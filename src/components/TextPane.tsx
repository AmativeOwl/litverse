import { Fragment, useCallback, useEffect, useRef, type RefObject } from 'react'
import { pause as narrationPause, play as narrationPlay, seekToSentence } from '../lib/narrationController'
import { useReadingStore } from '../store/readingStore'
import type { Passage } from '../types'

/**
 * Local demo fixture — richer than the trivial `data/gatsby-ch3.ts` stub
 * (owned by the Content track) so this component can be built and tested
 * independently. `TextPane` accepts a `passage` prop; when the real
 * Chapter 3 passage lands, integration can pass it in
 * (`<TextPane passage={gatsbyCh3} />`) with no other changes required here.
 */
const fallbackPassage: Passage = {
  id: 'fixture-passage',
  title: 'Chapter 3 (fixture)',
  paragraphs: [
    {
      id: 'p1',
      sentences: [
        {
          id: 's1',
          sceneBeatId: 'arrival',
          words: [
            { id: 'p1s1w1', text: 'In', normalized: 'in' },
            { id: 'p1s1w2', text: 'his', normalized: 'his' },
            { id: 'p1s1w3', text: 'blue', normalized: 'blue' },
            { id: 'p1s1w4', text: 'gardens', normalized: 'gardens' },
            { id: 'p1s1w5', text: 'men', normalized: 'men' },
            { id: 'p1s1w6', text: 'and', normalized: 'and' },
            { id: 'p1s1w7', text: 'girls', normalized: 'girls' },
            { id: 'p1s1w8', text: 'came', normalized: 'came' },
            { id: 'p1s1w9', text: 'and', normalized: 'and' },
            { id: 'p1s1w10', text: 'went', normalized: 'went' },
            { id: 'p1s1w11', text: 'like', normalized: 'like' },
            { id: 'p1s1w12', text: 'moths', normalized: 'moths' },
            { id: 'p1s1w13', text: 'among', normalized: 'among' },
            { id: 'p1s1w14', text: 'the', normalized: 'the' },
            { id: 'p1s1w15', text: 'whisperings', normalized: 'whisperings' },
            { id: 'p1s1w16', text: 'and', normalized: 'and' },
            { id: 'p1s1w17', text: 'the', normalized: 'the' },
            { id: 'p1s1w18', text: 'champagne', normalized: 'champagne' },
            { id: 'p1s1w19', text: 'and', normalized: 'and' },
            { id: 'p1s1w20', text: 'the', normalized: 'the' },
            { id: 'p1s1w21', text: 'stars.', normalized: 'stars' },
          ],
        },
        {
          id: 's2',
          sceneBeatId: 'arrival',
          speakerId: 'nick',
          words: [
            { id: 'p1s2w1', text: 'On', normalized: 'on' },
            { id: 'p1s2w2', text: 'weekends', normalized: 'weekends' },
            { id: 'p1s2w3', text: 'his', normalized: 'his' },
            { id: 'p1s2w4', text: 'Rolls-Royce', normalized: 'rolls-royce' },
            { id: 'p1s2w5', text: 'became', normalized: 'became' },
            { id: 'p1s2w6', text: 'an', normalized: 'an' },
            { id: 'p1s2w7', text: 'omnibus,', normalized: 'omnibus' },
            { id: 'p1s2w8', text: 'bearing', normalized: 'bearing' },
            { id: 'p1s2w9', text: 'parties', normalized: 'parties' },
            { id: 'p1s2w10', text: 'to', normalized: 'to' },
            { id: 'p1s2w11', text: 'and', normalized: 'and' },
            { id: 'p1s2w12', text: 'from', normalized: 'from' },
            { id: 'p1s2w13', text: 'the', normalized: 'the' },
            { id: 'p1s2w14', text: 'city.', normalized: 'city' },
          ],
        },
      ],
    },
    {
      id: 'p2',
      sentences: [
        {
          id: 's3',
          sceneBeatId: 'peak-revelry',
          words: [
            { id: 'p2s1w1', text: 'By', normalized: 'by' },
            { id: 'p2s1w2', text: 'seven', normalized: 'seven' },
            { id: 'p2s1w3', text: "o'clock", normalized: "o'clock" },
            { id: 'p2s1w4', text: 'the', normalized: 'the' },
            { id: 'p2s1w5', text: 'orchestra', normalized: 'orchestra' },
            { id: 'p2s1w6', text: 'has', normalized: 'has' },
            { id: 'p2s1w7', text: 'arrived,', normalized: 'arrived' },
            { id: 'p2s1w8', text: 'no', normalized: 'no' },
            { id: 'p2s1w9', text: 'thin', normalized: 'thin' },
            { id: 'p2s1w10', text: 'five-piece', normalized: 'five-piece' },
            { id: 'p2s1w11', text: 'affair,', normalized: 'affair' },
            { id: 'p2s1w12', text: 'but', normalized: 'but' },
            { id: 'p2s1w13', text: 'a', normalized: 'a' },
            { id: 'p2s1w14', text: 'whole', normalized: 'whole' },
            { id: 'p2s1w15', text: 'pitful', normalized: 'pitful' },
            { id: 'p2s1w16', text: 'of', normalized: 'of' },
            { id: 'p2s1w17', text: 'oboes', normalized: 'oboes' },
            { id: 'p2s1w18', text: 'and', normalized: 'and' },
            { id: 'p2s1w19', text: 'trombones.', normalized: 'trombones' },
          ],
        },
      ],
    },
  ],
}

