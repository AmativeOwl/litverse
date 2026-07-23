import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createNarrationController,
  findWordIdAtTime,
  type AudioLike,
  type NarrationControllerDeps,
  type NarrationManifest,
  type NarrationPositionState,
  type WordTiming,
} from './narrationController'
import type { Passage, Sentence } from '../types'

// ---------------------------------------------------------------------------
// findWordIdAtTime — pure function, no fakes needed.
// ---------------------------------------------------------------------------

describe('findWordIdAtTime', () => {
  const words: WordTiming[] = [
    { wordId: 'w1', startMs: 0, endMs: 200 },
    { wordId: 'w2', startMs: 200, endMs: 500 },
    { wordId: 'w3', startMs: 500, endMs: 900 },
  ]

  it('returns null for an empty array', () => {
    expect(findWordIdAtTime([], 100)).toBeNull()
  })

  it('returns the first word before any word has started', () => {
    expect(findWordIdAtTime(words, -50)).toBe('w1')
  })

  it('returns the word whose startMs exactly matches the given time', () => {
    expect(findWordIdAtTime(words, 200)).toBe('w2')
  })

  it('returns the most recently started word for a time between two starts', () => {
    expect(findWordIdAtTime(words, 350)).toBe('w2')
  })

  it('returns the last word at or after its start time, including past its own end', () => {
    expect(findWordIdAtTime(words, 500)).toBe('w3')
    expect(findWordIdAtTime(words, 5000)).toBe('w3')
  })

  it('works correctly for a single-word array', () => {
    const single: WordTiming[] = [{ wordId: 'only', startMs: 100, endMs: 300 }]
    expect(findWordIdAtTime(single, 0)).toBe('only')
    expect(findWordIdAtTime(single, 500)).toBe('only')
  })
})

// ---------------------------------------------------------------------------
// Controller — driven with fake AudioLike instances and a fake manifest
// fetcher, per CLAUDE.md's testing note: no real browser Audio API in jsdom.
// ---------------------------------------------------------------------------

