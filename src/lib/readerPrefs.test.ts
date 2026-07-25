import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_FONT_SCALE_INDEX,
  FONT_SCALES,
  loadStoredFontScaleIndex,
  loadStoredRate,
  normalizeRate,
  storeFontScaleIndex,
  storeRate,
} from './readerPrefs'

beforeEach(() => {
  window.localStorage.clear()
})

describe('normalizeRate', () => {
  it('passes through valid quarter steps', () => {
    for (const rate of [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
      expect(normalizeRate(rate)).toBe(rate)
    }
  })

  it('clamps below 0.25 and above 2', () => {
    expect(normalizeRate(0)).toBe(0.25)
    expect(normalizeRate(-3)).toBe(0.25)
    expect(normalizeRate(2.25)).toBe(2)
    expect(normalizeRate(99)).toBe(2)
  })

  it('snaps off-step values to the nearest quarter', () => {
    expect(normalizeRate(1.1)).toBe(1)
    expect(normalizeRate(1.13)).toBe(1.25)
    expect(normalizeRate(0.9)).toBe(1)
  })
})

describe('rate persistence', () => {
  it('round-trips a stored rate', () => {
    storeRate(1.5)
    expect(loadStoredRate()).toBe(1.5)
  })

  it('defaults to 1 with nothing stored', () => {
    expect(loadStoredRate()).toBe(1)
  })

  it('normalizes garbage and out-of-range stored values', () => {
    window.localStorage.setItem('litverse:narration-rate', 'not-a-number')
    expect(loadStoredRate()).toBe(1)
    window.localStorage.setItem('litverse:narration-rate', '7')
    expect(loadStoredRate()).toBe(2)
  })
})

describe('font scale persistence', () => {
  it('round-trips a stored index', () => {
    storeFontScaleIndex(3)
    expect(loadStoredFontScaleIndex()).toBe(3)
  })

  it('defaults with nothing stored and rejects out-of-range/garbage', () => {
    expect(loadStoredFontScaleIndex()).toBe(DEFAULT_FONT_SCALE_INDEX)
    window.localStorage.setItem('litverse:font-scale-index', String(FONT_SCALES.length))
    expect(loadStoredFontScaleIndex()).toBe(DEFAULT_FONT_SCALE_INDEX)
    window.localStorage.setItem('litverse:font-scale-index', '1.5')
    expect(loadStoredFontScaleIndex()).toBe(DEFAULT_FONT_SCALE_INDEX)
    window.localStorage.setItem('litverse:font-scale-index', 'nope')
    expect(loadStoredFontScaleIndex()).toBe(DEFAULT_FONT_SCALE_INDEX)
  })
})
