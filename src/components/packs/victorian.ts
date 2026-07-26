import type { LibraryEntry } from '../../data/library'
import { makePackPaint, safeRect, type CardPainter, type StylePack } from './types'

// ---------------------------------------------------------------------------
// Victorian Engraving / Brass Adventure pack -- per the style-packs concept
// board: the frontispiece of an 1870s printing; cross-hatched seas, an oval
// vignette, stacked title-page typography with rules between the lines.
// ---------------------------------------------------------------------------

const VC_IVORY = '#f2ecdd'
const VC_INK = '#2b2620'
const VC_BRASS = '#9a7b3c'
const VC_OXBLOOD = '#6e2f2a'

/** Clipped parallel-line hatching -- the engraver's tonal system. */
function hatchRegion(
  ctx: CanvasRenderingContext2D,
  clip: () => void,
  w: number,
  h: number,
  spacing: number,
  angle: number,
  alpha: number,
): void {
  ctx.save()
  clip()
  ctx.clip()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = VC_INK
  ctx.lineWidth = 1.1
  ctx.translate(w / 2, h / 2)
  ctx.rotate(angle)
  const span = Math.max(w, h) * 1.5
  for (let d = -span; d < span; d += spacing) {
    ctx.beginPath()
    ctx.moveTo(-span, d)
    ctx.lineTo(span, d)
    ctx.stroke()
  }
  ctx.restore()
}

