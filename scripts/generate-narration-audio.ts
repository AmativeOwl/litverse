#!/usr/bin/env node
/**
 * scripts/generate-narration-audio.ts
 *
 * OFFLINE, BUILD-TIME ONLY. Pre-renders one WAV file + a word-level timing
 * manifest per sentence of the real Chapter 3 passage, using Kokoro-82M (an
 * open-weight, Apache-2.0 TTS model) via the synthesis worker bundled with
 * the `@met4citizen/headtts` package.
 *
 * Why this exists instead of using Web Speech API at runtime: browser TTS
 * voices sound noticeably robotic. Kokoro sounds much closer to human, but
 * running it live in the browser (or hitting a hosted API for it) would
 * violate the "no live AI generation at runtime" rule and reintroduce
 * network-dependency fragility into the deployed app. So instead this
 * generates the audio + timing data ONCE, offline, and the result is
 * committed as static assets that ship in the Vite build — narrationController
 * then just plays pre-rendered <audio> files, with zero network calls and
 * zero AI inference at runtime.
 *
 * Model/inference: 100% CPU (`device: "cpu"`, ONNX Runtime's bundled
 * win32/x64 native binary), no GPU, no account, no API key. The `af_bella`
 * voice style file is downloaded once to scripts/tts-voices/ (gitignored --
 * a large binary, redownloadable on demand, same treatment as
 * scripts/output/).
 *
 * `@met4citizen/headtts` has no first-class "just synthesize once" API --
 * it's built around a persistent WebSocket/REST server (headtts-node.mjs)
 * or a Worker-based browser client (headtts.mjs). Rather than re-deriving
 * its phoneme-to-timestamp math by hand (real risk of a subtle transcription
 * bug), this drives the package's own worker-tts.mjs directly via
 * node:worker_threads -- the exact same, already-correct synthesis code the
 * bundled server uses, just without the HTTP/WebSocket layer wrapped around it.
 *
 * Usage: npm run generate:narration
 * Never imported by client code, never part of the Vite build/CI.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

import { gatsbyCh3 } from '../src/data/gatsby-ch3.ts'
import type { Sentence } from '../src/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX-timestamped'
const VOICE_NAME = 'af_bella'
const VOICE_PATH = resolve(__dirname, 'tts-voices')
const DICTIONARY_PATH = resolve(__dirname, '../node_modules/@met4citizen/headtts/dictionaries')
const WORKER_PATH = resolve(__dirname, '../node_modules/@met4citizen/headtts/modules/worker-tts.mjs')
const OUT_DIR = resolve(__dirname, '../public/narration/gatsby-ch3')
const SAMPLE_RATE = 24000

interface TtsMetadata {
  words: string[]
  wtimes: number[]
  wdurations: number[]
  audio: ArrayBuffer
  audioEncoding: string
}

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

function flattenSentences(): Sentence[] {
  return gatsbyCh3.paragraphs.flatMap((p) => p.sentences)
}

/** Concatenates a sentence's original (non-normalized) word text with single spaces -- natural punctuation/casing intact, which the phonemizer needs for correct prosody. */
function buildSentenceText(sentence: Sentence): string {
  return sentence.words.map((w) => w.text).join(' ')
}

/**
 * Normalizes a word for comparison: lowercase, strip everything except
 * letters/digits/internal apostrophes. Mirrors the normalization already
 * used when authoring gatsby-ch3.ts (see scripts/segment-passage.ts).
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9']/g, '')
    .replace(/^'+|'+$/g, '')
}

/**
 * Total playable duration of a 16-bit-PCM mono WAV buffer written by
 * HeadTTS's utils.encodeAudio (standard 44-byte header, 2 bytes/sample).
 */
function wavDurationMs(audio: ArrayBuffer, sampleRate: number): number {
  const dataBytes = audio.byteLength - 44
  const totalSamples = dataBytes / 2
  return (totalSamples / sampleRate) * 1000
}

/**
 * Aligns HeadTTS's own word-splitting output against this sentence's
 * already-tokenized `words[]` array by normalized text, not just position --
 * a strict equality check rather than assuming the two tokenizers always
 * agree. Returns null (caller must treat as a hard failure, not silently
 * mis-map) if the sequences don't match exactly.
 *
 * Known upstream quirk: worker-tts.mjs's updateTimestamps() occasionally
 * reads one index past the end of its internal per-frame `times` array when
 * computing a word's end boundary -- observed specifically on a sentence's
 * final word, producing `wdurations[i] = NaN` (which JSON.stringify then
 * silently serializes as `null`, a much easier failure to miss downstream).
 * Rather than patch node_modules or re-derive the frame math ourselves
 * (real risk of introducing a different bug), any NaN end time here falls
 * back to the sentence's actual total audio duration -- a safe, always-
 * correct upper bound for where the last word's speech actually ends.
 */
