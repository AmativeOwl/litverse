#!/usr/bin/env node
/**
 * scripts/calibrate-narration-timings.ts
 *
 * OFFLINE, BUILD-TIME ONLY. Re-aligns a narration manifest's word timings
 * against the RENDERED AUDIO's actual silence structure, treating the WAV
 * as ground truth.
 *
 * Why: HeadTTS's word timeline under-counts the pauses Kokoro actually
 * renders at heavy punctuation -- measured on gatsby-ch3's longest sentence
 * (p5-s3), the audio holds a 780ms pause at a semicolon where the manifest
 * records 232ms, plus a 640ms pause it doesn't record at all. Those
 * deficits accumulate so the voice runs >1s behind the word highlight by
 * the end of a 20s sentence ("the voice lags" -- user report). Short
 * sentences never build enough drift to notice.
 *
 * Method, per sentence: RMS-scan the WAV (20ms windows) for internal
 * silences >= MIN_SILENCE_MS; pair each with the nearest word boundary in
 * the (progressively shifted) manifest timeline; where the audio's silence
 * exceeds the manifest's inter-word gap by more than TOLERANCE_MS, shift
 * every later word by the deficit. Pairings farther than PAIR_WINDOW_MS
 * from any boundary are skipped (never guess). End times are clamped to
 * the clip duration. The manifest is rewritten in place; WAVs untouched.
 *
 * Usage: npx tsx scripts/calibrate-narration-timings.ts --passage <id>
 * Never imported by client code, never part of the Vite build/CI.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface WordTiming {
  wordId: string
  startMs: number
  endMs: number
}

interface ManifestEntry {
  audioUrl: string
  durationMs: number
  words: WordTiming[]
}

const MIN_SILENCE_MS = 240
const RMS_SILENCE_THRESHOLD = 120 // 16-bit PCM amplitude
const WINDOW_MS = 20
const PAIR_WINDOW_MS = 500
const TOLERANCE_MS = 80

function parseArgs(argv: string[]): string {
  const i = argv.indexOf('--passage')
  const id = i !== -1 ? argv[i + 1] : undefined
  if (!id) throw new Error('Usage: calibrate-narration-timings.ts --passage <id>')
  return id
}

/** Minimal PCM16 mono WAV reader for the files generate-narration-audio.ts writes (44-byte header). */
function readWavSamples(path: string): { samples: Int16Array; sampleRate: number } {
  const buf = readFileSync(path)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a RIFF/WAVE file`)
  }
  const sampleRate = buf.readUInt32LE(24)
  const bitsPerSample = buf.readUInt16LE(34)
  const channels = buf.readUInt16LE(22)
  if (bitsPerSample !== 16 || channels !== 1) {
    throw new Error(`${path}: expected 16-bit mono PCM, got ${bitsPerSample}-bit ${channels}ch`)
  }
  const data = buf.subarray(44)
  return { samples: new Int16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2)), sampleRate }
}

/** Internal silence spans (startMs, lengthMs), 20ms-RMS below threshold, leading/trailing spans excluded. */
function findSilences(samples: Int16Array, sampleRate: number): Array<{ startMs: number; lengthMs: number }> {
  const win = Math.floor((sampleRate * WINDOW_MS) / 1000)
  const spans: Array<{ startMs: number; lengthMs: number }> = []
  let quietStart: number | null = null
  const totalMs = (samples.length / sampleRate) * 1000
  for (let i = 0; i + win <= samples.length; i += win) {
    let sum = 0
    for (let j = i; j < i + win; j++) {
      const s = samples[j] ?? 0
      sum += s * s
    }
    const rms = Math.sqrt(sum / win)
    const t = (i / sampleRate) * 1000
    if (rms < RMS_SILENCE_THRESHOLD) {
      if (quietStart === null) quietStart = t
    } else if (quietStart !== null) {
      const len = t - quietStart
      // ignore leading silence (before speech) and collect the rest
      if (len >= MIN_SILENCE_MS && quietStart > 0) spans.push({ startMs: quietStart, lengthMs: len })
      quietStart = null
    }
  }
  // trailing silence (quietStart still open at end) is intentionally dropped
  void totalMs
  return spans
}

function calibrateSentence(entry: ManifestEntry, wavPath: string): { shiftedMs: number; applied: number } {
  const { samples, sampleRate } = readWavSamples(wavPath)
  const silences = findSilences(samples, sampleRate)
  const words = entry.words
  if (words.length < 2) return { shiftedMs: 0, applied: 0 }

  let applied = 0
  let totalShift = 0
  for (const silence of silences) {
    // pair with the word boundary whose gap START is nearest the silence start
    let best = -1
    let bestDist = Number.POSITIVE_INFINITY
    for (let i = 1; i < words.length; i++) {
      const prevEnd = words[i - 1]?.endMs ?? 0
      const dist = Math.abs(prevEnd - silence.startMs)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    if (best === -1 || bestDist > PAIR_WINDOW_MS) continue
    const prevEnd = words[best - 1]?.endMs ?? 0
    const nextStart = words[best]?.startMs ?? prevEnd
    const gap = Math.max(0, nextStart - prevEnd)
    const deficit = silence.lengthMs - gap
    if (deficit <= TOLERANCE_MS) continue
    for (let i = best; i < words.length; i++) {
      const w = words[i]
      if (!w) continue
      w.startMs = Math.round(w.startMs + deficit)
      w.endMs = Math.round(w.endMs + deficit)
    }
    totalShift += deficit
    applied++
  }
  // never let timings overrun the clip
  for (const w of words) {
    w.endMs = Math.min(w.endMs, entry.durationMs)
    w.startMs = Math.min(w.startMs, w.endMs)
  }
  return { shiftedMs: Math.round(totalShift), applied }
}

function main(): void {
  const passageId = parseArgs(process.argv.slice(2))
  const dir = resolve(__dirname, `../public/narration/${passageId}`)
  const manifestPath = resolve(dir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, ManifestEntry>

  let touched = 0
  for (const [sentenceId, entry] of Object.entries(manifest)) {
    const wavPath = resolve(dir, `${sentenceId}.wav`)
    const { shiftedMs, applied } = calibrateSentence(entry, wavPath)
    if (applied > 0) {
      touched++
      console.log(`  ${sentenceId}: ${applied} pause(s) reconciled, +${shiftedMs}ms total drift corrected`)
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Calibrated ${touched}/${Object.keys(manifest).length} sentences -> ${manifestPath}`)
}

main()
