import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneBeat } from '../../types'
import type { PlateDef, PlateLayer, ScenePlateSet } from '../../types-plates'
import { useReadingStore } from '../../store/readingStore'
import type { LerpedSceneBeat } from './beatMath'
import { vignetteVisibility } from './decoPlateKit'

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
 * Generic renderer of the painted-world pivot (see CLAUDE.md): flat 2D
 * Art-Deco plates hung in the beats' angular sectors, which the
 * azimuth-anchored CameraRig turns to face -- multiplane-camera staging.
 * Scene-agnostic: everything Gatsby-specific arrives via `plateSet`
 * (src/data/plates/<sceneId>.ts); pointing this at another text's registry
 * requires zero changes here.
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

interface BuiltPlate {
  def: PlateDef
  memberSet: ReadonlySet<string>
  texture: THREE.Texture
  material: THREE.MeshBasicMaterial
  position: readonly [number, number, number]
  rotationY: number
  size: readonly [number, number]
  fogTint: number
}

interface BuiltWindow {
  built: BuiltPlate
  sentenceIdSet: ReadonlySet<string>
  /** Mutated per frame (damped), never React state. */
  opacity: number
}

function buildTexture(def: PlateDef, beatsById: Record<string, SceneBeat>): THREE.Texture {
  if (def.source.kind === 'png') {
    const texture = new THREE.TextureLoader().load(def.source.url)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
  const [width, height] = def.size ?? LAYER_SIZE[def.layer]
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = Math.round((TEXTURE_WIDTH * height) / width)
  const ctx = canvas.getContext('2d')
  const firstBeatId = def.memberBeatIds[0]
  const palette = firstBeatId ? beatsById[firstBeatId]?.palette : undefined
  if (ctx && palette) {
    def.source.paint(ctx, canvas.width, canvas.height, palette)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildPlate(def: PlateDef, beatsById: Record<string, SceneBeat>): BuiltPlate {
  const radius = def.radius ?? LAYER_RADIUS[def.layer]
  const size = def.size ?? LAYER_SIZE[def.layer]
  const angleRad = (def.azimuthDeg * Math.PI) / 180
  const x = Math.cos(angleRad) * radius
  const z = Math.sin(angleRad) * radius
  const texture = buildTexture(def, beatsById)
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
    }),
    position: [x, size[1] * CENTER_Y_FACTOR, z] as const,
    rotationY: Math.atan2(-x, -z),
    size,
    fogTint: LAYER_FOG_TINT[def.layer],
  }
}

const workingColor = new THREE.Color()

function PlateMesh({ plate }: { plate: BuiltPlate }) {
  return (
    <mesh
      position={[plate.position[0], plate.position[1], plate.position[2]]}
      rotation={[0, plate.rotationY, 0]}
      material={plate.material}
    >
      <planeGeometry args={[plate.size[0], plate.size[1]]} />
    </mesh>
  )
}

export function PaintedPlates({ lerpedRef, plateSet, beatsById, sentenceIds }: PaintedPlatesProps) {
  const built = useMemo<BuiltPlate[]>(
    () => plateSet.plates.map((def) => buildPlate(def, beatsById)),
    [plateSet, beatsById],
  )
  const builtWindows = useMemo<BuiltWindow[]>(
    () =>
      (plateSet.windows ?? []).map((window) => ({
        built: buildPlate(window.plate, beatsById),
        sentenceIdSet: new Set(window.sentenceIds),
        opacity: 0,
      })),
    [plateSet, beatsById],
  )

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

  useFrame((_, delta) => {
    const lerped = lerpedRef.current
    if (!lerped) return
    workingColor.set(lerped.palette.fog)

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

    // -- beat track
    for (const plate of builtRef.current) {
      let opacity = vignetteVisibility(lerped.fromId, lerped.toId, lerped.t, plate.memberSet)
      if (plate.def.layer === 'mid') {
        const suppression = suppressionByAzimuth.get(plate.def.azimuthDeg) ?? 0
        opacity *= 1 - suppression
      }
      plate.material.opacity = opacity
      plate.material.color.setRGB(1, 1, 1).lerp(workingColor, plate.fogTint)
    }
  })

  return (
    <group>
      {built.map((plate) => (
        <PlateMesh key={plate.def.id} plate={plate} />
      ))}
      {builtWindows.map((window) => (
        <PlateMesh key={window.built.def.id} plate={window.built} />
      ))}
    </group>
  )
}
