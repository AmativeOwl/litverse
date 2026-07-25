import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneBeat } from '../../types'
import type { PlateDef, PlateLayer, ScenePlateSet } from '../../types-plates'
import { useReadingStore } from '../../store/readingStore'
import type { LerpedSceneBeat } from './beatMath'
import { shellArcFromTheta, tileSlotAzimuths, vignetteVisibility } from './decoPlateKit'
import { turntableMotion } from './WorldTurntable'

interface PaintedPlatesProps {
  lerpedRef: RefObject<LerpedSceneBeat>
  plateSet: ScenePlateSet
  /** Palette lookup for building each plate's texture -- keyed by beat id (WorldScene already owns this map). */
  beatsById: Record<string, SceneBeat>
  /**
   * Ordered sentence ids of the passage (flattened), used to resolve the
   * store's `currentSentenceIndex` into a sentence id for the window track.
   * Optional: without it, window plates simply never activate.
   */
  sentenceIds?: readonly string[]
}

/**
 * Generic renderer of the painted world (see CLAUDE.md): since the
 * cyclorama pivot, each 2D Art-Deco painting hangs as a CURVED CYLINDRICAL
 * SHELL segment around the scene origin (inside face painted), in the
 * beats' angular sectors, which the azimuth-anchored CameraRig turns to
 * face and then crosses into -- the multiplane camera evolved into a
 * cyclorama the viewer stands inside. Scene-agnostic: everything
 * book-specific arrives via `plateSet` (src/data/plates/<sceneId>.ts);
 * pointing this at another text's registry requires zero changes here.
 *
 * Two visibility tracks:
 * - BEAT plates crossfade with the shared vignetteVisibility over the beat
 *   lerp, exactly like the set-piece era's DecoWaterfront gating.
 * - WINDOW plates (the 3-4-sentence track) key off the store's
 *   `currentSentenceIndex` -- sentence-level state, which the design
 *   constraints explicitly permit to reach this subtree (only word-level is
 *   barred). Their opacity is time-damped in useFrame (~quarter-second
 *   fades) since sentence changes have no lerp progress of their own, and
 *   while a window is up it suppresses the beat MID plate in its sector so
 *   the window painting reads as *replacing* the beat painting, not
 *   stacking on it.
 *
 * Textures are built exactly once (useMemo): procedural plates paint into a
 * canvas with their FIRST member beat's palette from scene-beats.json; PNG
 * plates load from public/ (the offline image-gen fallback path). Per-frame
 * material work stays imperative, per the established pattern.
 */

const LAYER_RADIUS: Record<PlateLayer, number> = { far: 26, mid: 20, near: 13.5 }
const LAYER_SIZE: Record<PlateLayer, readonly [number, number]> = {
  far: [42, 13],
  mid: [18, 10],
  near: [10, 5.5],
}
/** How strongly each layer's material color leans toward the live fog color. */
const LAYER_FOG_TINT: Record<PlateLayer, number> = { far: 0.35, mid: 0.18, near: 0.08 }
/** Texture width in px; height follows the plate's aspect ratio. */
const TEXTURE_WIDTH = 1152
/** Fraction of the plane's height that sits above y=0 (matches the PaintedVignette precedent). */
const CENTER_Y_FACTOR = 0.42
/** Damping rate for window fades -- reaches ~95% of target in roughly 0.75s. */
const WINDOW_FADE_RATE = 4
/** Living-painting repaint cadence: ~12fps, "on twos" -- the cel rate of the animated shorts this look quotes. */
const REPAINT_INTERVAL_SECONDS = 1 / 12
/** Plates dimmer than this skip their repaint (invisible work). */
const REPAINT_MIN_OPACITY = 0.04
/**
 * Drum speed (rad/s) above which the living paintings hold their last
 * frame: every repaint is a GPU texture upload, and mid-rotation those
 * uploads read as visible ticks against the smooth turn. ~0.05 rad/s means
 * repaints resume in the turn's final settling moments and run freely at
 * dwell -- where the card animation actually registers.
 */
const REPAINT_PAUSE_TURN_SPEED = 0.05