/** How long (ms) a scroll must go quiet before auto-scroll resumes. */
const AUTO_SCROLL_RESUME_DELAY_MS = 2500
/** How long (ms) after we scroll programmatically before a scroll event counts as user-driven. */
const PROGRAMMATIC_SCROLL_GRACE_MS = 800

/**
 * Debounced auto-scroll with manual-scroll backoff.
 *
 * Listens for scroll on the nearest scrollable ancestor of `rootRef`
 * (App.tsx wraps TextPane in an `overflow-y-auto` pane). Any scroll event
 * that didn't originate from our own `scrollIntoView` call is treated as
 * user-initiated: auto-scroll is suppressed until the user has been idle
 * for `AUTO_SCROLL_RESUME_DELAY_MS`.
 */
function useAutoScroll(rootRef: RefObject<HTMLElement>) {
  const containerRef = useRef<HTMLElement | null>(null)
  const userScrollingRef = useRef(false)
  const resumeTimerRef = useRef<number | undefined>(undefined)
  const programmaticUntilRef = useRef(0)

  useEffect(() => {
    const container = rootRef.current?.parentElement ?? rootRef.current
    containerRef.current = container
    if (!container) return

    const handleScroll = () => {
      if (Date.now() < programmaticUntilRef.current) {
        // This scroll was triggered by our own scrollIntoView call — ignore it.
        return
      }
      userScrollingRef.current = true
      if (resumeTimerRef.current !== undefined) {
        window.clearTimeout(resumeTimerRef.current)
      }
      resumeTimerRef.current = window.setTimeout(() => {
        userScrollingRef.current = false
      }, AUTO_SCROLL_RESUME_DELAY_MS)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (resumeTimerRef.current !== undefined) {
        window.clearTimeout(resumeTimerRef.current)
      }
    }
  }, [rootRef])

  return useCallback((target: HTMLElement | null) => {
    if (!target || userScrollingRef.current) return
    programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_GRACE_MS
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [])
}

/** Escapes a value for safe use inside an attribute-selector string. */
function escapeForSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

export interface TextPaneProps {
  passage?: Passage
}

export default function TextPane({ passage = fallbackPassage }: TextPaneProps) {
  const currentSentenceIndex = useReadingStore((s) => s.currentSentenceIndex)
  const currentWordId = useReadingStore((s) => s.currentWordId)
  const playbackState = useReadingStore((s) => s.playbackState)

  const rootRef = useRef<HTMLDivElement>(null)
  const scrollToActive = useAutoScroll(rootRef)

  // Flat list of every sentence in reading order, used for clamping seek targets.
  const flatSentences = passage.paragraphs.flatMap((p) => p.sentences)
  const totalSentences = flatSentences.length

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const target = currentWordId
      ? root.querySelector<HTMLElement>(`[data-word-id="${escapeForSelector(currentWordId)}"]`)
      : root.querySelector<HTMLElement>(`[data-sentence-index="${currentSentenceIndex}"]`)

    scrollToActive(target)
  }, [currentWordId, currentSentenceIndex, scrollToActive])

  let globalIndex = -1

  return (
    <div ref={rootRef} className="px-8 py-10 sm:px-12 md:px-16">
      {/*
        Real playback controls, wired to narrationController (the sole owner
        of the SpeechSynthesisUtterance lifecycle) rather than the reading
        store's own thin play/pause/jumpToSentence actions -- those only
        flip store state and don't touch speech synthesis. Word-by-word
        advancement has no manual control here because it's driven entirely
        by narrationController's onboundary/fallback-timer handling once
        playback starts.
      */}
      <div className="mb-8 flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 font-sans text-xs text-neutral-400">
        <button
          type="button"
          className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
          onClick={() => seekToSentence(Math.max(0, currentSentenceIndex - 1))}
        >
          ◀ Prev sentence
        </button>
        <button
          type="button"
          className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
          onClick={() => seekToSentence(Math.min(totalSentences - 1, currentSentenceIndex + 1))}
        >
          Next sentence ▶
        </button>
        <button
          type="button"
          className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
          onClick={() => (playbackState === 'playing' ? narrationPause() : narrationPlay())}
        >
          {playbackState === 'playing' ? 'Pause' : 'Play'}
        </button>
        <span className="ml-auto">
          sentence {currentSentenceIndex} · {playbackState}
        </span>
      </div>

      <h2 className="mb-8 font-sans text-xs font-normal uppercase tracking-[0.2em] text-neutral-500">
        {passage.title}
      </h2>

      <article className="max-w-prose font-serif text-lg leading-relaxed text-neutral-200 sm:text-xl">
        {passage.paragraphs.map((paragraph) => (
          <p key={paragraph.id} className="mb-6">
            {paragraph.sentences.map((sentence, sentenceInParagraphIndex) => {
              globalIndex += 1
              const sentenceIndex = globalIndex
              const isActiveSentence = sentenceIndex === currentSentenceIndex
              const isLastInParagraph = sentenceInParagraphIndex === paragraph.sentences.length - 1

              return (
                <Fragment key={sentence.id}>
                  <button
                    type="button"
                    data-sentence-index={sentenceIndex}
                    aria-current={isActiveSentence ? 'true' : undefined}
                    onClick={() => seekToSentence(sentenceIndex)}
                    className={`m-0 inline appearance-none rounded border-0 bg-transparent px-0.5 py-0.5 text-left font-serif text-inherit cursor-pointer transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                      isActiveSentence ? 'bg-amber-400/10 text-neutral-50' : 'text-neutral-200 hover:bg-neutral-800/60'
                    }`}
                  >
                    {sentence.words.map((word, wordIndex) => {
                      const isActiveWord = word.id === currentWordId
                      return (
                        <Fragment key={word.id}>
                          <span
                            data-word-id={word.id}
                            className={isActiveWord ? 'rounded bg-amber-400/80 text-neutral-900' : undefined}
                          >
                            {word.text}
                          </span>
                          {wordIndex < sentence.words.length - 1 ? ' ' : ''}
                        </Fragment>
                      )
                    })}
                  </button>
                  {isLastInParagraph ? '' : ' '}
                </Fragment>
              )
            })}
          </p>
        ))}
      </article>
    </div>
  )
}
