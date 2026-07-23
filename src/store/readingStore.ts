import { create } from 'zustand'

export type PlaybackState = 'idle' | 'playing' | 'paused'

interface ReadingState {
  currentSentenceIndex: number
  currentWordId: string | null
  activeSceneBeatId: string | null
  activeSpeakerId: string | null
  playbackState: PlaybackState
  /** Id of the Motif (src/data/motifs.json) currently playing its one-shot visual, or null when none is active. */
  activeMotifId: string | null
  /**
   * Increments every time a motif fires -- including re-firing the *same*
   * motif id twice in a row (e.g. two motif-tagged words close together
   * using the same catalog entry). Consumers key their one-shot animation
   * trigger off this, not off activeMotifId changing, since an unchanged id
   * would otherwise be a no-op re-render and silently swallow the second cue.
   */
  activeMotifNonce: number

  play: () => void
  pause: () => void
  jumpToSentence: (sentenceIndex: number) => void
}

export const useReadingStore = create<ReadingState>((set) => ({
  currentSentenceIndex: 0,
  currentWordId: null,
  activeSceneBeatId: null,
  activeSpeakerId: null,
  playbackState: 'idle',
  activeMotifId: null,
  activeMotifNonce: 0,

  play: () => set({ playbackState: 'playing' }),
  pause: () => set({ playbackState: 'paused' }),
  jumpToSentence: (sentenceIndex) => set({ currentSentenceIndex: sentenceIndex, currentWordId: null }),
}))