interface BuiltPlate {
  def: PlateDef
  memberSet: ReadonlySet<string>
  texture: THREE.Texture
  material: THREE.MeshBasicMaterial
  /** Shell geometry: cylinder arc segment around the scene origin, painted on its inside face. */
  radius: number
  height: number
  centerY: number
  thetaStart: number
  thetaLength: number
  fogTint: number
  /**
   * Explicit transparent-pass ordering. Distance sorting CANNOT be trusted
   * here: a full-circle far ring's bounding-sphere center is the scene
   * origin, which sits closer to the interior camera than a mid arc's
   * centroid -- so by distance the backdrop ring drew ON TOP of the mid
   * cards (and, at renderOrder 0, over the motif layer), hiding every
   * painted detail behind sky. Negative orders keep all shells beneath the
   * default-0 effects (motifs, particles): far -30, mid -20, window -10,
   * near -5.
   */
  renderOrder: number
  /** Present on animated paint-source plates: everything needed to repaint per tick. */
  repaint?: {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    palette: SceneBeat['palette']
    paint: NonNullable<Extract<PlateDef['source'], { kind: 'paint' }>>['paint']
  }
  /** Next repaint due time (clock seconds) -- per-plate so live paintings stagger their GPU uploads across frames instead of all landing on one tick. Mutated per frame, never React state. */
  nextRepaintAt: number
}

interface BuiltWindow {
  built: BuiltPlate
  sentenceIdSet: ReadonlySet<string>
  /** Mutated per frame (damped), never React state. */
  opacity: number
}

interface BuiltTexture {
  texture: THREE.Texture
  repaint?: BuiltPlate['repaint']
}

function buildTexture(def: PlateDef, beatsById: Record<string, SceneBeat>): BuiltTexture {
  if (def.source.kind === 'png') {
    const texture = new THREE.TextureLoader().load(def.source.url)
    texture.colorSpace = THREE.SRGBColorSpace
    return { texture }
  }
  const [width, height] = def.size ?? LAYER_SIZE[def.layer]
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = Math.round((TEXTURE_WIDTH * height) / width)
  const ctx = canvas.getContext('2d')
  const firstBeatId = def.memberBeatIds[0]
  const palette = firstBeatId ? beatsById[firstBeatId]?.palette : undefined
  if (ctx && palette) {
    def.source.paint(ctx, canvas.width, canvas.height, palette, 0)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const repaint =
    def.animated && ctx && palette
      ? { canvas, ctx, palette, paint: def.source.paint }
      : undefined
  return { texture, repaint }
}

const LAYER_RENDER_ORDER: Record<PlateLayer, number> = { far: -30, mid: -20, near: -5 }
const WINDOW_RENDER_ORDER = -10

function buildPlate(
  def: PlateDef,
  beatsById: Record<string, SceneBeat>,
  slotAzimuthDeg: number,
  slotThetaRad: number,
  renderOrder?: number,
): BuiltPlate {
  const radius = def.radius ?? LAYER_RADIUS[def.layer]
  const size = def.size ?? LAYER_SIZE[def.layer]
  // FAR shells wrap the FULL circle -- a continuous painted panorama ring
  // (compositions are mirror-symmetric at their edges, so tiling the
  // texture an integer number of times around the drum is seamless). MID
  // and NEAR shells are cut to exactly one sector slot so neighbors abut
  // edge-to-edge -- the zoetrope drum with no blank space between frames.
  const isRing = def.layer === 'far'
  const { thetaStart, thetaLength } = isRing
    ? { thetaStart: 0, thetaLength: Math.PI * 2 }
    : shellArcFromTheta(slotAzimuthDeg, slotThetaRad)
  const { texture, repaint } = buildTexture(def, beatsById)
  // The shell is viewed from INSIDE (BackSide): that flips the horizontal
  // read of the texture, so mirror U (negative repeat) to keep compositions
  // un-mirrored -- the spectrum corridor must still recede left-to-right.
  // Ring shells tile the texture round(circumference / painting width)
  // times so the pattern density matches the flat-plate era.
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.x = isRing ? -Math.max(1, Math.round((Math.PI * 2 * radius) / size[0])) : -1
  return {
    def,
    memberSet: new Set(def.memberBeatIds),
    texture,
    material: new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      fog: false,
      depthWrite: false,
      opacity: 0,
      side: THREE.BackSide,
    }),
    radius,
    height: size[1],
    centerY: size[1] * CENTER_Y_FACTOR,
    thetaStart,
    thetaLength,
    fogTint: LAYER_FOG_TINT[def.layer],
    renderOrder: renderOrder ?? LAYER_RENDER_ORDER[def.layer],
    repaint,
    nextRepaintAt: 0,
  }
}

