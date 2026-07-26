import type { LibraryEntry } from '../../data/library'
import { makePackPaint, safeRect, type CardPainter, type StylePack } from './types'

// ---------------------------------------------------------------------------
// Storybook & Whimsy pack (Alice and the fairy-tale shelf) -- per the
// style-packs concept board: wobbly hand-inked line, scalloped edges, a
// path that refuses to run straight; nothing is quite level, on purpose.
// ---------------------------------------------------------------------------

const SB_CREAM = '#fdf6e3'
const SB_CREAM_DEEP = '#f5ead0'
const SB_INK = '#3a3230'
const SB_ROSE = '#c56a7e'
const SB_LEAF = '#8aa86b'
const SB_BRASS = '#9a7b3c'
const SB_ROBIN = '#7ac0c9'

const STORYBOOK_PAINTER: CardPainter = {
  safeArea: (w, h) => {
    const m = Math.min(w, h) * 0.045 // scallop lane
    const inset = m * 2
    return { x: inset, y: inset, w: w - 2 * inset, h: h - 2 * inset }
  },

  ground: (ctx, w, h, t) => {
    ctx.fillStyle = SB_CREAM
    ctx.fillRect(0, 0, w, h)
    // ink-fleck grain, re-rolled per ~12fps tick -- lighter-handed than the
    // deco/gothic grain: storybook paper is clean nursery cream
    const tick = Math.floor(t * 12)
    ctx.fillStyle = 'rgba(58,50,48,0.05)'
    for (let i = 0; i < 70; i++) {
      const n1 = Math.sin((tick * 83 + i) * 12.9898) * 43758.5453
      const n2 = Math.sin((tick * 41 + i) * 78.233) * 24634.6345
      ctx.fillRect((n1 - Math.floor(n1)) * w, (n2 - Math.floor(n2)) * h, 1.5, 1.5)
    }
  },

  subjects: (ctx, safe, w, _h, t) => {
    // wobbly double vignette ring, low center -- the picture zone the type
    // column sits above
    const cx = w / 2
    const cy = safe.y + safe.h * 0.62
    const R1 = Math.min(safe.w * 0.24, safe.h * 0.5)
    ctx.strokeStyle = SB_INK
    ctx.lineWidth = 3
    for (const R of [R1, R1 * 1.05]) {
      ctx.beginPath()
      for (let i = 0; i <= 64; i++) {
        const an = (i / 64) * Math.PI * 2
        const rr = R + Math.sin(an * 7) * 5 + Math.cos(an * 3) * 4
        const px = cx + Math.cos(an) * rr * 1.6
        const py = cy + Math.sin(an) * rr * 0.74
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }

    // mushroom, left of ring center: rose cap, cream spots, wobbly stalk
    const mx = cx - R1 * 1.05
    const my = cy + R1 * 0.3
    const capW = R1 * 1.15
    ctx.fillStyle = SB_ROSE
    ctx.beginPath()
    ctx.moveTo(mx - capW / 2, my)
    ctx.quadraticCurveTo(mx - capW * 0.08, my - capW * 0.5, mx + capW / 2, my - capW * 0.03)
    ctx.quadraticCurveTo(mx, my + capW * 0.1, mx - capW / 2, my)
    ctx.fill()
    ctx.strokeStyle = SB_INK
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = SB_CREAM
    for (const [sx, sy, sr] of [
      [-0.3, -0.16, 0.05],
      [-0.06, -0.25, 0.042],
      [0.22, -0.12, 0.047],
    ] as const) {
      ctx.beginPath()
      ctx.ellipse(mx + capW * sx, my + capW * sy, capW * sr, capW * sr * 0.72, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = SB_CREAM_DEEP
    ctx.beginPath()
    ctx.moveTo(mx - capW * 0.1, my + capW * 0.02)
    ctx.quadraticCurveTo(mx - capW * 0.15, my + capW * 0.5, mx - capW * 0.04, my + capW * 0.52)
    ctx.quadraticCurveTo(mx + capW * 0.1, my + capW * 0.5, mx + capW * 0.07, my + capW * 0.03)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // the floating key, right of center, drifting on a slow bob
    ctx.save()
    ctx.translate(cx + R1 * 1.1, cy - R1 * 0.35 + Math.sin(t * 0.7) * 6)
    ctx.rotate(0.35 + Math.sin(t * 0.5) * 0.05)
    ctx.strokeStyle = SB_BRASS
    ctx.lineWidth = 6
    const kr = R1 * 0.18
    ctx.beginPath()
    ctx.arc(0, 0, kr, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(kr * 0.9, kr * 0.35)
    ctx.lineTo(kr * 4.1, kr * 1.5)
    ctx.moveTo(kr * 3.3, kr * 1.25)
    ctx.lineTo(kr * 3, kr * 2.1)
    ctx.moveTo(kr * 4, kr * 1.5)
    ctx.lineTo(kr * 3.7, kr * 2.3)
    ctx.stroke()
    ctx.restore()

    // card pips adrift, each bobbing out of phase
    ctx.textAlign = 'center'
    ctx.font = '700 40px Georgia, serif'
    ctx.fillStyle = SB_INK
    ctx.fillText('♠', cx + R1 * 1.75, cy + R1 * 0.75 + Math.sin(t * 0.6 + 1) * 5)
    ctx.fillStyle = SB_ROSE
    ctx.fillText('♥', cx + R1 * 0.5, cy + R1 * 1.02 + Math.sin(t * 0.55 + 2.4) * 5)
    ctx.fillStyle = SB_ROBIN
    ctx.fillText('♦', cx - R1 * 1.7, cy - R1 * 0.72 + Math.sin(t * 0.65 + 4) * 5)

    // dotted leaf path wandering up and out of the ring
    ctx.fillStyle = SB_LEAF
    for (let d = 0; d < 24; d++) {
      const tt = d / 23
      const px = cx - R1 * 0.3 + tt * R1 * 2.6
      const py = cy + R1 * 1.15 - Math.sin(tt * 5) * R1 * 0.22 - tt * R1 * 0.55
      ctx.beginPath()
      ctx.arc(px, py, 4.2, 0, Math.PI * 2)
      ctx.fill()
    }
  },

  frame: (ctx, w, h) => {
    // scalloped rose border on all four sides -- the storybook page edge
    const m = Math.min(w, h) * 0.045
    const r = m * 0.62
    ctx.strokeStyle = SB_ROSE
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let x = m + r; x < w - m; x += r * 2) ctx.arc(x, m, r, Math.PI, 0, false)
    ctx.stroke()
    ctx.beginPath()
    for (let x = m + r; x < w - m; x += r * 2) ctx.arc(x, h - m, r, 0, Math.PI, false)
    ctx.stroke()
    ctx.beginPath()
    for (let y = m + r; y < h - m; y += r * 2) ctx.arc(m, y, r, Math.PI / 2, -Math.PI / 2, false)
    ctx.stroke()
    ctx.beginPath()
    for (let y = m + r; y < h - m; y += r * 2) ctx.arc(w - m, y, r, -Math.PI / 2, Math.PI / 2, false)
    ctx.stroke()
  },
}

const paintStorybookCard = makePackPaint(STORYBOOK_PAINTER)

/** Title lines on a bouncing baseline -- the storybook lettering rule: nothing sits level. */
function drawBounceTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  entry: LibraryEntry,
  centerY: number,
  titlePx: number,
): void {
  ctx.textAlign = 'center'
  ctx.fillStyle = SB_INK
  ctx.font = `700 italic ${titlePx}px Georgia, serif`
  const words = entry.title.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (ctx.measureText(probe).width > w * 0.74 && line) {
      lines.push(line)
      line = word
    } else {
      line = probe
    }
  }
  if (line) lines.push(line)
  const lineH = titlePx * 1.3
  const startY = centerY - ((lines.length - 1) * lineH) / 2
  lines.forEach((text, lineIndex) => {
    const widths = [...text].map((ch) => ctx.measureText(ch).width)
    let x = w / 2 - widths.reduce((a, b) => a + b, 0) / 2
    ;[...text].forEach((ch, i) => {
      const dy = Math.sin((i + lineIndex * 3) * 1.05) * titlePx * 0.14
      ctx.fillText(ch, x + (widths[i] ?? 0) / 2, startY + lineIndex * lineH + dy)
      x += widths[i] ?? 0
    })
  })
  ctx.font = `italic ${Math.round(titlePx * 0.62)}px Georgia, serif`
  ctx.fillStyle = SB_ROSE
  ctx.fillText(entry.author, w / 2, startY + lines.length * lineH + titlePx * 0.3)
}

export function paintStorybookCover(ctx: CanvasRenderingContext2D, w: number, h: number, entry: LibraryEntry): void {
  ctx.fillStyle = SB_CREAM
  ctx.fillRect(0, 0, w, h)
  const safe = safeRect(w, h)

  // scalloped rose border, running along the safe rect on all four sides
  ctx.strokeStyle = SB_ROSE
  ctx.lineWidth = Math.max(1.2, w * 0.011)
  const r = Math.max(4.5, w * 0.042)
  ctx.beginPath()
  for (let x = safe.x + r; x < safe.x + safe.w - r / 2; x += 2 * r) ctx.arc(x, safe.y, r, Math.PI, 0)
  ctx.stroke()
  ctx.beginPath()
  for (let x = safe.x + r; x < safe.x + safe.w - r / 2; x += 2 * r) ctx.arc(x, safe.y + safe.h, r, 0, Math.PI)
  ctx.stroke()
  ctx.beginPath()
  for (let y = safe.y + r; y < safe.y + safe.h - r / 2; y += 2 * r) ctx.arc(safe.x, y, r, Math.PI / 2, -Math.PI / 2)
  ctx.stroke()
  ctx.beginPath()
  for (let y = safe.y + r; y < safe.y + safe.h - r / 2; y += 2 * r) ctx.arc(safe.x + safe.w, y, r, -Math.PI / 2, Math.PI / 2)
  ctx.stroke()

  ctx.save()
  ctx.beginPath()
  ctx.rect(safe.x + r, safe.y + r, safe.w - 2 * r, safe.h - 2 * r)
  ctx.clip()

  // wobbly hand-inked vignette ring around the picture zone
  const cx = w / 2
  const cy = safe.y + safe.h * 0.3
  const ringR = safe.w * 0.34
  ctx.strokeStyle = SB_INK
  ctx.lineWidth = Math.max(1.2, w * 0.011)
  ctx.beginPath()
  for (let i = 0; i <= 48; i++) {
    const an = (i / 48) * Math.PI * 2
    const rr = ringR + Math.sin(an * 7) * w * 0.013 + Math.cos(an * 3) * w * 0.01
    const px = cx + Math.cos(an) * rr
    const py = cy + Math.sin(an) * rr * 0.8
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.stroke()

  // the mushroom: rose cap with cream spots, wobbly cream stalk
  const mx = cx - safe.w * 0.13
  const my = cy + ringR * 0.32
  const capW = safe.w * 0.3
  ctx.fillStyle = SB_ROSE
  ctx.beginPath()
  ctx.moveTo(mx - capW / 2, my)
  ctx.quadraticCurveTo(mx - capW * 0.1, my - capW * 0.52, mx + capW / 2, my - capW * 0.04)
  ctx.quadraticCurveTo(mx, my + capW * 0.1, mx - capW / 2, my)
  ctx.fill()
  ctx.strokeStyle = SB_INK
  ctx.lineWidth = Math.max(1, w * 0.009)
  ctx.stroke()
  ctx.fillStyle = SB_CREAM
  for (const [sx, sy, sr] of [
    [-0.28, -0.16, 0.045],
    [-0.05, -0.26, 0.038],
    [0.22, -0.12, 0.042],
  ] as const) {
    ctx.beginPath()
    ctx.ellipse(mx + capW * sx, my + capW * sy, capW * sr, capW * sr * 0.75, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = SB_CREAM_DEEP
  ctx.beginPath()
  ctx.moveTo(mx - capW * 0.1, my + capW * 0.03)
  ctx.quadraticCurveTo(mx - capW * 0.16, my + capW * 0.42, mx - capW * 0.06, my + capW * 0.44)
  ctx.quadraticCurveTo(mx + capW * 0.08, my + capW * 0.42, mx + capW * 0.06, my + capW * 0.04)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // the floating key, tilted
  ctx.save()
  ctx.translate(cx + safe.w * 0.2, cy - ringR * 0.28)
  ctx.rotate(0.35)
  ctx.strokeStyle = SB_BRASS
  ctx.lineWidth = Math.max(1.6, w * 0.016)
  const kr = safe.w * 0.055
  ctx.beginPath()
  ctx.arc(0, 0, kr, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(kr * 0.9, kr * 0.35)
  ctx.lineTo(kr * 3.6, kr * 1.3)
  ctx.moveTo(kr * 2.9, kr * 1.1)
  ctx.lineTo(kr * 2.7, kr * 1.9)
  ctx.moveTo(kr * 3.5, kr * 1.3)
  ctx.lineTo(kr * 3.3, kr * 2.1)
  ctx.stroke()
  ctx.restore()

  // card pips adrift
  ctx.textAlign = 'center'
  ctx.font = `700 ${Math.round(w * 0.085)}px Georgia, serif`
  ctx.fillStyle = SB_ROSE
  ctx.fillText('♥', cx + safe.w * 0.26, cy + ringR * 0.62)
  ctx.fillStyle = SB_INK
  ctx.fillText('♠', cx - safe.w * 0.3, cy - ringR * 0.5)

  // dotted leaf-green path wandering out of the ring
  ctx.fillStyle = SB_LEAF
  for (let d = 0; d < 12; d++) {
    const tt = d / 11
    const px = cx - safe.w * 0.05 + tt * safe.w * 0.34
    const py = cy + ringR * 0.86 - Math.sin(tt * 5) * safe.h * 0.03 - tt * safe.h * 0.05
    ctx.beginPath()
    ctx.arc(px, py, Math.max(1.2, w * 0.011), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  drawBounceTitle(ctx, w, entry, h * 0.72, Math.round(w * 0.092))
}

export const STORYBOOK_PACK: StylePack = {
  paint: paintStorybookCard,
  bg: SB_CREAM,
  titleFontFamily: 'Georgia, serif',
  titleItalic: true,
  kicker: SB_ROSE,
  title: SB_INK,
  titleShadow: '3px 3px 0 rgba(197,106,126,0.28)',
  rule: SB_ROSE,
  author: '#847668',
  meta: '#847668',
  quote: '#5f554e',
  buttonBg: SB_ROSE,
  buttonBorder: SB_ROSE,
  buttonInk: SB_CREAM,
  buttonHoverInk: SB_ROSE,
  buttonShadow: SB_LEAF,
}
