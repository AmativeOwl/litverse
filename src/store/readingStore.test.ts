import { describe, expect, it } from 'vitest'
import { useReadingStore } from './readingStore'

describe('readingStore', () => {
  it('starts in idle state with no active sentence/word/beat/speaker', () => {
    const state = useReadingStore.getState()
    expect(state.playbackState).toBe('idle')
    expect(state.currentSentenceIndex).toBe(0)
    expect(state.currentWordId).toBeNull()
    expect(state.activeSceneBeatId).toBeNull()
    expect(state.activeSpeakerId).toBeNull()
  })

  it('play() transitions playbackState to playing', () => {
    useReadingStore.getState().play()
    expect(useReadingStore.getState().playbackState).toBe('playing')
  })

  it('pause() transitions playbackState to paused', () => {
    useReadingStore.getState().pause()
    expect(useReadingStore.getState().playbackState).toBe('paused')
  })

  it('jumpToSentence() updates the sentence index and clears the current word', () => {
    useReadingStore.getState().jumpToSentence(3)
    const state = useReadingStore.getState()
    expect(state.currentSentenceIndex).toBe(3)
    expect(state.currentWordId).toBeNull()
  })
})
