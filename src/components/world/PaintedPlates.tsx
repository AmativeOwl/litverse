import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneBeat } from '../../types'
import type { PlateDef, PlateLayer, ScenePlateSet } from '../../types-plates'
import type { LerpedSceneBeat } from './beatMath'
import { vignetteVisibility } from './decoPlateKit'

interface PaintedPlatesProps {
  lerpedRef: RefObject<LerpedSceneBeat>
  plateSet: ScenePlateSet
  /** Palette lookup for building each plate's texture -- keyed by beat id (WorldScene already owns this map). */
  beatsById: Record<string, SceneBeat>
}

/**
 * Generic renderer of the painted-world pivot (see CLAUDE.md): flat 2D
 * Art-Deco plates hung in the beats' angular sectors, which the
 * azimuth-anchored CameraRig turns to face -- multiplane-camera staging.
 * Scene-agnostic: everything Gatsby-specific arrives via `plateSet`
 * (src/data/plates/<sceneId>.ts); pointing this at another text's registry
 * requires zero changes here.
 *
 * Textures are built exactly once (useMemo): procedural plates paint into a
 * canvas with their FIRST member beat's palette from scene-beats.json; PNG
 * plates load from public/ (the offline image-gen fallback path). Per-frame
 * work in useFrame is limited to the established imperative pattern --
 * opacity via the shared vignetteVisibility crossfade, plus a small
 * material-color nudge toward the live fog color, deeper for farther layers,
 * so plates sit in each beat's atmosphere while scene fog itself is disabled
 * on them (fog would grey out the paintings; they self-tint instead).
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

const workingColor = new THREE.Color()

export function PaintedPlates({ lerpedRef, plateSet, beatsById }: PaintedPlatesProps) {
  const builtRef = useRef<BuiltPlate[]>([])

  const built = useMemo<BuiltPlate[]>(() => {
    return plateSet.plates.map((def) => {
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
    })
  }, [plateSet, beatsById])
  builtRef.current = built

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped) return
    workingColor.set(lerped.palette.fog)
    for (const plate of builtRef.current) {
      plate.material.opacity = vignetteVisibility(
        lerped.fromId,
        lerped.toId,
        lerped.t,
        plate.memberSet,
      )
      plate.material.color.setRGB(1, 1, 1).lerp(workingColor, plate.fogTint)
    }
  })

  return (
    <group>
      {built.map((plate) => (
        <mesh
          key={plate.def.id}
          position={[plate.position[0], plate.position[1], plate.position[2]]}
          rotation={[0, plate.rotationY, 0]}
          material={plate.material}
        >
          <planeGeometry args={[plate.size[0], plate.size[1]]} />
        </mesh>
      ))}
    </group>
  )
}
