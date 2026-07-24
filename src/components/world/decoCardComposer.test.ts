import { describe, expect, it } from 'vitest'
import { motionTransform } from './decoCardComposer'
import type { MotionSpec } from '../../types-plates'

const at = (verb: MotionSpec['verb'], t: number, extra?: Partial<MotionSpec>) =>
  motionTransform({ verb, ...extra }, t)

describe('motionTransform (the verb library)', () => {
  it('still and undefined motions are the identity', () => {
    expect(motionTransform(undefined, 5)).toMatchObject({ dx: 0, dy: 0, rot: 0, alpha: 1, scale: 1 })
    expect(at('still', 5)).toMatchObject({ dx: 0, dy: 0, alpha: 1 })
  })

  it('every verb stays deterministic: same t, same transform', () => {
    const verbs: MotionSpec['verb'][] = [
      'sway', 'bob', 'weave', 'cross', 'pace', 'scrub', 'dive',
      'rise', 'fall', 'twinkle', 'breathe', 'flutter', 'orbit', 'burst', 'glide',
    ]
    for (const verb of verbs) {
      const a = at(verb, 3.7)
      const b = at(verb, 3.7)
      expect(a, verb).toEqual(b)
    }
  })

  it('in-place verbs never travel: sway/scrub/twinkle/breathe stay near the anchor', () => {
    for (const verb of ['sway', 'scrub', 'twinkle', 'breathe'] as const) {
      for (let t = 0; t < 10; t += 0.37) {
        const m = at(verb, t)
        expect(Math.abs(m.dx), verb).toBeLessThan(0.02)
        expect(Math.abs(m.dy), verb).toBeLessThan(0.02)
      }
    }
  })

  it('traveling verbs loop: weave/cross return to the start of their cycle', () => {
    const loop = 6
    const early = at('cross', 0.1, { loopSeconds: loop })
    const wrapped = at('cross', 0.1 + loop * 1.3, { loopSeconds: loop })
    expect(wrapped.dx).toBeCloseTo(early.dx, 6)
  })

  it('rise fades as it climbs', () => {
    const early = at('rise', 0.2)
    const late = at('rise', 1.4)
    if ((late.cycle ?? 0) > (early.cycle ?? 0)) {
      expect(late.dy).toBeLessThan(early.dy) // higher = more negative
      expect(late.alpha).toBeLessThan(early.alpha)
    }
  })

  it('dive cycles through poise, flight, and gone', () => {
    const loop = 6.5
    const poised = at('dive', 0.5, { loopSeconds: loop }) // u ~0.08
    expect(poised.alpha).toBe(1)
    expect(poised.dx).toBe(0)
    const flying = at('dive', loop * 0.45, { loopSeconds: loop })
    expect(flying.dx).toBeGreaterThan(0)
    expect(flying.rot).toBeGreaterThan(-0.4)
    const gone = at('dive', loop * 0.8, { loopSeconds: loop })
    expect(gone.alpha).toBe(0)
  })

  it('burst expands while fading', () => {
    const early = at('burst', 0.05)
    const later = at('burst', 0.6)
    if ((later.cycle ?? 0) > (early.cycle ?? 0)) {
      expect(later.scale).toBeGreaterThan(early.scale)
      expect(later.alpha).toBeLessThan(early.alpha)
    }
  })

  it('phase offsets desynchronize identical verbs', () => {
    const a = at('twinkle', 2)
    const b = at('twinkle', 2, { phase: 1.5 })
    expect(a.alpha).not.toBeCloseTo(b.alpha, 3)
  })
})
