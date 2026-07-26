import { clamp01, easeInOutCubic, lerpColorHex } from '../beatMath'

// ---------------------------------------------------------------------------
// Pure helpers (tested)
// ---------------------------------------------------------------------------

/** Blend two hex colors; t=0 -> a, t=1 -> b. */
export function mixHex(a: string, b: string, t: number): string {
  return lerpColorHex(a, b, clamp01(t))
}

export function lightenHex(hex: string, t: number): string {
  return mixHex(hex, '#ffffff', t)
}

export function darkenHex(hex: string, t: number): string {
  return mixHex(hex, '#000000', t)
}

/** Pre-tint a plate color toward the scene fog by layer depth (far plates sit deepest in the haze). */
export function fogTintHex(hex: string, fogHex: string, depth: number): string {
  return mixHex(hex, fogHex, depth)
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The stepped "wedding cake" ziggurat outline as a stack of rects, widest at
 * the base, each step narrower by an equal fraction. Pure layout math so the
 * step geometry is testable; `drawZigguratTower` fills these rects.
 */
export function zigguratSteps(
  centerX: number,
  baseY: number,
  width: number,
  height: number,
  steps: number,
): Rect[] {
  const rects: Rect[] = []
  const stepCount = Math.max(1, Math.floor(steps))
  const stepHeight = height / stepCount
  for (let s = 0; s < stepCount; s++) {
    const stepWidth = width * (1 - s * (0.72 / stepCount))
    rects.push({
      x: centerX - stepWidth / 2,
      y: baseY - height + s * stepHeight,
      width: stepWidth,
      height: stepHeight,
    })
  }
  return rects
}

/** Evenly spaced ray angles for sunburst/fan ornament, inclusive of both ends. */
export function sunburstRayAngles(count: number, startRad: number, endRad: number): number[] {
  const n = Math.max(1, Math.floor(count))
  const angles: number[] = []
  for (let i = 0; i <= n; i++) {
    angles.push(startRad + ((endRad - startRad) * i) / n)
  }
  return angles
}

/** Vertical position along a swagged strand/garland: ends at topY, dipping by sag at t=0.5. */
export function catenaryY(t: number, topY: number, sag: number): number {
  const clamped = clamp01(t)
  return topY + Math.sin(Math.PI * clamped) * sag
}

/**
 * Visibility for a beat-gated element during a transition. Relocated here
 * from PaintedVignette.tsx (which re-exports it) so every plate consumer
 * shares one implementation. `tRaw` is LerpedSceneBeat.t (pre-easing by
 * contract); eased here the same way lerpSceneBeat eases numeric fields.
 */
export function vignetteVisibility(
  fromId: string,
  toId: string,
  tRaw: number,
  memberBeatIds: ReadonlySet<string>,
): number {
  const eased = easeInOutCubic(clamp01(tRaw))
  const fromIn = memberBeatIds.has(fromId)
  const toIn = memberBeatIds.has(toId)
  if (fromIn && toIn) return 1
  if (toIn) return eased
  if (fromIn) return 1 - eased
  return 0
}

/**
 * Pure geometry for hanging a plate as a curved cylindrical shell segment
 * around the scene origin: converts the plate's scene azimuth (degrees,
 * x=cos/z=sin convention) and its flat width (now an ARC length, so
 * compositions keep their aspect) into three.js CylinderGeometry theta
 * parameters (whose convention is x=sin/z=cos). Exported for tests.
 */
export function shellArc(
  azimuthDeg: number,
  arcLength: number,
  radius: number,
): { thetaStart: number; thetaLength: number } {
  return shellArcFromTheta(azimuthDeg, arcLength / radius)
}

/** Same conversion as shellArc but from an explicit angular span -- used when a shell must fill an exact sector slot rather than derive its span from a painting's width. */
export function shellArcFromTheta(
  azimuthDeg: number,
  thetaLength: number,
): { thetaStart: number; thetaLength: number } {
  const azimuthRad = (azimuthDeg * Math.PI) / 180
  const thetaCenter = Math.PI / 2 - azimuthRad
  return { thetaStart: thetaCenter - thetaLength / 2, thetaLength }
}

/**
 * The seamless-drum spacing rule: N distinct sector azimuths retile onto an
 * even 360/N-degree circle so sector shells cut to exactly one slot each
 * abut their neighbors with no gap -- the zoetrope-drum look where
 * paintings connect edge-to-edge and a turn slides image-into-image.
 *
 * Slot order is the INPUT order (first appearance wins, duplicates
 * deduped), NOT sorted azimuth: callers pass azimuths in the scene's
 * narrative beat order, so consecutive story beats hang in physically
 * adjacent slots and every beat transition is a single one-frame advance
 * of the drum -- scene 1 slides into scene 2 slides into scene 3, never
 * sweeping across unrelated frames to reach a far sector (user direction:
 * sequential, no "spinning all over the place"). Authored azimuths stay
 * the *identity* of a sector (data files and camera map untouched); this
 * is purely the hanging position. Pure and exported for tests.
 */
export function tileSlotAzimuths(azimuthsDeg: readonly number[]): Map<number, number> {
  const unique = [...new Set(azimuthsDeg)]
  const slots = new Map<number, number>()
  const count = unique.length
  if (count === 0) return slots
  const step = 360 / count
  const anchor = unique[0] ?? 0
  unique.forEach((azimuth, index) => {
    slots.set(azimuth, (anchor + index * step) % 360)
  })
  return slots
}

export interface Point {
  x: number
  y: number
}

/**
 * Circle centers for a stacked pyramid (oranges, melons...), `rows` tall,
 * apex up, resting on baseY. Pure layout math, exported for tests;
 * `drawFruitPyramid` fills them.
 */
export function pyramidCenters(
  centerX: number,
  baseY: number,
  rows: number,
  radius: number,
): Point[] {
  const centers: Point[] = []
  const rowCount = Math.max(1, Math.floor(rows))
  for (let row = 0; row < rowCount; row++) {
    // row 0 = apex (1 fruit), bottom row = rowCount fruits
    const fruitsInRow = row + 1
    for (let col = 0; col < fruitsInRow; col++) {
      centers.push({
        x: centerX + (col - (fruitsInRow - 1) / 2) * radius * 2,
        y: baseY - (rowCount - 1 - row) * radius * 1.75 - radius,
      })
    }
  }
  return centers
}
