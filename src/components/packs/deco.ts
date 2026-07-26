import type { LibraryEntry } from '../../data/library'
import { makePackPaint, safeRect, drawTitleBlock, type CardPainter, type StylePack } from './types'

// ---------------------------------------------------------------------------
// Deco pack (Gatsby) -- the shipped title card, restructured onto the
// ground/subjects/frame contract (visually unchanged: its sunburst and
// grain are ground by design, and it has no discrete pictorial subjects)
// ---------------------------------------------------------------------------

const PAPER = '#efe4c9'
const PAPER_DEEP = '#e4d5b0'
const NAVY = '#22304f'
export const GOLD = '#a8802c'
const GOLD_BRIGHT = '#c99b3f'

const DECO_PAINTER: CardPainter = {
  safeArea: (w, h) => {
    const m = Math.min(w, h) * 0.035
    const inset = m * 1.55 + 2 // inner gold rule + its stroke
    return { x: inset, y: inset, w: w - 2 * inset, h: h - 2 * inset }
  },

  ground: (ctx, w, h, t) => {
    // paper with a soft radial deepening toward the edges
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, w, h)
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.95)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(90,66,30,0.18)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, h)

    // the giant sunburst, turning almost imperceptibly -- rays radiate to
    // the canvas edges BEHIND the frame deliberately: they are the card's
    // material, not a pictorial subject
    const cx = w / 2
    const cy = h * 0.42
    const rayCount = 28
    const rotation = t * 0.015
    ctx.fillStyle = PAPER_DEEP
    for (let i = 0; i < rayCount; i++) {
      const a0 = rotation + (i / rayCount) * Math.PI * 2
      const a1 = a0 + (Math.PI * 2) / rayCount / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, Math.max(w, h), a0, a1)
      ctx.closePath()
      ctx.fill()
    }

    // film grain, re-rolled per ~12fps tick
    const tick = Math.floor(t * 12)
    ctx.fillStyle = 'rgba(60,40,15,0.06)'
    for (let i = 0; i < 110; i++) {
      const n1 = Math.sin((tick * 91 + i) * 12.9898) * 43758.5453
      const n2 = Math.sin((tick * 47 + i) * 78.233) * 24634.6345
      ctx.fillRect((n1 - Math.floor(n1)) * w, (n2 - Math.floor(n2)) * h, 1.6, 1.6)
    }
  },

  subjects: () => {
    // the Deco bill is type-led: no painted pictorial subjects
  },

  frame: (ctx, w, h) => {
    // deco border: double rule + corner fans, in navy and gold
    const m = Math.min(w, h) * 0.035
    ctx.strokeStyle = NAVY
    ctx.lineWidth = 3
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 1.2
    ctx.strokeRect(m * 1.55, m * 1.55, w - 3.1 * m, h - 3.1 * m)
    const fan = m * 1.6
    const corners: ReadonlyArray<readonly [number, number, number]> = [
      [m, m, 0],
      [w - m, m, Math.PI / 2],
      [w - m, h - m, Math.PI],
      [m, h - m, -Math.PI / 2],
    ]
    ctx.strokeStyle = GOLD
    for (const [px, py, rot] of corners) {
      for (let r = 0; r <= 5; r++) {
        const a = rot + (r / 5) * (Math.PI / 2)
        ctx.beginPath()
        ctx.moveTo(px + Math.cos(a) * fan * 0.35, py + Math.sin(a) * fan * 0.35)
        ctx.lineTo(px + Math.cos(a) * fan, py + Math.sin(a) * fan)
        ctx.stroke()
      }
    }
  },
}

const paintDecoCard = makePackPaint(DECO_PAINTER)

export function paintDecoCover(ctx: CanvasRenderingContext2D, w: number, h: number, entry: LibraryEntry): void {
  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, w, h)
  const safe = safeRect(w, h)
  // gold double rule
  ctx.strokeStyle = GOLD
  ctx.lineWidth = Math.max(1.4, w * 0.012)
  ctx.strokeRect(safe.x, safe.y, safe.w, safe.h)
  ctx.lineWidth = Math.max(0.8, w * 0.006)
  ctx.strokeRect(safe.x + w * 0.03, safe.y + w * 0.03, safe.w - w * 0.06, safe.h - w * 0.06)
  // sunburst crown inside the frame
  ctx.save()
  ctx.beginPath()
  ctx.rect(safe.x, safe.y, safe.w, safe.h)
  ctx.clip()
  const cx = w / 2
  const cy = safe.y + safe.h * 0.3
  ctx.strokeStyle = GOLD_BRIGHT
  ctx.globalAlpha = 0.85
  for (let i = 0; i < 13; i++) {
    const a = Math.PI + (i / 12) * Math.PI
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * w * 0.05, cy + Math.sin(a) * w * 0.05)
    ctx.lineTo(cx + Math.cos(a) * w * 0.3, cy + Math.sin(a) * w * 0.3)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = GOLD_BRIGHT
  ctx.beginPath()
  ctx.arc(cx, cy, w * 0.045, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  drawTitleBlock(ctx, w, entry, PAPER, GOLD_BRIGHT, h * 0.62, Math.round(w * 0.105))
  // small diamond colophon
  ctx.fillStyle = GOLD
  ctx.save()
  ctx.translate(w / 2, safe.y + safe.h - h * 0.05)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-w * 0.014, -w * 0.014, w * 0.028, w * 0.028)
  ctx.restore()
}

export const DECO_PACK: StylePack = {
  paint: paintDecoCard,
  bg: PAPER,
  titleFontFamily: 'var(--font-display)',
  kicker: NAVY,
  title: '#221a12',
  titleShadow: '3px 3px 0 rgba(168,128,44,0.35)',
  rule: GOLD,
  author: '#3d3020',
  meta: '#6b5836',
  quote: '#4a3b26',
  buttonBg: NAVY,
  buttonBorder: NAVY,
  buttonInk: PAPER,
  buttonHoverInk: NAVY,
  buttonShadow: GOLD_BRIGHT,
}
