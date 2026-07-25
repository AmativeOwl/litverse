import type { ReactNode } from 'react'
import { PLAYBACK_RATE_MAX, PLAYBACK_RATE_MIN } from '../lib/narrationController'
import { normalizeRate, PLAYBACK_RATE_STEP } from '../lib/readerPrefs'

/**
 * Shared playback-control cluster (prev / play-pause / next) used by both
 * TextPane's floating pill and the cinema-mode CaptionBar. Pure presentation:
 * callers wire the handlers to narrationController. Styled in the app's deco
 * language -- hairline neutral rings for the skips, a solid amber disc for
 * play/pause echoing the active-word highlight block.
 */

/** Also reused by TextPane's font-size stepper so every small circular control in the pill matches. */
export const SKIP_BUTTON =
  'inline-flex shrink-0 items-center justify-center rounded-full border border-neutral-700/80 bg-neutral-900/60 text-neutral-400 transition-colors hover:border-amber-400/70 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400'

const PLAY_BUTTON =
  'inline-flex shrink-0 items-center justify-center rounded-full bg-amber-400/90 text-neutral-950 shadow-[0_0_10px_rgba(251,191,36,0.25)] transition-all enabled:hover:bg-amber-300 enabled:hover:shadow-[0_0_16px_rgba(251,191,36,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none'

const SIZES = {
  /** TextPane's floating pill. */
  sm: { skip: 'h-7 w-7', play: 'h-8 w-8', skipIcon: 'h-3.5 w-3.5', playIcon: 'h-4 w-4' },
  /** Cinema-mode caption bar. */
  md: { skip: 'h-9 w-9', play: 'h-11 w-11', skipIcon: 'h-4 w-4', playIcon: 'h-5 w-5' },
} as const

function Icon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {children}
    </svg>
  )
}

export interface PlaybackControlsProps {
  playing: boolean
  onPrev: () => void
  onTogglePlay: () => void
  onNext: () => void
  /** Disables play/pause (e.g. a reader-added book with no pre-rendered narration). */
  playDisabled?: boolean
  playDisabledTitle?: string
  /**
   * Current narration speed multiplier. Providing both `rate` and
   * `onRateChange` appends a -/+ speed stepper (0.25x-2x in quarter steps)
   * after the transport buttons; omit them to render transport only.
   */
  rate?: number
  onRateChange?: (rate: number) => void
  size?: keyof typeof SIZES
}

export default function PlaybackControls({
  playing,
  onPrev,
  onTogglePlay,
  onNext,
  playDisabled = false,
  playDisabledTitle,
  rate,
  onRateChange,
  size = 'sm',
}: PlaybackControlsProps) {
  const s = SIZES[size]
  const showRate = rate !== undefined && onRateChange !== undefined

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous sentence"
        title="Previous sentence"
        className={`${SKIP_BUTTON} ${s.skip}`}
        onClick={onPrev}
      >
        <Icon className={s.skipIcon}>
          <path d="M7 6h2.2v12H7zM17.8 6v12l-8-6z" />
        </Icon>
      </button>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        title={playDisabled ? playDisabledTitle : playing ? 'Pause' : 'Play'}
        disabled={playDisabled}
        className={`${PLAY_BUTTON} ${s.play}`}
        onClick={onTogglePlay}
      >
        <Icon className={s.playIcon}>
          {playing ? (
            <path d="M7.5 5.5h3.4v13H7.5zM13.1 5.5h3.4v13h-3.4z" />
          ) : (
            // Nudged right of center -- optically centered triangles sit a touch off-axis.
            <path d="M8.8 5.2 18.6 12l-9.8 6.8z" />
          )}
        </Icon>
      </button>
      <button
        type="button"
        aria-label="Next sentence"
        title="Next sentence"
        className={`${SKIP_BUTTON} ${s.skip}`}
        onClick={onNext}
      >
        <Icon className={s.skipIcon}>
          <path d="M14.8 6H17v12h-2.2zM6.2 6l8 6-8 6z" />
        </Icon>
      </button>

      {showRate && (
        <div className="ml-1 flex items-center gap-1">
          <button
            type="button"
            aria-label="Slower narration"
            title="Slower narration"
            disabled={rate <= PLAYBACK_RATE_MIN}
            className={`${SKIP_BUTTON} ${s.skip} text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-700/80 disabled:hover:text-neutral-400`}
            onClick={() => onRateChange(normalizeRate(rate - PLAYBACK_RATE_STEP))}
          >
            −
          </button>
          <span
            aria-live="polite"
            className="min-w-[3.25rem] text-center font-sans text-[11px] tabular-nums tracking-wide text-neutral-400"
          >
            {rate}×
          </span>
          <button
            type="button"
            aria-label="Faster narration"
            title="Faster narration"
            disabled={rate >= PLAYBACK_RATE_MAX}
            className={`${SKIP_BUTTON} ${s.skip} text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-700/80 disabled:hover:text-neutral-400`}
            onClick={() => onRateChange(normalizeRate(rate + PLAYBACK_RATE_STEP))}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}
