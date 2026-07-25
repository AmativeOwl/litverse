import { clamp01, easeInOutCubic, lerpColorHex } from './beatMath'

/**
 * The generic Art-Deco drawing kit for painted plates (see CLAUDE.md,
 * "Painted-world pivot"). Scene-agnostic by design: Gatsby-specific
 * compositions live in `src/data/plates/<sceneId>.ts`, which composes these
 * helpers -- a future text reuses the kit, not the compositions.
 *
 * Two tiers:
 * - Pure, canvas-free helpers (color math, layout geometry) -- unit-tested.
 * - Thin ctx-drawing wrappers over those helpers -- exercised visually, not
 *   unit-tested (pixel output isn't meaningfully assertable in jsdom).
 *
 * Style contract (from the user's Art-Deco poster references): flat color
 * fields, mirrored symmetry, sunburst/fan ornament, stepped ziggurats, flat
 * silhouette figures, ruled gold linework. No gradients except the banded
 * approximations these helpers draw explicitly.
 */

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

// ---------------------------------------------------------------------------
// ctx-drawing wrappers (thin; visually verified)
// ---------------------------------------------------------------------------

/** Flat horizontal color bands -- the posterized "gouache sky" ground of every plate. */
export function drawBandedSky(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  height: number,
  colors: readonly string[],
): void {
  if (colors.length === 0) return
  const bandHeight = height / colors.length
  colors.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(0, y + i * bandHeight, width, bandHeight + 1)
  })
}

/** Ruled sunburst/fan rays between two radii. */
export function drawSunburst(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  rayCount: number,
  color: string,
  startRad: number,
  endRad: number,
  alpha = 1,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, outerRadius * 0.012)
  for (const angle of sunburstRayAngles(rayCount, startRad, endRad)) {
    ctx.beginPath()
    ctx.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius)
    ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawZigguratTower(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  width: number,
  height: number,
  steps: number,
  color: string,
): void {
  ctx.fillStyle = color
  for (const rect of zigguratSteps(centerX, baseY, width, height, steps)) {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height + 0.8)
  }
}

/** Sparse deterministic lit-window dots over a tower footprint. */
export function drawWindows(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  width: number,
  height: number,
  color: string,
  seedStep: number,
): void {
  ctx.fillStyle = color
  for (let i = 0; i < 14; i++) {
    const t = (i * seedStep) % 1
    ctx.fillRect(
      centerX - width * 0.3 + t * width * 0.6,
      baseY - height * 0.15 - t * height * 0.75,
      Math.max(1.2, width * 0.02),
      Math.max(1.6, width * 0.028),
    )
  }
}

/** Draw half a composition, then the mirrored half -- the reference posters' bilateral symmetry. */
export function withMirrorSymmetry(
  ctx: CanvasRenderingContext2D,
  width: number,
  drawHalf: () => void,
): void {
  drawHalf()
  ctx.save()
  ctx.translate(width, 0)
  ctx.scale(-1, 1)
  drawHalf()
  ctx.restore()
}

/**
 * Cyclorama-mode switch for the poster frame: when the painted cards became
 * curved shells the viewer stands INSIDE (see CLAUDE.md "immersive cyclorama
 * + cinema mode"), the gold frame stopped making sense -- you don't see a
 * picture frame from inside the picture. Every existing paint function
 * calls drawDecoFrame unconditionally, so rather than editing dozens of
 * compositions across every registry, the frame is disabled here at the
 * single choke point. Flip back to true (or delete these three lines) to
 * restore the framed-photocard look wholesale.
 */
