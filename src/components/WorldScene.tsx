import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { useReadingStore } from '../store/readingStore'
import type { SceneBeat } from '../types'
import type { LibraryEntry } from '../data/library'
import { computeAdaptiveDpr } from './world/adaptiveDpr'
import { Atmosphere } from './world/Atmosphere'
import { CameraRig } from './world/CameraRig'
import { MotifEffects } from './world/MotifEffects'
import { PaintedPlates } from './world/PaintedPlates'
import { Particles } from './world/Particles'
import { PostProcessing } from './world/PostProcessing'
import { WorldTurntable } from './world/WorldTurntable'
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
 * Applies the pixel-budget dpr (see adaptiveDpr.ts) whenever the canvas
 * size changes -- which includes the half-pane <-> fullscreen cinema
 * toggle, the case that motivated it: a fixed dpr made cinema mode ~4x
 * heavier per frame than the reader pane.
 */
function AdaptiveResolution() {
  const size = useThree((state) => state.size)
  const setDpr = useThree((state) => state.setDpr)
  useEffect(() => {
    setDpr(computeAdaptiveDpr(size.width, size.height, window.devicePixelRatio))
  }, [size.width, size.height, setDpr])
  return null
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
          as of the painted-world pivot, and Silhouettes + StringLights
          followed in the cyclorama pivot (all files kept -- see CLAUDE.md):
          the shells' painted in-card inhabitants do the crowd's job now
          under the figures-are-never-statues rule, and a 3D crowd standing
          BETWEEN the viewer and a shell they live inside would break the
          illusion. Particles stay as in-world dust. */}
      <Atmosphere lerpedRef={lerpedRef} />
      {/* The zoetrope stage: the ring of shell paintings rotates to face the
          fixed viewer -- the images move, the camera never travels. */}
      <WorldTurntable lerpedRef={lerpedRef} plateSet={entry.plateSet}>
        <PaintedPlates
          lerpedRef={lerpedRef}
          plateSet={entry.plateSet}
          beatsById={scene.beatsById}
          sentenceIds={scene.sentenceIds}
        />
      </WorldTurntable>
      {/* Floor and Lighting unmounted (files kept): the 3D-lit era ended
          with the painted pivot -- every remaining material is unlit
          MeshBasicMaterial, so lights illuminated nothing and the floor was
          the last source of the bright "white space" band under the haze
          drum. */}
      <Particles lerpedRef={lerpedRef} />
      <CameraRig lerpedRef={lerpedRef} />
      {/* Motif one-shots were authored around the scene origin for the old
          across-the-origin camera; with the viewer now fixed inside the
          shell, they become a viewer-anchored layer, translated into the
          gap between the viewer (r13) and the mid shell (r20). */}
      <group position={[0, 0.5, -14]}>
        <MotifEffects />
      </group>
      <PostProcessing lerpedRef={lerpedRef} />
    </>
  )
}

/**
 * Right-pane 3D world: a scripted, mood-reactive painted cyclorama driven
 * entirely by `SceneBeat` data. Per the design constraints this is NOT a
 * free-roam scene -- there is no `OrbitControls` here, only the scripted
 * `CameraRig` (cinema mode included) -- and there are no rigged/animated
 * character models; all figures are painted inhabitants of the shells.
 */
export default function WorldScene({ entry }: WorldSceneProps) {
  const scene = useMemo(() => buildSceneData(entry), [entry])
  return (
    <div className="h-full w-full bg-neutral-950">
      <Canvas
        camera={{ position: [0, 2.6, 9], fov: 50, near: 0.1, far: 100 }}
        // Initial dpr only -- AdaptiveResolution (inside) re-derives it
        // from a fixed pixel budget whenever the canvas size changes, so
        // cinema mode's fullscreen canvas costs roughly the same per frame
        // as the half-pane reader. Default-framebuffer MSAA stays off: the
        // EffectComposer renders the scene into its own buffers and owns
        // anti-aliasing (multisampling there), so canvas-level MSAA was
        // pure waste; `shadows` is likewise gone -- nothing casts or
        // receives since the painted pivot (all materials are unlit
        // MeshBasicMaterial).
        dpr={[1, 1.5]}
        // ACES filmic tone mapping (rolls off highlights instead of
        // clipping) and explicit high-precision sRGB output, configured
        // explicitly so renderer defaults changing can't shift the look.
        gl={{ antialias: false, powerPreference: 'high-performance', precision: 'highp' }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1
          gl.outputColorSpace = SRGBColorSpace
        }}
      >
        <Suspense fallback={null}>
          <AdaptiveResolution />
          <WorldSceneContents entry={entry} scene={scene} />
        </Suspense>
      </Canvas>
    </div>
  )
}
