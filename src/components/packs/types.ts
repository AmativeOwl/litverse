import type { LibraryEntry } from '../../data/library'

/**
 * Shared machinery for the style packs (deco / gothic / storybook /
 * victorian / water). Each pack paints two surfaces in its own vocabulary:
 * the carousel TITLE CARD (LandingPage) and the bookcase COVER
 * (BookcasePage). One file per pack sits beside this one; `index.ts`
 * assembles the registries both pages consume.
 *
 * The cover-frame rule (applies to EVERY style pack):
 *
 *   every discrete PICTORIAL element -- arches, clocks, figures, marquee
 *   ornaments -- must sit fully INSIDE the card's border frame. Only GROUND
 *   may bleed full-canvas: texture and atmosphere that read as the card's
 *   material rather than as things (paper, stone, sunburst rays, film
 *   grain, vignettes).
 *
 * A pack painter is therefore three phases, orchestrated by makePackPaint():
 *   ground   -- full-bleed, painted first, runs under the frame
 *   subjects -- composed against the frame's inner SAFE RECT and hard-
 *               clipped to it besides (the clip is the enforcement; the
 *               safe-rect-relative composition is what keeps shapes whole
 *               instead of amputated at the rule)
 *   frame    -- the border itself, painted last, over the ground
 */

export interface CardRect {
  x: number
  y: number
  w: number
  h: number
}

export interface CardPainter {
  /** Inner rect of the frame -- the subjects' safe area (derive from the same margins `frame` strokes). */
  safeArea: (w: number, h: number) => CardRect
  ground: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
  subjects: (ctx: CanvasRenderingContext2D, safe: CardRect, w: number, h: number, t: number) => void
  frame: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
}

export function makePackPaint(painter: CardPainter) {
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

/** The full pack contract: the title-card painting plus the bill's type/color tokens. */
export interface StylePack {
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void
  /** Page ground behind/around the canvas (also the fade-through color between bills). */
  bg: string
  /** CSS font shorthand pieces for the bill's display face (the packs differ: deco poster caps vs storybook italic serif). */
  titleFontFamily: string
  titleItalic?: boolean
  /** Whether the title sets in caps. Defaults to the pre-existing rule (uppercase unless italic) so older packs are untouched. */
  titleUppercase?: boolean
  /** Optional letterspacing for the title (e.g. the water pack's quiet wide tracking). */
  titleTracking?: string
  /** Lift the bill's column high on the card (frontispiece layout: type above, the pack's painted vignette below). */
  columnRaised?: boolean
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

/** A bookcase-cover painter: one static painting per book, in the pack's language. */
export type CoverPaint = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: LibraryEntry,
) => void

/** Frame-rule helper for covers: every pictorial element stays inside this inset rect; only ground texture may bleed. */
export function safeRect(w: number, h: number) {
  const m = Math.round(w * 0.09)
  return { x: m, y: m, w: w - 2 * m, h: h - 2 * m }
}

/** Wrapped, centered title + italic author line -- the deco/gothic cover lettering. */
export function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  w: number,
  entry: LibraryEntry,
  color: string,
  authorColor: string,
  centerY: number,
  titlePx: number,
): void {
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.font = `${titlePx}px Limelight, Georgia, serif`
  const words = entry.title.toUpperCase().split(' ')
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
  const lineH = titlePx * 1.25
  const startY = centerY - ((lines.length - 1) * lineH) / 2
  lines.forEach((text, i) => ctx.fillText(text, w / 2, startY + i * lineH))
  ctx.font = `italic ${Math.round(titlePx * 0.62)}px Georgia, serif`
  ctx.fillStyle = authorColor
  ctx.fillText(entry.author, w / 2, startY + lines.length * lineH + titlePx * 0.35)
}
