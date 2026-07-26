import { useEffect, useMemo, useRef, useState } from 'react'
import type { LibraryEntry } from '../data/library'
import { USER_CATEGORY } from '../lib/userLibrary'
import { COVER_PAINTERS } from './packs'

interface BookcasePageProps {
  entries: readonly LibraryEntry[]
  onSelect: (entry: LibraryEntry) => void
  /** Opens the full carousel ("the full programme"). */
  onSeeAll: () => void
  /** Opens the add-a-book desk; its shelf shows an empty slot inviting it. */
  onAddBook: () => void
  /** Opens the desk in edit mode for a reader-added book (title/author/pack). */
  onEditBook: (entry: LibraryEntry) => void
  /** Removes a reader-added book from the shelf (two-step confirm lives on the cover). */
  onRemoveBook: (entry: LibraryEntry) => void
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
 * book's style-pack language (Deco, Gothic, or Storybook, per
 * `entry.stylePackId` -- reader-added books carry the pack chosen on the
 * add-a-book desk) -- the same closed-pack bet as the concept board: packs
 * are hand-built vocabulary, data picks which one a book wears. The cover
 * painters live in `./packs` (one module per pack, shared with
 * LandingPage's title cards).
 */
function BookCover({
  entry,
  onSelect,
  onEdit,
  onRemove,
}: {
  entry: LibraryEntry
  onSelect: (entry: LibraryEntry) => void
  /** Present only for reader-added books -- built-ins are part of the programme. */
  onEdit?: (entry: LibraryEntry) => void
  onRemove?: (entry: LibraryEntry) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Two-step remove: first click arms ("Sure?"), second within the window
  // removes -- an inline confirm in the shelf's own idiom, no blocking dialog.
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const disarmTimerRef = useRef<number | null>(null)

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
    const paint = COVER_PAINTERS[entry.stylePackId] ?? COVER_PAINTERS.deco
    paint(ctx, cssW, cssH, entry)
  }, [entry])

  useEffect(() => () => {
    if (disarmTimerRef.current !== null) window.clearTimeout(disarmTimerRef.current)
  }, [])

  const handleRemoveClick = () => {
    if (!onRemove) return
    if (confirmingRemove) {
      onRemove(entry)
      return
    }
    setConfirmingRemove(true)
    if (disarmTimerRef.current !== null) window.clearTimeout(disarmTimerRef.current)
    disarmTimerRef.current = window.setTimeout(() => setConfirmingRemove(false), 3500)
  }

  const control =
    'pointer-events-auto rounded-full border px-2 py-0.5 font-sans text-[0.55rem] uppercase tracking-[0.15em] backdrop-blur-[2px] transition-colors'

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={() => onSelect(entry)}
        className="block cursor-pointer transition-transform duration-200 hover:-translate-y-2 focus-visible:-translate-y-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a8802c]"
        aria-label={`${entry.title} by ${entry.author}`}
        title={`${entry.tagline} · ${sentenceLabel(entry)}`}
      >
        <canvas
          ref={canvasRef}
          className="block h-56 w-[9.5rem] rounded-[2px] shadow-[0_6px_14px_rgba(34,48,79,0.35)] transition-shadow duration-200 group-hover:shadow-[0_14px_26px_rgba(34,48,79,0.45)]"
        />
      </button>
      {onEdit || onRemove ? (
        // Curator controls, revealed on hover/focus so the shelf stays quiet.
        <div className="pointer-events-none absolute inset-x-0 -top-3 flex justify-center gap-1.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label={`Edit details of ${entry.title}`}
              className={`${control} border-[#a8802c]/60 bg-[#efe4c9]/90 text-[#22304f] hover:border-[#22304f] hover:bg-[#22304f] hover:text-[#efe4c9]`}
            >
              ✎ Edit
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={handleRemoveClick}
              aria-label={
                confirmingRemove ? `Confirm removing ${entry.title}` : `Remove ${entry.title} from the shelf`
              }
              className={`${control} ${
                confirmingRemove
                  ? 'border-[#8a1f1f] bg-[#8a1f1f] text-[#efe4c9]'
                  : 'border-[#8a1f1f]/50 bg-[#efe4c9]/90 text-[#8a1f1f] hover:border-[#8a1f1f] hover:bg-[#8a1f1f] hover:text-[#efe4c9]'
              }`}
            >
              {confirmingRemove ? 'Sure?' : '✕ Remove'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function sentenceLabel(entry: LibraryEntry): string {
  const count = entry.passage.paragraphs.reduce((sum, p) => sum + p.sentences.length, 0)
  return `${count} sentences · narrated & painted`
}

export default function BookcasePage({
  entries,
  onSelect,
  onSeeAll,
  onAddBook,
  onEditBook,
  onRemoveBook,
}: BookcasePageProps) {
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
                <BookCover
                  key={entry.id}
                  entry={entry}
                  onSelect={onSelect}
                  onEdit={category === USER_CATEGORY ? onEditBook : undefined}
                  onRemove={category === USER_CATEGORY ? onRemoveBook : undefined}
                />
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
