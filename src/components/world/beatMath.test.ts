import { describe, expect, it } from 'vitest'
import type { SceneBeat } from '../../types'
import {
  clamp01,
  computeTransitionProgress,
  easeInOutCubic,
  hexToRgbNormalized,
  lerp,
  lerpColorHex,
  lerpSceneBeat,
} from './beatMath'

function makeBeat(overrides: Partial<SceneBeat> & { id: string }): SceneBeat {
  return {
    palette: { background: '#000000', primary: '#000000', accent: '#000000', fog: '#000000' },
    lighting: { ambientIntensity: 0, keyLightIntensity: 0, keyLightColor: '#000000', bloomStrength: 0 },
    particles: { type: 'none', density: 0, speed: 0, sizeRange: [0, 0] },
    camera: { behavior: 'static-drift', speed: 0, fov: 50 },
    silhouettes: { count: 0, animation: 'still' },
    transitionDurationMs: 1000,
    ...overrides,
  }
}

describe('clamp01', () => {
  it('clamps below 0 up to 0', () => {
    expect(clamp01(-5)).toBe(0)
  })
  it('clamps above 1 down to 1', () => {
    expect(clamp01(5)).toBe(1)
  })
  it('passes through in-range values', () => {
    expect(clamp01(0.42)).toBe(0.42)
  })
})

describe('lerp', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(lerp(10, 20, 0)).toBe(10)
    expect(lerp(10, 20, 1)).toBe(20)
  })
  it('interpolates linearly in between', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
})

describe('easeInOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
  })
  it('is monotonically increasing', () => {
    const samples = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]
    for (let i = 1; i < samples.length; i++) {
      expect(easeInOutCubic(samples[i]!)).toBeGreaterThanOrEqual(easeInOutCubic(samples[i - 1]!))
    }
  })
  it('clamps out-of-range input', () => {
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
  })
})

describe('lerpColorHex', () => {
  it('returns the start color at t=0', () => {
    expect(lerpColorHex('#000000', '#ffffff', 0)).toBe('#000000')
  })
  it('returns the end color at t=1', () => {
    expect(lerpColorHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })
  it('blends channel-by-channel at t=0.5', () => {
    expect(lerpColorHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
  it('expands 3-digit hex shorthand', () => {
    expect(lerpColorHex('#000', '#fff', 1)).toBe('#ffffff')
  })
})

describe('hexToRgbNormalized', () => {
  it('normalizes 0..255 channels to 0..1', () => {
    expect(hexToRgbNormalized('#ffffff')).toEqual([1, 1, 1])
    expect(hexToRgbNormalized('#000000')).toEqual([0, 0, 0])
  })
})

describe('computeTransitionProgress', () => {
  it('is 0 right when the transition starts', () => {
    expect(computeTransitionProgress(1000, 1000, 2000)).toBe(0)
  })
  it('is 1 once the duration has fully elapsed', () => {
    expect(computeTransitionProgress(1000, 3000, 2000)).toBe(1)
  })
  it('is 0.5 halfway through', () => {
    expect(computeTransitionProgress(1000, 2000, 2000)).toBe(0.5)
  })
  it('treats a non-positive duration as already complete', () => {
    expect(computeTransitionProgress(1000, 1000, 0)).toBe(1)
  })
})

describe('lerpSceneBeat', () => {
  const from = makeBeat({
    id: 'from',
    palette: { background: '#000000', primary: '#111111', accent: '#222222', fog: '#333333' },
    lighting: { ambientIntensity: 0, keyLightIntensity: 1, keyLightColor: '#000000', bloomStrength: 0 },
    particles: { type: 'dust', density: 10, speed: 1, sizeRange: [0.1, 0.2] },
    camera: { behavior: 'static-drift', speed: 0.1, fov: 40 },
    silhouettes: { count: 10, animation: 'sway' },
  })
  const to = makeBeat({
    id: 'to',
    palette: { background: '#ffffff', primary: '#eeeeee', accent: '#dddddd', fog: '#cccccc' },
    lighting: { ambientIntensity: 1, keyLightIntensity: 2, keyLightColor: '#ffffff', bloomStrength: 1 },
    particles: { type: 'confetti', density: 100, speed: 2, sizeRange: [0.2, 0.4] },
    camera: { behavior: 'slow-orbit', speed: 0.3, fov: 60 },
    silhouettes: { count: 50, animation: 'sway' },
  })

  it('matches the from-beat at t=0', () => {
    const result = lerpSceneBeat(from, to, 0)
    expect(result.palette.background).toBe('#000000')
    expect(result.lighting.keyLightIntensity).toBe(1)
    expect(result.camera.fov).toBe(40)
    expect(result.silhouetteCount).toBe(10)
    expect(result.t).toBe(0)
  })

  it('matches the to-beat at t=1', () => {
    const result = lerpSceneBeat(from, to, 1)
    expect(result.palette.background).toBe('#ffffff')
    expect(result.lighting.keyLightIntensity).toBe(2)
    expect(result.camera.fov).toBe(60)
    expect(result.silhouetteCount).toBe(50)
    expect(result.t).toBe(1)
  })

  it('keeps discrete enum fields on the from-beat before the transition midpoint', () => {
    const result = lerpSceneBeat(from, to, 0.2)
    expect(result.particles.type).toBe('dust')
    expect(result.camera.behavior).toBe('static-drift')
  })

  it('snaps discrete enum fields to the to-beat at/after the transition midpoint', () => {
    const atMidpoint = lerpSceneBeat(from, to, 0.5)
    expect(atMidpoint.particles.type).toBe('confetti')
    expect(atMidpoint.camera.behavior).toBe('slow-orbit')

    const pastMidpoint = lerpSceneBeat(from, to, 0.9)
    expect(pastMidpoint.particles.type).toBe('confetti')
    expect(pastMidpoint.camera.behavior).toBe('slow-orbit')
  })

  it('interpolates continuous numeric fields smoothly in between', () => {
    const result = lerpSceneBeat(from, to, 0.5)
    expect(result.lighting.keyLightIntensity).toBeGreaterThan(1)
    expect(result.lighting.keyLightIntensity).toBeLessThan(2)
    expect(result.particles.sizeRange[0]).toBeGreaterThan(0.1)
    expect(result.particles.sizeRange[0]).toBeLessThan(0.2)
  })

  it('defaults silhouette count to 0 when a beat omits silhouettes', () => {
    const noSilhouettes = makeBeat({ id: 'bare' })
    delete noSilhouettes.silhouettes
    const result = lerpSceneBeat(noSilhouettes, noSilhouettes, 1)
    expect(result.silhouetteCount).toBe(0)
  })
})
