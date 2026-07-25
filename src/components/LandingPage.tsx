import { useCallback, useEffect, useRef, useState } from 'react'
import { LIBRARY, sentenceCountOf, type LibraryEntry, type StylePackId } from '../data/library'
import { USER_CATEGORY } from '../lib/userLibrary'

interface LandingPageProps {
  /**
   * The bills on the programme. Defaults to the precompiled LIBRARY;
   * App passes the full list (built-ins + reader-added books) so a book
   * added on the desk gets a real title card in its own pack's language.
   */
  entries?: readonly LibraryEntry[]
  onSelect: (entry: LibraryEntry) => void
  /**
   * Returns to the bookcase home. Rendered as a spectral, floating link
   * hovering top-center above the "Litverse presents" masthead -- barely
   * there until hovered (per user direction; it replaced a bottom-left
   * footer placement, itself a replacement for the original fixed top-left
   * overlay that sat awkwardly on the card's corner ornament).
   */
  onExit?: () => void
}

/**
 * The landing page as a CAROUSEL of 1930s picture-house title cards -- one
 * book per bill, each rendered in its own STYLE PACK (the style-packs
 * concept board: the compiler picks a rendering vocabulary per text; here
 * the landing card is that vocabulary's front door). Gatsby keeps the
 * shipped Deco card exactly (aged paper, rotating sunburst, deco border);
 * the Masque of the Red Death gets the Gothic/Memento Mori card -- seven
 * pointed-arch windows in Poe's own room-color order ending in the black
 * room's scarlet, candlelight golds on near-black. (An ebony clock
 * medallion originally hung top-center; it was cut -- it competed with the
 * "Litverse presents" kicker for the card's scarcest space, per user
 * direction that nothing should sit above the masthead.)
 *
 * Program changes between bills fade through the house lights going down
 * (a short content fade while the ground color crossfades underneath) --
 * the way a real picture house swapped title cards. Painted on one canvas
 * at ~12fps ("on twos") with per-tick grain; reduced-motion gets a static
 * painting and instant card swaps.
 *
 * Style packs live INSIDE this module keyed by entry id for now -- a
 * proper `stylePackId` on LibraryEntry is the future refactor (see the
 * style-packs concept in CLAUDE.md's orbit); the landing page should not
 * front-run the data contract.
 */

// ---------------------------------------------------------------------------
// The cover-frame rule (applies to EVERY style pack):
//
//   every discrete PICTORIAL element -- arches, clocks, figures, marquee
//   ornaments -- must sit fully INSIDE the card's border frame. Only GROUND
//   may bleed full-canvas: texture and atmosphere that read as the card's
//   material rather than as things (paper, stone, sunburst rays, film
//   grain, vignettes).
//
// A pack painter is therefore three phases, orchestrated by paintCard():
//   ground   -- full-bleed, painted first, runs under the frame
//   subjects -- composed against the frame's inner SAFE RECT and hard-
//               clipped to it besides (the clip is the enforcement; the
//               safe-rect-relative composition is what keeps shapes whole
//               instead of amputated at the rule)
//   frame    -- the border itself, painted last, over the ground
// ---------------------------------------------------------------------------

interface CardRect {
  x: number
  y: number
  w: number
  h: number
}

interface CardPainter {
  /** Inner rect of the frame -- the subjects' safe area (derive from the same margins `frame` strokes). */
  safeArea: (w: number, h: number) => CardRect
  ground: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
  subjects: (ctx: CanvasRenderingContext2D, safe: CardRect, w: number, h: number, t: number) => void
  frame: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
}

function makePackPaint(painter: CardPainter) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void => {
    painter.ground(ctx, w, h, t)
    const safe = painter.safeArea(w, h)
    ctx.save()
    ctx.beginPath()
    ctx.rect(safe.x, safe.y, safe.w, safe.h)
    ctx.clip()
    painter.subjects(ctx, safe, w, h, t)
    ctx.restore()
    painter.frame(ctx, w, h, t)
  }
}

// ---------------------------------------------------------------------------
// Deco pack (Gatsby) -- the shipped title card, restructured onto the
// ground/subjects/frame contract (visually unchanged: its sunburst and
// grain are ground by design, and it has no discrete pictorial subjects)
// ---------------------------------------------------------------------------

