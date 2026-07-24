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
 * win32/x64 native binary), no GPU, no account, no API key. The `af_sky`
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
 * Text->phoneme step: HeadTTS's own built-in dictionary lookup only ever
 * reads a word's *first* listed pronunciation (see language.mjs's
 * addToDictionary), so it has no notion of context -- a word like "was"
 * always comes out in its emphatic/standalone form, even mid-sentence as an
 * unstressed function word ("There was music..."). This script instead
 * shells out to scripts/misaki_g2p.py, which runs Misaki (the G2P engine
 * Kokoro was actually trained against) to get real contextual phonemes, and
 * feeds those to the worker directly via its `phonetic` input-item type --
 * bypassing HeadTTS's weaker dictionary phonemizer entirely while still
 * using its (already-correct) audio synthesis and word-timing extraction.
 * See misaki_g2p.py's own header for the GPL-avoidance rationale and setup.
 *
 * Usage: npm run generate:narration
 * Never imported by client code, never part of the Vite build/CI.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

import { gatsbyCh3 } from '../src/data/gatsby-ch3.ts'
import type { Sentence } from '../src/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Trial mode: renders a small fixed subset of sentences to a scratch folder
 * under scripts/output/voice-trials/ instead of the real manifest/public
 * output, so a human can A/B different voice/speed combinations before
 * committing to new defaults. Enabled by passing --voice and/or --speed
 * and/or --trial on the CLI; normal (no-args) invocation is unchanged.
 *
 * Usage: npx tsx scripts/generate-narration-audio.ts --voice af_sky --speed 1.1
 */
interface CliArgs {
  voice?: string
  speed?: number
  trial: boolean
}

function parseCliArgs(argv: string[]): CliArgs {
  let voice: string | undefined
  let speed: number | undefined
  let trialFlag = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--voice') {
      voice = argv[++i]
    } else if (arg === '--speed') {
      const raw = argv[++i]
      const parsed = raw === undefined ? NaN : Number(raw)
      if (Number.isNaN(parsed)) {
        throw new Error(`--speed requires a numeric argument, got: ${raw}`)
      }
      speed = parsed
    } else if (arg === '--trial') {
      trialFlag = true
    }
  }
  return { voice, speed, trial: trialFlag || voice !== undefined || speed !== undefined }
}

const cliArgs = parseCliArgs(process.argv.slice(2))
const IS_TRIAL = cliArgs.trial

/** Small fixed subset for trial mode: a mix of short-word and long/multisyllabic-word sentences. */
const TRIAL_SENTENCE_IDS = ['p1-s1', 'p3-s1', 'p4-s3']

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX-timestamped'
const VOICE_NAME = cliArgs.voice ?? 'af_sky'
const SPEED = cliArgs.speed ?? 1
const VOICE_PATH = resolve(__dirname, 'tts-voices')
const DICTIONARY_PATH = resolve(__dirname, '../node_modules/@met4citizen/headtts/dictionaries')
const WORKER_PATH = resolve(__dirname, '../node_modules/@met4citizen/headtts/modules/worker-tts.mjs')
const MISAKI_BRIDGE_PATH = resolve(__dirname, 'misaki_g2p.py')
const PYTHON_BIN = process.env.PYTHON_BIN ?? 'python3'
const OUT_DIR = IS_TRIAL
  ? resolve(__dirname, `output/voice-trials/${VOICE_NAME}-${SPEED}`)
  : resolve(__dirname, '../public/narration/gatsby-ch3')
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

interface PhoneticInputItem {
  type: 'phonetic'
  value: string
  subtitles: string
}

interface MisakiToken {
  text: string
  phonemes: string | null
}

