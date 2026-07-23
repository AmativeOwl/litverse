#!/usr/bin/env node
/**
 * scripts/generate-scene-beats.ts
 *
 * OFFLINE, BUILD-TIME ONLY. This script is never imported by client code
 * and is not part of the Vite build (see CLAUDE.md: "No live AI generation
 * at runtime"). It is meant to be run by hand from a terminal, with an
 * Anthropic or OpenAI API key supplied via a local, gitignored `.env` —
 * never commit the key, never bundle this file into the deployed app.
 *
 * What it does:
 *   1. Reads a raw excerpt of chapter text from a plain .txt file on disk.
 *   2. Sends it to an LLM with a prompt asking for a first-draft
 *      `Passage` segmentation (Paragraph -> Sentence -> Word, matching
 *      `src/types.ts` exactly) plus a first-draft set of `SceneBeat` mood
 *      buckets (see PROMPT_INSTRUCTIONS below for the exact shape asked for).
 *   3. Validates the response is well-formed JSON with the expected top
 *      level shape, then writes it to disk under `scripts/output/` for a
 *      human to review and hand-tune (lighting/color/timing by eye, and to
 *      fix any segmentation mistakes) before copying the result into
 *      `src/data/gatsby-ch3.ts` / `src/data/scene-beats.json`.
 *
 * This script is intentionally:
 *   - NOT run as part of `npm run build`, `npm run dev`, or any CI step.
 *   - NOT included in either tsconfig project (see the `include` arrays in
 *     tsconfig.app.json / tsconfig.node.json), so it is not type-checked by
 *     `tsc -b` and does not affect the app's type-safety guarantees.
 *   - NOT run automatically by anything in this repo — nobody should invoke
 *     it without deliberately supplying their own API key.
 *
 * Usage (never actually run by an agent/CI on your behalf):
 *   npm run generate:beats -- --input scripts/input/ch3-opening.txt --out scripts/output/ch3-draft.json
 *
 * Reads ANTHROPIC_API_KEY / OPENAI_API_KEY from a local `.env` file at the
 * repo root (simple KEY=VALUE parser below, no dependency needed) or from
 * already-exported environment variables — either works.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  input: string
  out: string
  model?: string
  retries: number
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string, fallback?: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i !== -1 ? argv[i + 1] : fallback
  }

  const input = get('--input')
  const out = get('--out', 'scripts/output/scene-beats-draft.json') as string
  const model = get('--model')
  const retries = Number(get('--retries', '2'))

  if (!input) {
    console.error(
      'Usage: generate-scene-beats.ts --input <raw-chapter.txt> [--out <draft.json>] [--model <model-id>] [--retries <n>]',
    )
    process.exit(1)
  }

  return { input, out, model, retries: Number.isFinite(retries) ? retries : 2 }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Describes the exact output contract (mirrors src/types.ts) so the model's
 * JSON can be dropped in with minimal hand-editing. Kept in sync manually —
 * this script does not import src/types.ts (build-time isolation).
 */
const PROMPT_INSTRUCTIONS = `
You are helping segment a public-domain novel excerpt into structured JSON
for an interactive reading app. Given the raw excerpt text, produce JSON
with exactly this shape:

{
  "passage": {
    "id": "gatsby-ch3",
    "title": "Chapter 3",
    "paragraphs": [
      {
        "id": "p1",
        "sentences": [
          {
            "id": "p1-s1",
            "sceneBeatId": "<one of the sceneBeats ids below>",
            "speakerId": "<optional, only if this sentence is dialogue>",
            "words": [
              { "id": "p1-s1-w1", "text": "In", "normalized": "in" },
              { "id": "p1-s1-w2", "text": "his", "normalized": "his" }
            ]
          }
        ]
      }
    ]
  },
  "sceneBeats": [
    {
      "id": "arrival",
      "palette": { "background": "#hex", "primary": "#hex", "accent": "#hex", "fog": "#hex" },
      "lighting": { "ambientIntensity": 0.0, "keyLightIntensity": 0.0, "keyLightColor": "#hex", "bloomStrength": 0.0 },
      "particles": { "type": "bokeh|confetti|embers|dust|none", "density": 0, "speed": 0.0, "sizeRange": [0.0, 0.0] },
      "camera": { "behavior": "slow-orbit|static-drift|push-in|pull-back", "speed": 0.0, "fov": 0 },
      "transitionDurationMs": 0
    }
  ]
}

Rules:
- Split the excerpt into paragraphs exactly as they appear in the source.
- Split each paragraph into sentences using standard sentence boundaries.
- Split each sentence into words, preserving original casing/punctuation in
  "text" but stripping ALL punctuation and lowercasing in "normalized"
  (e.g. "Gatsby's" -> normalized "gatsbys", "moths." -> normalized "moths").
- Every id must be unique across the whole document.
- Assign each sentence's "sceneBeatId" to reflect the mood shift already
  present in the prose (e.g. quieter/dimmer beat for arrival description,
  brighter/denser/faster beat once the party reaches its peak). Vary it
  across paragraphs, not just once at the top.
- Propose 2-3 sceneBeats total, tuned for contrast (arrival vs. peak
  revelry), with plausible-looking but rough palette/lighting/particle/
  camera values. These are a FIRST DRAFT ONLY — a human will hand-tune every
  numeric/color value afterward by eye. Do not overthink precision.
- Output raw JSON only. No prose, no markdown code fences, no commentary.
`.trim()

