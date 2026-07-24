import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { useReadingStore } from '../store/readingStore'
import sceneBeatsData from '../data/scene-beats.json'
import type { SceneBeat } from '../types'
import { Atmosphere } from './world/Atmosphere'
import { CameraRig } from './world/CameraRig'
import { Floor } from './world/Floor'
import { Lighting } from './world/Lighting'
import { MotifEffects } from './world/MotifEffects'
import { PaintedPlates } from './world/PaintedPlates'
import { Particles } from './world/Particles'
import { GATSBY_PLATES } from '../data/plates/gatsby-ch3'
import { gatsbyCh3 } from '../data/gatsby-ch3'

// Ordered sentence ids, flattened once at module scope -- resolves the
// store's sentence index into ids for PaintedPlates' 3-4-sentence window
// track (sentence-level state, permitted by the design constraints).
const SENTENCE_IDS: readonly string[] = gatsbyCh3.paragraphs.flatMap((paragraph) =>
  paragraph.sentences.map((sentence) => sentence.id),
)

// sentenceId -> windowId, for the camera's active-card key (the shot
// choreography pulses on card changes; windows and beats are both cards).
const WINDOW_ID_BY_SENTENCE_ID: Record<string, string> = Object.fromEntries(
  (GATSBY_PLATES.windows ?? []).flatMap((window) =>
    window.sentenceIds.map((sentenceId) => [sentenceId, window.id]),
  ),
)
import { PostProcessing } from './world/PostProcessing'
import { Silhouettes } from './world/Silhouettes'
import { StringLights } from './world/StringLights'
import { useLerpedSceneBeat } from './world/useLerpedSceneBeat'

// Phase 2 integration: resolves against the real, content-track-owned beat
// data instead of the local Phase-1 fixtures (fixtureBeats.ts, still kept
// around for this track's own isolated tests). Built once at module scope
// since the JSON is static.
const SCENE_BEATS = sceneBeatsData as SceneBeat[]
const SCENE_BEATS_BY_ID: Record<string, SceneBeat> = Object.fromEntries(SCENE_BEATS.map((beat) => [beat.id, beat]))
const DEFAULT_SCENE_BEAT = SCENE_BEATS[0]

function resolveSceneBeat(activeSceneBeatId: string | null): SceneBeat {
  const beat = activeSceneBeatId ? SCENE_BEATS_BY_ID[activeSceneBeatId] : undefined
  if (beat) return beat
  if (!DEFAULT_SCENE_BEAT) {
    throw new Error('src/data/scene-beats.json must contain at least one SceneBeat')
  }
  return DEFAULT_SCENE_BEAT
}

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
  // Sentence-level store field (permitted by the design constraints; only
  // word-level is barred) -- resolves which "card" is on stage so the camera
  // choreography can pulse between same-sector cards.
  const currentSentenceIndex = useReadingStore((state) => state.currentSentenceIndex)
  const targetBeat = resolveSceneBeat(activeSceneBeatId)
  const activeSentenceId = SENTENCE_IDS[currentSentenceIndex]
  const activeCardKey =
    (activeSentenceId ? WINDOW_ID_BY_SENTENCE_ID[activeSentenceId] : undefined) ?? targetBeat.id

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
        plateSet={GATSBY_PLATES}
        beatsById={SCENE_BEATS_BY_ID}
        sentenceIds={SENTENCE_IDS}
      />
      <Lighting lerpedRef={lerpedRef} />
      <Floor lerpedRef={lerpedRef} />
      <Silhouettes lerpedRef={lerpedRef} animation={targetBeat.silhouettes?.animation ?? 'still'} />
      <Particles lerpedRef={lerpedRef} />
      <CameraRig
        lerpedRef={lerpedRef}
        azimuthByBeatDeg={GATSBY_PLATES.cameraAzimuthDeg}
        activeCardKey={activeCardKey}
      />
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
export default function WorldScene() {
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
          <WorldSceneContents />
        </Suspense>
      </Canvas>
    </div>
  )
}