let decoFrameEnabled = false
export function setDecoFrameEnabled(enabled: boolean): void {
  decoFrameEnabled = enabled
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
 * even 360/N-degree circle (ascending order preserved, first azimuth kept
 * as the anchor), so sector shells cut to exactly one slot each abut their
 * neighbors with no gap -- the zoetrope-drum look where paintings connect
 * edge-to-edge and a turn slides image-into-image. Authored azimuths stay
 * the *identity* of a sector (data files and camera map are untouched);
 * this is purely the hanging position. Pure and exported for tests.
 */
export function tileSlotAzimuths(azimuthsDeg: readonly number[]): Map<number, number> {
  const unique = [...new Set(azimuthsDeg)].sort((a, b) => a - b)
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

/** Double-ruled gold border with quarter-fan corners -- the plate's poster frame. */
export function drawDecoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gold: string,
): void {
  if (!decoFrameEnabled) return
  const margin = width * 0.028
  ctx.strokeStyle = gold
  ctx.lineWidth = Math.max(1.5, width * 0.004)
  ctx.strokeRect(margin, margin, width - 2 * margin, height - 2 * margin)
  ctx.lineWidth = Math.max(0.8, width * 0.0018)
  ctx.strokeRect(margin * 1.6, margin * 1.6, width - 3.2 * margin, height - 3.2 * margin)
  const fanRadius = margin * 1.5
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [margin, margin, 0],
    [width - margin, margin, Math.PI / 2],
    [width - margin, height - margin, Math.PI],
    [margin, height - margin, -Math.PI / 2],
  ]
  for (const [cx, cy, rotation] of corners) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)
    drawSunburst(ctx, 0, 0, fanRadius * 0.3, fanRadius, 5, gold, 0, Math.PI / 2, 0.9)
    ctx.restore()
  }
}

export type FigurePose = 'stand' | 'dance' | 'serve' | 'mop' | 'horn'

/**
 * A flat Deco silhouette figure -- gown/coat body tapering to shoulders, a
 * separate head, and a pose-specific arm gesture. Drawn in a local 100-unit
 * coordinate space scaled to `height`, standing on (x, baseY).
 */
