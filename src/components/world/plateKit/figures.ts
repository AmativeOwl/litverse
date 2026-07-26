import { catenaryY } from './pure'

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