function buildPrompt(rawExcerpt: string): string {
  return `${PROMPT_INSTRUCTIONS}\n\n---\nRAW EXCERPT:\n---\n${rawExcerpt}`
}

// ---------------------------------------------------------------------------
// LLM calls (Anthropic preferred if both keys are set, OpenAI otherwise) —
// offline only, never invoked from the deployed client.
// ---------------------------------------------------------------------------

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
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
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
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText} — ${await res.text()}`)
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenAI response contained no message content')
  return text
}

async function draftFromLLM(prompt: string, model: string | undefined): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return callAnthropic(prompt, model ?? 'claude-sonnet-4-5')
  if (process.env.OPENAI_API_KEY) return callOpenAI(prompt, model ?? 'gpt-4o')
  throw new Error('Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your local .env before running this script.')
}

// ---------------------------------------------------------------------------
// Response cleanup + validation
// ---------------------------------------------------------------------------

/** Strips ```json ... ``` / ``` ... ``` fences if the model added them despite being told not to. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenced?.[1] ?? trimmed
}

interface DraftShape {
  passage: { id: string; title: string; paragraphs: unknown[] }
  sceneBeats: { id: string }[]
}

function validateDraftShape(value: unknown): DraftShape {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Draft is not a JSON object')
  }
  const obj = value as Record<string, unknown>

  const passage = obj.passage as Record<string, unknown> | undefined
  if (!passage || typeof passage.id !== 'string' || typeof passage.title !== 'string') {
    throw new Error('Draft missing valid "passage.id" / "passage.title"')
  }
  if (!Array.isArray(passage.paragraphs) || passage.paragraphs.length === 0) {
    throw new Error('Draft "passage.paragraphs" missing or empty')
  }

  const sceneBeats = obj.sceneBeats
  if (!Array.isArray(sceneBeats) || sceneBeats.length === 0) {
    throw new Error('Draft "sceneBeats" missing or empty')
  }
  for (const beat of sceneBeats) {
    if (typeof (beat as { id?: unknown }).id !== 'string') {
      throw new Error('Every entry in "sceneBeats" needs a string "id"')
    }
  }

  return value as DraftShape
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const inputPath = resolve(args.input)
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`)
    process.exit(1)
  }

  const rawExcerpt = readFileSync(inputPath, 'utf8')
  const prompt = buildPrompt(rawExcerpt)

  let lastError: unknown
  for (let attempt = 1; attempt <= args.retries + 1; attempt++) {
    try {
      console.log(
        `[attempt ${attempt}/${args.retries + 1}] Sending ${rawExcerpt.length} characters to the LLM for a draft segmentation...`,
      )
      const rawText = await draftFromLLM(prompt, args.model)
      const cleaned = stripCodeFences(rawText)

      let parsed: unknown
      try {
        parsed = JSON.parse(cleaned)
      } catch (err) {
        throw new Error(`LLM response was not valid JSON: ${(err as Error).message}`)
      }

      const draft = validateDraftShape(parsed)

      const outPath = resolve(args.out)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, JSON.stringify(draft, null, 2))

      console.log(`Draft written to ${outPath}`)
      console.log('Reminder: this is a first draft. Hand-check every id for uniqueness, every')
      console.log('sceneBeatId cross-reference, and hand-tune all palette/lighting/particle/camera')
      console.log('values by eye before copying into src/data/gatsby-ch3.ts and scene-beats.json.')
      return
    } catch (err) {
      lastError = err
      console.warn(`Attempt ${attempt} failed: ${(err as Error).message}`)
    }
  }

  console.error(`All ${args.retries + 1} attempts failed. Last error:`)
  console.error(lastError)
  console.error('Falling back to hand-authoring is expected/fine — see CLAUDE.md: treat AI output as a first draft only.')
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
