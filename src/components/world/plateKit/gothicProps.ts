import { mixHex, zigguratSteps } from './pure'

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
