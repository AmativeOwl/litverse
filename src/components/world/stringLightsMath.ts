import { hexToRgbNormalized } from './beatMath'

/**
 * Pure layout/brightness math for StringLights, split from the component
 * file so it exports only a component (react-refresh contract) and so these
 * stay unit-testable without touching three.js.
 */

const POLE_COUNT = 5
const ARC_START_DEG = 210
const ARC_END_DEG = 330
const ARC_RADIUS = 8.5
export const POLE_HEIGHT = 3.4
/** How far below the pole tops the strand midpoint sags. */
const STRAND_SAG = 0.55

/** Fixed pole positions along the arc -- pure and exported for tests. */
export function buildPolePositions(): { x: number; z: number }[] {
  const positions: { x: number; z: number }[] = []
  for (let i = 0; i < POLE_COUNT; i++) {
    const t = i / (POLE_COUNT - 1)
    const deg = ARC_START_DEG + (ARC_END_DEG - ARC_START_DEG) * t
    const rad = (deg * Math.PI) / 180
    positions.push({ x: Math.cos(rad) * ARC_RADIUS, z: Math.sin(rad) * ARC_RADIUS })
  }
  return positions
}

/**
 * Point along one strand: parabolic sag between two pole tops. `t` in [0,1].
 * A true catenary is cosh-based, but at this sag/span ratio a parabola is
 * visually identical and cheaper. Pure and exported for tests.
 */
export function strandPointAt(
  from: { x: number; z: number },
  to: { x: number; z: number },
  t: number,
): { x: number; y: number; z: number } {
  return {
    x: from.x + (to.x - from.x) * t,
    // 4t(1-t) is 0 at both ends, 1 at the middle
    y: POLE_HEIGHT - STRAND_SAG * 4 * t * (1 - t),
    z: from.z + (to.z - from.z) * t,
  }
}

/**
 * 0 = bright day (lights off), 1 = deep night (lights full). Driven by the
 * *lerped* background color's relative luminance so it animates smoothly
 * through every beat transition. Pure and exported for tests.
 */
export function nightnessOf(backgroundHex: string): number {
  const [r, g, b] = hexToRgbNormalized(backgroundHex)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // smoothstep between "clearly daylight" and "clearly night" luminances
  const t = Math.min(1, Math.max(0, (0.45 - luminance) / (0.45 - 0.12)))
  return t * t * (3 - 2 * t)
}