const PAPER = '#efe4c9'
const PAPER_DEEP = '#e4d5b0'
const NAVY = '#22304f'
const GOLD = '#a8802c'
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

  subjects: (ctx, safe, w, h, t) => {
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

// ---------------------------------------------------------------------------
// The style-pack registry, keyed by LibraryEntry.stylePackId
// ---------------------------------------------------------------------------

interface StylePack {
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
  /** Page ground behind/around the canvas (also the fade-through color between bills). */
  bg: string
  /** CSS font shorthand pieces for the bill's display face (the packs differ: deco poster caps vs storybook italic serif). */
  titleFontFamily: string
  titleItalic?: boolean
  kicker: string
  title: string
  titleShadow: string
  rule: string
  author: string
  meta: string
  quote: string
  buttonBg: string
  buttonBorder: string
  buttonInk: string
  buttonHoverInk: string
  buttonShadow: string
}

const DECO_PACK: StylePack = {
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

const GOTHIC_PACK: StylePack = {
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

const STORYBOOK_PACK: StylePack = {
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

const PACKS: Record<StylePackId, StylePack> = {
  deco: DECO_PACK,
  gothic: GOTHIC_PACK,
  storybook: STORYBOOK_PACK,
}

function packFor(entry: LibraryEntry): StylePack {
  return PACKS[entry.stylePackId] ?? DECO_PACK
}

// ---------------------------------------------------------------------------
// Canvas + carousel
// ---------------------------------------------------------------------------

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function TitleCardCanvas({ pack, reduced }: { pack: StylePack; reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const packRef = useRef(pack)
  packRef.current = pack

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const paintOnce = (t: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth, clientHeight } = canvas
      if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
        canvas.width = clientWidth * dpr
        canvas.height = clientHeight * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      packRef.current.paint(ctx, clientWidth, clientHeight, t)
    }

    if (reduced) {
      // one static painting per pack; repaint on resize only
      paintOnce(0)
      const onResize = () => paintOnce(0)
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    let raf = 0
    let last = 0
    const start = performance.now()
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 1000 / 12) return // on twos
      last = now
      paintOnce((now - start) / 1000)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [reduced, pack])

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
}

/** Content-fade duration for the program change between bills (ms). */
const FADE_MS = 280

export default function LandingPage({ entries = LIBRARY, onSelect, onExit }: LandingPageProps) {
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const fadeTimerRef = useRef<number | null>(null)
  const reduced = usePrefersReducedMotion()

  const entry = entries[index] ?? entries[0]
  const goTo = useCallback(
    (nextIndex: number) => {
      const total = entries.length
      if (total < 2) return
      const wrapped = ((nextIndex % total) + total) % total
      if (reduced) {
        setIndex(wrapped)
        return
      }
      setFading(true)
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = window.setTimeout(() => {
        setIndex(wrapped)
        setFading(false)
      }, FADE_MS)
    },
    [reduced, entries.length],
  )

  useEffect(() => () => {
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current)
  }, [])

  // the setIndex-in-timeout pattern means `index` inside goTo callers is
  // always the committed card; arrow keys navigate relative to it
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goTo(index - 1)
      else if (event.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goTo, index])

  if (!entry) return null
  const pack = packFor(entry)
  const many = entries.length > 1
  const silent = entry.category === USER_CATEGORY

  return (
    <div
      className="relative h-screen w-screen overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: pack.bg }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Litverse library"
    >
      <div
        className="absolute inset-0 transition-opacity"
        style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      >
        <TitleCardCanvas pack={pack} reduced={reduced} />
        {/* pt outweighs pb so the centered column sits lower, ceding the
            top of the card to the floating library cloud */}
        <main className="relative flex h-full flex-col items-center justify-center px-8 pb-14 pt-32 text-center">
          <p
            className="font-sans text-[11px] font-semibold uppercase tracking-[0.45em]"
            style={{ color: pack.kicker }}
          >
            Litverse presents
          </p>

          <section className="mt-6 flex flex-col items-center">
            <h1
              className={`max-w-3xl text-5xl leading-tight sm:text-6xl ${pack.titleItalic ? 'italic' : 'uppercase'}`}
              style={{ fontFamily: pack.titleFontFamily, color: pack.title, textShadow: pack.titleShadow }}
            >
              {entry.title}
            </h1>

            {/* ribbon rule */}
            <div className="mt-6 flex items-center gap-3" style={{ color: pack.rule }}>
              <span className="block h-px w-16" style={{ backgroundColor: pack.rule }} />
              <span aria-hidden className="text-xs">
                ◆
              </span>
              <span className="block h-px w-16" style={{ backgroundColor: pack.rule }} />
            </div>

            <p className="mt-5 font-serif text-lg italic" style={{ color: pack.author }}>
              by {entry.author}
            </p>
            <p
              className="mt-1 font-sans text-[11px] uppercase tracking-[0.3em]"
              style={{ color: pack.meta }}
            >
              {entry.chapter} · {entry.tagline}
            </p>

            <p
              className="mt-8 max-w-xl font-serif text-base italic leading-relaxed"
              style={{ color: pack.quote }}
            >
              “{entry.openingLine}”
            </p>

            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="group mt-10 cursor-pointer border-2 px-10 py-3 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{
                backgroundColor: pack.buttonBg,
                borderColor: pack.buttonBorder,
                boxShadow: `4px 4px 0 ${pack.buttonShadow}`,
                outlineColor: pack.rule,
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = 'transparent'
                const label = event.currentTarget.firstElementChild as HTMLElement | null
                if (label) label.style.color = pack.buttonHoverInk
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = pack.buttonBg
                const label = event.currentTarget.firstElementChild as HTMLElement | null
                if (label) label.style.color = pack.buttonInk
              }}
            >
              <span
                className="text-xl uppercase tracking-[0.2em] transition-colors duration-200"
                style={{ fontFamily: 'var(--font-display)', color: pack.buttonInk }}
              >
                Begin
              </span>
            </button>

            <p
              className="mt-4 font-sans text-[10px] uppercase tracking-[0.25em]"
              style={{ color: pack.meta }}
            >
              {sentenceCountOf(entry)} sentences · {silent ? 'painted · silent reading' : 'narrated & painted'}
            </p>
          </section>
        </main>
      </div>

      {onExit && (
        // Spectral cloud: a softly-bordered pill drifting above the
        // masthead -- faint pack-colored ring and halo, barely-there until
        // hover/focus draws it into this world. top-14 keeps it clear of
        // both packs' inner frame rules at any viewport height.
        <button
          type="button"
          onClick={onExit}
          className="absolute left-1/2 top-14 z-10 -translate-x-1/2 cursor-pointer rounded-full border px-5 py-2 font-sans text-[10px] uppercase tracking-[0.35em] opacity-50 backdrop-blur-[2px] transition-all duration-300 hover:-translate-y-0.5 hover:opacity-95 focus-visible:opacity-95 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4"
          style={{
            color: pack.kicker,
            borderColor: `${pack.rule}59`,
            boxShadow: `0 0 20px ${pack.rule}40, inset 0 0 12px ${pack.rule}1a`,
            textShadow: `0 0 12px ${pack.rule}`,
            outlineColor: pack.rule,
          }}
        >
          ← The library
        </button>
      )}

      {many && (
        <>
          {/* Bare pack-colored chevrons (no box/border, per user direction):
              the arrow itself is the whole control, nudging outward on hover. */}
          <button
            type="button"
            aria-label="Previous book"
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full px-3 py-2 text-6xl leading-none opacity-60 transition-all duration-200 hover:-translate-x-1 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:left-7"
            style={{ color: pack.rule, outlineColor: pack.rule }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next book"
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full px-3 py-2 text-6xl leading-none opacity-60 transition-all duration-200 hover:translate-x-1 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-7"
            style={{ color: pack.rule, outlineColor: pack.rule }}
          >
            ›
          </button>
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3">
            {entries.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.title}
                aria-current={itemIndex === index}
                onClick={() => goTo(itemIndex)}
                className="h-2.5 w-2.5 cursor-pointer rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  borderColor: pack.rule,
                  backgroundColor: itemIndex === index ? pack.rule : 'transparent',
                  outlineColor: pack.rule,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
