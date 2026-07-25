import { describe, expect, it } from 'vitest'
import {
  catenaryY,
  darkenHex,
  fogTintHex,
  lightenHex,
  mixHex,
  shellArc,
  tileSlotAzimuths,
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

describe('shellArc', () => {
  it('spans the arc length as angle: thetaLength = arcLength / radius', () => {
    const { thetaLength } = shellArc(80, 18, 20)
    expect(thetaLength).toBeCloseTo(0.9, 6)
  })

  it('centers the arc on the scene azimuth under the cylinder theta convention', () => {
    // Cylinder verts: x = r*sin(theta), z = r*cos(theta). The arc's midpoint
    // theta must land on the scene-polar direction (x = cos(az), z = sin(az)).
    const azimuthDeg = 80
    const radius = 20
    const { thetaStart, thetaLength } = shellArc(azimuthDeg, 18, radius)
    const thetaMid = thetaStart + thetaLength / 2
    const azimuthRad = (azimuthDeg * Math.PI) / 180
    expect(radius * Math.sin(thetaMid)).toBeCloseTo(Math.cos(azimuthRad) * radius, 6)
    expect(radius * Math.cos(thetaMid)).toBeCloseTo(Math.sin(azimuthRad) * radius, 6)
  })

  it('wider layers at larger radii keep sane angular spans (far plate under a half circle)', () => {
    const far = shellArc(0, 42, 26)
    expect(far.thetaLength).toBeGreaterThan(1.2)
    expect(far.thetaLength).toBeLessThan(Math.PI)
  })
})

describe('tileSlotAzimuths', () => {
  it('retiles N distinct azimuths onto an even 360/N circle in INPUT (narrative) order', () => {
    // Gatsby's beats in story order -- dancing repeats orchestra's 80
    const gatsby = [325, 28, 280, 140, 222, 80, 235, 80]
    const slots = tileSlotAzimuths(gatsby)
    expect(slots.size).toBe(7)
    expect(slots.get(325)).toBeCloseTo(325, 6)
    const step = 360 / 7
    const narrative = [325, 28, 280, 140, 222, 80, 235]
    narrative.forEach((az, i) => {
      expect(slots.get(az)).toBeCloseTo((325 + i * step) % 360, 6)
    })
    // consecutive story beats hang exactly one slot apart -- the drum
    // advances a single frame per beat, never sweeping across others
    for (let i = 1; i < narrative.length; i++) {
      const prev = slots.get(narrative[i - 1] ?? 0) ?? 0
      const curr = slots.get(narrative[i] ?? 0) ?? 0
      const delta = ((curr - prev) % 360 + 360) % 360
      expect(delta).toBeCloseTo(step, 6)
    }
  })

  it('leaves an already-even ring unchanged (Masque: nine sectors at 40 degrees)', () => {
    const masque = [0, 40, 80, 120, 160, 200, 240, 280, 320]
    const slots = tileSlotAzimuths(masque)
    for (const az of masque) expect(slots.get(az)).toBeCloseTo(az, 6)
  })

  it('dedupes repeated azimuths and tolerates empty input', () => {
    expect(tileSlotAzimuths([80, 80, 80]).size).toBe(1)
    expect(tileSlotAzimuths([]).size).toBe(0)
  })
})
