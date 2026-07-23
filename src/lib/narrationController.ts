// Plain TS module, zero React/three.js knowledge — sole owner of the
// SpeechSynthesisUtterance lifecycle and sole writer of narration-position
// state (currentSentenceIndex, currentWordId, activeSceneBeatId,
// activeSpeakerId, playbackState) on the Zustand reading store.
//
// See CLAUDE.md § "Narration sync architecture" for the full spec this
// module implements.

import { useReadingStore, type PlaybackState } from '../store/readingStore'
import type { Passage, Sentence, Word } from '../types'

// ---------------------------------------------------------------------------
// Pure, browser-API-free helpers (unit-testable in isolation — see the
// "Testing note" in CLAUDE.md: jsdom has no Web Speech API, so these are
// deliberately kept free of any dependency on it).
// ---------------------------------------------------------------------------

/** One word's character range within its utterance's flattened text. */
export interface WordOffset {
  wordId: string
  charStart: number
  charEnd: number
}

/** The minimal shape of a SpeechSynthesisVoice this module cares about. */
export interface VoiceLike {
  name: string
  lang: string
}

/**
 * Builds the text spoken for one sentence's utterance by concatenating its
 * words' `normalized` text with single spaces, alongside a parallel offset
 * table mapping each word to its `[charStart, charEnd)` range in that text.
 * This offset table is what `onboundary`'s `charIndex` gets matched against.
 */
export function buildUtteranceText(sentence: Sentence): { text: string; offsets: WordOffset[] } {
  let text = ''
  const offsets: WordOffset[] = []
  for (let i = 0; i < sentence.words.length; i += 1) {
    const word = sentence.words[i]
    if (!word) continue
    if (i > 0) text += ' '
    const charStart = text.length
    text += word.normalized
    offsets.push({ wordId: word.id, charStart, charEnd: text.length })
  }
  return { text, offsets }
}

/**
 * Binary-searches the offset table for the word whose range contains
 * `charIndex`. Tolerant, not an exact-equality lookup: browsers don't
 * consistently land `charIndex` precisely on a word's first character (it
 * may land in the preceding space, or be off by a character or two for some
 * voices), so on a miss this clamps to whichever neighboring word is
 * closest rather than returning null.
 */
export function findWordIdAtCharIndex(offsets: WordOffset[], charIndex: number): string | null {
  if (offsets.length === 0) return null

  let lo = 0
  let hi = offsets.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const word = offsets[mid]
    if (!word) break
    if (charIndex < word.charStart) {
      hi = mid - 1
    } else if (charIndex >= word.charEnd) {
      lo = mid + 1
    } else {
      return word.wordId
    }
  }

  // Tolerant fallback: charIndex fell between words (e.g. on the space
  // separator) or outside the table entirely. `lo` is the insertion point;
  // clamp to whichever adjacent word is nearer.
  const after = offsets[Math.min(lo, offsets.length - 1)]
  const before = offsets[Math.max(lo - 1, 0)]
  if (!after) return before ? before.wordId : null
  if (!before) return after.wordId
  if (before === after) return after.wordId

  const distAfter = Math.abs(after.charStart - charIndex)
  const distBefore = Math.abs(charIndex - before.charEnd)
  return distAfter <= distBefore ? after.wordId : before.wordId
}

/** Preference-ordered voice names, best-quality/most-natural first. Never a single hardcoded name. */
export const DEFAULT_VOICE_PREFERENCES: readonly string[] = [
  'Google US English',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Ava Online (Natural) - English (United States)',
  'Samantha',
  'Alex',
  'Daniel',
  'Microsoft Zira - English (United States)',
  'Microsoft David - English (United States)',
]

/**
 * Picks a voice from a preference-ordered fallback list: exact name match
 * first (in preference order), then any English-language voice, then
 * whatever the platform offers first. Returns null only when no voices are
 * available at all (handled gracefully by callers, never thrown).
 */
export function selectPreferredVoice<TVoice extends VoiceLike>(
  voices: readonly TVoice[],
  preferences: readonly string[] = DEFAULT_VOICE_PREFERENCES,
): TVoice | null {
  if (voices.length === 0) return null

  for (const preferredName of preferences) {
    const match = voices.find((v) => v.name === preferredName)
    if (match) return match
  }

  const english = voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  if (english) return english

  return voices[0] ?? null
}

