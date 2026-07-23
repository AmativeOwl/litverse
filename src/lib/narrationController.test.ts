import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildUtteranceText,
  findWordIdAtCharIndex,
  selectPreferredVoice,
  isBoundaryTrackingReliable,
  computeWordTimerDelaysMs,
  isSpeechSynthesisSupported,
  isSafariUserAgent,
  createNarrationController,
} from './narrationController'
import type { Passage, Sentence } from '../types'

// ---------------------------------------------------------------------------
// Pure helper smoke tests
// ---------------------------------------------------------------------------

const fixtureSentence: Sentence = {
  id: 's1',
  sceneBeatId: 'arrival',
  words: [
    { id: 'w1', text: 'In', normalized: 'in' },
    { id: 'w2', text: 'his', normalized: 'his' },
    { id: 'w3', text: 'blue', normalized: 'blue' },
    { id: 'w4', text: 'gardens', normalized: 'gardens' },
  ],
}

describe('buildUtteranceText', () => {
  it('concatenates normalized words with single spaces and builds matching offsets', () => {
    const { text, offsets } = buildUtteranceText(fixtureSentence)
    expect(text).toBe('in his blue gardens')
    expect(offsets).toEqual([
      { wordId: 'w1', charStart: 0, charEnd: 2 },
      { wordId: 'w2', charStart: 3, charEnd: 6 },
      { wordId: 'w3', charStart: 7, charEnd: 11 },
      { wordId: 'w4', charStart: 12, charEnd: 19 },
    ])
  })
})

describe('findWordIdAtCharIndex', () => {
  const { offsets } = buildUtteranceText(fixtureSentence)

  it('finds the exact word for an index inside its range', () => {
    expect(findWordIdAtCharIndex(offsets, 0)).toBe('w1')
    expect(findWordIdAtCharIndex(offsets, 4)).toBe('w2')
    expect(findWordIdAtCharIndex(offsets, 18)).toBe('w4')
  })

  it('tolerantly clamps an index that falls in a space gap', () => {
    // index 2 is the space right after "in" (charEnd of w1)
    expect(findWordIdAtCharIndex(offsets, 2)).toBe('w1')
  })

  it('returns null for an empty offset table', () => {
    expect(findWordIdAtCharIndex([], 0)).toBeNull()
  })
})

describe('selectPreferredVoice', () => {
  it('picks the first matching name in preference order', () => {
    const voices = [
      { name: 'Alex', lang: 'en-US' },
      { name: 'Samantha', lang: 'en-US' },
    ]
    expect(selectPreferredVoice(voices, ['Samantha', 'Alex'])?.name).toBe('Samantha')
  })

  it('falls back to any English voice when no preferred name matches', () => {
    const voices = [
      { name: 'Weirdo', lang: 'fr-FR' },
      { name: 'Other', lang: 'en-GB' },
    ]
    expect(selectPreferredVoice(voices, ['Nonexistent'])?.name).toBe('Other')
  })

  it('falls back to the first voice when nothing else matches', () => {
    const voices = [{ name: 'Weirdo', lang: 'fr-FR' }]
    expect(selectPreferredVoice(voices, ['Nonexistent'])?.name).toBe('Weirdo')
  })

  it('returns null for an empty voice list', () => {
    expect(selectPreferredVoice([])).toBeNull()
  })
})

describe('isBoundaryTrackingReliable', () => {
  it('is reliable when boundary events arrive at roughly a per-word rate', () => {
    expect(isBoundaryTrackingReliable(4, 4)).toBe(true)
    expect(isBoundaryTrackingReliable(2, 4)).toBe(true)
  })

  it('is unreliable when far fewer boundary events arrive than words', () => {
    expect(isBoundaryTrackingReliable(0, 4)).toBe(false)
    expect(isBoundaryTrackingReliable(1, 10)).toBe(false)
  })
})

describe('computeWordTimerDelaysMs', () => {
  it('returns one delay per word, longer words getting longer delays', () => {
    const delays = computeWordTimerDelaysMs(fixtureSentence.words, 165)
    expect(delays).toHaveLength(4)
    // "gardens" (7 chars) should take at least as long as "in" (2 chars)
    expect(delays[3]).toBeGreaterThanOrEqual(delays[0] ?? 0)
  })
})