class FakeAudio implements AudioLike {
  src = ''
  currentTime = 0
  paused = true
  ontimeupdate: ((ev: Event) => void) | null = null
  onended: ((ev: Event) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  playCalls = 0
  playResult: 'resolve' | 'reject' = 'resolve'

  play = vi.fn(async (): Promise<void> => {
    this.playCalls += 1
    if (this.playResult === 'reject') {
      throw new Error('play() rejected')
    }
    this.paused = false
  })

  pause = vi.fn((): void => {
    this.paused = true
  })

  /** Test helper: simulate the browser advancing playback position and firing timeupdate. */
  advanceTo(ms: number): void {
    this.currentTime = ms / 1000
    this.ontimeupdate?.(new Event('timeupdate'))
  }

  /** Test helper: simulate the clip finishing. */
  finish(): void {
    this.onended?.(new Event('ended'))
  }

  /** Test helper: simulate a playback error. */
  triggerError(): void {
    this.onerror?.(new Event('error'))
  }
}

function makeSentence(id: string, sceneBeatId: string, wordCount: number, speakerId?: string): Sentence {
  return {
    id,
    sceneBeatId,
    ...(speakerId ? { speakerId } : {}),
    words: Array.from({ length: wordCount }, (_, i) => ({
      id: `${id}-w${i + 1}`,
      text: `word${i + 1}`,
      normalized: `word${i + 1}`,
    })),
  }
}

function manifestEntryFor(sentence: Sentence, msPerWord = 300): NarrationManifest[string] {
  const words: WordTiming[] = sentence.words.map((w, i) => ({
    wordId: w.id,
    startMs: i * msPerWord,
    endMs: (i + 1) * msPerWord,
  }))
  return {
    audioUrl: `/narration/test-passage/${sentence.id}.wav`,
    durationMs: sentence.words.length * msPerWord,
    words,
  }
}

function makeFixture() {
  const s1 = makeSentence('p1-s1', 'arrival', 2)
  const s2 = makeSentence('p1-s2', 'arrival', 3, 'nick')
  const s3 = makeSentence('p2-s1', 'peak-revelry', 1)

  const passage: Passage = {
    id: 'test-passage',
    title: 'Test Passage',
    paragraphs: [
      { id: 'p1', sentences: [s1, s2] },
      { id: 'p2', sentences: [s3] },
    ],
  }

  const manifest: NarrationManifest = {
    [s1.id]: manifestEntryFor(s1),
    [s2.id]: manifestEntryFor(s2),
    [s3.id]: manifestEntryFor(s3),
  }

  return { passage, manifest, s1, s2, s3 }
}

interface Harness {
  controller: ReturnType<typeof createNarrationController>
  store: NarrationPositionState
  audios: FakeAudio[]
  fetchManifest: ReturnType<typeof vi.fn>
  documentListeners: Map<string, (ev: Event) => void>
  simulateVisibilityChange: (state: DocumentVisibilityState) => void
  /** Makes the *next* audio element created by the controller reject on play(). */
  rejectNextPlay: () => void
}

function createHarness(
  manifestResult: NarrationManifest | 'reject' = {},
  depOverrides: Partial<NarrationControllerDeps> = {},
): Harness {
  const store: NarrationPositionState = {
    currentSentenceIndex: 0,
    currentWordId: null,
    activeSceneBeatId: null,
    activeSpeakerId: null,
    playbackState: 'idle',
    activeMotifId: null,
    activeMotifNonce: 0,
  }

  const audios: FakeAudio[] = []
  const documentListeners = new Map<string, (ev: Event) => void>()
  let visibilityState: DocumentVisibilityState = 'visible'
  let nextPlayResult: 'resolve' | 'reject' = 'resolve'

  const fetchManifest = vi.fn(async (): Promise<NarrationManifest> => {
    if (manifestResult === 'reject') throw new Error('manifest fetch failed')
    return manifestResult
  })

  const controller = createNarrationController({
    store: {
      getState: () => store,
      setState: (partial) => Object.assign(store, partial),
    },
    createAudio: () => {
      const audio = new FakeAudio()
      audio.playResult = nextPlayResult
      nextPlayResult = 'resolve'
      audios.push(audio)
      return audio
    },
    fetchManifest,
    getDocument: () => ({
      addEventListener: (type: string, listener: (ev: Event) => void) => {
        documentListeners.set(type, listener)
      },
      removeEventListener: (type: string) => {
        documentListeners.delete(type)
      },
      get visibilityState() {
        return visibilityState
      },
    }),
    ...depOverrides,
  })

  return {
    controller,
    store,
    audios,
    fetchManifest,
    documentListeners,
    simulateVisibilityChange: (state) => {
      visibilityState = state
      documentListeners.get('visibilitychange')?.(new Event('visibilitychange'))
    },
    rejectNextPlay: () => {
      nextPlayResult = 'reject'
    },
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('createNarrationController', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('loadPassage', () => {
    it('resets store position to the first sentence and starts fetching the manifest', () => {
      const { passage, manifest, s1 } = makeFixture()
      const { controller, store, fetchManifest } = createHarness(manifest)

      controller.loadPassage(passage)

      expect(store.currentSentenceIndex).toBe(0)
      expect(store.currentWordId).toBeNull()
      expect(store.activeSceneBeatId).toBe(s1.sceneBeatId)
      expect(store.activeSpeakerId).toBeNull()
      expect(store.playbackState).toBe('idle')
      expect(fetchManifest).toHaveBeenCalledWith(`/narration/${passage.id}/manifest.json`)
    })

    it('does not start playing on its own', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)

      controller.loadPassage(passage)
      await flushMicrotasks()

      expect(store.playbackState).toBe('idle')
      expect(audios).toHaveLength(0)
    })
  })

  describe('play', () => {
    it('plays the first sentence: sets store fields, plays audio for it', async () => {
      const { passage, manifest, s1 } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      controller.loadPassage(passage)

      controller.play()
      expect(store.playbackState).toBe('playing') // set synchronously, before the manifest await resolves
      await flushMicrotasks()

      expect(audios).toHaveLength(1)
      expect(audios[0]?.src).toBe(manifest[s1.id]?.audioUrl)
      expect(audios[0]?.playCalls).toBe(1)
      expect(store.currentSentenceIndex).toBe(0)
      expect(store.currentWordId).toBe(s1.words[0]?.id)
    })

    it('is a no-op if already playing (does not start a second audio element)', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, audios } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      controller.play()
      await flushMicrotasks()

      expect(audios).toHaveLength(1)
    })

    it('advances currentWordId as ontimeupdate fires, via findWordIdAtTime', async () => {
      const { passage, manifest, s2 } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.seekToSentence(1) // s2, 3 words at 300ms apart
      await flushMicrotasks()

      audios[0]?.advanceTo(650) // into the third word's window (600-900ms)
      expect(store.currentWordId).toBe(s2.words[2]?.id)
    })
  })

  describe('sentence chaining', () => {
    it('chains to the next sentence after a pause when a clip ends', async () => {
      vi.useFakeTimers()
      const { passage, manifest, s2 } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      audios[0]?.finish()
      expect(store.currentSentenceIndex).toBe(0) // not yet — the inter-sentence pause hasn't elapsed

      await vi.runAllTimersAsync()

      expect(store.currentSentenceIndex).toBe(1)
      expect(audios).toHaveLength(2)
      expect(audios[1]?.src).toBe(manifest[s2.id]?.audioUrl)
    })

    it('reaches idle (finishPassage) after the last sentence ends', async () => {
      vi.useFakeTimers()
      const { passage, manifest } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.seekToSentence(2) // last sentence (p2-s1)
      await flushMicrotasks()

      audios[audios.length - 1]?.finish()
      await vi.runAllTimersAsync()

      expect(store.playbackState).toBe('idle')
      expect(store.currentWordId).toBeNull()
    })
  })

  describe('pause/resume', () => {
    it('pauses the current audio element and sets playbackState', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      controller.pause()

      expect(audios[0]?.pause).toHaveBeenCalledTimes(1)
      expect(store.playbackState).toBe('paused')
    })

    it('is a no-op if not currently playing', () => {
      const { passage, manifest } = makeFixture()
      const { controller, store } = createHarness(manifest)
      controller.loadPassage(passage)

      controller.pause()

      expect(store.playbackState).toBe('idle')
    })

    it('resumes by calling play() again on the same audio element (no restart)', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()
      controller.pause()

      controller.play()
      await flushMicrotasks()

      expect(audios).toHaveLength(1) // same audio element, not a fresh one
      expect(audios[0]?.playCalls).toBe(2)
      expect(store.playbackState).toBe('playing')
    })

    it('restarts the sentence fresh if pause() landed before any audio had actually started', async () => {
      // Simulate pause() racing ahead of the manifest fetch resolving.
      const { passage, manifest } = makeFixture()
      let resolveManifest: (m: NarrationManifest) => void = () => {}
      const pendingManifest = new Promise<NarrationManifest>((resolve) => {
        resolveManifest = resolve
      })
      const { controller, store, audios } = createHarness(manifest, {
        fetchManifest: vi.fn(() => pendingManifest),
      })
      controller.loadPassage(passage)

      controller.play() // starts awaiting the manifest
      controller.pause() // lands before the manifest (and thus the first audio) ever resolves
      expect(store.playbackState).toBe('paused')

      resolveManifest(manifest)
      await flushMicrotasks()

      // Since nothing had actually started, pause() alone should not have
      // caused playback to begin on its own.
      expect(audios).toHaveLength(0)

      controller.play()
      await flushMicrotasks()

      expect(audios).toHaveLength(1)
      expect(store.playbackState).toBe('playing')
    })
  })

  describe('seekToSentence', () => {
    it('cancels current playback and starts the target sentence immediately', async () => {
      const { passage, manifest, s3 } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      controller.seekToSentence(2)
      await flushMicrotasks()

      expect(audios[0]?.pause).toHaveBeenCalled() // the first sentence's audio was stopped
      expect(store.currentSentenceIndex).toBe(2)
      expect(store.currentWordId).toBe(s3.words[0]?.id)
      expect(store.playbackState).toBe('playing')
      expect(audios).toHaveLength(2)
      expect(audios[1]?.src).toBe(manifest[s3.id]?.audioUrl)
    })

    it('clamps out-of-range indices into bounds', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, store } = createHarness(manifest)
      controller.loadPassage(passage)

      controller.seekToSentence(999)
      await flushMicrotasks()
      expect(store.currentSentenceIndex).toBe(2) // last valid index

      controller.seekToSentence(-5)
      await flushMicrotasks()
      expect(store.currentSentenceIndex).toBe(0)
    })

    it('a stale in-flight ontimeupdate from before the seek cannot clobber the new sentence state', async () => {
      const { passage, manifest, s3 } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()
      const staleAudio = audios[0]

      controller.seekToSentence(2)
      await flushMicrotasks()

      staleAudio?.advanceTo(50) // fire a late event from the now-abandoned first sentence
      expect(store.currentWordId).toBe(s3.words[0]?.id) // unaffected by the stale event
    })
  })

  describe('missing or failing audio', () => {
    it('skips a sentence with no manifest entry and plays the next one', async () => {
      const { passage, s3 } = makeFixture()
      const partialManifest: NarrationManifest = {
        [s3.id]: manifestEntryFor(s3),
        // s1 and s2 deliberately have no manifest entry
      }
      const { controller, store, audios } = createHarness(partialManifest)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      controller.loadPassage(passage)

      controller.play()
      await flushMicrotasks()

      expect(store.currentSentenceIndex).toBe(2) // skipped straight through s1 and s2
      expect(audios).toHaveLength(1)
      expect(audios[0]?.src).toBe(partialManifest[s3.id]?.audioUrl)
      expect(warnSpy).toHaveBeenCalled()
    })

    it('degrades to idle (never throws) when the manifest fetch fails entirely', async () => {
      const { passage } = makeFixture()
      const { controller, store } = createHarness('reject')
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      controller.loadPassage(passage)

      expect(() => controller.play()).not.toThrow()
      await flushMicrotasks()

      expect(store.playbackState).toBe('idle')
    })

    it('skips to the next sentence when audio.play() rejects', async () => {
      vi.useFakeTimers()
      const { passage, manifest, s2 } = makeFixture()
      const { controller, store, audios, rejectNextPlay } = createHarness(manifest)
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      controller.loadPassage(passage)

      rejectNextPlay() // the first sentence's audio element will reject on play()
      controller.play()
      await flushMicrotasks()
      await vi.runAllTimersAsync()

      expect(store.currentSentenceIndex).toBe(1) // skipped past the rejecting sentence
      expect(audios[1]?.src).toBe(manifest[s2.id]?.audioUrl)
    })

    it('skips to the next sentence on an onerror event mid-clip', async () => {
      vi.useFakeTimers()
      const { passage, manifest, s2 } = makeFixture()
      const { controller, store, audios } = createHarness(manifest)
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      audios[0]?.triggerError()
      await vi.runAllTimersAsync()

      expect(store.currentSentenceIndex).toBe(1)
      expect(audios[1]?.src).toBe(manifest[s2.id]?.audioUrl)
    })
  })

  describe('visibilitychange resync', () => {
    it('resumes playback if the browser silently paused it while the tab was hidden', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, store, audios, simulateVisibilityChange } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      // Simulate the browser throttling/suspending background audio.
      const audio = audios[0]
      if (audio) audio.paused = true

      simulateVisibilityChange('visible')

      expect(audio?.playCalls).toBe(2) // the initial play() plus the resync play()
      expect(store.playbackState).toBe('playing')
    })

    it('does nothing if the tab becomes hidden (only resyncs on becoming visible)', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, audios, simulateVisibilityChange } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      simulateVisibilityChange('hidden')

      expect(audios[0]?.playCalls).toBe(1)
    })

    it('does nothing if playback is already progressing normally', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, audios, simulateVisibilityChange } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()
      // audios[0].paused is false after a successful play() resolves.

      simulateVisibilityChange('visible')

      expect(audios[0]?.playCalls).toBe(1) // no redundant resync call
    })
  })

  describe('destroy', () => {
    it('stops playback and detaches the visibility listener', async () => {
      const { passage, manifest } = makeFixture()
      const { controller, audios, documentListeners } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      controller.destroy()

      expect(audios[0]?.pause).toHaveBeenCalled()
      expect(documentListeners.has('visibilitychange')).toBe(false)
    })

    it('re-attaches the visibility listener if the controller is reused after destroy()', () => {
      const { passage, manifest } = makeFixture()
      const { controller, documentListeners } = createHarness(manifest)
      controller.loadPassage(passage)
      controller.destroy()

      controller.loadPassage(passage)

      expect(documentListeners.has('visibilitychange')).toBe(true)
    })
  })

  describe('imagery motifs', () => {
    // src/data/motif-triggers.json is imported directly (static content data,
    // like SCENE_BEATS in WorldScene.tsx -- not injected via deps), so these
    // tests exercise it against one of its real entries rather than a fake
    // trigger map. makeSentence's `${id}-w${i+1}` id scheme means a 12-word
    // sentence built with id 'p1-s2' lands its last word on 'p1-s2-w12',
    // which motif-triggers.json really does tag as "dust-drift" -- without
    // needing the actual gatsby-ch3 passage text in this test.
    function makeMotifFixture(wordCount: number) {
      const sentence = makeSentence('p1-s2', 'arrival', wordCount)
      const passage: Passage = {
        id: 'motif-fixture',
        title: 'Motif Fixture',
        paragraphs: [{ id: 'p1', sentences: [sentence] }],
      }
      const manifest: NarrationManifest = { [sentence.id]: manifestEntryFor(sentence) }
      return { sentence, passage, manifest }
    }

    it('fires the tagged motif when narration reaches a trigger word', async () => {
      const { passage, manifest } = makeMotifFixture(12)
      const { controller, store, audios } = createHarness(manifest)

      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      expect(store.activeMotifId).toBeNull() // word 1 isn't tagged

      audios[0]?.advanceTo(3300) // word 12's window (300ms/word => starts at 3300ms)
      expect(store.activeMotifId).toBe('dust-drift')
      expect(store.activeMotifNonce).toBe(1)
    })

    it('does not re-fire on repeated timeupdate ticks for the same already-tagged word', async () => {
      const { passage, manifest } = makeMotifFixture(12)
      const { controller, store, audios } = createHarness(manifest)

      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      audios[0]?.advanceTo(3300)
      expect(store.activeMotifNonce).toBe(1)

      audios[0]?.advanceTo(3350)
      audios[0]?.advanceTo(3400)
      expect(store.activeMotifNonce).toBe(1) // unchanged -- still the same word
    })

    it('does not fire for words with no motif-triggers.json entry', async () => {
      const { passage, manifest } = makeMotifFixture(5) // no tagged word among the first 5
      const { controller, store, audios } = createHarness(manifest)

      controller.loadPassage(passage)
      controller.play()
      await flushMicrotasks()

      audios[0]?.advanceTo(1200) // word 5
      expect(store.activeMotifId).toBeNull()
      expect(store.activeMotifNonce).toBe(0)
    })
  })
})