const workingColor = new THREE.Color()

/**
 * One cyclorama shell: an open-ended cylinder arc segment centered on the
 * scene origin, its painting on the inside face -- the golden-age multiplane
 * flattened into curved theatrical backcloths the camera can stand among.
 * Concentric layers (far r26 / mid r20 / near r13.5) give the look-around
 * dwell real parallax in every direction.
 */
function PlateMesh({ plate }: { plate: BuiltPlate }) {
  return (
    <mesh position={[0, plate.centerY, 0]} material={plate.material} renderOrder={plate.renderOrder}>
      <cylinderGeometry
        args={[
          plate.radius,
          plate.radius,
          plate.height,
          48,
          1,
          true,
          plate.thetaStart,
          plate.thetaLength,
        ]}
      />
    </mesh>
  )
}

/**
 * The haze drum: a full-360-degree closed backdrop cylinder just outside the
 * far shells, self-tinted to the live fog/background blend every frame.
 * Sectors only span their own arcs, so while the turntable rotates between
 * distant walls the seam between paintings sweeps across the view -- without
 * this drum that seam showed raw floor-to-horizon brightness (the "white
 * space"). With it, the void between paintings is always the beat's own
 * haze.
 */
const HAZE_DRUM_RADIUS = 27
const HAZE_DRUM_HEIGHT = 18
const HAZE_DRUM_CENTER_Y = 5

