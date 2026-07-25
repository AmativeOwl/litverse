import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneBeat } from '../../types'
import type { PlateDef, PlateLayer, ScenePlateSet } from '../../types-plates'
import { useReadingStore } from '../../store/readingStore'
import type { LerpedSceneBeat } from './beatMath'
import { shellArcFromTheta, tileSlotAzimuths, vignetteVisibility } from './decoPlateKit'

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
  /** Present on animated paint-source plates: everything needed to repaint per tick. */
  repaint?: {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    palette: SceneBeat['palette']
    paint: NonNullable<Extract<PlateDef['source'], { kind: 'paint' }>>['paint']
  }
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

function buildPlate(
  def: PlateDef,
  beatsById: Record<string, SceneBeat>,
  slotAzimuthDeg: number,
  slotThetaRad: number,
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
    repaint,
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
    <mesh position={[0, plate.centerY, 0]} material={plate.material}>
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
  const { built, builtWindows, midGroups } = useMemo(() => {
    const allAzimuths = [
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
      built: buildPlate(window.plate, beatsById, slotOf(window.plate.azimuthDeg), slotThetaRad),
      sentenceIdSet: new Set(window.sentenceIds),
      opacity: 0,
    }))
    // Mid/near shells grouped by authored sector azimuth: a group of one is
    // ALWAYS fully visible (the drum's persistent gallery); a shared slot
    // (e.g. orchestra + dancing at Gatsby's 80) crossfades by beat
    // membership, topped up so the slot never goes blank.
    const groups = new Map<number, BuiltPlate[]>()
    for (const plate of builtPlates) {
      if (plate.def.layer === 'far') continue
      const group = groups.get(plate.def.azimuthDeg) ?? []
      group.push(plate)
      groups.set(plate.def.azimuthDeg, group)
    }
    return { built: builtPlates, builtWindows: windows, midGroups: groups }
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
  const midGroupsRef = useRef(midGroups)
  midGroupsRef.current = midGroups
  const lastRepaintRef = useRef(0)
  const hazeMaterialRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(({ clock }, delta) => {
    const lerped = lerpedRef.current
    if (!lerped) return
    workingColor.set(lerped.palette.fog)

    if (hazeMaterialRef.current) {
      hazeMaterialRef.current.color.set(lerped.palette.background).lerp(workingColor, 0.6)
    }

    // -- living paintings: repaint visible animated plates "on twos"
    if (clock.elapsedTime - lastRepaintRef.current >= REPAINT_INTERVAL_SECONDS) {
      lastRepaintRef.current = clock.elapsedTime
      const repaintIfLive = (plate: BuiltPlate) => {
        if (!plate.repaint || plate.material.opacity < REPAINT_MIN_OPACITY) return
        const { canvas, ctx, palette, paint } = plate.repaint
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        paint(ctx, canvas.width, canvas.height, palette, clock.elapsedTime)
        plate.texture.needsUpdate = true
      }
      for (const plate of builtRef.current) repaintIfLive(plate)
      for (const window of windowsRef.current) repaintIfLive(window.built)
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

    // -- far rings: full-circle panoramas crossfading on beat change (the
    // outgoing and incoming rings always sum to full cover, so the backdrop
    // is painted at every rotation angle)
    for (const plate of builtRef.current) {
      if (plate.def.layer !== 'far') continue
      plate.material.opacity = vignetteVisibility(lerped.fromId, lerped.toId, lerped.t, plate.memberSet)
      plate.material.color.setRGB(1, 1, 1).lerp(workingColor, plate.fogTint)
    }

    // -- mid/near shells: the drum's persistent gallery. Every sector's
    // painting stays visible so a turn slides image-into-image with no
    // blank between frames; only slot-SHARING plates crossfade by beat
    // membership, topped up so their slot never goes empty either.
    for (const group of midGroupsRef.current.values()) {
      const first = group[0]
      if (!first) continue
      const suppression = 1 - (suppressionByAzimuth.get(first.def.azimuthDeg) ?? 0)
      if (group.length === 1) {
        first.material.opacity = suppression
        first.material.color.setRGB(1, 1, 1).lerp(workingColor, first.fogTint)
        continue
      }
      let total = 0
      const visibilities = group.map((plate) => {
        const visibility = vignetteVisibility(lerped.fromId, lerped.toId, lerped.t, plate.memberSet)
        total += visibility
        return visibility
      })
      const deficit = Math.max(0, 1 - total)
      group.forEach((plate, index) => {
        const base = (visibilities[index] ?? 0) + (index === 0 ? deficit : 0)
        plate.material.opacity = base * suppression
        plate.material.color.setRGB(1, 1, 1).lerp(workingColor, plate.fogTint)
      })
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
