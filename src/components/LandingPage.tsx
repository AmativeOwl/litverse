import { LIBRARY, sentenceCountOf, type LibraryEntry } from '../data/library'

interface LandingPageProps {
  onSelect: (entry: LibraryEntry) => void
}

/**
 * The front door: a quiet, type-first page in the reader's own register --
 * Lora serif, near-black ground, one amber accent, hairline rules. The
 * library list is data-driven from src/data/library.ts, so future compiled
 * texts appear here with no UI changes.
 */
export default function LandingPage({ onSelect }: LandingPageProps) {
  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-y-auto bg-neutral-950 text-neutral-100">
      <main className="w-full max-w-2xl px-8 py-16">
        {/* masthead */}
        <header className="mb-16 text-center">
          <h1 className="font-serif text-5xl tracking-tight text-neutral-50">Litverse</h1>
          <div className="mx-auto mt-6 w-24 border-t border-neutral-700" />
          <div className="mx-auto mt-1 w-16 border-t border-neutral-800" />
          <p className="mt-6 font-sans text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            prose, painted as you read
          </p>
        </header>

        {/* the library */}
        <p className="mb-2 font-sans text-[11px] uppercase tracking-[0.3em] text-neutral-600">
          The library
        </p>
        <ul>
          {LIBRARY.map((entry) => (
            <li key={entry.id} className="border-t border-neutral-800/80 last:border-b">
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className="group block w-full cursor-pointer px-1 py-9 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-serif text-3xl italic text-neutral-100 transition-colors duration-300 group-hover:text-amber-200">
                    {entry.title}
                  </h2>
                  <span
                    aria-hidden
                    className="font-sans text-xs uppercase tracking-[0.2em] text-amber-300/0 transition-all duration-300 group-hover:text-amber-300/90"
                  >
                    begin&nbsp;→
                  </span>
                </div>
                <p className="mt-1 font-sans text-xs uppercase tracking-[0.25em] text-neutral-500">
                  {entry.author}
                </p>
                <p className="mt-5 font-serif text-base italic leading-relaxed text-neutral-400">
                  “{entry.openingLine}”
                </p>
                <p className="mt-5 font-sans text-xs text-neutral-600">
                  {entry.chapter} · {entry.tagline} · {sentenceCountOf(entry)} sentences
                </p>
              </button>
            </li>
          ))}
        </ul>

        {/* the honest footnote */}
        <p className="mt-16 text-center font-sans text-[11px] leading-relaxed text-neutral-700">
          Narration and scenery are compiled ahead of time.
          <br />
          Nothing is generated while you read.
        </p>
      </main>
    </div>
  )
}
