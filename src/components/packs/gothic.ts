import type { LibraryEntry } from '../../data/library'
import { makePackPaint, safeRect, drawTitleBlock, type CardPainter, type StylePack } from './types'
import { GOLD } from './deco'

// ---------------------------------------------------------------------------
// Gothic / Memento Mori pack (the Masque) -- per the style-packs board
// ---------------------------------------------------------------------------

const EBONY = '#0b0609'
const EBONY_LIFT = '#160a10'
const SCARLET = '#c1121f'
const BONE = '#d8cfc0'
const CANDLE = '#b08d57'
const GOTHIC_RULE = '#3a2028'
/** Poe's room order: blue, purple, green, orange, white, violet -- then the black room's scarlet panes. */
const ROOM_PANES = ['#2a4a8a', '#5a3a8a', '#2f6b3f', '#b05a1f', '#cfc8bd', '#3b2a5a', '#c1121f'] as const

const GOTHIC_PAINTER: CardPainter = {
  safeArea: (w, h) => {
    const m = Math.min(w, h) * 0.03
    const inset = m * 1.6 + 2 // inner rule + its stroke
    return { x: inset, y: inset, w: w - 2 * inset, h: h - 2 * inset }
  },

  ground: (ctx, w, h, t) => {
    // ebony ground, faint stone lift toward the top
    ctx.fillStyle = EBONY
    ctx.fillRect(0, 0, w, h)
    const stone = ctx.createLinearGradient(0, 0, 0, h)
    stone.addColorStop(0, EBONY_LIFT)
    stone.addColorStop(1, EBONY)
    ctx.fillStyle = stone
    ctx.fillRect(0, 0, w, h)

    // bone-dust grain, re-rolled per ~12fps tick
    const tick = Math.floor(t * 12)
    ctx.fillStyle = 'rgba(216,207,192,0.045)'
    for (let i = 0; i < 110; i++) {
      const n1 = Math.sin((tick * 73 + i) * 12.9898) * 43758.5453
      const n2 = Math.sin((tick * 59 + i) * 78.233) * 24634.6345
      ctx.fillRect((n1 - Math.floor(n1)) * w, (n2 - Math.floor(n2)) * h, 1.6, 1.6)
    }
  },

  subjects: (ctx, safe, w, h, t) => {
    // seven pointed-arch windows across the lower hall, composed against
    // the SAFE RECT so every full arch shape -- base, spring, and point --
    // sits inside the frame (they used to run to the canvas edges); each
    // glows its room's hue, candle-flicker out of phase per room
    const n = ROOM_PANES.length
    const marginX = safe.w * 0.035
    const slot = (safe.w - marginX * 2) / n
    const aw = slot * 0.52
    const baseY = safe.y + safe.h - 2 // arch bases rest just above the inner rule
    const ah = Math.min(safe.h * 0.46, slot * 1.6)
    for (let i = 0; i < n; i++) {
      const pane = ROOM_PANES[i] ?? SCARLET
      const x = safe.x + marginX + i * slot + (slot - aw) / 2
      const cxA = x + aw / 2
      const flicker = 0.8 + 0.2 * Math.sin(t * 1.9 + i * 1.7)
      // glow halo -- soft light, safe to let the clip feather its edges
      const glow = ctx.createRadialGradient(cxA, baseY - ah * 0.5, 8, cxA, baseY - ah * 0.5, ah * 0.75)
      glow.addColorStop(0, `${pane}44`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalAlpha = 0.9 * flicker
      ctx.fillStyle = glow
      ctx.fillRect(cxA - ah * 0.8, baseY - ah - ah * 0.4, ah * 1.6, ah * 1.5)
      // pane
      ctx.globalAlpha = 0.5
      ctx.fillStyle = pane
      ctx.beginPath()
      ctx.moveTo(x, baseY)
      ctx.lineTo(x, baseY - ah * 0.62)
      ctx.quadraticCurveTo(x, baseY - ah, cxA, baseY - ah)
      ctx.quadraticCurveTo(x + aw, baseY - ah, x + aw, baseY - ah * 0.62)
      ctx.lineTo(x + aw, baseY)
      ctx.closePath()
      ctx.fill()
      // tracery: mullion + transom in ebony, arch outline in candle gold
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = EBONY
      ctx.lineWidth = Math.max(2, aw * 0.045)
      ctx.beginPath()
      ctx.moveTo(cxA, baseY)
      ctx.lineTo(cxA, baseY - ah * 0.94)
      ctx.moveTo(x, baseY - ah * 0.5)
      ctx.lineTo(x + aw, baseY - ah * 0.5)
      ctx.stroke()
      ctx.strokeStyle = CANDLE
      ctx.lineWidth = Math.max(1.4, aw * 0.03)
      ctx.globalAlpha = 0.6 * flicker
      ctx.beginPath()
      ctx.moveTo(x, baseY)
      ctx.lineTo(x, baseY - ah * 0.62)
      ctx.quadraticCurveTo(x, baseY - ah, cxA, baseY - ah)
      ctx.quadraticCurveTo(x + aw, baseY - ah, x + aw, baseY - ah * 0.62)
      ctx.lineTo(x + aw, baseY)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    // hall floor line, inside the frame
    ctx.strokeStyle = GOTHIC_RULE
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(safe.x + safe.w * 0.01, baseY)
    ctx.lineTo(safe.x + safe.w * 0.99, baseY)
    ctx.stroke()

    // center scrim: an ebony pool behind the type column so the bill stays
    // legible over the brighter panes (white and orange rooms especially)
    const scrim = ctx.createRadialGradient(w / 2, h * 0.52, h * 0.08, w / 2, h * 0.52, h * 0.62)
    scrim.addColorStop(0, 'rgba(11,6,9,0.82)')
    scrim.addColorStop(0.7, 'rgba(11,6,9,0.45)')
    scrim.addColorStop(1, 'rgba(11,6,9,0)')
    ctx.fillStyle = scrim
    ctx.fillRect(safe.x, safe.y, safe.w, safe.h)

    // (the ebony clock medallion that hung here was cut -- see the module
    // header: nothing competes with the masthead for the top-center space)
  },

  frame: (ctx, w, h) => {
    // thin double rule frame with scarlet corner diamonds
    const m = Math.min(w, h) * 0.03
    ctx.strokeStyle = GOTHIC_RULE
    ctx.lineWidth = 2
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
    ctx.lineWidth = 1
    ctx.strokeRect(m * 1.6, m * 1.6, w - 3.2 * m, h - 3.2 * m)
    ctx.fillStyle = SCARLET
    for (const [px, py] of [
      [m, m],
      [w - m, m],
      [w - m, h - m],
      [m, h - m],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(px, py - 6)
      ctx.lineTo(px + 6, py)
      ctx.lineTo(px, py + 6)
      ctx.lineTo(px - 6, py)
      ctx.closePath()
      ctx.fill()
    }
  },
}

const paintGothicCard = makePackPaint(GOTHIC_PAINTER)

const GOTHIC_INK = '#120a10'
const GOTHIC_BONE = '#e8dfd2'
const GOTHIC_SCARLET = '#c1121f'
const ROOM_HUES = ['#2a4a8a', '#6a3a8a', '#2a7a4a', '#c96a1e', '#e8e2d2', '#7a5a9a', '#c1121f']

export function paintGothicCover(ctx: CanvasRenderingContext2D, w: number, h: number, entry: LibraryEntry): void {
  ctx.fillStyle = GOTHIC_INK
  ctx.fillRect(0, 0, w, h)
  const safe = safeRect(w, h)
  ctx.strokeStyle = GOTHIC_SCARLET
  ctx.lineWidth = Math.max(1.4, w * 0.012)
  ctx.strokeRect(safe.x, safe.y, safe.w, safe.h)
  ctx.save()
  ctx.beginPath()
  ctx.rect(safe.x, safe.y, safe.w, safe.h)
  ctx.clip()
  // clock at a minute to midnight
  const cx = w / 2
  const clockY = safe.y + safe.h * 0.16
  const r = w * 0.085
  ctx.strokeStyle = GOLD
  ctx.lineWidth = Math.max(1, w * 0.008)
  ctx.beginPath()
  ctx.arc(cx, clockY, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, clockY)
  ctx.lineTo(cx - r * 0.12, clockY - r * 0.75)
  ctx.moveTo(cx, clockY)
  ctx.lineTo(cx + r * 0.4, clockY - r * 0.3)
  ctx.stroke()
  // the seven rooms as a band of tiny arches, Poe's own order
  const bandY = safe.y + safe.h * 0.44
  const archW = safe.w / 10
  ROOM_HUES.forEach((hue, i) => {
    const x = safe.x + safe.w * 0.5 + (i - 3) * archW * 1.18
    const aw = archW * 0.52
    const ah = safe.h * 0.13
    ctx.fillStyle = hue
    ctx.beginPath()
    ctx.moveTo(x - aw / 2, bandY)
    ctx.lineTo(x - aw / 2, bandY - ah * 0.55)
    ctx.quadraticCurveTo(x - aw / 2, bandY - ah * 0.95, x, bandY - ah)
    ctx.quadraticCurveTo(x + aw / 2, bandY - ah * 0.95, x + aw / 2, bandY - ah * 0.55)
    ctx.lineTo(x + aw / 2, bandY)
    ctx.closePath()
    ctx.fill()
  })
  ctx.restore()
  drawTitleBlock(ctx, w, entry, GOTHIC_BONE, GOTHIC_SCARLET, h * 0.66, Math.round(w * 0.092))
}

export const GOTHIC_PACK: StylePack = {
  paint: paintGothicCard,
  bg: EBONY,
  titleFontFamily: 'var(--font-display)',
  kicker: CANDLE,
  title: BONE,
  titleShadow: '3px 3px 0 rgba(193,18,31,0.45)',
  rule: SCARLET,
  author: '#a99e90',
  meta: '#8d8378',
  quote: '#b8ac9c',
  buttonBg: SCARLET,
  buttonBorder: SCARLET,
  buttonInk: BONE,
  buttonHoverInk: SCARLET,
  buttonShadow: CANDLE,
}
