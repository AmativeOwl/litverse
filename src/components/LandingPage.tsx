import { useEffect, useRef } from 'react'
import { LIBRARY, sentenceCountOf, type LibraryEntry } from '../data/library'

interface LandingPageProps {
  onSelect: (entry: LibraryEntry) => void
}

/**
 * The landing page as a 1930s animated-short TITLE CARD (user direction:
 * Art Deco + Tom & Jerry / Cuphead title-screen style) -- aged-cream paper,
 * a giant sunburst turning almost imperceptibly behind marquee lettering
 * (Limelight), a double-ruled deco border with corner fans, gold-on-ink
 * type, and the book itself as the star of the bill. Painted on a canvas at
 * ~12fps ("on twos", like everything else in this project) with per-tick
 * grain flicker -- the projected-film idiom the era's cards actually had.
 *
 * Deliberately distinct from the reader's dark painted world: the title
 * card is the poster outside the theater; the world is the film.
 */

// -- the title-card palette (aged paper, ink, deco navy, two golds) --------
const PAPER = '#efe4c9'
const PAPER_DEEP = '#e4d5b0'
const NAVY = '#22304f'
const GOLD = '#a8802c'
const GOLD_BRIGHT = '#c99b3f'

function paintTitleCard(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  // paper ground with a soft radial deepening toward the edges
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.95)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(90,66,30,0.18)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)

  // the giant sunburst, turning almost imperceptibly
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
}

function TitleCardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = 0
    const start = performance.now()
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 1000 / 12) return // on twos
      last = now
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth, clientHeight } = canvas
      if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
        canvas.width = clientWidth * dpr
        canvas.height = clientHeight * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintTitleCard(ctx, clientWidth, clientHeight, (now - start) / 1000)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
}

export default function LandingPage({ onSelect }: LandingPageProps) {
  return (
    <div className="relative h-screen w-screen overflow-y-auto bg-[#efe4c9]">
      <TitleCardCanvas />
      <main className="relative flex min-h-full flex-col items-center justify-center px-8 py-16 text-center">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.45em] text-[#22304f]">
          Litverse presents
        </p>

        {LIBRARY.map((entry) => (
          <section key={entry.id} className="mt-6 flex flex-col items-center">
            <h1
              className="max-w-3xl text-5xl uppercase leading-tight text-[#221a12] sm:text-6xl"
              style={{ fontFamily: 'var(--font-display)', textShadow: '3px 3px 0 rgba(168,128,44,0.35)' }}
            >
              {entry.title}
            </h1>

            {/* ribbon rule */}
            <div className="mt-6 flex items-center gap-3 text-[#a8802c]">
              <span className="block h-px w-16 bg-[#a8802c]" />
              <span aria-hidden className="text-xs">◆</span>
              <span className="block h-px w-16 bg-[#a8802c]" />
            </div>

            <p className="mt-5 font-serif text-lg italic text-[#3d3020]">by {entry.author}</p>
            <p className="mt-1 font-sans text-[11px] uppercase tracking-[0.3em] text-[#6b5836]">
              {entry.chapter} · {entry.tagline}
            </p>

            <p className="mt-8 max-w-xl font-serif text-base italic leading-relaxed text-[#4a3b26]">
              “{entry.openingLine}”
            </p>

            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="group mt-10 cursor-pointer border-2 border-[#22304f] bg-[#22304f] px-10 py-3 transition-colors duration-200 hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a8802c]"
              style={{ boxShadow: `4px 4px 0 ${GOLD_BRIGHT}` }}
            >
              <span
                className="text-xl uppercase tracking-[0.2em] text-[#efe4c9] transition-colors duration-200 group-hover:text-[#22304f]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Begin
              </span>
            </button>

            <p className="mt-4 font-sans text-[10px] uppercase tracking-[0.25em] text-[#8a7450]">
              {sentenceCountOf(entry)} sentences · narrated &amp; painted
            </p>
          </section>
        ))}

        <p className="mt-14 max-w-md font-sans text-[10px] leading-relaxed tracking-wide text-[#8a7450]">
          Narration and scenery are compiled ahead of time — nothing is generated while you read.
        </p>
      </main>
    </div>
  )
}
