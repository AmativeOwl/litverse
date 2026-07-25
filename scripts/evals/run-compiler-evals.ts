#!/usr/bin/env node
/**
 * scripts/evals/run-compiler-evals.ts — the compiler regression harness.
 *
 * OFFLINE, BUILD-TIME ONLY, keyed like its subject (generate-plate-specs.ts
 * reads the same gitignored .env). Never imported by client code, never part
 * of the Vite build or CI. Run it deliberately, when you change the
 * description-mining prompt or model, to answer: "what fraction of drafts
 * survive the deterministic gates, and how far do survivors sit from the
 * hand-approved finals?"
 *
 * Per run it invokes the real generator with --retries 0 (one attempt, so
 * raw structural failure is observable instead of hidden behind retries),
 * then pushes the draft through the eval layers:
 *
 *   structural  — the generator's own validateDraft gate (coverage, beat
 *                 consistency, no unknown/duplicated sentences); a nonzero
 *                 exit here means the draft never even parsed into shape.
 *   grammar     — every windows[].card obeys the CardSpec schema and the
 *                 CLOSED noun/verb lexicons (scripts/evals/validators.ts).
 *   laws        — table-driven compiler laws bound to the passage's own
 *                 prose (numeric fidelity, negation); N/A when the draft
 *                 skipped the law's sentence rather than drawing it wrong.
 *   proximity   — window-choice overlap vs the shipped, hand-approved
 *                 registry: of the sentences the human gave windows, how
 *                 many did the draft also pick (recall), and how much extra
 *                 did it propose (the hand-tuning burden proxy).
 *
 * Usage:
 *   npx tsx scripts/evals/run-compiler-evals.ts [--runs 3] [--model <id>] [--keep]
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

import { gatsbyCh3 } from '../../src/data/gatsby-ch3'
import { GATSBY_PLATES } from '../../src/data/plates/gatsby-ch3'
import type { CardSpec } from '../../src/types-plates'
import { applyLaw, findSentenceIdByText, validateCardSpec, type CompilerLaw, type EvalIssue } from './validators'

interface DraftWindow {
  id: string
  sentenceIds: string[]
  beatId: string
  subject?: string
  sourcePhrases?: string[]
  card?: CardSpec
}
interface Draft {
  windows: DraftWindow[]
  skipped: { sentenceIds: string[]; reason: string }[]
  alreadyCovered: string[]
}

// --- the gatsby law table, self-bound to the prose --------------------------

interface LawCase {
  name: string
  pattern: RegExp
  law: CompilerLaw
}

const GATSBY_LAWS: LawCase[] = [
  { name: 'eight-servants', pattern: /eight servants/i, law: { kind: 'exact-count', noun: 'figure', n: 8 } },
  { name: 'two-motorboats', pattern: /two motor-?boats/i, law: { kind: 'exact-count', noun: 'boat', n: 2 } },
  // "no thin five-piece affair, but a whole pitful": never the denied five,
  // and emphatically more (the shipped registry renders eleven)
  { name: 'pitful-not-five', pattern: /no thin five-piece affair/i, law: { kind: 'forbidden-count', noun: 'figure', n: 5 } },
  { name: 'pitful-abundance', pattern: /no thin five-piece affair/i, law: { kind: 'min-count', noun: 'figure', n: 8 } },
]

// --- CLI ---------------------------------------------------------------------

const argv = process.argv.slice(2)
const get = (flag: string, fallback?: string) => {
  const i = argv.indexOf(flag)
  return i !== -1 ? argv[i + 1] : fallback
}
const RUNS = Number(get('--runs', '3'))
const MODEL = get('--model')
const KEEP = argv.includes('--keep')
const OUT_DIR = resolve(process.cwd(), 'scripts/output/evals')

interface RunResult {
  run: number
  structural: boolean
  structuralError?: string
  grammarIssues: EvalIssue[]
  lawResults: { name: string; status: 'pass' | 'fail' | 'n/a'; detail?: string }[]
  windowCount?: number
  recall?: number
  extraWindows?: number
}

function shippedWindowSentences(): Set<string> {
  const ids = new Set<string>()
  for (const window of GATSBY_PLATES.windows ?? []) for (const id of window.sentenceIds) ids.add(id)
  return ids
}

function evaluateDraft(draft: Draft): Omit<RunResult, 'run' | 'structural'> {
  const grammarIssues: EvalIssue[] = []
  for (const window of draft.windows) {
    if (!window.card) {
      grammarIssues.push({ check: 'schema', detail: `window ${window.id}: draft has no card (grammar output missing)` })
      continue
    }
    grammarIssues.push(...validateCardSpec(window.card, `window ${window.id}`))
  }

  const lawResults: RunResult['lawResults'] = []
  for (const lawCase of GATSBY_LAWS) {
    const sentenceId = findSentenceIdByText(gatsbyCh3, lawCase.pattern)
    if (!sentenceId) {
      lawResults.push({ name: lawCase.name, status: 'n/a', detail: 'law prose not found in passage (table stale?)' })
      continue
    }
    const window = draft.windows.find((w) => w.sentenceIds.includes(sentenceId))
    if (!window?.card) {
      lawResults.push({ name: lawCase.name, status: 'n/a', detail: `draft did not draw ${sentenceId}` })
      continue
    }
    const issues = applyLaw(lawCase.law, window.card, `window ${window.id}`)
    lawResults.push(
      issues.length === 0
        ? { name: lawCase.name, status: 'pass' }
        : { name: lawCase.name, status: 'fail', detail: issues.map((i) => i.detail).join('; ') },
    )
  }

  const shipped = shippedWindowSentences()
  const draftPicked = new Set(draft.windows.flatMap((w) => w.sentenceIds))
  const overlap = [...shipped].filter((id) => draftPicked.has(id)).length
  return {
    grammarIssues,
    lawResults,
    windowCount: draft.windows.length,
    recall: shipped.size > 0 ? overlap / shipped.size : 1,
    extraWindows: [...draftPicked].filter((id) => !shipped.has(id)).length,
  }
}

function main(): void {
  if (!Number.isInteger(RUNS) || RUNS < 1) throw new Error(`--runs must be a positive integer, got ${RUNS}`)
  mkdirSync(OUT_DIR, { recursive: true })

  const results: RunResult[] = []
  for (let run = 1; run <= RUNS; run++) {
    const outPath = resolve(OUT_DIR, `draft-${run}.json`)
    if (existsSync(outPath)) rmSync(outPath)
    console.log(`\n=== run ${run}/${RUNS} ===`)
    // --ignore-covered: from-scratch mode, so the draft may re-pick sentences
    // the shipped registry drew -- that overlap is exactly what `recall`
    // measures (without it, shipped windows sit in alreadyCovered and recall
    // is definitionally ~0, as the first harness run demonstrated).
    const generatorArgs = ['tsx', 'scripts/generate-plate-specs.ts', '--retries', '0', '--ignore-covered', '--out', outPath]
    if (MODEL) generatorArgs.push('--model', MODEL)
    let structural = true
    let structuralError: string | undefined
    try {
      execFileSync('npx', generatorArgs, { stdio: ['ignore', 'inherit', 'inherit'], shell: true })
    } catch (error) {
      structural = false
      structuralError = error instanceof Error ? error.message : String(error)
    }
    if (!structural || !existsSync(outPath)) {
      results.push({ run, structural: false, structuralError, grammarIssues: [], lawResults: [] })
      continue
    }
    const draft = JSON.parse(readFileSync(outPath, 'utf8')) as Draft
    results.push({ run, structural: true, ...evaluateDraft(draft) })
    if (!KEEP) rmSync(outPath)
  }

  // --- report ---------------------------------------------------------------
  console.log('\n================ EVAL REPORT ================')
  const structuralPasses = results.filter((r) => r.structural).length
  console.log(`structural (generator's own gate): ${structuralPasses}/${RUNS}`)

  for (const result of results) {
    if (!result.structural) {
      console.log(`  run ${result.run}: STRUCTURAL FAIL`)
      continue
    }
    const lawSummary = result.lawResults.map((l) => `${l.name}:${l.status}`).join(' ')
    console.log(
      `  run ${result.run}: ${result.windowCount} windows | grammar issues: ${result.grammarIssues.length} | ` +
        `recall vs shipped: ${((result.recall ?? 0) * 100).toFixed(0)}% | extra sentences drawn: ${result.extraWindows} | ${lawSummary}`,
    )
    for (const issue of result.grammarIssues.slice(0, 8)) console.log(`      [${issue.check}] ${issue.detail}`)
    if (result.grammarIssues.length > 8) console.log(`      ... ${result.grammarIssues.length - 8} more`)
    for (const law of result.lawResults) if (law.status === 'fail') console.log(`      [LAW ${law.name}] ${law.detail}`)
  }

  const survived = results.filter(
    (r) => r.structural && r.grammarIssues.length === 0 && r.lawResults.every((l) => l.status !== 'fail'),
  ).length
  console.log(`\nfully clean drafts (structural + grammar + laws): ${survived}/${RUNS}`)
  console.log('=============================================')
}

main()
