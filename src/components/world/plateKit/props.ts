import { pyramidCenters } from './pure'
import { drawSunburst } from './scenery'

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