function flattenSentences(): Sentence[] {
  const all = gatsbyCh3.paragraphs.flatMap((p) => p.sentences)
  if (!IS_TRIAL) return all

  const bySentenceId = new Map(all.map((s) => [s.id, s]))
  return TRIAL_SENTENCE_IDS.map((id) => bySentenceId.get(id)).filter((s): s is Sentence => s !== undefined)
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
function alignWordTimings(sentence: Sentence, metadata: TtsMetadata, totalDurationMs: number): WordTiming[] | null {
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

/**
 * Runs scripts/misaki_g2p.py once for every sentence's natural-language text
 * (a single process/model-load, not one per sentence -- spaCy's POS-tagger
 * load dominates startup cost). Returns Misaki's token stream per sentence
 * id. Throws if the bridge reports any word it couldn't phonemize (see the
 * script's own "hard failure over silent mis-map" rationale).
 */
function runMisakiBridge(sentences: Sentence[]): Map<string, MisakiToken[]> {
  const payload = JSON.stringify({
    sentences: sentences.map((s) => ({ id: s.id, text: buildSentenceText(s) })),
  })

  let stdout: string
  try {
    stdout = execFileSync(PYTHON_BIN, [MISAKI_BRIDGE_PATH], {
      input: payload,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'inherit'],
    })
  } catch (error) {
    throw new Error(
      `Misaki G2P bridge failed (PYTHON_BIN="${PYTHON_BIN}", override via env var if this resolves to the ` +
        `wrong interpreter). See stderr above for the underlying error.`,
      { cause: error },
    )
  }

  const parsed = JSON.parse(stdout) as { sentences: Record<string, MisakiToken[]> }
  return new Map(Object.entries(parsed.sentences))
}

/**
 * Merges Misaki's token stream (which splits punctuation into its own
 * tokens, e.g. "nights" + ".") back onto this sentence's own `words[]`
 * (which keeps trailing punctuation attached to the word, e.g. "nights."),
 * since the frozen data model has no separate punctuation token. A run of
 * tokens that normalize to empty text (pure punctuation) is folded into the
 * *preceding* word's phonemes/subtitles. Returns null (hard failure, not a
 * silent mis-map) if the merged sequence doesn't line up 1:1 with
 * `sentence.words`, mirroring `alignWordTimings`'s own philosophy.
 *
 * A leading space is prepended to every item after the first, matching
 * HeadTTS's own `splitText` convention (each word "part" carries its own
 * leading space) that the proven-correct word-timing math already assumes.
 */
function buildPhoneticInputItems(sentence: Sentence, tokens: MisakiToken[]): PhoneticInputItem[] | null {
  const merged: { value: string; subtitles: string }[] = []
  let current: { value: string; subtitles: string } | null = null

  for (const token of tokens) {
    if (normalizeForComparison(token.text) === '') {
      if (!current) return null
      current.value += token.phonemes ?? ''
      current.subtitles += token.text
    } else {
      if (current) merged.push(current)
      current = { value: token.phonemes ?? '', subtitles: token.text }
    }
  }
  if (current) merged.push(current)

  if (merged.length !== sentence.words.length) return null

  const items: PhoneticInputItem[] = []
  for (let i = 0; i < sentence.words.length; i++) {
    const ours = sentence.words[i]
    const theirs = merged[i]
    if (!ours || !theirs) return null
    if (normalizeForComparison(theirs.subtitles) !== ours.normalized) return null
    items.push({
      type: 'phonetic',
      value: i === 0 ? theirs.value : ` ${theirs.value}`,
      subtitles: theirs.subtitles,
    })
  }
  return items
}

async function synthesizeSentence(
  worker: Worker,
  input: PhoneticInputItem[],
  speed: number,
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
        input,
        voice: VOICE_NAME,
        language: 'en-us',
        speed,
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

  if (IS_TRIAL) {
    console.log(
      `TRIAL MODE: voice=${VOICE_NAME} speed=${SPEED} sentences=[${TRIAL_SENTENCE_IDS.join(', ')}] -> ${OUT_DIR}\n` +
        `(real manifest/public/narration output will NOT be touched)`,
    )
  }

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
  console.log('Model loaded.')

  const sentences = flattenSentences()

  console.log(`Running Misaki G2P bridge (${PYTHON_BIN}) for ${sentences.length} sentence(s)...`)
  const misakiTokensBySentence = runMisakiBridge(sentences)
  console.log('Misaki G2P complete. Synthesizing sentences...')

  const manifest: Record<string, ManifestEntry> = {}
  const failures: string[] = []

  let successCount = 0

  for (const sentence of sentences) {
    const misakiTokens = misakiTokensBySentence.get(sentence.id)
    if (!misakiTokens) {
      failures.push(`${sentence.id}: Misaki bridge returned no tokens for this sentence.`)
      continue
    }

    const input = buildPhoneticInputItems(sentence, misakiTokens)
    if (!input) {
      failures.push(
        `${sentence.id}: Misaki token/word mismatch (ours=${sentence.words.length}, theirs=${misakiTokens.length}). ` +
          `ours=[${sentence.words.map((w) => w.normalized).join(' ')}] theirs=[${misakiTokens.map((t) => t.text).join(' ')}]`,
      )
      continue
    }

    const { metadata } = await synthesizeSentence(worker, input, SPEED)
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
    successCount++

    if (!IS_TRIAL) {
      manifest[sentence.id] = {
        audioUrl: `/narration/gatsby-ch3/${audioFileName}`,
        durationMs: Math.round(audioDurationMs),
        words,
      }
    }
    console.log(`  ${sentence.id}: OK (${words.length} words, ${Math.round(audioDurationMs)}ms)`)
  }

  worker.terminate()

  if (failures.length > 0) {
    console.error(`\n${failures.length} sentence(s) failed word-alignment and were NOT written:`)
    failures.forEach((f) => console.error(`  - ${f}`))
  }

  if (IS_TRIAL) {
    console.log(`\nTrial complete: wrote ${successCount}/${sentences.length} sentence(s) to ${OUT_DIR}`)
  } else {
    const manifestPath = resolve(OUT_DIR, 'manifest.json')
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log(
      `\nWrote ${Object.keys(manifest).length}/${sentences.length} sentences to ${OUT_DIR}\nManifest: ${manifestPath}`,
    )
  }

  if (failures.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
