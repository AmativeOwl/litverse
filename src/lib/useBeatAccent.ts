import { useMemo } from 'react'
import { useReadingStore } from '../store/readingStore'
import type { SceneBeat } from '../types'

/** Fallback when `activeSceneBeatId` doesn't (yet) match a known beat -- the original amber (Tailwind amber-400). */
export const DEFAULT_ACCENT = '#fbbf24'

/**
 * The active scene beat's `palette.accent` -- the world's mood as a single
 * color, used by the text pane's sentence wash and by the active-word
 * color in both TextPane and CaptionBar (gold family for Gatsby, Poe's
 * room hues/scarlet for the Masque). A static `id -> accent` map over
 * read-only reference data, same pattern as MotifEffects' Motif lookup;
 * subscribing to `activeSceneBeatId` here is sentence/beat-level state and
 * stays DOM-side -- it never enters the R3F subtree.
 */
export function useBeatAccent(beats?: readonly SceneBeat[]): string {
  const activeSceneBeatId = useReadingStore((s) => s.activeSceneBeatId)
  const accents = useMemo(
    () => Object.fromEntries((beats ?? []).map((beat) => [beat.id, beat.palette.accent])),
    [beats],
  )
  return (activeSceneBeatId && accents[activeSceneBeatId]) || DEFAULT_ACCENT
}
