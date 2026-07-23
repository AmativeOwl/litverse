#!/usr/bin/env node
/**
 * scripts/segment-passage.ts
 *
 * OFFLINE, BUILD-TIME ONLY, NO API CALLS. Deterministic replacement for the
 * segmentation half of generate-scene-beats.ts: paragraph/sentence/word
 * splitting is mechanical (blank lines, sentence-ending punctuation,
 * whitespace) and doesn't benefit from an LLM — this is plain code, so it
 * can't truncate, rate-limit, or produce malformed output. Scene-beat mood
 * assignment per sentence and the SceneBeat palette/lighting/particle/camera
 * values are still a human/creative call, done by hand in src/data/*.
 *
 * Usage:
 *   npx tsx scripts/segment-passage.ts --input scripts/input/ch3-opening.txt --out scripts/output/ch3-segmented.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

interface CliArgs {
  input: string
  out: string
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string, fallback?: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i !== -1 ? argv[i + 1] : fallback
  }
  const input = get('--input')
  const out = get('--out', 'scripts/output/segmented.json') as string
  if (!input) {
    console.error('Usage: segment-passage.ts --input <raw-chapter.txt> [--out <segmented.json>]')
    process.exit(1)
  }
  return { input, out }
}

interface SegWord {
  text: string
  normalized: string
}
interface SegSentence {
  text: string
  words: SegWord[]
}
interface SegParagraph {
  sentences: SegSentence[]
}

/** Splits raw text on blank lines into paragraphs, joining wrapped lines within each. */
function splitParagraphs(raw: string): string[] {
  return raw
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
}

/**
 * Splits a paragraph into sentences on '.', '!', '?' followed by whitespace
 * (or end of string), while NOT splitting on the common abbreviations below
 * or on ellipses. Good enough for clean 1920s prose; not a general-purpose
 * sentence splitter.
 */
function splitSentences(paragraph: string): string[] {
  const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'mt', 'jr', 'sr', 'vs', 'etc'])
  const sentences: string[] = []
  let current = ''

  const words = paragraph.split(/(\s+)/) // keep whitespace tokens so we can rejoin exactly
  for (let i = 0; i < words.length; i++) {
    const token = words[i]
    current += token
    if (!token) continue

    const endsSentence = /[.!?]["')]*$/.test(token) && !/\.\.\.$/.test(token)
    if (!endsSentence) continue

    const bareWord = token.replace(/[.!?"')]+$/, '').toLowerCase()
    if (ABBREVIATIONS.has(bareWord)) continue

    sentences.push(current.trim())
    current = ''
  }
  if (current.trim()) sentences.push(current.trim())
  return sentences.filter((s) => s.length > 0)
}

/** Tokenizes a sentence into words, dropping pure-punctuation tokens (em-dashes etc). */
function splitWords(sentence: string): SegWord[] {
  const raw = sentence.split(/\s+/).filter(Boolean)
  const words: SegWord[] = []
  for (const text of raw) {
    // Normalize: lowercase, strip everything except letters/digits/internal apostrophes.
    const normalized = text
      .toLowerCase()
      .replace(/[‘’]/g, "'") // curly quotes -> straight, so possessives survive
      .replace(/[^a-z0-9']/g, '')
      .replace(/^'+|'+$/g, '')
    if (!normalized) continue // pure punctuation (e.g. a standalone em-dash) — not a word
    words.push({ text, normalized })
  }
  return words
}

function segment(raw: string): SegParagraph[] {
  return splitParagraphs(raw).map((paragraphText) => ({
    sentences: splitSentences(paragraphText).map((sentenceText) => ({
      text: sentenceText,
      words: splitWords(sentenceText),
    })),
  }))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const inputPath = resolve(args.input)
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`)
    process.exit(1)
  }

  const raw = readFileSync(inputPath, 'utf8')
  const paragraphs = segment(raw)

  const wordCount = paragraphs.reduce(
    (sum, p) => sum + p.sentences.reduce((s, sent) => s + sent.words.length, 0),
    0,
  )
  const sentenceCount = paragraphs.reduce((sum, p) => sum + p.sentences.length, 0)
  console.log(
    `Segmented ${paragraphs.length} paragraphs, ${sentenceCount} sentences, ${wordCount} words.`,
  )

  const outPath = resolve(args.out)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(paragraphs, null, 2))
  console.log(`Written to ${outPath} — review sentence boundaries, then assign sceneBeatId per`)
  console.log('sentence and copy into src/data/gatsby-ch3.ts.')
}

main()
