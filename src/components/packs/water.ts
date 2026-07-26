import type { LibraryEntry } from '../../data/library'
import { makePackPaint, safeRect, type CardPainter, type StylePack } from './types'

// ---------------------------------------------------------------------------
// Water pack -- an original quiet vocabulary (Tsushima and any watery text):
// ripple rings spreading from drop points, wave crests, a moon's broken
// reflection. Stillness is the composition; nothing shouts.
// ---------------------------------------------------------------------------

const WT_MIST = '#eaf1f2'
const WT_SILVER = '#c9d8da'
const WT_INK = '#16323e'
const WT_TEAL = '#4a8f9f'
const WT_MOON = '#e8e2cf'

const WATER_PAINTER: CardPainter = {
  safeArea: (w, h) => {
    const m = Math.min(w, h) * 0.05
    const inset = m * 1.6
    return { x: inset, y: inset, w: w - 2 * inset, h: h - 2 * inset }
  },

  ground: (ctx, w, h, t) => {
    ctx.fillStyle = WT_MIST
    ctx.fillRect(0, 0, w, h)
    // silver deepening toward the waterline -- the card's material
    const grad = ctx.createLinearGradient(0, h * 0.5, 0, h)
    grad.addColorStop(0, 'rgba(201,216,218,0)')
    grad.addColorStop(1, 'rgba(201,216,218,0.5)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    // very sparse silver grain, re-rolled per ~12fps tick
    const tick = Math.floor(t * 12)
    ctx.fillStyle = 'rgba(22,50,62,0.04)'
    for (let i = 0; i < 50; i++) {
      const n1 = Math.sin((tick * 53 + i) * 12.9898) * 43758.5453
      const n2 = Math.sin((tick * 31 + i) * 78.233) * 24634.6345
      ctx.fillRect((n1 - Math.floor(n1)) * w, (n2 - Math.floor(n2)) * h, 1.4, 1.4)
    }
  },

  subjects: (ctx, safe, _w, _h, t) => {
    // three staggered drop points; each cycles drop-fall -> ripple-spread
    const points: ReadonlyArray<readonly [number, number, number, number]> = [
      // [x frac, y frac (of safe), max ring radius, phase offset]
      [0.3, 0.62, safe.w * 0.09, 0],
      [0.62, 0.72, safe.w * 0.075, 0.37],
      [0.45, 0.5, safe.w * 0.055, 0.7],
    ]
    const PERIOD = 7 // seconds per drop-and-ripple cycle -- unhurried
    for (const [fx, fy, maxR, offset] of points) {
      const cx = safe.x + safe.w * fx
      const cy = safe.y + safe.h * fy
      const cycle = ((t / PERIOD + offset) % 1 + 1) % 1
      // the drop: first fifth of the cycle, falling toward the surface
      if (cycle < 0.2) {
        const fall = cycle / 0.2
        ctx.fillStyle = WT_TEAL
        ctx.beginPath()
        ctx.arc(cx, cy - (1 - fall) * safe.h * 0.3, 3.2, 0, Math.PI * 2)
        ctx.fill()
      }
      // the rings: three staggered expansions after the landing
      ctx.strokeStyle = WT_INK
      for (let k = 0; k < 3; k++) {
        const ringPhase = cycle - 0.2 - k * 0.12
        if (ringPhase <= 0 || ringPhase > 0.6) continue
        const p = ringPhase / 0.6
        ctx.globalAlpha = (1 - p) * 0.5
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.ellipse(cx, cy, maxR * p + 2, (maxR * p + 2) * 0.36, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // the moon, upper right, with a shimmering broken reflection
    const moonX = safe.x + safe.w * 0.72
    const moonY = safe.y + safe.h * 0.16
    const moonR = Math.min(safe.w, safe.h) * 0.07
    ctx.fillStyle = WT_MOON
    ctx.beginPath()
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = WT_SILVER
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.strokeStyle = WT_MOON
    ctx.lineWidth = 4
    for (let seg = 0; seg < 6; seg++) {
      const sy = moonY + moonR + 12 + seg * 16
      if (sy > safe.y + safe.h * 0.95) break
      const off = Math.sin(t * 0.8 + seg * 1.9) * 4
      ctx.globalAlpha = 0.55 - seg * 0.07
      ctx.beginPath()
      ctx.moveTo(moonX + off, sy)
      ctx.lineTo(moonX + off, sy + 8)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // wave crest lines along the bottom, drifting very slowly
    ctx.strokeStyle = WT_TEAL
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1.4
    for (let i = 0; i < 4; i++) {
      const y = safe.y + safe.h * (0.84 + i * 0.045)
      const drift = t * 2.5 * (i % 2 === 0 ? 1 : -0.7)
      ctx.beginPath()
      for (let x = safe.x; x <= safe.x + safe.w; x += 4) {
        const yy = y + Math.sin((x + drift) / 26 + i * 1.7) * 2.4
        if (x === safe.x) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  frame: (ctx, w, h) => {
    // two thin wavy teal rules, top and bottom -- the water's own edges
    const m = Math.min(w, h) * 0.05
    ctx.strokeStyle = WT_TEAL
    ctx.lineWidth = 2.5
    for (const y of [m, h - m]) {
      ctx.beginPath()
      for (let x = 0; x <= w; x += 4) {
        const yy = y + Math.sin((x / w) * Math.PI * 10) * m * 0.3
        if (x === 0) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
    }
  },
}

const paintWaterCard = makePackPaint(WATER_PAINTER)

/** A thin sine-wave rule across the width -- the water pack's frame element. */
function drawWavyRule(ctx: CanvasRenderingContext2D, w: number, y: number, amplitude: number): void {
  ctx.strokeStyle = WT_TEAL
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let x = 0; x <= w; x += 3) {
    const yy = y + Math.sin((x / w) * Math.PI * 6) * amplitude
    if (x === 0) ctx.moveTo(x, yy)
    else ctx.lineTo(x, yy)
  }
  ctx.stroke()
}

/** Concentric ripple rings, alpha fading outward; flattened ellipses read as a water surface. */
function drawRippleSet(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseR: number, rings: number): void {
  ctx.strokeStyle = WT_INK
  for (let k = 0; k < rings; k++) {
    ctx.globalAlpha = 0.5 - k * 0.13
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(cx, cy, baseR * (1 + k * 0.75), baseR * (1 + k * 0.75) * 0.36, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** Letterspaced text via manual per-char advance (canvas letterSpacing isn't everywhere yet). */
function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking: number,
): void {
  const chars = [...text]
  const widths = chars.map((ch) => ctx.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1)
  let x = cx - total / 2
  chars.forEach((ch, i) => {
    const cw = widths[i] ?? 0
    ctx.fillText(ch, x + cw / 2, y)
    x += cw + tracking
  })
}

export function paintWaterCover(ctx: CanvasRenderingContext2D, w: number, h: number, entry: LibraryEntry): void {
  ctx.fillStyle = WT_MIST
  ctx.fillRect(0, 0, w, h)
  // soft silver deepening toward the waterline (ground material)
  const grad = ctx.createLinearGradient(0, h * 0.55, 0, h)
  grad.addColorStop(0, 'rgba(201,216,218,0)')
  grad.addColorStop(1, 'rgba(201,216,218,0.55)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  const safe = safeRect(w, h)
  // frame: two thin wavy teal rules instead of a rect
  drawWavyRule(ctx, w, safe.y, Math.max(1.5, h * 0.006))
  drawWavyRule(ctx, w, safe.y + safe.h, Math.max(1.5, h * 0.006))

  ctx.save()
  ctx.beginPath()
  ctx.rect(safe.x * 0.4, safe.y + 4, w - safe.x * 0.8, safe.h - 8)
  ctx.clip()

  // moon, upper third, with a broken vertical reflection
  const moonX = w * 0.7
  const moonY = safe.y + safe.h * 0.14
  const moonR = w * 0.075
  ctx.fillStyle = WT_MOON
  ctx.beginPath()
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = WT_SILVER
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.strokeStyle = WT_MOON
  ctx.lineWidth = Math.max(1.4, w * 0.012)
  for (let seg = 0; seg < 4; seg++) {
    const sy = moonY + moonR + 6 + seg * 9
    const off = (seg % 2 === 0 ? 1 : -1) * 2
    ctx.beginPath()
    ctx.moveTo(moonX + off, sy)
    ctx.lineTo(moonX + off, sy + 5)
    ctx.stroke()
  }

  // ripple sets at asymmetric drop points
  drawRippleSet(ctx, w * 0.32, safe.y + safe.h * 0.3, w * 0.055, 3)
  drawRippleSet(ctx, w * 0.55, safe.y + safe.h * 0.42, w * 0.04, 3)
  drawRippleSet(ctx, w * 0.75, safe.y + safe.h * 0.52, w * 0.03, 2)

  // sparse falling drops
  ctx.fillStyle = WT_TEAL
  for (const [dx, dy, dr] of [
    [0.28, 0.12, 0.011],
    [0.5, 0.2, 0.009],
    [0.62, 0.08, 0.01],
    [0.4, 0.05, 0.008],
  ] as const) {
    ctx.beginPath()
    ctx.arc(w * dx, safe.y + safe.h * dy, Math.max(1.2, w * dr), 0, Math.PI * 2)
    ctx.fill()
  }

  // wave crest lines low on the card
  ctx.strokeStyle = WT_TEAL
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1.2
  for (let i = 0; i < 3; i++) {
    const y = safe.y + safe.h * (0.86 + i * 0.045)
    ctx.beginPath()
    for (let x = safe.x; x <= safe.x + safe.w; x += 3) {
      const yy = y + Math.sin((x / w) * Math.PI * 8 + i * 1.7) * 2
      if (x === safe.x) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // quiet lowercase-preserving title, wide tracking
  const titlePx = Math.round(w * 0.085)
  ctx.textAlign = 'center'
  ctx.fillStyle = WT_INK
  ctx.font = `${titlePx}px Georgia, serif`
  const words = entry.title.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (ctx.measureText(probe).width > w * 0.66 && line) {
      lines.push(line)
      line = word
    } else {
      line = probe
    }
  }
  if (line) lines.push(line)
  const lineH = titlePx * 1.45
  const startY = h * 0.66 - ((lines.length - 1) * lineH) / 2
  lines.forEach((text, i) => drawTrackedText(ctx, text, w / 2, startY + i * lineH, titlePx * 0.14))
  ctx.font = `italic ${Math.round(titlePx * 0.62)}px Georgia, serif`
  ctx.fillStyle = WT_TEAL
  ctx.fillText(entry.author, w / 2, startY + lines.length * lineH + titlePx * 0.2)
}

export const WATER_PACK: StylePack = {
  paint: paintWaterCard,
  bg: WT_MIST,
  titleFontFamily: 'Georgia, serif',
  titleUppercase: false,
  titleTracking: '0.12em',
  kicker: WT_TEAL,
  title: WT_INK,
  titleShadow: '1px 1px 0 rgba(74,143,159,0.25)',
  rule: WT_TEAL,
  author: '#6b7f85',
  meta: '#6b7f85',
  quote: '#3d5259',
  buttonBg: WT_INK,
  buttonBorder: WT_INK,
  buttonInk: WT_MIST,
  buttonHoverInk: WT_INK,
  buttonShadow: WT_TEAL,
}
