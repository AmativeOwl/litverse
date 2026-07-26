import { useCallback, useEffect, useRef, useState } from 'react'
import { LIBRARY, sentenceCountOf, type LibraryEntry } from '../data/library'
import { USER_CATEGORY } from '../lib/userLibrary'
import { packFor, type StylePack } from './packs'

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
 * The pack painters themselves live in `./packs` (one module per pack,
 * shared with BookcasePage's covers), keyed by `LibraryEntry.stylePackId`;
 * this module owns only the canvas plumbing and the carousel chrome.
 */

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
              className={`max-w-3xl text-5xl leading-tight sm:text-6xl ${pack.titleItalic ? 'italic' : ''} ${
                (pack.titleUppercase ?? !pack.titleItalic) ? 'uppercase' : ''
              }`}
              style={{
                fontFamily: pack.titleFontFamily,
                color: pack.title,
                textShadow: pack.titleShadow,
                letterSpacing: pack.titleTracking,
              }}
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