/**
 * Decides whether the `onboundary` events observed during a just-finished
 * utterance arrived at roughly a per-word rate. Below the threshold, the
 * browser/voice is treated as not reliably supporting word boundaries (e.g.
 * Safari, or voices that only emit a single sentence-level boundary), and
 * the caller should switch to the synthetic WPM timer.
 */
export function isBoundaryTrackingReliable(boundaryEventCount: number, wordCount: number): boolean {
  if (wordCount <= 0) return true
  if (wordCount === 1) return boundaryEventCount >= 1
  return boundaryEventCount >= Math.ceil(wordCount * 0.5)
}

/**
 * Computes a per-word highlight duration (ms) for the synthetic fallback
 * timer, given a target words-per-minute rate. Longer words get a longer
 * slice so highlighting doesn't visibly race ahead of speech on long words
 * or lag on short ones.
 */
export function computeWordTimerDelaysMs(words: readonly Word[], wpm: number): number[] {
  const baseMsPerWord = 60000 / Math.max(1, wpm)
  return words.map((word) => {
    const lengthFactor = Math.min(2, Math.max(0.6, word.normalized.length / 5))
    return Math.round(baseMsPerWord * lengthFactor)
  })
}

/** Minimal shape of the global scope this module needs — kept narrow so tests can pass a fake. */
export interface SpeechCapableWindow {
  speechSynthesis?: SpeechSynthesis
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance
}

/** Feature-detects Web Speech API support without throwing on any environment shape. */
export function isSpeechSynthesisSupported(win: SpeechCapableWindow | undefined): boolean {
  return !!win && typeof win.speechSynthesis !== 'undefined' && typeof win.SpeechSynthesisUtterance !== 'undefined'
}

/**
 * Detects Safari (including iOS Safari) from a user-agent string, excluding
 * Chrome/Chromium/Edge/Firefox-on-iOS/Android WebView, all of which also
 * contain "Safari" in their UA strings.
 */
export function isSafariUserAgent(userAgent: string): boolean {
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|fxios|android|edg/i.test(userAgent)
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

const VOICES_READY_TIMEOUT_MS = 2000
const BOUNDARY_WATCHDOG_MS = 500
const FALLBACK_WPM = 165

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
}

/** The store surface this module reads/writes. Narrow enough to fake in tests without satisfying Zustand's full overloaded `setState`. */
export interface NarrationStoreApi {
  getState: () => NarrationPositionState
  setState: (partial: Partial<NarrationPositionState>) => void
}

export interface NarrationControllerDeps {
  store: NarrationStoreApi
  getWindow: () => SpeechCapableWindow | undefined
  getDocument: () => Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | undefined
  getUserAgent: () => string
}

