import { describe, expect, it } from 'vitest'
import { buildPolePositions, nightnessOf, strandPointAt } from './StringLights'

describe('buildPolePositions', () => {
  it('is deterministic and stays on the 8.5 arc', () => {
    const a = buildPolePositions()
    const b = buildPolePositions()
    expect(a).toEqual(b)
    for (const { x, z } of a) {
      expect(Math.hypot(x, z)).toBeCloseTo(8.5, 6)
    }
  })

  it('keeps every pole clear of the other set-pieces radius bands', () => {
    // buffet 12-16, bar 12, cars 17-21, fountain railing 11 -- everything
    // this arc must stay inside of starts at radius 11.
    for (const { x, z } of buildPolePositions()) {
      expect(Math.hypot(x, z)).toBeLessThan(11)
    }
  })

  it('spans the 210-330 degree sector on the far side of the camera', () => {
    for (const { x, z } of buildPolePositions()) {
      let deg = (Math.atan2(z, x) * 180) / Math.PI
      if (deg < 0) deg += 360
      expect(deg).toBeGreaterThanOrEqual(210 - 1e-6)
      expect(deg).toBeLessThanOrEqual(330 + 1e-6)
    }
  })
})

describe('strandPointAt', () => {
  const from = { x: 0, z: 0 }
  const to = { x: 4, z: 0 }

  it('meets the pole tops at both ends', () => {
    expect(strandPointAt(from, to, 0).y).toBeCloseTo(3.4, 6)
    expect(strandPointAt(from, to, 1).y).toBeCloseTo(3.4, 6)
  })

  it('sags lowest at the midpoint and stays above head height', () => {
    const mid = strandPointAt(from, to, 0.5)
    expect(mid.y).toBeCloseTo(3.4 - 0.55, 6)
    // tallest crowd figure is ~1.3 + head; the strand must clear it easily
    expect(mid.y).toBeGreaterThan(2)
    expect(mid.y).toBeLessThan(strandPointAt(from, to, 0.25).y)
  })

  it('interpolates x/z linearly', () => {
    const p = strandPointAt(from, to, 0.25)
    expect(p.x).toBeCloseTo(1, 6)
    expect(p.z).toBeCloseTo(0, 6)
  })
})

describe('nightnessOf', () => {
  it('turns the lights off for the bright daytime beat background', () => {
    expect(nightnessOf('#4a8fc9')).toBe(0) // daytime-leisure
    expect(nightnessOf('#7d8ba0')).toBe(0) // monday-lull
  })

  it('turns the lights up for night beat backgrounds', () => {
    expect(nightnessOf('#0b1026')).toBeGreaterThan(0.9) // dusk-arrival
    expect(nightnessOf('#3a1450')).toBeGreaterThan(0.7) // dancing-under-lights
  })

  it('is partial for the day-to-midnight weekend-traffic beat', () => {
    const weekend = nightnessOf('#6b5a3a')
    expect(weekend).toBeGreaterThan(0.1)
    expect(weekend).toBeLessThan(0.9)
  })

  it('is monotonic from white to black', () => {
    expect(nightnessOf('#ffffff')).toBe(0)
    expect(nightnessOf('#000000')).toBe(1)
  })
})
