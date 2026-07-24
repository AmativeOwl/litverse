import { describe, expect, it } from 'vitest'
import { vignetteVisibility } from './PaintedVignette'

const BEATS = new Set(['orchestra-tuning', 'dancing-under-lights'])

describe('vignetteVisibility', () => {
  it('is fully visible when both transition endpoints are member beats', () => {
    expect(vignetteVisibility('orchestra-tuning', 'dancing-under-lights', 0.3, BEATS)).toBe(1)
  })

  it('fades in while transitioning into a member beat', () => {
    expect(vignetteVisibility('evening-bar-setup', 'orchestra-tuning', 0, BEATS)).toBe(0)
    const mid = vignetteVisibility('evening-bar-setup', 'orchestra-tuning', 0.5, BEATS)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    expect(vignetteVisibility('evening-bar-setup', 'orchestra-tuning', 1, BEATS)).toBe(1)
  })

  it('fades out while transitioning away from a member beat', () => {
    expect(vignetteVisibility('orchestra-tuning', 'full-swing-cocktails', 0, BEATS)).toBe(1)
    expect(vignetteVisibility('orchestra-tuning', 'full-swing-cocktails', 1, BEATS)).toBe(0)
  })

  it('is invisible when neither endpoint is a member beat', () => {
    expect(vignetteVisibility('dusk-arrival', 'daytime-leisure', 0.5, BEATS)).toBe(0)
  })

  it('clamps out-of-range progress instead of extrapolating', () => {
    expect(vignetteVisibility('evening-bar-setup', 'orchestra-tuning', -0.5, BEATS)).toBe(0)
    expect(vignetteVisibility('evening-bar-setup', 'orchestra-tuning', 1.5, BEATS)).toBe(1)
  })
})
