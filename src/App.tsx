import { useCallback, useEffect, useState } from 'react'
import BookcasePage from './components/BookcasePage'
import CaptionBar from './components/CaptionBar'
import LandingPage from './components/LandingPage'
import LoadingScreen from './components/LoadingScreen'
import TextPane from './components/TextPane'
import WorldScene from './components/WorldScene'
import { LIBRARY, type LibraryEntry } from './data/library'
import { destroy, loadPassage } from './lib/narrationController'

/**
 * Stages (see CLAUDE.md "Reading compiler + landing page", Phase A):
 * bookcase (the home -- shelves by category) -> either straight into a
 * book, or "full programme" -> the title-card carousel -> loading (honest
 * prefetch of the pre-compiled narration assets) -> reading (the two-pane
 * experience). No router -- a single state machine is all this needs.
 *
 * Within the reading stage, CINEMA MODE (the cyclorama feature) expands the
 * world pane over the full viewport with a word-synced caption bar at the
 * bottom; Esc (or the exit control) returns to the two-pane reader. The
 * world pane's element stays mounted in the same tree position either way
 * -- only its classes change -- so the WebGL canvas, camera choreography,
 * and narration all carry across the toggle untouched.
 */
type Stage =
  | { phase: 'bookcase' }
  | { phase: 'carousel' }
  | { phase: 'loading'; entry: LibraryEntry }
  | { phase: 'reading'; entry: LibraryEntry }

function App() {
  const [stage, setStage] = useState<Stage>({ phase: 'bookcase' })
  const [cinema, setCinema] = useState(false)

  // Register the passage with the narration controller only once the reader
  // opens. loadPassage resets store position to the first sentence but does
  // not start speaking -- playback is user-initiated via TextPane's Play
  // control. destroy() on leave cancels any in-flight speech and detaches
  // the visibilitychange listener, per the narration spec's "always cancel
  // defensively" rule.
  const readingEntry = stage.phase === 'reading' ? stage.entry : null
  useEffect(() => {
    if (!readingEntry) return
    loadPassage(readingEntry.passage)
    return () => destroy()
  }, [readingEntry])

  // Esc leaves cinema mode (listener only lives while cinema is up).
  useEffect(() => {
    if (!cinema) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCinema(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cinema])

  const handleSelect = useCallback((entry: LibraryEntry) => {
    setStage({ phase: 'loading', entry })
  }, [])

  const handleReady = useCallback(() => {
    setStage((current) => (current.phase === 'loading' ? { phase: 'reading', entry: current.entry } : current))
  }, [])

  const backToBookcase = useCallback(() => setStage({ phase: 'bookcase' }), [])

  // Esc returns from the carousel to the bookcase.
  const inCarousel = stage.phase === 'carousel'
  useEffect(() => {
    if (!inCarousel) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') backToBookcase()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inCarousel, backToBookcase])

  if (stage.phase === 'bookcase') {
    return (
      <BookcasePage
        entries={LIBRARY}
        onSelect={handleSelect}
        onSeeAll={() => setStage({ phase: 'carousel' })}
      />
    )
  }
  if (stage.phase === 'carousel') {
    return (
      // LandingPage untouched: the return-to-bookcase control overlays it.
      <div className="relative">
        <LandingPage onSelect={handleSelect} />
        <button
          type="button"
          onClick={backToBookcase}
          className="fixed left-4 top-4 z-50 border border-[#a8802c]/60 bg-[#efe4c9]/85 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.25em] text-[#22304f] backdrop-blur-sm transition-colors hover:bg-[#22304f] hover:text-[#efe4c9]"
        >
          ← The library
        </button>
      </div>
    )
  }
  if (stage.phase === 'loading') {
    return <LoadingScreen entry={stage.entry} onReady={handleReady} />
  }
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className={cinema ? 'hidden' : 'h-full w-1/2 overflow-y-auto border-r border-neutral-800'}>
        <TextPane passage={stage.entry.passage} beats={stage.entry.beats} />
      </div>
      <div className={cinema ? 'fixed inset-0 z-40' : 'relative h-full w-1/2'}>
        <WorldScene entry={stage.entry} />
        {cinema ? (
          <>
            <CaptionBar passage={stage.entry.passage} />
            <button
              type="button"
              className="absolute right-4 top-4 z-10 rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 text-xs text-neutral-300 backdrop-blur-sm hover:border-amber-400/60 hover:text-neutral-100"
              onClick={() => setCinema(false)}
            >
              ✕ Exit cinema
            </button>
          </>
        ) : (
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 text-xs text-neutral-300 backdrop-blur-sm hover:border-amber-400/60 hover:text-neutral-100"
            onClick={() => setCinema(true)}
            title="Fullscreen world with narrated captions"
          >
            ⛶ Cinema
          </button>
        )}
      </div>
    </div>
  )
}

export default App
