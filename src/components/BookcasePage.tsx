import { useEffect, useMemo, useRef } from 'react'
import type { LibraryEntry } from '../data/library'
import { USER_CATEGORY } from '../lib/userLibrary'

interface BookcasePageProps {
  entries: readonly LibraryEntry[]
  onSelect: (entry: LibraryEntry) => void
  /** Opens the full carousel ("the full programme"). */
  onSeeAll: () => void
  /** Opens the add-a-book desk; its shelf shows an empty slot inviting it. */
  onAddBook: () => void
}

/**
 * The home page: a bookcase. Shelves group the library by category, each
 * book standing cover-out like a bookseller's display; clicking a cover
 * opens that text, "Full programme" opens the title-card carousel. Stays in
 * the shipped 1930s title-card idiom (aged paper, navy/gold, Limelight
 * display face) so bookcase -> carousel -> loading -> reader reads as one
 * continuous sequence.
 *
 * Covers are small procedural canvases painted once per book in that
 * book's style-pack language (Deco for the Jazz Age shelf, Gothic for the
 * Macabre shelf) -- the same closed-pack bet as the concept board: packs
 * are hand-built vocabulary, data picks which one a book wears.
 */

const PAPER = '#efe4c9'
const NAVY = '#22304f'
const GOLD = '#a8802c'
const GOLD_BRIGHT = '#c99b3f'

type CoverPack = 'deco' | 'gothic'

/** Style pack per entry id; unknown ids wear the house deco binding. */
const COVER_PACK_BY_ID: Record<string, CoverPack> = {
  'gatsby-ch3': 'deco',
  masque: 'gothic',
}

/** Frame-rule helper: every pictorial element stays inside this inset rect; only ground texture may bleed. */
function safeRect(w: number, h: number) {
  const m = Math.round(w * 0.09)
  return { x: m, y: m, w: w - 2 * m, h: h - 2 * m }
}

function drawTitleBlock(
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

function paintDecoCover(ctx: CanvasRenderingContext2D, w: number, h: number, entry: LibraryEntry): void {
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

const GOTHIC_INK = '#120a10'
const GOTHIC_BONE = '#e8dfd2'
const GOTHIC_SCARLET = '#c1121f'
const ROOM_HUES = ['#2a4a8a', '#6a3a8a', '#2a7a4a', '#c96a1e', '#e8e2d2', '#7a5a9a', '#c1121f']

function paintGothicCover(ctx: CanvasRenderingContext2D, w: number, h: number, entry: LibraryEntry): void {
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

const COVER_PAINTERS: Record<CoverPack, typeof paintDecoCover> = {
  deco: paintDecoCover,
  gothic: paintGothicCover,
}

function BookCover({ entry, onSelect }: { entry: LibraryEntry; onSelect: (entry: LibraryEntry) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const paint = COVER_PAINTERS[COVER_PACK_BY_ID[entry.id] ?? 'deco']
    paint(ctx, cssW, cssH, entry)
  }, [entry])

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="group relative block shrink-0 transition-transform duration-200 hover:-translate-y-2 focus-visible:-translate-y-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a8802c]"
      aria-label={`${entry.title} by ${entry.author}`}
      title={`${entry.tagline} · ${sentenceLabel(entry)}`}
    >
      <canvas
        ref={canvasRef}
        className="block h-56 w-[9.5rem] rounded-[2px] shadow-[0_6px_14px_rgba(34,48,79,0.35)] transition-shadow duration-200 group-hover:shadow-[0_14px_26px_rgba(34,48,79,0.45)]"
      />
    </button>
  )
}

function sentenceLabel(entry: LibraryEntry): string {
  const count = entry.passage.paragraphs.reduce((sum, p) => sum + p.sentences.length, 0)
  return `${count} sentences · narrated & painted`
}

export default function BookcasePage({ entries, onSelect, onSeeAll, onAddBook }: BookcasePageProps) {
  const shelves = useMemo(() => {
    const byCategory = new Map<string, LibraryEntry[]>()
    for (const entry of entries) {
      const shelf = byCategory.get(entry.category) ?? []
      shelf.push(entry)
      byCategory.set(entry.category, shelf)
    }
    // the additions shelf always exists -- empty, it holds the invitation
    if (!byCategory.has(USER_CATEGORY)) byCategory.set(USER_CATEGORY, [])
    return [...byCategory.entries()]
  }, [entries])

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-[#efe4c9] text-[#22304f]">
      <div className="mx-auto max-w-4xl px-8 py-12">
        <header className="mb-10 flex items-end justify-between border-b border-[#a8802c]/40 pb-6">
          <div>
            <p className="mb-2 text-[0.65rem] uppercase tracking-[0.3em] text-[#a8802c]">The library</p>
            <h1 className="text-4xl text-[#22304f]" style={{ fontFamily: 'var(--font-display)' }}>
              LITVERSE
            </h1>
          </div>
          <button
            type="button"
            onClick={onSeeAll}
            className="border border-[#a8802c]/60 px-4 py-2 text-[0.65rem] uppercase tracking-[0.25em] text-[#22304f] transition-colors hover:bg-[#22304f] hover:text-[#efe4c9]"
          >
            Full programme →
          </button>
        </header>

        {shelves.map(([category, books]) => (
          <section key={category} className="mb-4">
            <div className="mb-4 flex items-baseline gap-4">
              <h2 className="whitespace-nowrap text-[0.7rem] uppercase tracking-[0.3em] text-[#a8802c]">
                {category}
              </h2>
              <div className="h-px flex-1 bg-[#a8802c]/30" />
            </div>
            <div className="flex items-end gap-6 px-4">
              {books.map((entry) => (
                <BookCover key={entry.id} entry={entry} onSelect={onSelect} />
              ))}
              {category === USER_CATEGORY ? (
                <button
                  type="button"
                  onClick={onAddBook}
                  className="flex h-56 w-[9.5rem] shrink-0 flex-col items-center justify-center gap-2 rounded-[2px] border-2 border-dashed border-[#a8802c]/50 text-[#a8802c] transition-colors hover:border-[#a8802c] hover:bg-[#a8802c]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a8802c]"
                  aria-label="Add a book"
                >
                  <span className="text-3xl leading-none">+</span>
                  <span className="text-[0.6rem] uppercase tracking-[0.25em]">Add a book</span>
                </button>
              ) : null}
            </div>
            {/* the shelf ledge */}
            <div className="mt-0 h-3 rounded-[1px] bg-gradient-to-b from-[#6b4a2f] to-[#4a3018] shadow-[0_5px_8px_rgba(74,48,24,0.35)]" />
            <div className="mb-8 h-1 w-[97%] bg-[#3a2512]/60" />
          </section>
        ))}

        <footer className="mt-10 text-center text-[0.6rem] uppercase tracking-[0.2em] text-[#22304f]/50">
          Narration and scenery are compiled ahead of time — nothing is generated while you read.
        </footer>
      </div>
    </div>
  )
}