const VICTORIAN_PAINTER: CardPainter = {
  safeArea: (w, h) => {
    const m = Math.min(w, h) * 0.04
    const inset = m * 1.8 + 2 // outer + inner stacked rules
    return { x: inset, y: inset, w: w - 2 * inset, h: h - 2 * inset }
  },

  ground: (ctx, w, h, t) => {
    ctx.fillStyle = VC_IVORY
    ctx.fillRect(0, 0, w, h)
    // plate-ink flecks, re-rolled per ~12fps tick -- the paper of an old
    // impression, not pristine stock
    const tick = Math.floor(t * 12)
    ctx.fillStyle = 'rgba(43,38,32,0.05)'
    for (let i = 0; i < 90; i++) {
      const n1 = Math.sin((tick * 67 + i) * 12.9898) * 43758.5453
      const n2 = Math.sin((tick * 29 + i) * 78.233) * 24634.6345
      ctx.fillRect((n1 - Math.floor(n1)) * w, (n2 - Math.floor(n2)) * h, 1.4, 1.4)
    }
  },

  subjects: (ctx, safe, w, _h, t) => {
    // the oval engraved vignette, low center (the type column sits above)
    const vcx = w / 2
    const vcy = safe.y + safe.h * 0.72
    const vrx = Math.min(safe.w * 0.32, safe.h * 0.62)
    const vry = vrx * 0.48
    const ovalClip = () => {
      ctx.beginPath()
      ctx.ellipse(vcx, vcy, vrx, vry, 0, 0, Math.PI * 2)
    }
    // hatched sea at three angles, denser toward the bottom strata
    hatchRegion(ctx, ovalClip, w, _h, 9, 0.06, 0.5)
    hatchRegion(
      ctx,
      () => {
        ctx.beginPath()
        ctx.ellipse(vcx, vcy + vry * 0.35, vrx, vry * 0.75, 0, 0, Math.PI * 2)
      },
      w,
      _h,
      6.5,
      -0.18,
      0.4,
    )
    hatchRegion(
      ctx,
      () => {
        ctx.beginPath()
        ctx.ellipse(vcx, vcy + vry * 0.6, vrx, vry * 0.5, 0, 0, Math.PI * 2)
      },
      w,
      _h,
      4.5,
      0.3,
      0.42,
    )

    // light shaft from the upper left -- erases hatching like a burnisher
    ctx.save()
    ovalClip()
    ctx.clip()
    const shaft = ctx.createLinearGradient(vcx - vrx * 0.2, vcy - vry, vcx + vrx * 0.5, vcy + vry)
    shaft.addColorStop(0, 'rgba(242,236,221,0.85)')
    shaft.addColorStop(0.45, 'rgba(242,236,221,0.12)')
    shaft.addColorStop(1, 'rgba(242,236,221,0)')
    ctx.fillStyle = shaft
    ctx.beginPath()
    ctx.moveTo(vcx - vrx * 0.3, vcy - vry)
    ctx.lineTo(vcx + vrx * 0.55, vcy + vry)
    ctx.lineTo(vcx + vrx * 0.05, vcy + vry)
    ctx.lineTo(vcx - vrx * 0.75, vcy - vry)
    ctx.closePath()
    ctx.fill()

    // the Nautilus, riding a gentle vertical bob
    const bob = Math.sin(t * 0.6) * 3
    ctx.fillStyle = VC_INK
    ctx.beginPath()
    ctx.ellipse(vcx - vrx * 0.08, vcy + bob * 0.4, vrx * 0.52, vry * 0.24, -0.03, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(vcx + vrx * 0.42, vcy - vry * 0.02 + bob * 0.4)
    ctx.lineTo(vcx + vrx * 0.68, vcy - vry * 0.16 + bob * 0.4)
    ctx.lineTo(vcx + vrx * 0.42, vcy + vry * 0.12 + bob * 0.4)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(vcx - vrx * 0.3, vcy - vry * 0.34 + bob * 0.4, vrx * 0.22, vry * 0.22)
    // brass portholes
    ctx.fillStyle = VC_BRASS
    for (const px of [-0.32, -0.16, 0.0, 0.16]) {
      ctx.beginPath()
      ctx.arc(vcx + vrx * px, vcy + bob * 0.4, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    // occasional bubbles rising from the prow
    ctx.fillStyle = 'rgba(242,236,221,0.7)'
    for (let b = 0; b < 5; b++) {
      const cycle = (t * 0.12 + b * 0.2) % 1
      const bx = vcx + vrx * (0.5 + b * 0.05) + Math.sin(t + b) * 3
      const by = vcy - vry * 0.1 - cycle * vry * 0.9
      ctx.beginPath()
      ctx.arc(bx, by, 1.6 + (b % 3) * 0.7, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // oval plate line
    ovalClip()
    ctx.strokeStyle = VC_INK
    ctx.lineWidth = 2.2
    ctx.stroke()
  },

  frame: (ctx, w, h) => {
    // stacked title-page rules + small brass corner squares
    const m = Math.min(w, h) * 0.04
    ctx.strokeStyle = VC_INK
    ctx.lineWidth = 3
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
    ctx.lineWidth = 1
    ctx.strokeRect(m * 1.8, m * 1.8, w - 3.6 * m, h - 3.6 * m)
    ctx.fillStyle = VC_BRASS
    const s = 7
    for (const [px, py] of [
      [m, m],
      [w - m, m],
      [w - m, h - m],
      [m, h - m],
    ] as const) {
      ctx.fillRect(px - s / 2, py - s / 2, s, s)
    }
  },
}

const paintVictorianCard = makePackPaint(VICTORIAN_PAINTER)

const VICTORIAN_TITLE_FONT = "'Bodoni MT', Didot, 'Playfair Display', Georgia, serif"

/** Clipped parallel-line hatching -- the engraver's shading, denser where the spacing is tighter. */
function hatchClipped(
  ctx: CanvasRenderingContext2D,
  clip: () => void,
  w: number,
  h: number,
  spacing: number,
  angle: number,
  alpha: number,
): void {
  ctx.save()
  clip()
  ctx.clip()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = VC_INK
  ctx.lineWidth = 0.8
  ctx.translate(w / 2, h / 2)
  ctx.rotate(angle)
  const span = Math.max(w, h) * 1.5
  for (let d = -span; d < span; d += spacing) {
    ctx.beginPath()
    ctx.moveTo(-span, d)
    ctx.lineTo(span, d)
    ctx.stroke()
  }
  ctx.restore()
}

function drawVictorianTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  entry: LibraryEntry,
  centerY: number,
  titlePx: number,
): void {
  ctx.textAlign = 'center'
  ctx.fillStyle = VC_INK
  ctx.font = `700 ${titlePx}px ${VICTORIAN_TITLE_FONT}`
  const words = entry.title.toUpperCase().split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (ctx.measureText(probe).width > w * 0.76 && line) {
      lines.push(line)
      line = word
    } else {
      line = probe
    }
  }
  if (line) lines.push(line)
  const lineH = titlePx * 1.3
  const startY = centerY - ((lines.length - 1) * lineH) / 2
  lines.forEach((text, i) => ctx.fillText(text, w / 2, startY + i * lineH))
  // the title-page rule between title and author
  const ruleY = startY + (lines.length - 1) * lineH + titlePx * 0.55
  ctx.strokeStyle = VC_INK
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(w * 0.3, ruleY)
  ctx.lineTo(w * 0.7, ruleY)
  ctx.stroke()
  ctx.font = `italic ${Math.round(titlePx * 0.6)}px Georgia, serif`
  ctx.fillStyle = VC_OXBLOOD
  ctx.fillText(entry.author, w / 2, ruleY + titlePx * 0.75)
}

export function paintVictorianCover(ctx: CanvasRenderingContext2D, w: number, h: number, entry: LibraryEntry): void {
  ctx.fillStyle = VC_IVORY
  ctx.fillRect(0, 0, w, h)
  const safe = safeRect(w, h)
  // stacked double rules
  ctx.strokeStyle = VC_INK
  ctx.lineWidth = Math.max(1.4, w * 0.012)
  ctx.strokeRect(safe.x, safe.y, safe.w, safe.h)
  ctx.lineWidth = Math.max(0.7, w * 0.005)
  ctx.strokeRect(safe.x + w * 0.028, safe.y + w * 0.028, safe.w - w * 0.056, safe.h - w * 0.056)

  ctx.save()
  ctx.beginPath()
  ctx.rect(safe.x, safe.y, safe.w, safe.h)
  ctx.clip()

  // oval engraved vignette: hatched sea, denser toward the bottom
  const vcx = w / 2
  const vcy = safe.y + safe.h * 0.3
  const vrx = safe.w * 0.36
  const vry = safe.h * 0.18
  const ovalClip = () => {
    ctx.beginPath()
    ctx.ellipse(vcx, vcy, vrx, vry, 0, 0, Math.PI * 2)
  }
  hatchClipped(ctx, ovalClip, w, h, 5.5, 0.06, 0.4)
  hatchClipped(
    ctx,
    () => {
      ctx.beginPath()
      ctx.ellipse(vcx, vcy + vry * 0.4, vrx, vry * 0.7, 0, 0, Math.PI * 2)
    },
    w,
    h,
    3.5,
    -0.16,
    0.35,
  )
  // oval outline
  ovalClip()
  ctx.strokeStyle = VC_INK
  ctx.lineWidth = Math.max(1, w * 0.008)
  ctx.stroke()

  // the Nautilus silhouette
  ctx.save()
  ovalClip()
  ctx.clip()
  ctx.fillStyle = VC_INK
  ctx.beginPath()
  ctx.ellipse(vcx - vrx * 0.06, vcy + vry * 0.08, vrx * 0.52, vry * 0.26, -0.02, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(vcx + vrx * 0.44, vcy + vry * 0.02)
  ctx.lineTo(vcx + vrx * 0.72, vcy - vry * 0.12)
  ctx.lineTo(vcx + vrx * 0.44, vcy + vry * 0.18)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(vcx - vrx * 0.28, vcy - vry * 0.32, vrx * 0.24, vry * 0.22)
  // brass portholes
  ctx.fillStyle = VC_BRASS
  for (const px of [-0.28, -0.1, 0.1]) {
    ctx.beginPath()
    ctx.arc(vcx + vrx * px, vcy + vry * 0.08, Math.max(1.2, w * 0.009), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  ctx.restore()

  drawVictorianTitle(ctx, w, entry, h * 0.68, Math.round(w * 0.088))
}

export const VICTORIAN_PACK: StylePack = {
  paint: paintVictorianCard,
  bg: VC_IVORY,
  titleFontFamily: "'Bodoni MT', Didot, 'Playfair Display', Georgia, serif",
  kicker: VC_BRASS,
  title: VC_INK,
  titleShadow: '2px 2px 0 rgba(154,123,60,0.3)',
  rule: VC_BRASS,
  author: '#6d6455',
  meta: '#6d6455',
  quote: '#4a4438',
  buttonBg: VC_OXBLOOD,
  buttonBorder: VC_OXBLOOD,
  buttonInk: VC_IVORY,
  buttonHoverInk: VC_OXBLOOD,
  buttonShadow: VC_BRASS,
}