function defaultDeps(): NarrationControllerDeps {
  return {
    store: useReadingStore,
    getWindow: () => (typeof window !== 'undefined' ? window : undefined),
    getDocument: () => (typeof document !== 'undefined' ? document : undefined),
    getUserAgent: () => (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
  }
}

export interface NarrationController {
  /** Registers the passage to narrate and resets position to its first sentence. Does not start speaking. */
  loadPassage: (passage: Passage) => void
  /** Starts, or resumes, narration. No-op if already playing. */
  play: () => void
  /** Pauses narration. Prefers `speechSynthesis.pause()`; on Safari falls back to cancel + resume-at-sentence-start. */
  pause: () => void
  /** Cancels current speech and starts speaking from `sentenceIndex`. */
  seekToSentence: (sentenceIndex: number) => void
  /** Cancels speech, detaches listeners, and clears internal state. Call on unmount. */
  destroy: () => void
}

interface ControllerState {
  sentences: Sentence[]
  sentenceIndex: number
  epoch: number
  offsets: WordOffset[]
  boundaryEventCount: number
  useFallbackTimer: boolean
  fallbackTimerId: ReturnType<typeof setTimeout> | null
  watchdogTimerId: ReturnType<typeof setTimeout> | null
  voice: VoiceLike | null
  voiceInitPromise: Promise<void> | null
  playbackWasPausedViaCancel: boolean
  /**
   * True once `speechSynthesis.speak()` has actually been called for the
   * current sentence attempt (set just before that call, cleared by any
   * defensive cancel). Distinguishes "genuinely mid-utterance, safe to
   * resume via `speechSynthesis.resume()`" from "playbackState flipped to
   * 'playing'/'paused' before any utterance was ever queued" — e.g. pause()
   * fired while still awaiting `ensureVoiceReady()`. In the latter case
   * `synth.resume()` has nothing to resume and would silently strand
   * playback, so `play()`'s resume path checks this flag and restarts
   * `speakCurrentSentence()` instead when it's false.
   */
  hasStartedSpeaking: boolean
  visibilityListenerAttached: boolean
  hasWarnedUnsupported: boolean
}

function createInitialState(): ControllerState {
  return {
    sentences: [],
    sentenceIndex: 0,
    epoch: 0,
    offsets: [],
    boundaryEventCount: 0,
    useFallbackTimer: false,
    fallbackTimerId: null,
    watchdogTimerId: null,
    voice: null,
    voiceInitPromise: null,
    playbackWasPausedViaCancel: false,
    hasStartedSpeaking: false,
    visibilityListenerAttached: false,
    hasWarnedUnsupported: false,
  }
}

function flattenPassage(passage: Passage): Sentence[] {
  return passage.paragraphs.flatMap((paragraph) => paragraph.sentences)
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

  function getSynth(): SpeechSynthesis | undefined {
    return deps.getWindow()?.speechSynthesis
  }

  function clearFallbackTimer(): void {
    if (state.fallbackTimerId !== null) {
      clearTimeout(state.fallbackTimerId)
      state.fallbackTimerId = null
    }
  }

  function clearWatchdog(): void {
    if (state.watchdogTimerId !== null) {
      clearTimeout(state.watchdogTimerId)
      state.watchdogTimerId = null
    }
  }

  /** Bumps the epoch so any in-flight utterance's callbacks become stale no-ops, then cancels the speech queue. Call before any critical operation (start/seek/pause/unmount) per the narration spec. */
  function cancelSpeechDefensively(): void {
    clearFallbackTimer()
    clearWatchdog()
    state.epoch += 1
    state.hasStartedSpeaking = false
    const synth = getSynth()
    if (synth) {
      synth.cancel()
    }
  }

  function warnUnsupportedOnce(): void {
    if (state.hasWarnedUnsupported) return
    state.hasWarnedUnsupported = true
    console.warn(
      '[narrationController] Web Speech API is not available in this browser — degrading to silent manual-reading mode.',
    )
  }

  function ensureVoiceReady(): Promise<void> {
    if (state.voiceInitPromise) return state.voiceInitPromise

    state.voiceInitPromise = new Promise((resolve) => {
      const win = deps.getWindow()
      if (!isSpeechSynthesisSupported(win) || !win?.speechSynthesis) {
        resolve()
        return
      }
      const synth = win.speechSynthesis

      const tryPick = (): boolean => {
        const voices = synth.getVoices?.() ?? []
        if (voices.length > 0) {
          state.voice = selectPreferredVoice(voices)
          return true
        }
        return false
      }

      if (tryPick()) {
        resolve()
        return
      }

      let settled = false
      const onVoicesChanged = (): void => {
        if (settled) return
        if (tryPick()) {
          settled = true
          synth.removeEventListener('voiceschanged', onVoicesChanged)
          resolve()
        }
      }
      synth.addEventListener('voiceschanged', onVoicesChanged)

      setTimeout(() => {
        if (settled) return
        settled = true
        synth.removeEventListener('voiceschanged', onVoicesChanged)
        tryPick() // last attempt; proceed either way, never blocks playback forever
        resolve()
      }, VOICES_READY_TIMEOUT_MS)
    })

    return state.voiceInitPromise
  }

  function startFallbackTimer(sentence: Sentence, myEpoch: number): void {
    clearFallbackTimer()
    const delays = computeWordTimerDelaysMs(sentence.words, FALLBACK_WPM)
    let wordIndex = 0

    const advance = (): void => {
      if (myEpoch !== state.epoch) return
      const word = sentence.words[wordIndex]
      if (!word) return
      deps.store.setState({ currentWordId: word.id })
      const delay = delays[wordIndex] ?? 60000 / FALLBACK_WPM
      wordIndex += 1
      if (wordIndex < sentence.words.length) {
        state.fallbackTimerId = setTimeout(advance, delay)
      }
    }

    advance()
  }

  function armBoundaryWatchdog(sentence: Sentence, myEpoch: number): void {
    clearWatchdog()
    if (state.useFallbackTimer) return
    state.watchdogTimerId = setTimeout(() => {
      if (myEpoch !== state.epoch) return
      if (state.boundaryEventCount === 0) {
        // No boundary events arrived shortly after speech started — this
        // browser/voice doesn't fire them at a usable rate. Switch to the
        // synthetic timer for the rest of this utterance and stay on it.
        state.useFallbackTimer = true
        startFallbackTimer(sentence, myEpoch)
      }
    }, BOUNDARY_WATCHDOG_MS)
  }

  function finishPassage(): void {
    deps.store.setState({ playbackState: 'idle', currentWordId: null })
  }

  function speakCurrentSentence(): void {
    const win = deps.getWindow()
    if (!isSpeechSynthesisSupported(win) || !win?.speechSynthesis || !win.SpeechSynthesisUtterance) {
      warnUnsupportedOnce()
      return
    }

    const sentence = state.sentences[state.sentenceIndex]
    if (!sentence) {
      finishPassage()
      return
    }

    if (sentence.words.length === 0) {
      // Nothing to speak or highlight — skip straight to the next sentence.
      state.sentenceIndex += 1
      speakCurrentSentence()
      return
    }

    const myEpoch = state.epoch
    const { text, offsets } = buildUtteranceText(sentence)
    state.offsets = offsets
    state.boundaryEventCount = 0

    deps.store.setState({
      currentSentenceIndex: state.sentenceIndex,
      currentWordId: offsets[0]?.wordId ?? null,
      activeSceneBeatId: sentence.sceneBeatId,
      activeSpeakerId: sentence.speakerId ?? null,
    })

    const utterance = new win.SpeechSynthesisUtterance(text)
    if (state.voice) {
      // Narrow VoiceLike back to a real SpeechSynthesisVoice: it always is
      // one in production (selected from synth.getVoices()); only tests
      // supply plain VoiceLike stand-ins, where assigning `.voice` is inert.
      utterance.voice = state.voice as SpeechSynthesisVoice
    }

    utterance.onstart = () => {
      if (myEpoch !== state.epoch) return
      armBoundaryWatchdog(sentence, myEpoch)
    }

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (myEpoch !== state.epoch) return
      // Only count events that actually represent word-level progress toward
      // the reliability heuristic below. Some voices emit coarse
      // sentence-level boundaries (event.name === 'sentence') alongside or
      // instead of word boundaries; counting those would let a voice that
      // never fires per-word events masquerade as "reliable" (e.g. a single
      // sentence-boundary event on a 2-word sentence already meets the >=50%
      // threshold) and wrongly skip the WPM fallback the spec requires.
      if (event.name && event.name !== 'word') return
      state.boundaryEventCount += 1
      if (state.useFallbackTimer) return
      const wordId = findWordIdAtCharIndex(state.offsets, event.charIndex)
      if (wordId) {
        deps.store.setState({ currentWordId: wordId })
      }
    }

    utterance.onend = () => {
      if (myEpoch !== state.epoch) return
      clearWatchdog()
      clearFallbackTimer()
      if (!isBoundaryTrackingReliable(state.boundaryEventCount, sentence.words.length)) {
        state.useFallbackTimer = true
      }
      state.sentenceIndex += 1
      speakCurrentSentence()
    }

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      if (myEpoch !== state.epoch) return
      clearWatchdog()
      clearFallbackTimer()
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        console.warn('[narrationController] speech synthesis error, skipping to next sentence:', event.error)
      }
      state.sentenceIndex += 1
      speakCurrentSentence()
    }

    if (state.useFallbackTimer) {
      startFallbackTimer(sentence, myEpoch)
    }

    state.hasStartedSpeaking = true
    win.speechSynthesis.speak(utterance)
  }

  function handleVisibilityChange(): void {
    const doc = deps.getDocument()
    const win = deps.getWindow()
    if (!doc || doc.visibilityState !== 'visible') return
    if (!isSpeechSynthesisSupported(win) || !win?.speechSynthesis) return

    const synth = win.speechSynthesis
    const playbackState = deps.store.getState().playbackState

    if (playbackState === 'playing') {
      const looksActive = synth.speaking && !synth.paused
      if (!looksActive && !state.playbackWasPausedViaCancel) {
        // Tab was backgrounded and speech silently stopped/desynced (common
        // when the OS suspends audio in background tabs). Resync by
        // re-speaking the current sentence from its start rather than
        // leaving the UI stuck out of step with reality.
        cancelSpeechDefensively()
        speakCurrentSentence()
      }
    } else if (playbackState === 'paused' && !state.playbackWasPausedViaCancel) {
      if (synth.speaking && !synth.paused) {
        // Store thinks we're paused but the engine kept going — bring it
        // back in line rather than silently drifting.
        synth.pause()
      }
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
    cancelSpeechDefensively()
    state = { ...createInitialState(), visibilityListenerAttached: state.visibilityListenerAttached }
    // Re-attach if a prior destroy() detached it (e.g. the controller is
    // reused across an unmount/remount, such as React StrictMode's
    // dev-mode double-invoke) — idempotent, guarded by the attached flag.
    attachVisibilityListener()
    state.sentences = flattenPassage(passage)
    const first = state.sentences[0]
    deps.store.setState({
      currentSentenceIndex: 0,
      currentWordId: null,
      activeSceneBeatId: first?.sceneBeatId ?? null,
      activeSpeakerId: first?.speakerId ?? null,
      playbackState: 'idle',
    })
  }

  function play(): void {
    const win = deps.getWindow()
    if (!isSpeechSynthesisSupported(win)) {
      warnUnsupportedOnce()
      return
    }
    if (state.sentences.length === 0) return

    const currentPlaybackState = deps.store.getState().playbackState
    if (currentPlaybackState === 'playing') return // already playing — avoid overlapping audio

    if (currentPlaybackState === 'paused') {
      if (state.playbackWasPausedViaCancel || !state.hasStartedSpeaking) {
        // Safari-style resume (restart current sentence from its start), or
        // playback was paused before any utterance was ever actually queued
        // (e.g. pause() landed while still awaiting ensureVoiceReady()) — in
        // both cases there's nothing live for speechSynthesis.resume() to
        // resume, so restart the current sentence from scratch instead of
        // silently stranding playback.
        state.playbackWasPausedViaCancel = false
        cancelSpeechDefensively()
        const myEpoch = state.epoch
        deps.store.setState({ playbackState: 'playing' })
        ensureVoiceReady().then(() => {
          if (myEpoch !== state.epoch) return
          if (deps.store.getState().playbackState !== 'playing') return
          speakCurrentSentence()
        })
      } else {
        const synth = getSynth()
        if (synth?.paused) synth.resume()
        deps.store.setState({ playbackState: 'playing' })
      }
      return
    }

    // Fresh start from idle (start of passage, or after reaching its end).
    cancelSpeechDefensively()
    const myEpoch = state.epoch
    deps.store.setState({ playbackState: 'playing' })
    ensureVoiceReady().then(() => {
      if (myEpoch !== state.epoch) return // a seek/pause/destroy happened while we waited
      if (deps.store.getState().playbackState !== 'playing') return
      speakCurrentSentence()
    })
  }

  function pause(): void {
    const win = deps.getWindow()
    if (!isSpeechSynthesisSupported(win)) return
    if (deps.store.getState().playbackState !== 'playing') return

    clearFallbackTimer()
    clearWatchdog()

    if (isSafariUserAgent(deps.getUserAgent())) {
      // speechSynthesis.pause() is unreliable on Safari; cancel instead and
      // mark that resume should restart the current sentence (`sentenceIndex`
      // itself already "remembers" which one — it's only advanced in
      // onend/onerror, neither of which fires once we've cancelled) from the
      // top rather than resuming mid-word — an accepted, explicit tradeoff.
      state.playbackWasPausedViaCancel = true
      cancelSpeechDefensively()
      const sentence = state.sentences[state.sentenceIndex]
      deps.store.setState({ playbackState: 'paused', currentWordId: sentence?.words[0]?.id ?? null })
    } else {
      getSynth()?.pause()
      deps.store.setState({ playbackState: 'paused' })
    }
  }

  function seekToSentence(sentenceIndex: number): void {
    if (state.sentences.length === 0) return
    const clamped = Math.max(0, Math.min(sentenceIndex, state.sentences.length - 1))

    cancelSpeechDefensively()
    state.sentenceIndex = clamped
    state.playbackWasPausedViaCancel = false

    const sentence = state.sentences[clamped]
    deps.store.setState({
      currentSentenceIndex: clamped,
      currentWordId: sentence?.words[0]?.id ?? null,
      activeSceneBeatId: sentence?.sceneBeatId ?? null,
      activeSpeakerId: sentence?.speakerId ?? null,
      playbackState: 'playing',
    })

    const myEpoch = state.epoch
    ensureVoiceReady().then(() => {
      if (myEpoch !== state.epoch) return
      speakCurrentSentence()
    })
  }

  function destroy(): void {
    cancelSpeechDefensively()
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
