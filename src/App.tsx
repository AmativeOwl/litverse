import { useEffect } from 'react'
import TextPane from './components/TextPane'
import WorldScene from './components/WorldScene'
import { gatsbyCh3 } from './data/gatsby-ch3'
import { destroy, loadPassage } from './lib/narrationController'

function App() {
  // Phase 2 integration: register the real passage with the narration
  // controller once, on mount. loadPassage resets store position state to
  // the passage's first sentence but does not start speaking -- playback is
  // user-initiated via TextPane's Play control. destroy() on unmount cancels
  // any in-flight speech and detaches the visibilitychange listener, per the
  // narration spec's "always cancel defensively" rule.
  useEffect(() => {
    loadPassage(gatsbyCh3)
    return () => destroy()
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="h-full w-1/2 overflow-y-auto border-r border-neutral-800">
        <TextPane passage={gatsbyCh3} />
      </div>
      <div className="h-full w-1/2">
        <WorldScene />
      </div>
    </div>
  )
}

export default App
