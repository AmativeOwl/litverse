import { describe, expect, it } from 'vitest'
import {
  catenaryY,
  darkenHex,
  fogTintHex,
  lightenHex,
  mixHex,
  sunburstRayAngles,
  vignetteVisibility,
  zigguratSteps,
} from './decoPlateKit'

describe('color helpers', () => {
  it('mixHex returns the endpoints at t=0 and t=1', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('mixHex midpoint is mid-gray and t is clamped', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff')
    expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000')
  })

  it('lighten moves toward white, darken toward black', () => {
    expect(lightenHex('#804020', 1)).toBe('#ffffff')
    expect(darkenHex('#804020', 1)).toBe('#000000')
  })

  it('fogTintHex is monotonic toward the fog color as depth grows', () => {
    const base = '#ff0000'
    const fog = '#0000ff'
    const shallow = fogTintHex(base, fog, 0.2)
    const deep = fogTintHex(base, fog, 0.8)
    const red = (hex: string) => parseInt(hex.slice(1, 3), 16)
    expect(red(shallow)).toBeGreaterThan(red(deep))
    expect(red(deep)).toBeGreaterThan(red(fog))
  })
})

describe('zigguratSteps', () => {
  it('produces the requested number of steps spanning the full height', () => {
    const steps = zigguratSteps(50, 100, 40, 60, 4)
    expect(steps).toHaveLength(4)
    const first = steps[0]
    const last = steps[steps.length - 1]
    expect(first?.y).toBeCloseTo(40, 6) // baseY - height
    expect((last?.y ?? 0) + (last?.height ?? 0)).toBeCloseTo(100, 6)
  })

  it('narrows monotonically toward the top and stays centered', () => {
    const steps = zigguratSteps(0, 0, 40, 60, 5)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]?.width).toBeLessThan(steps[i - 1]?.width ?? Infinity)
    }
    for (const rect of steps) {
      expect(rect.x + rect.width / 2).toBeCloseTo(0, 6)
    }
  })

  it('coerces a degenerate step count to one full-size step', () => {
    const steps = zigguratSteps(0, 10, 20, 30, 0)
    expect(steps).toHaveLength(1)
    expect(steps[0]?.width).toBeCloseTo(20, 6)
  })
})

describe('sunburstRayAngles', () => {
  it('spans start to end inclusive with count+1 rays', () => {
    const angles = sunburstRayAngles(4, 0, Math.PI)
    expect(angles).toHaveLength(5)
    expect(angles[0]).toBeCloseTo(0, 9)
    expect(angles[angles.length - 1]).toBeCloseTo(Math.PI, 9)
  })

  it('is symmetric about the arc midpoint', () => {
    const angles = sunburstRayAngles(6, 0, Math.PI)
    const mid = Math.PI / 2
    for (let i = 0; i < angles.length; i++) {
      const mirror = angles[angles.length - 1 - i]
      expect((angles[i] ?? 0) - mid).toBeCloseTo(mid - (mirror ?? 0), 9)
    }
  })
})

describe('catenaryY', () => {
  it('sits at topY at both ends and dips by sag at the middle', () => {
    expect(catenaryY(0, 10, 3)).toBeCloseTo(10, 9)
    expect(catenaryY(1, 10, 3)).toBeCloseTo(10, 9)
    expect(catenaryY(0.5, 10, 3)).toBeCloseTo(13, 9)
  })
})

describe('vignetteVisibility (kit home after relocation)', () => {
  const BEATS = new Set(['a', 'b'])

  it('keeps the DecoWaterfront gating semantics', () => {
    expect(vignetteVisibility('a', 'b', 0.4, BEATS)).toBe(1)
    expect(vignetteVisibility('x', 'a', 1, BEATS)).toBe(1)
    expect(vignetteVisibility('a', 'x', 1, BEATS)).toBe(0)
    expect(vignetteVisibility('x', 'y', 0.5, BEATS)).toBe(0)
  })
})
