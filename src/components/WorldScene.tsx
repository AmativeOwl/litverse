import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { useReadingStore } from '../store/readingStore'
import { Atmosphere } from './world/Atmosphere'
import { CameraRig } from './world/CameraRig'
import { Floor } from './world/Floor'
import { Lighting } from './world/Lighting'
import { Particles } from './world/Particles'
import { PostProcessing } from './world/PostProcessing'
import { Silhouettes } from './world/Silhouettes'
import { resolveFixtureBeat } from './world/fixtureBeats'
import { useLerpedSceneBeat } from './world/useLerpedSceneBeat'

/**
 * Lives inside <Canvas>, so it's free to call R3F hooks (useFrame/useThree).
 * Reads only `activeSceneBeatId` from the store -- a beat-level field, which
 * is exactly what's allowed to trigger a re-render of this subtree per the
 * design constraints. It never reads word-level state, and it only ever
 * consumes `SceneBeat` objects -- never sentence text -- which is what keeps
 * this engine mood-agnostic and reusable across scenes via data alone.
 */
function WorldSceneContents() {
  const activeSceneBeatId = useReadingStore((state) => state.activeSceneBeatId)

  // Phase 1: this track owns no data files, so it resolves against its own
  // local fixtures (see fixtureBeats.ts) rather than importing
  // `src/data/scene-beats.json`, which belongs to the content track. Phase 2
  // integration swaps this resolution for the real beat set, still read via
  // `activeSceneBeatId` -- this component's shape doesn't change.
  const targetBeat = resolveFixtureBeat(activeSceneBeatId)

  // Every numeric/color field of the active beat is interpolated here, once,
  // into a ref that per-frame consumers below read inside their own
  // useFrame callbacks -- never as React state, so beat transitions never
  // fight the render loop.
  const lerpedRef = useLerpedSceneBeat(targetBeat)

  return (
    <>
      <Atmosphere lerpedRef={lerpedRef} />
      <Lighting lerpedRef={lerpedRef} />
      <Floor lerpedRef={lerpedRef} />
      <Silhouettes lerpedRef={lerpedRef} animation={targetBeat.silhouettes?.animation ?? 'still'} />
      <Particles lerpedRef={lerpedRef} />
      <CameraRig lerpedRef={lerpedRef} />
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
export default function WorldScene() {
  return (
    <div className="h-full w-full bg-neutral-950">
      <Canvas
        camera={{ position: [0, 2.6, 9], fov: 50, near: 0.1, far: 100 }}
        dpr={[1, 2]}
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
          <WorldSceneContents />
        </Suspense>
      </Canvas>
    </div>
  )
}