describe('isSpeechSynthesisSupported', () => {
  it('is false for undefined window', () => {
    expect(isSpeechSynthesisSupported(undefined)).toBe(false)
  })

  it('is false when SpeechSynthesisUtterance is missing (e.g. Firefox)', () => {
    expect(isSpeechSynthesisSupported({ speechSynthesis: {} as SpeechSynthesis })).toBe(false)
  })

  it('is true when both APIs are present', () => {
    expect(
      isSpeechSynthesisSupported({
        speechSynthesis: {} as SpeechSynthesis,
        SpeechSynthesisUtterance: class {} as unknown as typeof SpeechSynthesisUtterance,
      }),
    ).toBe(true)
  })
})

describe('isSafariUserAgent', () => {
  it('detects real Safari', () => {
    expect(
      isSafariUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toBe(true)
  })

  it('does not flag Chrome (which also contains "Safari")', () => {
    expect(
      isSafariUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      ),
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Controller integration smoke tests, with a mocked Web Speech API
// ---------------------------------------------------------------------------

const fixturePassage: Passage = {
  id: 'fixture',
  title: 'Fixture',
  paragraphs: [
    {
      id: 'p1',
      sentences: [
        {
          id: 's1',
          sceneBeatId: 'arrival',
          words: [
            { id: 'w1', text: 'In', normalized: 'in' },
            { id: 'w2', text: 'his', normalized: 'his' },
          ],
        },
        {
          id: 's2',
          sceneBeatId: 'arrival',
          words: [
            { id: 'w3', text: 'blue', normalized: 'blue' },
            { id: 'w4', text: 'gardens', normalized: 'gardens' },
          ],
        },
      ],
    },
  ],
}

class FakeUtterance {
  text: string
  voice: unknown = null
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((ev: { error: string }) => void) | null = null
  onboundary: ((ev: { charIndex: number; name?: string }) => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

function makeFakeSynth(opts: { emitBoundaries: boolean; endDelayMs?: number }) {
  const spoken: string[] = []
  const synth = {
    speaking: false,
    paused: false,
    getVoices: () => [{ name: 'Alex', lang: 'en-US' }],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    cancel: vi.fn(function (this: typeof synth) {
      this.speaking = false
    }),
    pause: vi.fn(function (this: typeof synth) {
      this.paused = true
    }),
    resume: vi.fn(function (this: typeof synth) {
      this.paused = false
    }),
    speak: vi.fn(function (this: typeof synth, utterance: FakeUtterance) {
      spoken.push(utterance.text)
      this.speaking = true
      // onstart always fires promptly (microtask), same as real engines firing
      // it as soon as speech begins. `onend`, however, only fires once
      // `endDelayMs` of "speaking" has elapsed when provided — this models
      // real wall-clock speech duration, which is what gives the 500ms
      // boundary watchdog (and the fallback timer it starts) an actual
      // window to run before the utterance completes. Without this, a fake
      // synth that resolves everything in one microtask would make the
      // watchdog/fallback path structurally untestable: `onend` would always
      // beat it, no matter how the controller is implemented.
      queueMicrotask(() => {
        utterance.onstart?.()
        if (opts.emitBoundaries) {
          let idx = 0
          for (const word of utterance.text.split(' ')) {
            utterance.onboundary?.({ charIndex: idx, name: 'word' })
            idx += word.length + 1
          }
        }
        const finish = (): void => {
          this.speaking = false
          utterance.onend?.()
        }
        if (opts.endDelayMs) {
          setTimeout(finish, opts.endDelayMs)
        } else {
          finish()
        }
      })
    }),
  }
  return { synth, spoken }
}

function makeFakeStore() {
  let state = {
    currentSentenceIndex: 0,
    currentWordId: null as string | null,
    activeSceneBeatId: null as string | null,
    activeSpeakerId: null as string | null,
    playbackState: 'idle' as 'idle' | 'playing' | 'paused',
  }
  const wordIdHistory: (string | null)[] = []
  return {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      state = { ...state, ...partial }
      if ('currentWordId' in partial) wordIdHistory.push(partial.currentWordId ?? null)
    },
    wordIdHistory,
  }
}

describe('createNarrationController', () => {
  let flushMicrotasks: () => Promise<void>

  beforeEach(() => {
    flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('speaks sentence-by-sentence and updates store position in step', async () => {
    const { synth, spoken } = makeFakeSynth({ emitBoundaries: true })
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fixturePassage)
    expect(store.getState().activeSceneBeatId).toBe('arrival')

    controller.play()
    await flushMicrotasks()
    await flushMicrotasks()
    await flushMicrotasks()

    expect(spoken).toEqual(['in his', 'blue gardens'])
    expect(store.getState().playbackState).toBe('idle') // reached end of passage
    controller.destroy()
  })

  it('never throws when speechSynthesis is unsupported (Firefox-style degrade)', () => {
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => undefined,
      getDocument: () => undefined,
      getUserAgent: () => 'Mozilla/5.0 (Firefox)',
    })

    controller.loadPassage(fixturePassage)
    expect(() => controller.play()).not.toThrow()
    expect(() => controller.pause()).not.toThrow()
    expect(() => controller.seekToSentence(1)).not.toThrow()
    controller.destroy()
  })

  it('seek cancels current speech and starts from the target sentence', async () => {
    const { synth, spoken } = makeFakeSynth({ emitBoundaries: true })
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fixturePassage)
    controller.seekToSentence(1)
    await flushMicrotasks()
    await flushMicrotasks()

    expect(synth.cancel).toHaveBeenCalled()
    expect(spoken[0]).toBe('blue gardens')
    controller.destroy()
  })

  it('pause uses speechSynthesis.pause() on non-Safari browsers', async () => {
    const { synth } = makeFakeSynth({ emitBoundaries: true })
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () => 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36',
    })

    controller.loadPassage(fixturePassage)
    controller.play()
    store.setState({ playbackState: 'playing' }) // simulate being mid-utterance
    controller.pause()

    expect(synth.pause).toHaveBeenCalled()
    expect(store.getState().playbackState).toBe('paused')
    controller.destroy()
  })

  it('pause falls back to cancel + resume-at-sentence-start on Safari', () => {
    const { synth } = makeFakeSynth({ emitBoundaries: true })
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () =>
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    })

    controller.loadPassage(fixturePassage)
    store.setState({ playbackState: 'playing' })
    controller.pause()

    expect(synth.cancel).toHaveBeenCalled()
    expect(store.getState().playbackState).toBe('paused')
    controller.destroy()
  })

  it('falls back to the synthetic timer when boundary events are sparse', async () => {
    // A single four-word sentence, tested in isolation from a real passage
    // fixture: with two sentences (as `fixturePassage` has), the *second*
    // sentence's near-instant `onend` (this fake synth resolves `onend` in
    // the same microtask as `onstart` unless `endDelayMs` holds it open) can
    // race the first sentence's still-ticking fallback timer and clear it
    // via `clearFallbackTimer()` before its later words fire — a timing
    // artifact of the fake synth, not the controller. Isolating to one
    // sentence removes that cross-sentence coupling so this test verifies
    // exactly one thing: the fallback timer engages and advances through a
    // sentence's words when boundary events never arrive.
    const fallbackFixture: Passage = {
      id: 'fallback-fixture',
      title: 'Fallback Fixture',
      paragraphs: [
        {
          id: 'p1',
          sentences: [fixtureSentence], // 'in his blue gardens' — 4 words
        },
      ],
    }

    // endDelayMs holds `onend` open well past the 500ms boundary watchdog
    // plus the ~4 fallback-timer ticks it takes to reach the last word, so
    // the timer has room to run to completion before the sentence "ends" —
    // see the `makeFakeSynth` comment for why this matters.
    const { synth } = makeFakeSynth({ emitBoundaries: false, endDelayMs: 2500 })
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () => 'Safari fixture',
    })

    controller.loadPassage(fallbackFixture)
    controller.play()

    // Let the voice-ready microtask + speak() onstart microtask resolve, then
    // wait past the boundary watchdog window and the fallback timer's ticks
    // through all four words (real timers — no boundary events ever fire for
    // this fake synth), while staying well under `endDelayMs` so `onend`
    // hasn't cleared the timer yet.
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // currentWordId should have advanced through all four fixture words via
    // the fallback timer, despite no onboundary events ever firing for this
    // fake synth.
    expect(store.wordIdHistory).toEqual(expect.arrayContaining(['w1', 'w2', 'w3', 'w4']))
    controller.destroy()
  }, 10000)

  it('does not count sentence-level (non-word) boundary events toward the reliability heuristic', async () => {
    // Regression test: a voice that only ever fires coarse sentence-level
    // boundary events (event.name === 'sentence') must still be judged
    // *unreliable* for word-level tracking and fall back to the synthetic
    // timer — it must not accumulate boundaryEventCount from those events
    // and be mistaken for a voice that fires per-word boundaries.
    const spoken: string[] = []
    const synth = {
      speaking: false,
      paused: false,
      getVoices: () => [{ name: 'Alex', lang: 'en-US' }],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(function (this: typeof synth) {
        this.speaking = false
      }),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn(function (this: typeof synth, utterance: FakeUtterance) {
        spoken.push(utterance.text)
        this.speaking = true
        queueMicrotask(() => {
          utterance.onstart?.()
          // Only ever fire a single sentence-level boundary — never 'word'.
          utterance.onboundary?.({ charIndex: 0, name: 'sentence' })
          setTimeout(() => {
            this.speaking = false
            utterance.onend?.()
          }, 2500)
        })
      }),
    }
    const store = makeFakeStore()
    const fallbackFixture: Passage = {
      id: 'sentence-boundary-fixture',
      title: 'Sentence Boundary Fixture',
      paragraphs: [{ id: 'p1', sentences: [fixtureSentence] }], // 4 words
    }
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fallbackFixture)
    controller.play()

    // Past the 500ms watchdog window plus the fallback timer's ticks through
    // all four words, still well under the 2500ms onend delay.
    await new Promise((resolve) => setTimeout(resolve, 2000))

    expect(store.wordIdHistory).toEqual(expect.arrayContaining(['w1', 'w2', 'w3', 'w4']))
    controller.destroy()
  }, 10000)

  it('waits for a late voiceschanged event before speaking the first utterance', async () => {
    // getVoices() starts empty (as in real Chrome before voices load
    // asynchronously); the controller must wait for 'voiceschanged' rather
    // than proceeding with no voice or throwing.
    let voicesLoaded = false
    const voiceschangedRef: { handler: (() => void) | null } = { handler: null }
    const { synth: baseSynth, spoken } = makeFakeSynth({ emitBoundaries: true })
    const synth = {
      ...baseSynth,
      getVoices: () => (voicesLoaded ? [{ name: 'Alex', lang: 'en-US' }] : []),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'voiceschanged') voiceschangedRef.handler = handler
      }),
      removeEventListener: vi.fn(),
    }
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fixturePassage)
    controller.play()

    // Give the voice-ready promise a couple of microtask turns to run its
    // initial (empty) getVoices() check and register the listener.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(spoken).toHaveLength(0) // must not have started speaking yet

    // Now simulate voices arriving asynchronously.
    voicesLoaded = true
    voiceschangedRef.handler?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(spoken.length).toBeGreaterThan(0)
    controller.destroy()
  })

  it('proceeds without hanging if voices never load and voiceschanged never fires', async () => {
    const { synth: baseSynth, spoken } = makeFakeSynth({ emitBoundaries: true })
    const synth = {
      ...baseSynth,
      getVoices: () => [], // never resolves
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fixturePassage)
    controller.play()

    // Wait past the internal voices-ready timeout so play() proceeds anyway.
    await new Promise((resolve) => setTimeout(resolve, 2200))

    expect(spoken.length).toBeGreaterThan(0)
    controller.destroy()
  }, 10000)

  function makeFakeDocument() {
    let listener: (() => void) | null = null
    let visibilityState: DocumentVisibilityState = 'visible'
    const doc = {
      get visibilityState() {
        return visibilityState
      },
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'visibilitychange') listener = cb
      }),
      removeEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'visibilitychange' && listener === cb) listener = null
      }),
      setVisibility: (v: DocumentVisibilityState) => {
        visibilityState = v
      },
      fire: () => listener?.(),
      hasListener: () => listener !== null,
    }
    return doc
  }

  it('resyncs by re-speaking the current sentence when the tab returns visible and speech silently stopped', async () => {
    const { synth, spoken } = makeFakeSynth({ emitBoundaries: true, endDelayMs: 5000 })
    const store = makeFakeStore()
    const doc = makeFakeDocument()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () =>
        doc as unknown as Pick<
          Document,
          'addEventListener' | 'removeEventListener' | 'visibilityState'
        >,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fixturePassage)
    controller.play()
    await new Promise((resolve) => setTimeout(resolve, 50)) // let speak() start

    expect(doc.hasListener()).toBe(true)

    // Simulate the tab being backgrounded and the OS silently killing audio:
    // the store still thinks playback is 'playing' but the engine stopped.
    synth.speaking = false
    store.setState({ playbackState: 'playing' })
    doc.setVisibility('visible')
    doc.fire()

    expect(synth.cancel).toHaveBeenCalled()
    expect(spoken.length).toBeGreaterThanOrEqual(2) // re-spoke the current sentence

    controller.destroy()
    expect(doc.hasListener()).toBe(false) // destroy() detaches the listener
  })

  it('resyncs by pausing the engine when the store says paused but speech kept going', async () => {
    const { synth } = makeFakeSynth({ emitBoundaries: true, endDelayMs: 5000 })
    const store = makeFakeStore()
    const doc = makeFakeDocument()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () =>
        doc as unknown as Pick<
          Document,
          'addEventListener' | 'removeEventListener' | 'visibilityState'
        >,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fixturePassage)
    controller.play()
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Store thinks we're paused, but the engine is still actively speaking
    // and not paused — an inconsistent state the resync should correct.
    synth.speaking = true
    synth.paused = false
    store.setState({ playbackState: 'paused' })
    doc.setVisibility('visible')
    doc.fire()

    expect(synth.pause).toHaveBeenCalled()
    controller.destroy()
  })

  it('recovers if pause() lands before the very first utterance was ever queued (still awaiting ensureVoiceReady)', async () => {
    // Regression test: play() flips playbackState to 'playing' synchronously,
    // before ensureVoiceReady() resolves. If pause() lands in that window,
    // speechSynthesis.pause()/resume() have nothing real to act on (no
    // utterance was ever spoken yet) — a naive resume-via-`synth.resume()`
    // would silently strand playback forever. The controller must instead
    // detect nothing was actually queued and restart the sentence.
    let voicesLoaded = false
    const voiceschangedRef: { handler: (() => void) | null } = { handler: null }
    const { synth: baseSynth, spoken } = makeFakeSynth({ emitBoundaries: true })
    const synth = {
      ...baseSynth,
      getVoices: () => (voicesLoaded ? [{ name: 'Alex', lang: 'en-US' }] : []),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'voiceschanged') voiceschangedRef.handler = handler
      }),
      removeEventListener: vi.fn(),
    }
    const store = makeFakeStore()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () => undefined,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fixturePassage)
    controller.play() // kicks off ensureVoiceReady(), still pending — nothing spoken yet
    controller.pause() // lands in that window, before any utterance was ever queued

    expect(spoken).toHaveLength(0)
    expect(store.getState().playbackState).toBe('paused')

    controller.play() // resume: must restart the sentence, not rely on synth.resume()

    // Now let voices arrive asynchronously, as in the "late voiceschanged" test.
    voicesLoaded = true
    voiceschangedRef.handler?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(spoken.length).toBeGreaterThan(0) // playback actually started, not stranded
    controller.destroy()
  })

  it('re-attaches the visibility listener if the controller is reused after destroy() (e.g. a StrictMode remount)', () => {
    const { synth } = makeFakeSynth({ emitBoundaries: true })
    const store = makeFakeStore()
    const doc = makeFakeDocument()
    const controller = createNarrationController({
      store,
      getWindow: () => ({
        speechSynthesis: synth as unknown as SpeechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      }),
      getDocument: () =>
        doc as unknown as Pick<
          Document,
          'addEventListener' | 'removeEventListener' | 'visibilityState'
        >,
      getUserAgent: () => 'test-agent',
    })

    controller.loadPassage(fixturePassage)
    expect(doc.hasListener()).toBe(true)

    controller.destroy()
    expect(doc.hasListener()).toBe(false)

    controller.loadPassage(fixturePassage) // simulate the controller being reused post-destroy
    expect(doc.hasListener()).toBe(true)

    controller.destroy()
  })
})