function alignWordTimings(
  sentence: Sentence,
  metadata: TtsMetadata,
  totalDurationMs: number,
): WordTiming[] | null {
  if (metadata.words.length !== sentence.words.length) return null

  const timings: WordTiming[] = []
  for (let i = 0; i < sentence.words.length; i++) {
    const ours = sentence.words[i]
    const theirs = metadata.words[i]
    if (!ours || theirs === undefined) return null
    if (normalizeForComparison(theirs) !== ours.normalized) return null

    const start = metadata.wtimes[i] ?? 0
    if (Number.isNaN(start)) return null // no sane fallback for a NaN start

    const duration = metadata.wdurations[i] ?? 0
    const end = Number.isNaN(duration) ? totalDurationMs : start + duration
    timings.push({ wordId: ours.id, startMs: start, endMs: Math.max(start, end) })
  }
  return timings
}

/** Minimal WAV header rewrite of the sample rate is unnecessary -- HeadTTS's encodeAudio already writes a correct self-contained WAV file. */
function writeWav(path: string, audio: ArrayBuffer): void {
  writeFileSync(path, Buffer.from(audio))
}

async function synthesizeSentence(
  worker: Worker,
  text: string,
): Promise<{ metadata: TtsMetadata }> {
  return new Promise((resolveResult, reject) => {
    const onMessage = (message: { type: string; data: unknown }) => {
      if (message.type === 'audio') {
        worker.off('message', onMessage)
        resolveResult({ metadata: message.data as TtsMetadata })
      } else if (message.type === 'error') {
        worker.off('message', onMessage)
        reject(new Error(`HeadTTS worker error: ${JSON.stringify(message.data)}`))
      }
    }
    worker.on('message', onMessage)
    worker.postMessage({
      type: 'synthesize',
      id: 1,
      data: {
        input: text,
        voice: VOICE_NAME,
        language: 'en-us',
        speed: 1,
        audioEncoding: 'wav',
      },
    })
  })
}

function waitForReady(worker: Worker): Promise<void> {
  return new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for HeadTTS worker to load the model (5 min).'))
    }, 300_000)
    const onMessage = (message: { type: string }) => {
      if (message.type === 'ready') {
        clearTimeout(timeout)
        worker.off('message', onMessage)
        resolveReady()
      }
    }
    worker.on('message', onMessage)
  })
}

async function main() {
  if (!existsSync(resolve(VOICE_PATH, `${VOICE_NAME}.bin`))) {
    console.error(
      `Voice file not found: ${resolve(VOICE_PATH, `${VOICE_NAME}.bin`)}\n` +
        `Download it first, e.g.:\n` +
        `  curl -L -o scripts/tts-voices/${VOICE_NAME}.bin https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${VOICE_NAME}.bin`,
    )
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Loading model "${MODEL_ID}" (CPU) -- this can take a while on first run...`)
  const worker = new Worker(WORKER_PATH, { type: 'module' })
  worker.on('error', (error) => {
    console.error('HeadTTS worker crashed:', error)
    process.exit(1)
  })

  const readyPromise = waitForReady(worker)
  worker.postMessage({
    type: 'connect',
    data: {
      transformersModule: '@huggingface/transformers',
      model: MODEL_ID,
      dtype: 'fp32',
      device: 'cpu',
      styleDim: 256,
      frameRate: 40,
      audioSampleRate: SAMPLE_RATE,
      languages: ['en-us'],
      dictionaryPath: DICTIONARY_PATH,
      voicePath: VOICE_PATH,
      voices: [VOICE_NAME],
      deltaStart: -10,
      deltaEnd: 0,
      trace: 0,
    },
  })
  await readyPromise
  console.log('Model loaded. Synthesizing sentences...')

  const sentences = flattenSentences()
  const manifest: Record<string, ManifestEntry> = {}
  const failures: string[] = []

  for (const sentence of sentences) {
    const text = buildSentenceText(sentence)
    const { metadata } = await synthesizeSentence(worker, text)
    const audioDurationMs = wavDurationMs(metadata.audio, SAMPLE_RATE)

    const words = alignWordTimings(sentence, metadata, audioDurationMs)
    if (!words) {
      failures.push(
        `${sentence.id}: word-count/text mismatch (ours=${sentence.words.length}, theirs=${metadata.words.length}). ` +
          `ours=[${sentence.words.map((w) => w.normalized).join(' ')}] theirs=[${metadata.words.join(' ')}]`,
      )
      continue
    }

    const audioFileName = `${sentence.id}.wav`
    writeWav(resolve(OUT_DIR, audioFileName), metadata.audio)

    manifest[sentence.id] = {
      audioUrl: `/narration/gatsby-ch3/${audioFileName}`,
      durationMs: Math.round(audioDurationMs),
      words,
    }
    console.log(`  ${sentence.id}: OK (${words.length} words, ${Math.round(audioDurationMs)}ms)`)
  }

  worker.terminate()

  if (failures.length > 0) {
    console.error(`\n${failures.length} sentence(s) failed word-alignment and were NOT written:`)
    failures.forEach((f) => console.error(`  - ${f}`))
  }

  const manifestPath = resolve(OUT_DIR, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(
    `\nWrote ${Object.keys(manifest).length}/${sentences.length} sentences to ${OUT_DIR}\nManifest: ${manifestPath}`,
  )

  if (failures.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
