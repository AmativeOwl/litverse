import { useState } from 'react'
import { addUserBook, type UserBookRecord } from '../lib/userLibrary'

interface AddBookPageProps {
  onAdded: (record: UserBookRecord) => void
  onCancel: () => void
}

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
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    try {
      setError(null)
      onAdded(addUserBook({ title, author, text }))
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
