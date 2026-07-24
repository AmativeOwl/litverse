#!/usr/bin/env node
/**
 * scripts/generate-plate-specs.ts — the "description mining" pass of the
 * reading compiler (see CLAUDE.md: "Reading compiler + landing page").
 *
 * OFFLINE, BUILD-TIME ONLY. This script is never imported by client code
 * and is not part of the Vite build (see CLAUDE.md: "No live AI generation
 * at runtime"). It is meant to be run by hand from a terminal, with an
 * Anthropic or OpenAI API key supplied via a local, gitignored `.env` —
 * never commit the key, never bundle this file into the deployed app.
 *
 * What it does:
 *   1. Loads the segmented passage (sentence ids + text + beat assignments)
 *      and the current plate registry (which sentences already have
 *      windows).
 *   2. Sends the full sentence inventory to an LLM asking it to sweep EVERY
 *      sentence for concrete, visualizable imagery and emit first-draft
 *      window/plate composition specs — subjects, concrete elements from
 *      the text, a layout sketch, and suggested decoPlateKit helpers —
 *      plus an explicit "skipped" list (with reasons) for sentences with
 *      no paintable subject. This systematically closes the "description
 *      gaps" that hand-picking windows left.
 *   3. Validates the response (real sentence ids, beat-consistent, unique,
 *      no silent omissions: every sentence must appear in exactly one of
 *      windows/skipped/alreadyCovered), then writes it to
 *      `scripts/output/` for a human to review and hand-tune before any of
 *      it becomes paint functions in `src/data/plates/<sceneId>.ts`.
 *
 * This script is intentionally:
 *   - NOT run as part of `npm run build`, `npm run dev`, or any CI step.
 *   - NOT included in either tsconfig project.
 *   - NOT run automatically by anything in this repo — nobody should invoke
 *     it without deliberately supplying their own API key.
 *
 * Usage (never actually run by an agent/CI on your behalf):
 *   npm run generate:plates -- [--out scripts/output/plate-specs-draft.json] [--model <id>] [--retries <n>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { gatsbyCh3 } from '../src/data/gatsby-ch3.ts'
import { GATSBY_PLATES } from '../src/data/plates/gatsby-ch3.ts'

// ---------------------------------------------------------------------------
// Minimal .env loader (KEY=VALUE per line, '#' comments, no interpolation).
// Doesn't override variables already present in process.env.
// ---------------------------------------------------------------------------

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnv(resolve(process.cwd(), '.env'))

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface CliArgs {
  out: string
  model?: string
  retries: number
  /** Build + validate the inventory and prompt, write the prompt to disk, and exit WITHOUT any API call. */
  dryRun: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string, fallback?: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i !== -1 ? argv[i + 1] : fallback
  }
  const out = get('--out', 'scripts/output/plate-specs-draft.json') as string
  const model = get('--model')
  const retries = Number(get('--retries', '2'))
  const dryRun = argv.includes('--dry-run')
  return { out, model, retries: Number.isFinite(retries) ? retries : 2, dryRun }
}

// ---------------------------------------------------------------------------
// Sentence inventory from the segmented passage + current coverage
// ---------------------------------------------------------------------------

interface SentenceRow {
  id: string
  beatId: string
  text: string
}

function buildSentenceInventory(): SentenceRow[] {
  return gatsbyCh3.paragraphs.flatMap((paragraph) =>
    paragraph.sentences.map((sentence) => ({
      id: sentence.id,
      beatId: sentence.sceneBeatId,
      text: sentence.words.map((word) => word.text).join(' '),
    })),
  )
}