export function drawSilhouetteFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  pose: FigurePose,
  color: string,
): void {
  ctx.save()
  ctx.translate(x, baseY)
  ctx.scale(height / 100, height / 100)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(-13, 0)
  ctx.quadraticCurveTo(-9, -46, -7, -62)
  ctx.quadraticCurveTo(-11, -70, -6, -74)
  ctx.lineTo(6, -74)
  ctx.quadraticCurveTo(11, -70, 7, -62)
  ctx.quadraticCurveTo(9, -46, 13, 0)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -84, 8.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  const arm = (x0: number, y0: number, x1: number, y1: number) => {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  switch (pose) {
    case 'dance':
      arm(-6, -70, -24, -92)
      arm(6, -70, 26, -90)
      break
    case 'serve':
      arm(-6, -68, -22, -72)
      arm(6, -68, 22, -72)
      ctx.fillRect(-28, -76, 56, 3)
      break
    case 'mop':
      arm(6, -68, 20, -40)
      ctx.beginPath()
      ctx.moveTo(20, -40)
      ctx.lineTo(24, 2)
      ctx.stroke()
      break
    case 'horn':
      arm(-6, -70, 14, -78)
      ctx.beginPath()
      ctx.moveTo(12, -80)
      ctx.lineTo(30, -84)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(30, -90)
      ctx.lineTo(30, -78)
      ctx.lineTo(40, -84)
      ctx.closePath()
      ctx.fill()
      break
    case 'stand':
      break
  }
  ctx.restore()
}

/** Flat side-profile vintage car: body slab, cabin, two wheel discs, optional headlight dot. */
export function drawCarProfile(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  length: number,
  color: string,
  headlightColor?: string,
): void {
  const height = length * 0.26
  ctx.fillStyle = color
  ctx.fillRect(centerX - length / 2, baseY - height * 0.55, length, height * 0.55)
  ctx.fillRect(centerX - length * 0.16, baseY - height, length * 0.42, height * 0.5)
  for (const dx of [-0.3, 0.3]) {
    ctx.beginPath()
    ctx.arc(centerX + dx * length, baseY, length * 0.085, 0, Math.PI * 2)
    ctx.fill()
  }
  if (headlightColor) {
    ctx.fillStyle = headlightColor
    ctx.beginPath()
    ctx.arc(centerX + length / 2, baseY - height * 0.35, length * 0.045, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Fading triangular headlight/spotlight beam. */
export function drawBeamCone(
  ctx: CanvasRenderingContext2D,
  sourceX: number,
  sourceY: number,
  length: number,
  spread: number,
  color: string,
): void {
  const gradient = ctx.createLinearGradient(sourceX, sourceY, sourceX + length, sourceY)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(sourceX, sourceY)
  ctx.lineTo(sourceX + length, sourceY - spread)
  ctx.lineTo(sourceX + length, sourceY + spread)
  ctx.closePath()
  ctx.fill()
}

/**
 * A swagged strand of light dots across the full plate width. Pass
 * `twinkleTime` (seconds) to make the bulbs shimmer individually -- each
 * dot's alpha breathes on its own phase, the "coloured lights" alive.
 */
export function drawStringDots(
  ctx: CanvasRenderingContext2D,
  width: number,
  topY: number,
  sag: number,
  count: number,
  color: string,
  dotRadius: number,
  twinkleTime?: number,
): void {
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i <= count; i++) {
    const t = i / count
    if (twinkleTime !== undefined) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(twinkleTime * 3 + i * 1.7)
    }
    ctx.beginPath()
    ctx.arc(t * width, catenaryY(t, topY, sag), dotRadius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
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

/** A stacked pyramid of fruit ("a pyramid of pulpless halves"). */
export function drawFruitPyramid(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  rows: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color
  for (const center of pyramidCenters(centerX, baseY, rows, radius)) {
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** "Spiced baked hams" -- a glazed ham: ellipse body, shine band, bone nub. */
export function drawGlazedHam(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  color: string,
  shineColor: string,
): void {
  const height = width * 0.62
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(centerX, centerY, width / 2, height / 2, -0.15, 0, Math.PI * 2)
  ctx.fill()
  // bone nub
  ctx.fillRect(centerX + width * 0.38, centerY - height * 0.14, width * 0.16, height * 0.24)
  // glaze shine band
  ctx.strokeStyle = shineColor
  ctx.lineWidth = Math.max(1.2, width * 0.05)
  ctx.beginPath()
  ctx.ellipse(centerX - width * 0.08, centerY - height * 0.12, width * 0.28, height * 0.2, -0.3, Math.PI * 1.1, Math.PI * 1.9)
  ctx.stroke()
}

/** "Turkeys bewitched to a dark gold" -- body, tail fan, two drumsticks up. */
export function drawTurkey(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  color: string,
  accent: string,
): void {
  const height = width * 0.7
  drawSunburst(ctx, centerX, centerY - height * 0.1, width * 0.28, width * 0.52, 6, accent, Math.PI * 1.15, Math.PI * 1.85, 0.8)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // drumsticks
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(centerX + side * width * 0.34, centerY - height * 0.42, width * 0.09, height * 0.24, side * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX + side * width * 0.42, centerY - height * 0.66, width * 0.06, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** "Pastry pigs" and tarts -- a row of alternating crescents and rounds. */
export function drawPastryRow(
  ctx: CanvasRenderingContext2D,
  startX: number,
  y: number,
  count: number,
  spacing: number,
  size: number,
  color: string,
): void {
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing
    if (i % 2 === 0) {
      // round tart
      ctx.beginPath()
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // crescent
      ctx.beginPath()
      ctx.arc(x, y, size * 0.55, Math.PI * 0.15, Math.PI * 1.1)
      ctx.arc(x + size * 0.18, y - size * 0.12, size * 0.42, Math.PI * 1.05, Math.PI * 0.25, true)
      ctx.closePath()
      ctx.fill()
    }
  }
}

/**
 * The kitchen juice machine -- deco appliance: body, hopper funnel, crank,
 * glass, the little button. Pass `crankTime` (seconds) and the crank handle
 * turns -- two hundred oranges in half an hour.
 */
export function drawJuiceMachine(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  height: number,
  bodyColor: string,
  accent: string,
  crankTime?: number,
): void {
  const width = height * 0.56
  // body
  ctx.fillStyle = bodyColor
  ctx.fillRect(centerX - width / 2, baseY - height * 0.72, width, height * 0.72)
  // hopper funnel on top
  ctx.beginPath()
  ctx.moveTo(centerX - width * 0.42, baseY - height)
  ctx.lineTo(centerX + width * 0.42, baseY - height)
  ctx.lineTo(centerX + width * 0.16, baseY - height * 0.72)
  ctx.lineTo(centerX - width * 0.16, baseY - height * 0.72)
  ctx.closePath()
  ctx.fill()
  // fluted deco ribs
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(1, height * 0.014)
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(centerX + i * width * 0.22, baseY - height * 0.68)
    ctx.lineTo(centerX + i * width * 0.22, baseY - height * 0.2)
    ctx.stroke()
  }
  // crank: axis on the body's side; handle turns when crankTime is passed
  const crankAxisX = centerX + width * 0.56
  const crankAxisY = baseY - height * 0.6
  const crankAngle = crankTime === undefined ? -0.5 : crankTime * 2.4
  const handleX = crankAxisX + Math.cos(crankAngle) * width * 0.24
  const handleY = crankAxisY + Math.sin(crankAngle) * width * 0.24
  ctx.beginPath()
  ctx.moveTo(crankAxisX, crankAxisY)
  ctx.lineTo(handleX, handleY)
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(handleX, handleY, height * 0.03, 0, Math.PI * 2)
  ctx.fill()
  // THE little button, pressed two hundred times
  ctx.beginPath()
  ctx.arc(centerX - width * 0.62, baseY - height * 0.45, height * 0.035, 0, Math.PI * 2)
  ctx.fill()
  // juice glass at the spout
  ctx.fillStyle = accent
  ctx.fillRect(centerX - width * 0.14, baseY - height * 0.16, width * 0.28, height * 0.16)
}

/**
 * A tall, narrow Gothic lancet window -- straight jambs rising to a pointed
 * arch, a center mullion and one transom, panes filled `paneColor`. The
 * first kit primitive added for a non-Gatsby text (Masque of the Red Death);
 * per the shared-lexicon rule it now serves every text after it.
 */
export function drawGothicArch(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  width: number,
  height: number,
  paneColor: string,
  frameColor: string,
): void {
  const half = width / 2
  const springY = baseY - height * 0.62 // where the arch curves begin
  const apexY = baseY - height
  ctx.fillStyle = paneColor
  ctx.beginPath()
  ctx.moveTo(centerX - half, baseY)
  ctx.lineTo(centerX - half, springY)
  ctx.quadraticCurveTo(centerX - half, apexY + height * 0.1, centerX, apexY)
  ctx.quadraticCurveTo(centerX + half, apexY + height * 0.1, centerX + half, springY)
  ctx.lineTo(centerX + half, baseY)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = frameColor
  ctx.lineWidth = Math.max(1.2, width * 0.08)
  ctx.stroke()
  // mullion + transom
  ctx.lineWidth = Math.max(1, width * 0.05)
  ctx.beginPath()
  ctx.moveTo(centerX, apexY + height * 0.04)
  ctx.lineTo(centerX, baseY)
  ctx.moveTo(centerX - half, baseY - height * 0.38)
  ctx.lineTo(centerX + half, baseY - height * 0.38)
  ctx.stroke()
}

/**
 * A heavy tripod brazier bearing fire (Poe's corridors: no lamp nor candle,
 * only fire-light through stained glass). Pass `flameTime` (seconds) and the
 * flame tongues flicker deterministically; omit it for a steady flame.
 */
export function drawBrazier(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  height: number,
  ironColor: string,
  fireColor: string,
  flameTime?: number,
): void {
  const bowlW = height * 0.5
  const bowlY = baseY - height * 0.52
  ctx.strokeStyle = ironColor
  ctx.lineWidth = Math.max(1.4, height * 0.045)
  // three splayed legs
  for (const lean of [-0.32, 0, 0.32]) {
    ctx.beginPath()
    ctx.moveTo(centerX + lean * bowlW * 0.6, bowlY)
    ctx.lineTo(centerX + lean * bowlW * 1.5, baseY)
    ctx.stroke()
  }
  // the bowl: shallow trapezoid
  ctx.fillStyle = ironColor
  ctx.beginPath()
  ctx.moveTo(centerX - bowlW / 2, bowlY)
  ctx.lineTo(centerX + bowlW / 2, bowlY)
  ctx.lineTo(centerX + bowlW * 0.3, bowlY + height * 0.14)
  ctx.lineTo(centerX - bowlW * 0.3, bowlY + height * 0.14)
  ctx.closePath()
  ctx.fill()
  // flame tongues: three triangles whose heights breathe out of phase
  ctx.fillStyle = fireColor
  const tongues: ReadonlyArray<readonly [number, number, number]> = [
    [-0.16, 0.3, 0], // [xFrac of bowlW, height frac, phase]
    [0, 0.48, 2.1],
    [0.15, 0.34, 4.2],
  ]
  for (const [xFrac, hFrac, phase] of tongues) {
    const flicker = flameTime === undefined ? 1 : 0.78 + 0.22 * Math.sin(flameTime * 5.3 + phase)
    const tx = centerX + xFrac * bowlW
    const th = height * hFrac * flicker
    ctx.beginPath()
    ctx.moveTo(tx - bowlW * 0.11, bowlY)
    ctx.lineTo(tx + bowlW * 0.11, bowlY)
    ctx.lineTo(tx + (flameTime === undefined ? 0 : Math.sin(flameTime * 3.7 + phase) * bowlW * 0.06), bowlY - th)
    ctx.closePath()
    ctx.fill()
  }
}

/**
 * The gigantic ebony clock -- tall case with a stepped deco-gothic crown, a
 * pale face with the minute-hand a breath from twelve, and a pendulum
 * behind a lower window. Pass `pendulumTime` (seconds) and the pendulum
 * swings to and fro on a ~2s period, "with a dull, heavy, monotonous clang";
 * omit it for a frozen mid-swing pose.
 */
export function drawEbonyClock(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  height: number,
  caseColor: string,
  faceColor: string,
  accent: string,
  pendulumTime?: number,
): void {
  const width = height * 0.34
  // case body
  ctx.fillStyle = caseColor
  ctx.fillRect(centerX - width / 2, baseY - height * 0.86, width, height * 0.86)
  // stepped crown
  for (const rect of zigguratSteps(centerX, baseY - height * 0.86, width * 0.98, height * 0.14, 3)) {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height + 0.8)
  }
  // face, ringed in accent; the minute-hand nearly at the circuit's end
  const faceR = width * 0.36
  const faceY = baseY - height * 0.68
  ctx.fillStyle = faceColor
  ctx.beginPath()
  ctx.arc(centerX, faceY, faceR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(1, height * 0.012)
  ctx.stroke()
  ctx.strokeStyle = caseColor
  ctx.lineWidth = Math.max(1, height * 0.014)
  ctx.beginPath()
  ctx.moveTo(centerX, faceY)
  ctx.lineTo(centerX - faceR * 0.06, faceY - faceR * 0.78) // minute hand: a breath before twelve
  ctx.moveTo(centerX, faceY)
  ctx.lineTo(centerX + faceR * 0.45, faceY - faceR * 0.3) // hour hand
  ctx.stroke()
  // pendulum window + swinging bob
  const winTop = baseY - height * 0.5
  const winH = height * 0.42
  ctx.fillStyle = mixHex(caseColor, '#000000', 0.4)
  ctx.fillRect(centerX - width * 0.3, winTop, width * 0.6, winH)
  const angle = pendulumTime === undefined ? 0.3 : Math.sin(pendulumTime * Math.PI) * 0.42
  const rodLen = winH * 0.82
  const bobX = centerX + Math.sin(angle) * rodLen
  const bobY = winTop + Math.cos(angle) * rodLen
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(1, height * 0.008)
  ctx.beginPath()
  ctx.moveTo(centerX, winTop)
  ctx.lineTo(bobX, bobY)
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(bobX, bobY, width * 0.09, 0, Math.PI * 2)
  ctx.fill()
}

/** One ruled sine wave band -- stylized water. Pass `phase` (radians) to make the swell travel. */
export function drawWaveBand(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  amplitude: number,
  wavelength: number,
  color: string,
  lineWidth: number,
  phase = 0,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  for (let px = 0; px <= width; px += 2) {
    const py = y + Math.sin((px / wavelength) * Math.PI * 2 + phase) * amplitude
    if (px === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
}
