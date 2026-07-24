import { describe, expect, it } from 'vitest'
import { computeCameraPose, DEFAULT_CAMERA_AZIMUTH_RAD, lerpAngleRad } from './cameraMath'

const degToRad = (deg: number) => (deg * Math.PI) / 180

/** Polar angle (radians, 0..2PI) of a position on the ground plane. */
function azimuthOf(pos: [number, number, number]): number {
  let angle = Math.atan2(pos[2], pos[0])
  if (angle < 0) angle += Math.PI * 2
  return angle
}

describe('computeCameraPose', () => {
  it('slow-orbit stays at a constant radius/height and moves with elapsed time', () => {
    const t0 = computeCameraPose('slow-orbit', 0.2, 50, 0)
    const t1 = computeCameraPose('slow-orbit', 0.2, 50, 3)

    const radiusOf = (pos: [number, number, number]) => Math.hypot(pos[0], pos[2])
    expect(radiusOf(t0.position)).toBeCloseTo(radiusOf(t1.position), 5)
    expect(t0.position[1]).toBe(t1.position[1])
    expect(t0.position).not.toEqual(t1.position)
    expect(t0.fov).toBe(50)
  })

  it('slow-orbit with zero speed never moves', () => {
    const a = computeCameraPose('slow-orbit', 0, 50, 0)
    const b = computeCameraPose('slow-orbit', 0, 50, 10)
    expect(a.position).toEqual(b.position)
  })

  it('slow-orbit swings around its anchor instead of orbiting the full circle', () => {
    // sample the whole cycle -- every sample must stay within the swing
    // amplitude of the anchor-opposite azimuth, never wander to the far side
    const azimuth = degToRad(80)
    const opposite = azimuth + Math.PI
    for (let s = 0; s < 40; s++) {
      const pose = computeCameraPose('slow-orbit', 0.3, 50, s * 0.7, azimuth)
      const delta = Math.abs(lerpAngleRad(azimuthOf(pose.position), opposite, 1) - opposite)
      expect(delta).toBeLessThanOrEqual(0.6 + 1e-9)
    }
  })

  it('static-drift oscillates near the base distance rather than orbiting', () => {
    const pose = computeCameraPose('static-drift', 0.3, 50, 1.5)
    const distance = Math.hypot(pose.position[0], pose.position[2])
    expect(distance).toBeGreaterThan(7.5)
    expect(distance).toBeLessThan(8.5)
  })

  it('defaults to the original +z framing when no azimuth is given', () => {
    const pose = computeCameraPose('static-drift', 0, 50, 0)
    expect(pose.position[0]).toBeCloseTo(0, 6)
    expect(pose.position[2]).toBeCloseTo(8, 6)
  })

  it('positions the camera opposite the featured sector, looking toward it', () => {
    // daytime-leisure faces the waterfront at 28deg: camera should stand at
    // ~208deg and the lookAt point should sit in the 28deg direction
    const azimuth = degToRad(28)
    const pose = computeCameraPose('static-drift', 0, 50, 0, azimuth)
    expect(azimuthOf(pose.position)).toBeCloseTo(degToRad(208), 5)
    expect(azimuthOf(pose.lookAt)).toBeCloseTo(azimuth, 5)
  })

  it('push-in starts far and eases toward the near distance as time elapses', () => {
    const start = computeCameraPose('push-in', 1, 50, 0)
    const later = computeCameraPose('push-in', 1, 50, 20)
    const distanceOf = (pos: [number, number, number]) => Math.hypot(pos[0], pos[2])
    expect(distanceOf(start.position)).toBeGreaterThan(distanceOf(later.position))
    expect(distanceOf(later.position)).toBeGreaterThanOrEqual(5.5 - 1e-9)
  })

  it('pull-back starts near and eases toward the far distance as time elapses', () => {
    const start = computeCameraPose('pull-back', 1, 50, 0)
    const later = computeCameraPose('pull-back', 1, 50, 20)
    const distanceOf = (pos: [number, number, number]) => Math.hypot(pos[0], pos[2])
    expect(distanceOf(later.position)).toBeGreaterThan(distanceOf(start.position))
  })

  it('clamps a negative/non-finite speed to a safe minimum instead of producing NaN', () => {
    const negative = computeCameraPose('slow-orbit', -5, 50, 2)
    const nan = computeCameraPose('slow-orbit', Number.NaN, 50, 2)
    for (const value of [...negative.position, ...nan.position]) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('falls back to the default azimuth when given a non-finite one', () => {
    const pose = computeCameraPose('static-drift', 0, 50, 0, Number.NaN)
    const reference = computeCameraPose('static-drift', 0, 50, 0, DEFAULT_CAMERA_AZIMUTH_RAD)
    expect(pose.position).toEqual(reference.position)
  })

  it('passes fov straight through unchanged', () => {
    expect(computeCameraPose('slow-orbit', 0.2, 73, 1).fov).toBe(73)
    expect(computeCameraPose('static-drift', 0.2, 73, 1).fov).toBe(73)
    expect(computeCameraPose('push-in', 0.2, 73, 1).fov).toBe(73)
    expect(computeCameraPose('pull-back', 0.2, 73, 1).fov).toBe(73)
  })
})

describe('lerpAngleRad', () => {
  it('interpolates plainly when the arc does not cross the wrap point', () => {
    expect(lerpAngleRad(degToRad(10), degToRad(50), 0.5)).toBeCloseTo(degToRad(30), 6)
  })

  it('takes the short way across the 0/360 wrap', () => {
    // 350deg -> 10deg should pass through 0deg (i.e. +20deg), not -340deg
    const mid = lerpAngleRad(degToRad(350), degToRad(10), 0.5)
    expect(Math.cos(mid)).toBeCloseTo(1, 6) // 360deg == 0deg direction
  })

  it('returns the endpoints exactly at t=0 and t=1 (mod 2PI)', () => {
    const a = degToRad(300)
    const b = degToRad(45)
    expect(lerpAngleRad(a, b, 0)).toBeCloseTo(a, 6)
    expect(Math.cos(lerpAngleRad(a, b, 1))).toBeCloseTo(Math.cos(b), 6)
    expect(Math.sin(lerpAngleRad(a, b, 1))).toBeCloseTo(Math.sin(b), 6)
  })
})
