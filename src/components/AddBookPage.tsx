import { useState } from 'react'
import type { StylePackId } from '../data/library'
import { addUserBook, type UserBookRecord } from '../lib/userLibrary'

interface AddBookPageProps {
  onAdded: (record: UserBookRecord) => void
  onCancel: () => void
}

/**
 * The closed pack set, presented as swatched choices. Picking the style
 * yourself is what keeps this zero-AI: judging "this prose reads storybook"
 * from arbitrary text is the offline compiler's LLM job, not the client's.
 */
const STYLE_CHOICES: { id: StylePackId; name: string; blurb: string; swatches: [string, string, string] }[] = [
  { id: 'deco', name: 'Deco · Jazz Age', blurb: 'Gold rules, sunbursts, poster caps', swatches: ['#efe4c9', '#22304f', '#a8802c'] },
  { id: 'gothic', name: 'Gothic · Memento Mori', blurb: 'Scarlet on ebony, candlelight', swatches: ['#0b0609', '#c1121f', '#b08d57'] },
  { id: 'storybook', name: 'Storybook & Whimsy', blurb: 'Wobbly ink, scallops, rose & leaf', swatches: ['#fdf6e3', '#c56a7e', '#8aa86b'] },
]

/**
 * The "add a book" desk: paste a public-domain text, it compiles in the
 * browser (mechanical segmentation + the generic painted mood arc -- see
 * userLibrary.ts) and lands on the bookcase's "Your additions" shelf.
 * Honest about the trade: narration requires the offline compiler, so
 * these books open as silent painted readers.
 */
export default function AddBookPage({ onAdded, onCancel }: AddBookPageProps) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [text, setText] = useState('')
  const [stylePackId, setStylePackId] = useState<StylePackId>('deco')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    try {
      setError(null)
      onAdded(addUserBook({ title, author, text, stylePackId }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compile that text.')
    }
  }

  const field =
    'w-full border border-[#a8802c]/40 bg-[#f7efdd] px-3 py-2 font-serif text-[#22304f] placeholder:text-[#22304f]/35 focus:border-[#a8802c] focus:outline-none'

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-[#efe4c9] text-[#22304f]">
      <div className="mx-auto max-w-2xl px-8 py-12">
        <header className="mb-8 border-b border-[#a8802c]/40 pb-6">
          <p className="mb-2 text-[0.65rem] uppercase tracking-[0.3em] text-[#a8802c]">The library · new acquisition</p>
          <h1 className="text-3xl" style={{ fontFamily: 'var(--font-display)' }}>
            ADD A BOOK
          </h1>
        </header>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[#a8802c]">Title</span>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Yellow Wallpaper" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[#a8802c]">Author</span>
            <input className={field} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Charlotte Perkins Gilman" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[#a8802c]">Text (public domain)</span>
            <textarea
              className={`${field} min-h-64 leading-relaxed`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the passage or chapter here. Blank lines separate paragraphs."
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[0.65rem] uppercase tracking-[0.25em] text-[#a8802c]">
              Cover &amp; title-card style
            </legend>
            <div className="flex flex-wrap gap-3">
              {STYLE_CHOICES.map((choice) => {
                const selected = choice.id === stylePackId
                return (
                  <button
                    key={choice.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStylePackId(choice.id)}
                    className={`flex min-w-[11rem] flex-1 flex-col gap-2 border px-4 py-3 text-left transition-colors ${
                      selected
                        ? 'border-[#22304f] bg-[#f7efdd]'
                        : 'border-[#a8802c]/40 hover:border-[#a8802c]'
                    }`}
                  >
                    <span className="flex gap-1.5">
                      {choice.swatches.map((color) => (
                        <span
                          key={color}
                          className="h-4 w-4 rounded-full border border-black/10"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                    <span className="text-sm font-semibold text-[#22304f]">{choice.name}</span>
                    <span className="text-xs text-[#22304f]/60">{choice.blurb}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {error ? <p className="text-sm text-[#8a1f1f]">{error}</p> : null}

          <p className="text-xs leading-relaxed text-[#22304f]/60">
            Compiling happens entirely in your browser — the text is segmented for reading and given a painted
            mood arc, then kept on this device. Narrated voice requires the offline compiler, so added books open
            as silent painted readers: click any sentence to move through the world.
          </p>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={submit}
              className="border border-[#22304f] bg-[#22304f] px-5 py-2 text-[0.7rem] uppercase tracking-[0.25em] text-[#efe4c9] transition-colors hover:bg-[#efe4c9] hover:text-[#22304f]"
            >
              Compile &amp; shelve
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="border border-[#a8802c]/60 px-5 py-2 text-[0.7rem] uppercase tracking-[0.25em] text-[#22304f] transition-colors hover:bg-[#22304f] hover:text-[#efe4c9]"
            >
              Back to the shelves
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
