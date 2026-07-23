import { create } from 'zustand'

export type PlaybackState = 'idle' | 'playing' | 'paused'

interface ReadingState {
  currentSentenceIndex: number
  currentWordId: string | null
  activeSceneBeatId: string | null
  activeSpeakerId: string | null
  playbackState: PlaybackState

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

  play: () => set({ playbackState: 'playing' }),
  pause: () => set({ playbackState: 'paused' }),
  jumpToSentence: (sentenceIndex) =>
    set({ currentSentenceIndex: sentenceIndex, currentWordId: null }),
}))
