/**
 * The first painted vignette's art, split from PaintedVignette.tsx so the
 * component file exports only a component (react-refresh contract).
 */

/**
 * Paints the bandstand vignette once: flat value-banded gouache -- sky bands,
 * a glowing Deco half-shell, musician silhouettes, string-light dots -- in
 * the orchestra-tuning beat's own palette so it sits naturally in the scene
 * even before per-beat tinting.
 */
export function paintOrchestraVignette(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
): void {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null
  if (!ctx) return
  const w = width
  const h = height

  // -- flat banded sky (posterized gouache, not a smooth gradient)
  const skyBands = ['#241338', '#2e1a44', '#3b2354', '#4a2c62']
  const bandH = (h * 0.72) / skyBands.length
  skyBands.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(0, i * bandH, w, bandH + 1)
  })
  // -- ground band
  ctx.fillStyle = '#57356b'
  ctx.fillRect(0, h * 0.72, w, h * 0.28)

  // -- distant flat towers, pure cutouts
  ctx.fillStyle = '#1b0f2e'
  const towerXs = [0.06, 0.16, 0.82, 0.93]
  for (const tx of towerXs) {
    const cx = tx * w
    const tw = w * 0.055
    const th = h * (0.2 + 0.12 * Math.abs(Math.sin(cx)))
    for (let s = 0; s < 3; s++) {
      const sw = tw * (1 - s * 0.25)
      ctx.fillRect(cx - sw / 2, h * 0.72 - th + (s * th) / 3, sw, th / 3 + 1)
    }
  }

  const cx = w * 0.5
  const baseY = h * 0.78
  const shellR = h * 0.34

  // -- bandstand platform
  ctx.fillStyle = '#20122f'
  ctx.beginPath()
  ctx.ellipse(cx, baseY + shellR * 0.12, shellR * 1.45, shellR * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()

  // -- glowing half-shell interior: three flat bands, light to dark
  const shellBands: Array<[string, number]> = [
    ['#ffdf9e', 0.45],
    ['#e8974a', 0.75],
    ['#8a4a3a', 1],
  ]
  for (let i = shellBands.length - 1; i >= 0; i--) {
    const entry = shellBands[i]
    if (!entry) continue
    ctx.fillStyle = entry[0]
    ctx.beginPath()
    ctx.arc(cx, baseY, shellR * entry[1], Math.PI, 0)
    ctx.closePath()
    ctx.fill()
  }
  // -- shell ribs
  ctx.strokeStyle = 'rgba(32,16,40,0.45)'
  ctx.lineWidth = Math.max(1, w * 0.002)
  for (let i = 1; i < 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI
    ctx.beginPath()
    ctx.moveTo(cx, baseY)
    ctx.lineTo(cx + Math.cos(a) * shellR, baseY + Math.sin(a) * shellR)
    ctx.stroke()
  }
  // -- shell rim + finial rays
  ctx.strokeStyle = '#ffd166'
  ctx.lineWidth = Math.max(2, w * 0.004)
  ctx.beginPath()
  ctx.arc(cx, baseY, shellR, Math.PI, 0)
  ctx.stroke()
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(cx, baseY - shellR)
    ctx.lineTo(cx + i * shellR * 0.12, baseY - shellR * 1.22)
    ctx.stroke()
  }

  // -- musician silhouettes: flat cutouts inside the glow
  ctx.fillStyle = '#241028'
  for (let i = 0; i < 7; i++) {
    const mx = cx + (i - 3) * shellR * 0.24
    const mh = shellR * (0.34 + (i % 2) * 0.08)
    const my = baseY
    ctx.beginPath()
    ctx.moveTo(mx - mh * 0.16, my)
    ctx.quadraticCurveTo(mx - mh * 0.2, my - mh * 0.6, mx, my - mh * 0.72)
    ctx.quadraticCurveTo(mx + mh * 0.2, my - mh * 0.6, mx + mh * 0.16, my)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.arc(mx, my - mh * 0.84, mh * 0.13, 0, Math.PI * 2)
    ctx.fill()
  }

  // -- strings of light dots swagged across the top
  ctx.fillStyle = '#ffe9b0'
  for (const sy of [0.14, 0.24]) {
    for (let i = 0; i <= 18; i++) {
      const t = i / 18
      const lx = t * w
      const ly = h * sy + Math.sin(Math.PI * t) * h * 0.05
      ctx.beginPath()
      ctx.arc(lx, ly, Math.max(1.5, w * 0.0035), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
