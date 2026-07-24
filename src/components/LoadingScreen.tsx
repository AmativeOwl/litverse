import { useEffect, useRef, useState } from 'react'
import type { LibraryEntry } from '../data/library'

interface LoadingScreenProps {
  entry: LibraryEntry
  onReady: () => void
}

/** Loading feels wrong if it flashes -- hold the page at least this long. */
const MINIMUM_DISPLAY_MS = 1100

/**
 * The honest loading screen (compiler Phase A): nothing is being generated
 * here -- it prefetches the already-compiled narration (manifest + one WAV
 * per sentence) so playback and seeking are instant once the reader opens.
 * Failures are non-fatal: the reader already skips any sentence whose audio
 * is missing, so on error we proceed rather than strand the user.
 */
export default function LoadingScreen({ entry, onReady }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState('Opening the book…')
  const startedAtRef = useRef(performance.now())

  useEffect(() => {
    let cancelled = false

    const finish = () => {
      const elapsed = performance.now() - startedAtRef.current
      const wait = Math.max(0, MINIMUM_DISPLAY_MS - elapsed)
      window.setTimeout(() => {
        if (!cancelled) onReady()
      }, wait)
    }

    const load = async () => {
      try {
        const response = await fetch(`/narration/${entry.id}/manifest.json`)
        const manifest = (await response.json()) as Record<string, { audioUrl: string }>
        const urls = Object.values(manifest).map((sentence) => sentence.audioUrl)
        if (!cancelled) setLabel('Preparing the narration…')
        let done = 0
        await Promise.all(
          urls.map(async (url) => {
            try {
              // warms the HTTP cache; the reader's own <audio> loads hit it
              await fetch(url, { cache: 'force-cache' }).then((r) => r.arrayBuffer())
            } catch {
              // per-sentence degradation is the reader's job; keep going
            }
            done++
            if (!cancelled) setProgress(done / urls.length)
          }),
        )
      } catch {
        // manifest unreachable: the reader degrades gracefully, proceed
      }
      if (!cancelled) finish()
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [entry, onReady])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md px-8 text-center">
        <h1 className="font-serif text-3xl italic text-neutral-100">{entry.title}</h1>
        <p className="mt-2 font-sans text-xs uppercase tracking-[0.25em] text-neutral-500">
          {entry.author} · {entry.chapter}
        </p>
        {/* a single hairline that fills -- the whole progress UI */}
        <div className="mx-auto mt-10 h-px w-64 overflow-hidden bg-neutral-800">
          <div
            className="h-full bg-amber-300/80 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="mt-4 font-sans text-[11px] uppercase tracking-[0.3em] text-neutral-600">
          {label}
        </p>
      </div>
    </div>
  )
}
