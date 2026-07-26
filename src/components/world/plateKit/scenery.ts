import { sunburstRayAngles, zigguratSteps } from './pure'

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
