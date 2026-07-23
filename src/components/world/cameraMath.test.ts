import { describe, expect, it } from 'vitest'
import { computeCameraPose } from './cameraMath'

describe('computeCameraPose', () => {
  it('slow-orbit stays at a constant radius/height and moves with elapsed time', () => {
    const t0 = computeCameraPose('slow-orbit', 0.2, 50, 0)
    const t1 = computeCameraPose('slow-orbit', 0.2, 50, 3)

    const radiusOf = (pos: [number, number, number]) => Math.hypot(pos[0], pos[2])
    expect(radiusOf(t0.position)).toBeCloseTo(radiusOf(t1.position), 5)
    expect(t0.position[1]).toBe(t1.position[1])
    expect(t0.position).not.toEqual(t1.position)
    expect(t0.lookAt).toEqual([0, 1, 0])
    expect(t0.fov).toBe(50)
  })

  it('slow-orbit with zero speed never moves', () => {
    const a = computeCameraPose('slow-orbit', 0, 50, 0)
    const b = computeCameraPose('slow-orbit', 0, 50, 10)
    expect(a.position).toEqual(b.position)
  })

  it('static-drift oscillates near the base distance rather than orbiting', () => {
    const pose = computeCameraPose('static-drift', 0.3, 50, 1.5)
    expect(pose.position[2]).toBe(8)
    expect(Math.abs(pose.position[0])).toBeLessThanOrEqual(0.6)
  })

  it('push-in starts far and eases toward the near distance as time elapses', () => {
    const start = computeCameraPose('push-in', 1, 50, 0)
    const later = computeCameraPose('push-in', 1, 50, 20)
    expect(start.position[2]).toBeGreaterThan(later.position[2])
    expect(later.position[2]).toBeGreaterThanOrEqual(5.5)
  })

  it('pull-back starts near and eases toward the far distance as time elapses', () => {
    const start = computeCameraPose('pull-back', 1, 50, 0)
    const later = computeCameraPose('pull-back', 1, 50, 20)
    expect(later.position[2]).toBeGreaterThan(start.position[2])
  })

  it('clamps a negative/non-finite speed to a safe minimum instead of producing NaN', () => {
    const negative = computeCameraPose('slow-orbit', -5, 50, 2)
    const nan = computeCameraPose('slow-orbit', Number.NaN, 50, 2)
    for (const value of [...negative.position, ...nan.position]) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('passes fov straight through unchanged', () => {
    expect(computeCameraPose('slow-orbit', 0.2, 73, 1).fov).toBe(73)
    expect(computeCameraPose('static-drift', 0.2, 73, 1).fov).toBe(73)
    expect(computeCameraPose('push-in', 0.2, 73, 1).fov).toBe(73)
    expect(computeCameraPose('pull-back', 0.2, 73, 1).fov).toBe(73)
  })
})
