import { useMemo } from 'react'
import type { Passage, Sentence } from '../types'
import {
  pause as narrationPause,
  play as narrationPlay,
  seekToSentence,
  setPlaybackRate,
} from '../lib/narrationController'
import { storeRate } from '../lib/readerPrefs'
import { useReadingStore } from '../store/readingStore'
import PlaybackControls from './PlaybackControls'

interface CaptionBarProps {
  passage: Passage
}

/**
 * Cinema-mode subtitle bar: the current sentence rendered word-by-word at
 * the bottom of the fullscreen world, with the same two-level highlight
 * treatment as TextPane -- a solid amber block on the active word over a
 * softly washed sentence. Subscribes to `currentSentenceIndex` and
 * `currentWordId` exactly like TextPane does: word-level state stays in
 * this DOM overlay, which the design constraints permit -- it never enters
 * the R3F subtree.
 */
export default function CaptionBar({ passage }: CaptionBarProps) {
  const sentences = useMemo<Sentence[]>(
    () => passage.paragraphs.flatMap((paragraph) => paragraph.sentences),
    [passage],
  )
  const currentSentenceIndex = useReadingStore((state) => state.currentSentenceIndex)
  const currentWordId = useReadingStore((state) => state.currentWordId)
  const playbackState = useReadingStore((state) => state.playbackState)
  const narrationAvailable = useReadingStore((state) => state.narrationAvailable)
  const playbackRate = useReadingStore((state) => state.playbackRate)

  const sentence = sentences[currentSentenceIndex]
  if (!sentence) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-6 pb-6">
      <p
        className="pointer-events-auto max-w-3xl rounded-lg bg-neutral-950/70 px-6 py-4 text-center font-serif text-xl leading-relaxed text-neutral-100 backdrop-blur-sm md:text-2xl"
        aria-live="off"
      >
        {sentence.words.map((word, wordIndex) => (
          <span key={word.id}>
            <span
              className={
                word.id === currentWordId
                  ? 'rounded-sm bg-amber-400/90 px-0.5 text-neutral-950 transition-all duration-150'
                  : 'transition-colors duration-300'
              }
            >
              {word.text}
            </span>
            {wordIndex < sentence.words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
      <div className="pointer-events-auto flex items-center gap-3 text-xs text-neutral-400">
        <PlaybackControls
          size="md"
          playing={playbackState === 'playing'}
          onPrev={() => seekToSentence(Math.max(0, currentSentenceIndex - 1))}
          onTogglePlay={() => (playbackState === 'playing' ? narrationPause() : narrationPlay())}
          onNext={() => seekToSentence(Math.min(sentences.length - 1, currentSentenceIndex + 1))}
          playDisabled={!narrationAvailable}
          playDisabledTitle="This book has no pre-rendered narration — click sentences to read through it."
          rate={narrationAvailable ? playbackRate : undefined}
          onRateChange={
            narrationAvailable
              ? (rate) => {
                  setPlaybackRate(rate)
                  storeRate(rate)
                }
              : undefined
          }
        />
        <span className="select-none text-[11px] uppercase tracking-[0.18em] opacity-70">Esc to return</span>
      </div>
    </div>
  )
}
