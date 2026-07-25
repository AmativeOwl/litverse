import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_DPR_CAP,
  ADAPTIVE_DPR_FLOOR,
  computeAdaptiveDpr,
  RENDER_PIXEL_BUDGET,
} from './adaptiveDpr'

describe('computeAdaptiveDpr', () => {
  it('half-pane reader stays at the sharpness cap', () => {
    // ~half of a 1080p-ish window: well under budget even at the cap
    expect(computeAdaptiveDpr(950, 900, 2)).toBeCloseTo(ADAPTIVE_DPR_CAP, 6)
  })

  it('1080p cinema lands near native 1.0 (the budget is ~a native 1080p frame)', () => {
    const dpr = computeAdaptiveDpr(1920, 1080, 2)
    expect(dpr).toBeGreaterThan(0.95)
    expect(dpr).toBeLessThan(1.1)
    // and the resulting device-pixel count respects the budget
    expect(1920 * 1080 * dpr * dpr).toBeLessThanOrEqual(RENDER_PIXEL_BUDGET * 1.1)
  })

  it('very large screens hit the sharpness floor rather than going blurrier', () => {
    expect(computeAdaptiveDpr(3840, 2160, 2)).toBeCloseTo(ADAPTIVE_DPR_FLOOR, 6)
  })

  it('never exceeds the device ratio -- upsampling is wasted work', () => {
    expect(computeAdaptiveDpr(600, 500, 1)).toBeCloseTo(1, 6)
  })

  it('keeps the budget roughly flat across pane sizes below the clamps', () => {
    const a = computeAdaptiveDpr(1920, 1080, 3)
    const b = computeAdaptiveDpr(2560, 1440, 3)
    expect(1920 * 1080 * a * a).toBeCloseTo(2560 * 1440 * b * b, -4)
  })

  it('tolerates degenerate sizes', () => {
    const dpr = computeAdaptiveDpr(0, 0, 2)
    expect(Number.isFinite(dpr)).toBe(true)
    expect(dpr).toBeLessThanOrEqual(ADAPTIVE_DPR_CAP)
  })
})
