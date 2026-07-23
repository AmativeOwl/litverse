import TextPane from './components/TextPane'
import WorldScene from './components/WorldScene'

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="h-full w-1/2 overflow-y-auto border-r border-neutral-800">
        <TextPane />
      </div>
      <div className="h-full w-1/2">
        <WorldScene />
      </div>
    </div>
  )
}

export default App
