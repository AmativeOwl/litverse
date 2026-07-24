import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { useReadingStore } from '../store/readingStore'
import type { SceneBeat } from '../types'
import type { LibraryEntry } from '../data/library'
import { Atmosphere } from './world/Atmosphere'
import { CameraRig } from './world/CameraRig'
import { Floor } from './world/Floor'
import { Lighting } from './world/Lighting'
import { MotifEffects } from './world/MotifEffects'
import { PaintedPlates } from './world/PaintedPlates'
import { Particles } from './world/Particles'
import { PostProcessing } from './world/PostProcessing'
import { Silhouettes } from './world/Silhouettes'
import { StringLights } from './world/StringLights'
import { useLerpedSceneBeat } from './world/useLerpedSceneBeat'

/**
 * Everything scene-specific arrives through the LIBRARY ENTRY (the
 * reusability seam of the reading compiler): beats, the painted-plate
 * registry, and the passage's sentence-id order. The engine below never
 * imports a particular book's data -- a second compiled text is a second
 * `LibraryEntry`, zero changes here.
 */
interface WorldSceneProps {
  entry: LibraryEntry
}

interface SceneData {
  beatsById: Record<string, SceneBeat>
  defaultBeat: SceneBeat
  sentenceIds: readonly string[]
}

function buildSceneData(entry: LibraryEntry): SceneData {
  const defaultBeat = entry.beats[0]
  if (!defaultBeat) {
    throw new Error(`Library entry "${entry.id}" must define at least one SceneBeat`)
  }
  return {
    beatsById: Object.fromEntries(entry.beats.map((beat) => [beat.id, beat])),
    defaultBeat,
    sentenceIds: entry.passage.paragraphs.flatMap((paragraph) =>
      paragraph.sentences.map((sentence) => sentence.id),
    ),
  }
}

/**
 * Lives inside <Canvas>, so it's free to call R3F hooks (useFrame/useThree).
 * Reads only `activeSceneBeatId` from the store -- a beat-level field, which
 * is exactly what's allowed to trigger a re-render of this subtree per the
 * design constraints. It never reads word-level state, and it only ever
 * consumes `SceneBeat` objects -- never sentence text -- which is what keeps
 * this engine mood-agnostic and reusable across scenes via data alone.
 */
function WorldSceneContents({ entry, scene }: { entry: LibraryEntry; scene: SceneData }) {
  const activeSceneBeatId = useReadingStore((state) => state.activeSceneBeatId)
  const targetBeat =
    (activeSceneBeatId ? scene.beatsById[activeSceneBeatId] : undefined) ?? scene.defaultBeat

  // Every numeric/color field of the active beat is interpolated here, once,
  // into a ref that per-frame consumers below read inside their own
  // useFrame callbacks -- never as React state, so beat transitions never
  // fight the render loop.
  const lerpedRef = useLerpedSceneBeat(targetBeat)

  return (
    <>
      {/* The eight 3D Deco set-pieces that used to render here are unmounted
          as of the painted-world pivot (their files are kept -- see CLAUDE.md
          "Painted-world pivot"); PaintedPlates below is the scenery now. */}
      <Atmosphere lerpedRef={lerpedRef} />
      <StringLights lerpedRef={lerpedRef} />
      <PaintedPlates
        lerpedRef={lerpedRef}
        plateSet={entry.plateSet}
        beatsById={scene.beatsById}
        sentenceIds={scene.sentenceIds}
      />
      <Lighting lerpedRef={lerpedRef} />
      <Floor lerpedRef={lerpedRef} />
      <Silhouettes lerpedRef={lerpedRef} animation={targetBeat.silhouettes?.animation ?? 'still'} />
      <Particles lerpedRef={lerpedRef} />
      <CameraRig lerpedRef={lerpedRef} azimuthByBeatDeg={entry.plateSet.cameraAzimuthDeg} />
      <MotifEffects />
      <PostProcessing lerpedRef={lerpedRef} />
    </>
  )
}

/**
 * Right-pane 3D world: a scripted, mood-reactive backdrop driven entirely by
 * `SceneBeat` data. Per the design constraints this is NOT a free-roam
 * scene -- there is no `OrbitControls` here, only the scripted `CameraRig`
 * -- and there are no rigged/animated character models, only the abstract
 * instanced-silhouette crowd built in `Silhouettes.tsx`.
 */
export default function WorldScene({ entry }: WorldSceneProps) {
  const scene = useMemo(() => buildSceneData(entry), [entry])
  return (
    <div className="h-full w-full bg-neutral-950">
      <Canvas
        camera={{ position: [0, 2.6, 9], fov: 50, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        shadows
        // Explicit renderer configuration rather than relying on R3F's
        // (currently matching) implicit defaults, so this stays correct even
        // if those defaults ever change: MSAA on, ACES filmic tone mapping
        // (a physically-based operator that rolls off highlights instead of
        // clipping them, unlike the default linear/no-tonemap response) for
        // an accurate HDR-to-display mapping, and explicit high-precision
        // sRGB color output for correct color reproduction on screen.
        gl={{ antialias: true, powerPreference: 'high-performance', precision: 'highp' }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1
          gl.outputColorSpace = SRGBColorSpace
        }}
      >
        <Suspense fallback={null}>
          <WorldSceneContents entry={entry} scene={scene} />
        </Suspense>
      </Canvas>
    </div>
  )
}