function coveredSentenceIds(): Set<string> {
  const covered = new Set<string>()
  for (const window of GATSBY_PLATES.windows ?? []) {
    for (const id of window.sentenceIds) covered.add(id)
  }
  return covered
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/** Kit vocabulary the model may reference in suggestions -- kept in sync by hand with world/decoPlateKit.ts. */
const KIT_HELPERS = [
  'drawBandedSky',
  'drawSunburst',
  'drawZigguratTower',
  'drawWindows',
  'drawDecoFrame',
  'withMirrorSymmetry',
  "drawSilhouetteFigure (poses: 'stand'|'dance'|'serve'|'mop'|'horn')",
  'drawCarProfile',
  'drawBeamCone',
  'drawStringDots',
  'drawWaveBand',
  'drawFruitPyramid',
  'drawGlazedHam',
  'drawTurkey',
  'drawPastryRow',
  'drawJuiceMachine',
  'mixHex / lightenHex / darkenHex / fogTintHex',
] as const

function buildPrompt(
  rows: SentenceRow[],
  covered: Set<string>,
  azimuthByBeat: Record<string, number>,
): string {
  const inventory = rows
    .map(
      (row) =>
        `${row.id} [beat: ${row.beatId}]${covered.has(row.id) ? ' [ALREADY COVERED]' : ''}: ${row.text}`,
    )
    .join('\n')

  return `
You are the "description mining" pass of a reading-experience compiler for an
interactive book app. The right pane of the app shows flat Art-Deco painted
plates (geometric poster style: flat color fields, mirrored symmetry,
sunburst/fan ornament, stepped ziggurats, flat silhouette figures, ruled
gold linework) that crossfade as narration reaches each sentence.

Below is the complete sentence inventory of the passage, one per line:
"<sentenceId> [beat: <beatId>]: <text>". Some are marked [ALREADY COVERED]
by an existing window.

Your job: sweep EVERY sentence and decide, for each, whether it contains
concrete, paintable imagery deserving its own picture ("window"). Then emit
JSON with exactly this shape (raw JSON only — no prose, no code fences):

{
  "windows": [
    {
      "id": "w-<short-kebab-slug>",
      "sentenceIds": ["<sentenceId>"],
      "beatId": "<the sentences' beatId>",
      "subject": "<3-8 word title of the picture>",
      "elements": ["<concrete noun phrases taken from the text itself>"],
      "composition": "<one sentence: what is where — center/left/right, foreground/background, mirrored or not>",
      "kitHelpers": ["<names from the helper list below>"]
    }
  ],
  "skipped": [
    { "sentenceIds": ["<sentenceId>"], "reason": "<why no dedicated picture: abstract, transitional, already the beat plate's subject, etc.>" }
  ],
  "alreadyCovered": ["<sentenceId>", ...]
}

Rules:
- EVERY sentence id from the inventory must appear in exactly one of
  windows[].sentenceIds, skipped[].sentenceIds, or alreadyCovered.
  [ALREADY COVERED] sentences go in alreadyCovered verbatim.
- One sentence per window by default (a long sentence is ~3-4 rendered
  lines in the app). Merge two ADJACENT sentences into one window only if
  they are short and share one subject. Never merge across beats.
- "beatId" must be the beat of the window's sentences (given in the
  inventory) — the camera faces that beat's sector while they narrate.
- "elements" must quote concrete nouns/images from the sentence text, not
  inventions. Prefer the vivid specifics (e.g. "shawls beyond the dreams of
  Castile", "cataracts of foam") over generic props.
- Skip genuinely unpaintable sentences rather than forcing weak windows —
  but be greedy about imagery: this pass exists because hand-picking missed
  things. Mood-only sentences whose imagery the beat plate already shows
  should be skipped with that reason.
- These are FIRST DRAFTS for a human to hand-tune into procedural canvas
  paint functions. Do not overthink precision.

Available drawing-kit helpers (suggest from these; new helpers are allowed
but mark them "NEW:"):
${KIT_HELPERS.map((helper) => `- ${helper}`).join('\n')}

Beat camera sectors (degrees), for context only: ${JSON.stringify(azimuthByBeat)}

---
SENTENCE INVENTORY:
---
${inventory}
`.trim()
}

// ---------------------------------------------------------------------------
// LLM calls (Anthropic preferred if both keys are set, OpenAI otherwise) —
// offline only, never invoked from the deployed client.
// ---------------------------------------------------------------------------

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5'
const DEFAULT_OPENAI_MODEL = 'gpt-4o'

async function callAnthropic(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${res.statusText} — ${await res.text()}`)
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  const text = data.content?.find((block) => block.type === 'text')?.text
  if (!text) throw new Error('Anthropic response contained no text block')
  return text
}

async function callOpenAI(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText} — ${await res.text()}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenAI response contained no content')
  return text
}

async function callLlm(prompt: string, modelOverride?: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropic(prompt, modelOverride ?? DEFAULT_ANTHROPIC_MODEL)
  }
  if (process.env.OPENAI_API_KEY) {
    return callOpenAI(prompt, modelOverride ?? DEFAULT_OPENAI_MODEL)
  }
  throw new Error('Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set (checked env and ./.env)')
}

// ---------------------------------------------------------------------------
// Validation — loud failures over silent gaps, per house doctrine
// ---------------------------------------------------------------------------

interface DraftWindow {
  id: string
  sentenceIds: string[]
  beatId: string
  subject: string
  elements: string[]
  composition: string
  kitHelpers: string[]
}

interface Draft {
  windows: DraftWindow[]
  skipped: { sentenceIds: string[]; reason: string }[]
  alreadyCovered: string[]
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed)
  return fenced?.[1] ?? trimmed
}

function validateDraft(raw: string, rows: SentenceRow[], covered: Set<string>): Draft {
  const parsed = JSON.parse(stripCodeFences(raw)) as Draft
  if (!Array.isArray(parsed.windows) || !Array.isArray(parsed.skipped) || !Array.isArray(parsed.alreadyCovered)) {
    throw new Error('Draft missing windows/skipped/alreadyCovered arrays')
  }

  const beatBySentence = new Map(rows.map((row) => [row.id, row.beatId]))
  const seen = new Map<string, string>() // sentenceId -> which bucket

  const claim = (sentenceId: string, bucket: string) => {
    if (!beatBySentence.has(sentenceId)) throw new Error(`Unknown sentence id: ${sentenceId} (${bucket})`)
    const prior = seen.get(sentenceId)
    if (prior) throw new Error(`Sentence ${sentenceId} appears in both ${prior} and ${bucket}`)
    seen.set(sentenceId, bucket)
  }

  const windowIds = new Set<string>()
  for (const window of parsed.windows) {
    if (!window.id || windowIds.has(window.id)) throw new Error(`Missing/duplicate window id: ${window.id}`)
    windowIds.add(window.id)
    if (!window.sentenceIds?.length) throw new Error(`Window ${window.id} has no sentences`)
    for (const sentenceId of window.sentenceIds) {
      claim(sentenceId, `window ${window.id}`)
      const beat = beatBySentence.get(sentenceId)
      if (beat !== window.beatId) {
        throw new Error(`Window ${window.id}: sentence ${sentenceId} is beat ${beat}, window says ${window.beatId}`)
      }
    }
  }
  for (const entry of parsed.skipped) {
    for (const sentenceId of entry.sentenceIds ?? []) claim(sentenceId, 'skipped')
  }
  for (const sentenceId of parsed.alreadyCovered) {
    claim(sentenceId, 'alreadyCovered')
    if (!covered.has(sentenceId)) {
      throw new Error(`Sentence ${sentenceId} listed alreadyCovered but has no existing window`)
    }
  }

  const missing = rows.filter((row) => !seen.has(row.id)).map((row) => row.id)
  if (missing.length > 0) {
    throw new Error(`Sentences unaccounted for (the whole point is no gaps): ${missing.join(', ')}`)
  }
  return parsed
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const rows = buildSentenceInventory()
  const covered = coveredSentenceIds()
  const prompt = buildPrompt(rows, covered, GATSBY_PLATES.cameraAzimuthDeg)

  console.log(
    `Mining ${rows.length} sentences (${covered.size} already covered) for plate specs...`,
  )

  if (args.dryRun) {
    const promptPath = resolve(process.cwd(), 'scripts/output/plate-specs-prompt.txt')
    mkdirSync(dirname(promptPath), { recursive: true })
    writeFileSync(promptPath, prompt, 'utf8')
    console.log(`Dry run: no API call made. Prompt written to scripts/output/plate-specs-prompt.txt`)
    return
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= args.retries; attempt++) {
    try {
      const raw = await callLlm(prompt, args.model)
      const draft = validateDraft(raw, rows, covered)
      const outPath = resolve(process.cwd(), args.out)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, JSON.stringify(draft, null, 2), 'utf8')
      console.log(
        `OK: ${draft.windows.length} windows, ${draft.skipped.length} skip groups, ` +
          `${draft.alreadyCovered.length} already covered -> ${args.out}`,
      )
      console.log('This is a FIRST DRAFT. Review + hand-tune before turning any of it into paint functions.')
      return
    } catch (error) {
      lastError = error
      console.warn(`Attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : error}`)
    }
  }
  console.error('All attempts failed.')
  console.error(lastError)
  process.exit(1)
}

void main()