export function PaintedPlates({ lerpedRef, plateSet, beatsById, sentenceIds }: PaintedPlatesProps) {
  const { built, builtWindows } = useMemo(() => {
    // Narrative order first: cameraAzimuthDeg's key order is the scene's
    // beat sequence (both registries declare beats in story order), so
    // consecutive story beats land in adjacent drum slots -- every beat
    // transition advances the drum exactly one frame. Plate/window
    // azimuths follow only as a safety net for sectors missing from the
    // beat map (dedup keeps the narrative position for shared ones).
    const allAzimuths = [
      ...Object.values(plateSet.cameraAzimuthDeg),
      ...plateSet.plates.map((def) => def.azimuthDeg),
      ...(plateSet.windows ?? []).map((window) => window.plate.azimuthDeg),
    ]
    const slots = tileSlotAzimuths(allAzimuths)
    const slotThetaRad = slots.size > 0 ? (Math.PI * 2) / slots.size : Math.PI * 2
    const slotOf = (deg: number) => slots.get(deg) ?? deg
    const builtPlates = plateSet.plates.map((def) =>
      buildPlate(def, beatsById, slotOf(def.azimuthDeg), slotThetaRad),
    )
    const windows: BuiltWindow[] = (plateSet.windows ?? []).map((window) => ({
      built: buildPlate(
        window.plate,
        beatsById,
        slotOf(window.plate.azimuthDeg),
        slotThetaRad,
        WINDOW_RENDER_ORDER,
      ),
      sentenceIdSet: new Set(window.sentenceIds),
      opacity: 0,
    }))
    return { built: builtPlates, builtWindows: windows }
  }, [plateSet, beatsById])

  // Sentence-level store field (permitted; word-level is what's barred).
  // Mirrored into a ref so the useFrame loop reads the freshest value
  // without re-creating its closure.
  const currentSentenceIndex = useReadingStore((state) => state.currentSentenceIndex)
  const sentenceIndexRef = useRef(currentSentenceIndex)
  sentenceIndexRef.current = currentSentenceIndex

  const builtRef = useRef(built)
  builtRef.current = built
  const windowsRef = useRef(builtWindows)
  windowsRef.current = builtWindows
  const hazeMaterialRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(({ clock }, delta) => {
    const lerped = lerpedRef.current
    if (!lerped) return
    workingColor.set(lerped.palette.fog)

    if (hazeMaterialRef.current) {
      hazeMaterialRef.current.color.set(lerped.palette.background).lerp(workingColor, 0.6)
    }

    // -- living paintings: repaint visible animated plates "on twos", with
    // two anti-jank rules. (1) Hold every card's last frame while the drum
    // is visibly turning -- repaints are GPU texture uploads, and uploads
    // mid-rotation read as ticks against the smooth motion. (2) At most ONE
    // upload per frame: each plate carries its own due time, and only the
    // most overdue candidate repaints this frame, so concurrent live cards
    // stagger onto different frames instead of stalling one together.
    if (turntableMotion.radPerSec <= REPAINT_PAUSE_TURN_SPEED) {
      let due: BuiltPlate | null = null
      const consider = (plate: BuiltPlate) => {
        if (!plate.repaint || plate.material.opacity < REPAINT_MIN_OPACITY) return
        if (clock.elapsedTime < plate.nextRepaintAt) return
        if (!due || plate.nextRepaintAt < due.nextRepaintAt) due = plate
      }
      for (const plate of builtRef.current) consider(plate)
      for (const window of windowsRef.current) consider(window.built)
      if (due) {
        const plate: BuiltPlate = due
        plate.nextRepaintAt = clock.elapsedTime + REPAINT_INTERVAL_SECONDS
        if (plate.repaint) {
          const { canvas, ctx, palette, paint } = plate.repaint
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          paint(ctx, canvas.width, canvas.height, palette, clock.elapsedTime)
          plate.texture.needsUpdate = true
        }
      }
    }

    // -- window track: damped fades toward active/inactive targets
    const activeSentenceId = sentenceIds?.[sentenceIndexRef.current]
    const damping = 1 - Math.exp(-delta * WINDOW_FADE_RATE)
    // per-sector suppression of beat mid plates while a window is up
    const suppressionByAzimuth = new Map<number, number>()
    for (const window of windowsRef.current) {
      const target = activeSentenceId !== undefined && window.sentenceIdSet.has(activeSentenceId) ? 1 : 0
      window.opacity += (target - window.opacity) * damping
      window.built.material.opacity = window.opacity
      window.built.material.color.setRGB(1, 1, 1).lerp(workingColor, window.built.fogTint)
      const azimuth = window.built.def.azimuthDeg
      suppressionByAzimuth.set(azimuth, Math.max(suppressionByAzimuth.get(azimuth) ?? 0, window.opacity))
    }

    // -- beat track: dissolve + advance. Far rings crossfade on beat change
    // (outgoing + incoming always sum to full cover, so the backdrop is
    // painted at every rotation angle); mid/near cards are beat-gated by
    // the same vignetteVisibility -- the outgoing card dissolves out over
    // the ~1s beat lerp while the drum advances one slot, so a rotation
    // never carries the previous frame along. This gating is also the
    // living-painting perf gate: only visible cards pass the repaint
    // threshold above, so at most a couple of canvases repaint + re-upload
    // per tick instead of the whole gallery (an always-visible gallery made
    // every animated card upload every tick -- the observed jank).
    for (const plate of builtRef.current) {
      let opacity = vignetteVisibility(lerped.fromId, lerped.toId, lerped.t, plate.memberSet)
      if (plate.def.layer !== 'far') {
        opacity *= 1 - (suppressionByAzimuth.get(plate.def.azimuthDeg) ?? 0)
      }
      plate.material.opacity = opacity
      plate.material.color.setRGB(1, 1, 1).lerp(workingColor, plate.fogTint)
    }
  })

  return (
    <group>
      <mesh position={[0, HAZE_DRUM_CENTER_Y, 0]}>
        <cylinderGeometry
          args={[HAZE_DRUM_RADIUS, HAZE_DRUM_RADIUS, HAZE_DRUM_HEIGHT, 64, 1, true]}
        />
        <meshBasicMaterial ref={hazeMaterialRef} side={THREE.BackSide} fog={false} />
      </mesh>
      {built.map((plate) => (
        <PlateMesh key={plate.def.id} plate={plate} />
      ))}
      {builtWindows.map((window) => (
        <PlateMesh key={window.built.def.id} plate={window.built} />
      ))}
    </group>
  )
}
