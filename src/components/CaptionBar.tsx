import { useMemo } from 'react'
import type { Passage, SceneBeat, Sentence } from '../types'
import {
  pause as narrationPause,
  play as narrationPlay,
  seekToSentence,
  setPlaybackRate,
} from '../lib/narrationController'
import { storeRate } from '../lib/readerPrefs'
import { useBeatAccent } from '../lib/useBeatAccent'
import { useReadingStore } from '../store/readingStore'
import PlaybackControls from './PlaybackControls'

interface CaptionBarProps {
  passage: Passage
  /** The scene's beats, for the active-word accent color (falls back to amber when omitted). */
  beats?: readonly SceneBeat[]
}

/**
 * Cinema-mode subtitle bar: the current sentence rendered word-by-word at
 * the bottom of the fullscreen world, with the same active-word treatment
 * as TextPane -- beat-accent ink with a soft same-hue halo (no background
 * block). Subscribes to `currentSentenceIndex` and
 * `currentWordId` exactly like TextPane does: word-level state stays in
 * this DOM overlay, which the design constraints permit -- it never enters
 * the R3F subtree.
 */
export default function CaptionBar({ passage, beats }: CaptionBarProps) {
  const sentences = useMemo<Sentence[]>(
    () => passage.paragraphs.flatMap((paragraph) => paragraph.sentences),
    [passage],
  )
  const currentSentenceIndex = useReadingStore((state) => state.currentSentenceIndex)
  const currentWordId = useReadingStore((state) => state.currentWordId)
  const playbackState = useReadingStore((state) => state.playbackState)
  const narrationAvailable = useReadingStore((state) => state.narrationAvailable)
  const playbackRate = useReadingStore((state) => state.playbackRate)
  const accent = useBeatAccent(beats)

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
              // Accent ink + same-hue halo instead of the old background
              // block (which also nudged layout via its px-0.5) -- matches
              // TextPane's treatment, zero reflow as the highlight moves.
              className="transition-all duration-200"
              style={
                word.id === currentWordId
                  ? { color: accent, textShadow: `0 0 14px color-mix(in srgb, ${accent} 65%, transparent)` }
                  : undefined
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
