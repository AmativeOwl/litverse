// Reader accessibility preferences (text size, narration speed), persisted
// to localStorage so they survive book changes and sessions. Pure helpers +
// storage wrappers -- all reads are defensive (private-mode/blocked storage
// degrades to defaults, never throws).

import { PLAYBACK_RATE_MAX, PLAYBACK_RATE_MIN } from './narrationController'

export const PLAYBACK_RATE_STEP = 0.25

/**
 * Text-size steps for the reading pane, as multipliers on the base serif
 * size. Five steps rather than a free slider: each is a genuinely distinct
 * reading size, and the ends stay inside what the two-pane layout can hold
 * without the measure collapsing.
 */
export const FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.5] as const
export const DEFAULT_FONT_SCALE_INDEX = 1

const RATE_KEY = 'litverse:narration-rate'
const FONT_KEY = 'litverse:font-scale-index'

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode, blocked) -- preference just won't persist.
  }
}

/** Clamps to [0.25, 2] and snaps to the nearest quarter step. */
export function normalizeRate(rate: number): number {
  const clamped = Math.min(PLAYBACK_RATE_MAX, Math.max(PLAYBACK_RATE_MIN, rate))
  return Math.round(clamped / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP
}

export function loadStoredRate(): number {
  const raw = readStorage(RATE_KEY)
  const parsed = raw === null ? NaN : Number(raw)
  return Number.isFinite(parsed) ? normalizeRate(parsed) : 1
}

export function storeRate(rate: number): void {
  writeStorage(RATE_KEY, String(rate))
}

export function loadStoredFontScaleIndex(): number {
  const raw = readStorage(FONT_KEY)
  const parsed = raw === null ? NaN : Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= FONT_SCALES.length) {
    return DEFAULT_FONT_SCALE_INDEX
  }
  return parsed
}

export function storeFontScaleIndex(index: number): void {
  writeStorage(FONT_KEY, String(index))
}
