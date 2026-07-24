import { useCallback, useEffect, useState } from 'react'
import LandingPage from './components/LandingPage'
import LoadingScreen from './components/LoadingScreen'
import TextPane from './components/TextPane'
import WorldScene from './components/WorldScene'
import type { LibraryEntry } from './data/library'
import { destroy, loadPassage } from './lib/narrationController'

/**
 * Three stages (see CLAUDE.md "Reading compiler + landing page", Phase A):
 * landing (pick a compiled text from the library) -> loading (honest
 * prefetch of the pre-compiled narration assets) -> reading (the two-pane
 * experience). No router -- a single state machine is all this needs.
 */
type Stage =
  | { phase: 'landing' }
  | { phase: 'loading'; entry: LibraryEntry }
  | { phase: 'reading'; entry: LibraryEntry }

function App() {
  const [stage, setStage] = useState<Stage>({ phase: 'landing' })

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

  const handleSelect = useCallback((entry: LibraryEntry) => {
    setStage({ phase: 'loading', entry })
  }, [])

  const handleReady = useCallback(() => {
    setStage((current) => (current.phase === 'loading' ? { phase: 'reading', entry: current.entry } : current))
  }, [])

  if (stage.phase === 'landing') {
    return <LandingPage onSelect={handleSelect} />
  }
  if (stage.phase === 'loading') {
    return <LoadingScreen entry={stage.entry} onReady={handleReady} />
  }
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="h-full w-1/2 overflow-y-auto border-r border-neutral-800">
        <TextPane passage={stage.entry.passage} />
      </div>
      <div className="h-full w-1/2">
        <WorldScene />
      </div>
    </div>
  )
}

export default App
