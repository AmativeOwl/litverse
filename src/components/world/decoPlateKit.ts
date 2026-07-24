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

/** Double-ruled gold border with quarter-fan corners -- the plate's poster frame. */
export function drawDecoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gold: string,
): void {
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

/** One ruled sine wave band -- stylized water. */
export function drawWaveBand(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  amplitude: number,
  wavelength: number,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  for (let px = 0; px <= width; px += 2) {
    const py = y + Math.sin((px / wavelength) * Math.PI * 2) * amplitude
    if (px === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
}
