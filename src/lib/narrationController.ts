// Plain TS module, zero React/three.js knowledge — sole owner of narration
// playback and sole writer of narration-position state (currentSentenceIndex,
// currentWordId, activeSceneBeatId, activeSpeakerId, playbackState) on the
// Zustand reading store.
//
// Plays pre-rendered per-sentence audio files (generated offline by
// scripts/generate-narration-audio.ts, never at runtime) instead of the Web
// Speech API — browser TTS voices sound noticeably robotic; the pre-rendered
// audio uses Kokoro (an open-weight neural TTS model) and sounds much closer
// to human. Generating it once, offline, and shipping the result as static
// assets keeps the "no live AI generation at runtime" rule fully intact: this
// module makes zero AI-inference calls, only fetches a JSON manifest and
// plays <audio> elements, same risk profile as loading an image.
//
// See CLAUDE.md § "Narration sync architecture" for the full spec this
// module implements.

import { useReadingStore, type PlaybackState } from '../store/readingStore'
import type { Passage, Sentence } from '../types'
import type { MotifTriggers } from '../types-motifs'
import motifTriggersData from '../data/motif-triggers.json'

const MOTIF_TRIGGERS = motifTriggersData as MotifTriggers

// ---------------------------------------------------------------------------
// Pure, browser-API-free helpers (unit-testable in isolation).
// ---------------------------------------------------------------------------

/** One word's timing within its sentence's pre-rendered audio clip, as produced by scripts/generate-narration-audio.ts. */
export interface WordTiming {
  wordId: string
  startMs: number
  endMs: number
}

/** One sentence's entry in a passage's narration manifest (public/narration/<passageId>/manifest.json). */
export interface NarrationManifestEntry {
  audioUrl: string
  durationMs: number
  words: WordTiming[]
}

export type NarrationManifest = Record<string, NarrationManifestEntry>

/**
 * Finds the word that should be highlighted at a given playback position:
 * the last word whose `startMs` has already passed. `words` must be sorted
 * ascending by `startMs` (guaranteed by how the offline generation script
 * writes them). Before the first word starts (or for an empty array before
 * any word exists), returns the first word so the highlight snaps on
 * immediately rather than showing nothing during any lead-in silence.
 */
export function findWordIdAtTime(words: readonly WordTiming[], timeMs: number): string | null {
  if (words.length === 0) return null
  let lo = 0
  let hi = words.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const word = words[mid]
    if (word && word.startMs <= timeMs) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return words[lo]?.wordId ?? null
}

/**
 * Minimal shape of an HTMLAudioElement this module needs — kept narrow so
 * tests can pass a fake. Handler properties are typed to accept an event arg
 * (even though this module's own handlers never use it) so a real
 * HTMLAudioElement — whose native `ontimeupdate`/`onended`/`onerror`
 * properties are typed as `(ev: Event) => any`, not `() => void` — is
 * structurally assignable to this interface without a cast.
 */
export interface AudioLike {
  src: string
  currentTime: number
  paused: boolean
  play: () => Promise<void>
  pause: () => void
  onended: ((ev: Event) => void) | null
  onerror: ((ev: Event) => void) | null
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/** Natural breath between sentences (separately-recorded clips chained together read as mechanical with zero gap). */
const SENTENCE_PAUSE_MS = 260
/** Longer beat between paragraphs — how a narrator actually marks a paragraph break. */
const PARAGRAPH_PAUSE_MS = 650

/**
 * The narration-position slice of the reading store's state that this module
 * reads and writes. Field names/types mirror `readingStore.ts`'s frozen
 * `ReadingState` position fields exactly (kept in sync by hand, not derived
 * via `Pick<typeof useReadingStore, ...>`) because Zustand's `setState` is an
 * overloaded signature (partial | updater fn, optional `replace` flag) that
 * doesn't structurally match a plain `(partial) => void` test double — this
 * narrower shape is what actually gets used and is easy to fake in tests.
 */
export interface NarrationPositionState {
  currentSentenceIndex: number
  currentWordId: string | null
  activeSceneBeatId: string | null
  activeSpeakerId: string | null
  playbackState: PlaybackState
  activeMotifId: string | null
  activeMotifNonce: number
}

/** The store surface this module reads/writes. Narrow enough to fake in tests without satisfying Zustand's full overloaded `setState`. */
export interface NarrationStoreApi {
  getState: () => NarrationPositionState
  setState: (partial: Partial<NarrationPositionState>) => void
}

export interface NarrationControllerDeps {
  store: NarrationStoreApi
  createAudio: () => AudioLike
  fetchManifest: (url: string) => Promise<NarrationManifest>
  getDocument: () => Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | undefined
  /**
   * Schedules `callback` to run on the next animation frame. Defaults to the
   * real `requestAnimationFrame`; tests override this with a manually
   * steppable fake (see narrationController.test.ts's harness) so word
   * tracking can be exercised deterministically with no real timers.
   */
  requestFrame: (callback: FrameRequestCallback) => number
  /** Cancels a frame previously scheduled via `requestFrame`. Defaults to the real `cancelAnimationFrame`. */
  cancelFrame: (handle: number) => void
}

function defaultDeps(): NarrationControllerDeps {
  return {
    store: useReadingStore,
    createAudio: () => new Audio(),
    fetchManifest: async (url) => {
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to fetch narration manifest "${url}": ${res.status} ${res.statusText}`)
      }
      return (await res.json()) as NarrationManifest
    },
    getDocument: () => (typeof document !== 'undefined' ? document : undefined),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
  }
}

export interface NarrationController {
  /** Registers the passage to narrate and resets position to its first sentence. Does not start playing. Fetches that passage's narration manifest in the background. */
  loadPassage: (passage: Passage) => void
  /** Starts, or resumes, narration. No-op if already playing. */
  play: () => void
  /** Pauses narration. */
  pause: () => void
  /** Cancels current playback and starts playing from `sentenceIndex`. */
  seekToSentence: (sentenceIndex: number) => void
  /** Cancels playback, detaches listeners, and clears internal state. Call on unmount. */
  destroy: () => void
}

interface ControllerState {
  passageId: string | null
  sentences: Sentence[]
  /** Indices into `sentences` that are the last sentence of their paragraph -- drives the longer `PARAGRAPH_PAUSE_MS` beat instead of `SENTENCE_PAUSE_MS`. */
  paragraphEndIndices: Set<number>
  sentenceIndex: number
  epoch: number
  manifest: NarrationManifest | null
  manifestReadyPromise: Promise<void> | null
  currentAudio: AudioLike | null
  /**
   * The manifest entry (word timings) for `currentAudio`'s sentence — kept
   * alongside `currentAudio` so `pause()`/resume can restart the word-
   * tracking rAF loop on the same audio element without re-deriving `entry`
   * from `sentenceIndex`/`manifest` (which may have moved on by then).
   */
  currentEntry: NarrationManifestEntry | null
  /** Handle for the active word-tracking requestAnimationFrame loop (see startWordTracking/stopWordTracking), or null when no loop is running. */
  rafId: number | null
  interSentenceTimerId: ReturnType<typeof setTimeout> | null
  /**
   * True once `audio.play()` has actually been called for the current
   * sentence attempt (set just before that call, cleared by any defensive
   * cancel). Distinguishes "genuinely mid-clip, safe to resume via
   * `currentAudio.play()`" from "playbackState flipped to 'playing'/'paused'
   * before any clip was ever started" — e.g. pause() fired while still
   * awaiting `ensureManifestReady()`. In the latter case there is no live
   * audio element to resume, so `play()`'s resume path checks this flag and
   * restarts `playCurrentSentence()` instead when it's false.
   */
  hasStartedPlaying: boolean
  visibilityListenerAttached: boolean
  hasWarnedMissingAudio: boolean
  /** Last wordId a motif was fired for -- guards against re-firing on every rAF tick while that same word stays current (the tracking loop runs once per frame, not once per word). */
  lastMotifWordId: string | null
}

function createInitialState(): ControllerState {
  return {
    passageId: null,
    sentences: [],
    paragraphEndIndices: new Set(),
    sentenceIndex: 0,
    epoch: 0,
    manifest: null,
    manifestReadyPromise: null,
    currentAudio: null,
    currentEntry: null,
    rafId: null,
    interSentenceTimerId: null,
    hasStartedPlaying: false,
    visibilityListenerAttached: false,
    hasWarnedMissingAudio: false,
    lastMotifWordId: null,
  }
}

function flattenPassage(passage: Passage): {
  sentences: Sentence[]
  paragraphEndIndices: Set<number>
} {
  const sentences: Sentence[] = []
  const paragraphEndIndices = new Set<number>()
  for (const paragraph of passage.paragraphs) {
    sentences.push(...paragraph.sentences)
    if (paragraph.sentences.length > 0) {
      paragraphEndIndices.add(sentences.length - 1)
    }
  }
  return { sentences, paragraphEndIndices }
}

/**
 * Creates an independent narration controller instance. A module-level
 * singleton (built from real browser globals) is exported below for normal
 * app use; tests should call this directly with mocked deps to get fully
 * isolated state per test, no global monkey-patching or reset required.
 */
export function createNarrationController(overrides: Partial<NarrationControllerDeps> = {}): NarrationController {
  const deps: NarrationControllerDeps = { ...defaultDeps(), ...overrides }
  let state = createInitialState()

  function clearInterSentenceTimer(): void {
    if (state.interSentenceTimerId !== null) {
      clearTimeout(state.interSentenceTimerId)
      state.interSentenceTimerId = null
    }
  }

  /**
   * Starts (or restarts) the rAF-driven word-position tracking loop for
   * `audio`/`entry`. Reads `audio.currentTime` every animation frame rather
   * than relying on `audio.ontimeupdate` — that event is a real browser
   * event that only fires at a browser-throttled rate (not every frame), so
   * `findWordIdAtTime` was working off stale `currentTime` reads, which is
   * what caused word highlighting to visibly lag the audio. Only writes to
   * the store when the resolved word id actually changes, so this doesn't
   * cause a re-render on every single frame.
   */
  function startWordTracking(audio: AudioLike, entry: NarrationManifestEntry, myEpoch: number): void {
    stopWordTracking() // guard against two loops ever running concurrently, regardless of caller discipline
    state.currentEntry = entry
    let lastAppliedWordId: string | null = null
    const tick = (): void => {
      if (myEpoch !== state.epoch) return
      const wordId = findWordIdAtTime(entry.words, audio.currentTime * 1000)
      if (wordId !== null && wordId !== lastAppliedWordId) {
        lastAppliedWordId = wordId
        deps.store.setState({ currentWordId: wordId })
        maybeFireMotif(wordId)
      }
      state.rafId = deps.requestFrame(tick)
    }
    state.rafId = deps.requestFrame(tick)
  }

  function stopWordTracking(): void {
    if (state.rafId !== null) {
      deps.cancelFrame(state.rafId)
      state.rafId = null
    }
  }

  function detachCurrentAudio(): void {
    stopWordTracking()
    const audio = state.currentAudio
    if (!audio) return
    audio.onended = null
    audio.onerror = null
    if (!audio.paused) audio.pause()
    state.currentAudio = null
  }

  /** Bumps the epoch so any in-flight audio's callbacks become stale no-ops, then stops playback. Call before any critical operation (start/seek/pause/unmount). */
  function cancelPlaybackDefensively(): void {
    clearInterSentenceTimer()
    state.epoch += 1
    state.hasStartedPlaying = false
    state.lastMotifWordId = null
    detachCurrentAudio()
  }

  function warnMissingAudioOnce(sentenceId: string): void {
    if (state.hasWarnedMissingAudio) return
    state.hasWarnedMissingAudio = true
    console.warn(
      `[narrationController] No pre-rendered audio for sentence "${sentenceId}" (manifest missing or failed to load) — skipping.`,
    )
  }

  function ensureManifestReady(passageId: string): Promise<void> {
    if (state.manifestReadyPromise) return state.manifestReadyPromise

    state.manifestReadyPromise = (async () => {
      try {
        state.manifest = await deps.fetchManifest(`/narration/${passageId}/manifest.json`)
      } catch (error) {
        console.warn(
          `[narrationController] Failed to load narration manifest for passage "${passageId}" — narration audio will be unavailable.`,
          error,
        )
        state.manifest = null
      }
    })()

    return state.manifestReadyPromise
  }

  function finishPassage(): void {
    deps.store.setState({ playbackState: 'idle', currentWordId: null })
  }

  /**
   * Fires a Motif's one-shot visual if `wordId` is tagged in
   * MOTIF_TRIGGERS and isn't the same word that just fired one (the rAF
   * word-tracking tick fires every frame while the same word stays current --
   * this must fire once per word, not once per tick). Bumps activeMotifNonce so the *same*
   * motif id firing twice in a row (two tagged words sharing a catalog
   * entry) still re-triggers consumers instead of being a no-op re-render.
   */
  function maybeFireMotif(wordId: string | null): void {
    if (!wordId || wordId === state.lastMotifWordId) return
    state.lastMotifWordId = wordId
    const motifId = MOTIF_TRIGGERS[wordId]
    if (!motifId) return
    deps.store.setState({
      activeMotifId: motifId,
      activeMotifNonce: deps.store.getState().activeMotifNonce + 1,
    })
  }

  function playCurrentSentence(): void {
    const sentence = state.sentences[state.sentenceIndex]
    if (!sentence) {
      finishPassage()
      return
    }

    const entry = state.manifest?.[sentence.id]
    if (!entry) {
      warnMissingAudioOnce(sentence.id)
      state.sentenceIndex += 1
      playCurrentSentence()
      return
    }

    const myEpoch = state.epoch

    const firstWordId = entry.words[0]?.wordId ?? null
    deps.store.setState({
      currentSentenceIndex: state.sentenceIndex,
      currentWordId: firstWordId,
      activeSceneBeatId: sentence.sceneBeatId,
      activeSpeakerId: sentence.speakerId ?? null,
    })
    maybeFireMotif(firstWordId)

    const audio = deps.createAudio()
    audio.src = entry.audioUrl

    const advanceToNextSentence = () => {
      if (myEpoch !== state.epoch) return
      // A real narrator breathes between sentences (longer between
      // paragraphs); chaining separately-recorded clips with zero gap is
      // what makes it read as mechanical. cancelPlaybackDefensively (on
      // start/seek/pause/unmount) clears this via clearInterSentenceTimer,
      // and the epoch check guards against a stale fire either way.
      const pauseMs = state.paragraphEndIndices.has(state.sentenceIndex) ? PARAGRAPH_PAUSE_MS : SENTENCE_PAUSE_MS
      state.sentenceIndex += 1
      state.interSentenceTimerId = setTimeout(() => {
        state.interSentenceTimerId = null
        if (myEpoch !== state.epoch) return
        playCurrentSentence()
      }, pauseMs)
    }

    audio.onended = () => advanceToNextSentence()

    audio.onerror = () => {
      if (myEpoch !== state.epoch) return
      console.warn(
        `[narrationController] Audio playback error for sentence "${sentence.id}", skipping to next sentence.`,
      )
      advanceToNextSentence()
    }

    state.currentAudio = audio
    state.hasStartedPlaying = true
    audio.play().catch((error: unknown) => {
      if (myEpoch !== state.epoch) return
      console.warn(
        `[narrationController] audio.play() rejected for sentence "${sentence.id}", skipping to next sentence.`,
        error,
      )
      advanceToNextSentence()
    })
    startWordTracking(audio, entry, myEpoch)
  }

  function handleVisibilityChange(): void {
    const doc = deps.getDocument()
    if (!doc || doc.visibilityState !== 'visible') return

    const playbackState = deps.store.getState().playbackState
    const audio = state.currentAudio
    if (playbackState === 'playing' && audio?.paused) {
      // Tab was backgrounded and the browser silently paused/suspended
      // playback (some mobile browsers throttle background <audio>) — resync
      // by resuming rather than leaving the UI stuck out of step with reality.
      audio.play().catch(() => {
        // Best-effort resync; if it fails there's nothing more to do here.
      })
    }
  }

  function attachVisibilityListener(): void {
    const doc = deps.getDocument()
    if (!doc || state.visibilityListenerAttached) return
    doc.addEventListener('visibilitychange', handleVisibilityChange)
    state.visibilityListenerAttached = true
  }

  function detachVisibilityListener(): void {
    const doc = deps.getDocument()
    if (doc && state.visibilityListenerAttached) {
      doc.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    state.visibilityListenerAttached = false
  }

  function loadPassage(passage: Passage): void {
    cancelPlaybackDefensively()
    state = {
      ...createInitialState(),
      visibilityListenerAttached: state.visibilityListenerAttached,
    }
    // Re-attach if a prior destroy() detached it (e.g. the controller is
    // reused across an unmount/remount, such as React StrictMode's
    // dev-mode double-invoke) — idempotent, guarded by the attached flag.
    attachVisibilityListener()
    state.passageId = passage.id
    const { sentences, paragraphEndIndices } = flattenPassage(passage)
    state.sentences = sentences
    state.paragraphEndIndices = paragraphEndIndices
    const first = state.sentences[0]
    deps.store.setState({
      currentSentenceIndex: 0,
      currentWordId: null,
      activeSceneBeatId: first?.sceneBeatId ?? null,
      activeSpeakerId: first?.speakerId ?? null,
      playbackState: 'idle',
    })
    // Start fetching the manifest now rather than waiting for the first
    // play() so playback can start immediately once the user clicks Play.
    ensureManifestReady(passage.id)
  }

  function play(): void {
    if (state.sentences.length === 0 || !state.passageId) return

    const currentPlaybackState = deps.store.getState().playbackState
    if (currentPlaybackState === 'playing') return // already playing — avoid overlapping audio

    if (currentPlaybackState === 'paused') {
      if (state.currentAudio && state.hasStartedPlaying) {
        const audio = state.currentAudio
        const entry = state.currentEntry
        deps.store.setState({ playbackState: 'playing' })
        audio.play().catch(() => {
          // If resuming genuinely fails, restart the sentence from scratch
          // rather than leaving playback silently stuck.
          cancelPlaybackDefensively()
          const myEpoch = state.epoch
          ensureManifestReady(state.passageId ?? '').then(() => {
            if (myEpoch !== state.epoch) return
            if (deps.store.getState().playbackState !== 'playing') return
            playCurrentSentence()
          })
        })
        if (entry) startWordTracking(audio, entry, state.epoch)
      } else {
        // Paused before any clip was ever actually started (e.g. pause()
        // landed while still awaiting ensureManifestReady()) — there's
        // nothing live to resume, so start the current sentence fresh.
        cancelPlaybackDefensively()
        const myEpoch = state.epoch
        deps.store.setState({ playbackState: 'playing' })
        ensureManifestReady(state.passageId).then(() => {
          if (myEpoch !== state.epoch) return
          if (deps.store.getState().playbackState !== 'playing') return
          playCurrentSentence()
        })
      }
      return
    }

    // Fresh start from idle (start of passage, or after reaching its end).
    cancelPlaybackDefensively()
    const myEpoch = state.epoch
    deps.store.setState({ playbackState: 'playing' })
    ensureManifestReady(state.passageId).then(() => {
      if (myEpoch !== state.epoch) return // a seek/pause/destroy happened while we waited
      if (deps.store.getState().playbackState !== 'playing') return
      playCurrentSentence()
    })
  }

  function pause(): void {
    if (deps.store.getState().playbackState !== 'playing') return
    clearInterSentenceTimer()
    stopWordTracking()
    state.currentAudio?.pause()
    deps.store.setState({ playbackState: 'paused' })
  }

  function seekToSentence(sentenceIndex: number): void {
    if (state.sentences.length === 0 || !state.passageId) return
    const clamped = Math.max(0, Math.min(sentenceIndex, state.sentences.length - 1))

    cancelPlaybackDefensively()
    state.sentenceIndex = clamped

    const sentence = state.sentences[clamped]
    const entry = state.manifest?.[sentence?.id ?? '']
    deps.store.setState({
      currentSentenceIndex: clamped,
      currentWordId: entry?.words[0]?.wordId ?? null,
      activeSceneBeatId: sentence?.sceneBeatId ?? null,
      activeSpeakerId: sentence?.speakerId ?? null,
      playbackState: 'playing',
    })

    const myEpoch = state.epoch
    ensureManifestReady(state.passageId).then(() => {
      if (myEpoch !== state.epoch) return
      playCurrentSentence()
    })
  }

  function destroy(): void {
    cancelPlaybackDefensively()
    detachVisibilityListener()
    state = createInitialState()
  }

  attachVisibilityListener()

  return { loadPassage, play, pause, seekToSentence, destroy }
}

// ---------------------------------------------------------------------------
// Module-level singleton for normal app use (backed by real browser globals).
// ---------------------------------------------------------------------------

const defaultController = createNarrationController()

export const loadPassage = defaultController.loadPassage
export const play = defaultController.play
export const pause = defaultController.pause
export const seekToSentence = defaultController.seekToSentence
export const destroy = defaultController.destroy
