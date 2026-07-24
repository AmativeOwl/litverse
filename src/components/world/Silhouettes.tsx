import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { SceneBeat } from '../../types'
import { useReadingStore } from '../../store/readingStore'
import type { LerpedSceneBeat } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'

interface SilhouettesProps {
  lerpedRef: RefObject<LerpedSceneBeat>
  animation: NonNullable<SceneBeat['silhouettes']>['animation']
}

/** Capacity of the shared InstancedMesh -- always allocated at this size so that
 * a beat's `silhouettes.count` can be animated up/down via `InstancedMesh.count`
 * (a draw-range style truncation) without ever re-allocating instance buffers
 * or issuing more than one draw call. */
const MAX_SILHOUETTES = 90
/** Exported so `Lighting.tsx` can size the key light's shadow-camera frustum
 * to match the crowd's actual scatter radius instead of guessing a number. */
export const FLOOR_RADIUS = 22

const BODY_HEIGHT = 1.0
// A single linear taper (the old CylinderGeometry(0.14, 0.2, ...) approach)
// only differs by 0.06 units over the whole body height -- too subtle to
// register at silhouette scale, so it just read as a plain cylinder (hence
// "a sphere on a trapezium"). This profile is revolved via LatheGeometry
// instead: hem flare, waist-in, shoulder-out, neck taper -- an actual coat
// silhouette contour, not one straight line. y is absolute (0 = feet,
// BODY_HEIGHT = neck), x is radius at that height.
const BODY_PROFILE: ReadonlyArray<readonly [radius: number, y: number]> = [
  [0.24, 0], // hem
  [0.19, 0.16], // lower leg/coat taper
  [0.12, 0.52], // waist
  [0.18, 0.78], // shoulders
  [0.08, BODY_HEIGHT], // neck
]
// Deliberately oversized relative to the body (real head:body proportions
// read as a featureless blob at silhouette scale/distance) -- exaggerating
// the head is the standard trick minimalist crowd figures use to stay
// legible as "a person" rather than "a post," per the Journey/Gris reference.
const HEAD_RADIUS = 0.24
/** How far the head sinks into the body's top so the join reads as a neck, not a gap. */
const HEAD_OVERLAP = 0.3

const HEAD_CENTER_Y = BODY_HEIGHT - HEAD_RADIUS * HEAD_OVERLAP
/** The profile is already defined in absolute y (feet at 0), so instances need no vertical offset to stand on the floor. */
const BASE_Y = 0

/**
 * A single static, unarticulated "figure" shape -- a revolved coat/dress
 * silhouette (hem flare, waist, shoulders, neck) with a rounded head merged
 * on top -- still just one abstract silhouette per instance (no bones, no
 * rig, no per-part animation beyond the shared sway), still one draw call
 * for the whole crowd. Built once and reused as the InstancedMesh's geometry.
 */
function buildFigureGeometry(): THREE.BufferGeometry {
  const profile = BODY_PROFILE.map(([radius, y]) => new THREE.Vector2(radius, y))
  const body = new THREE.LatheGeometry(profile, 8)
  const head = new THREE.SphereGeometry(HEAD_RADIUS, 10, 8)
  head.translate(0, HEAD_CENTER_Y, 0)
  const merged = mergeGeometries([body, head])
  body.dispose()
  head.dispose()
  return merged
}

interface Layout {
  x: number
  z: number
  rotationY: number
  swayPhase: number
  swaySpeed: number
  swayAmplitude: number
}

function buildLayout(): Layout[] {
  // Fixed seed (not beat-dependent) so the crowd's physical positions stay
  // put across beat transitions -- only how many of them are drawn changes.
  const random = createSeededRandom(hashStringToSeed('litverse-crowd-layout'))
  const layout: Layout[] = []
  for (let i = 0; i < MAX_SILHOUETTES; i++) {
    const angle = random() * Math.PI * 2
    // sqrt-distributed radius so instances don't bunch up near the center
    const radius = Math.sqrt(random()) * FLOOR_RADIUS
    layout.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      rotationY: random() * Math.PI * 2,
      swayPhase: random() * Math.PI * 2,
      swaySpeed: 0.5 + random() * 0.6,
      swayAmplitude: 0.08 + random() * 0.1,
    })
  }
  return layout
}

/** Base coat/dress color for the crowd -- unchanged from the pre-PBR look. */
const BASE_SILHOUETTE_COLOR = new THREE.Color('#2a2436')

// "gaudy primary colours... hair bobbed in strange new ways... shawls beyond
// the dreams of Castile" -- a small fixed palette of saturated, clashing
// tones (not colors pulled from SceneBeat.palette, which is the *mood*
// palette, not a fashion one) that a subset of crowd instances tint towards
// instead of the uniform base coat color.
const FASHION_COLORS: readonly string[] = [
  '#e63946', // gaudy red
  '#457b9d', // peacock blue
  '#ffd166', // gold
  '#2a9d8f', // emerald
  '#d62aa0', // fuchsia shawl
]

/** Fraction of the crowd that's ever eligible to show fashion tinting at all -- the rest stay uniform regardless of beat, so even at peak variety it reads as "some of the crowd," not "all of it recolored." */
const FASHION_CANDIDATE_RATE = 0.45
/** Baseline reveal intensity for beats other than the two peak-revelry ones below. */
const FASHION_INTENSITY_BASELINE = 0.18
/** Reveal intensity during the orchestra-tuning / dancing-under-lights beats -- where the passage's "gaudy primary colours" description is most apt. */
const FASHION_INTENSITY_PEAK = 0.6
const PEAK_FASHION_BEAT_IDS = new Set(['orchestra-tuning', 'dancing-under-lights'])

interface FashionTint {
  isCandidate: boolean
  color: THREE.Color
  /** Instance is revealed once the current beat's variety intensity exceeds this deterministic per-instance threshold -- gives a stable (not flickering) subset that grows as intensity rises. */
  revealThreshold: number
}

/**
 * Deterministic per-instance fashion-tint assignment, seeded independently of
 * `buildLayout`'s scatter positions so this can be tuned without perturbing
 * where instances stand. Same seeded-random approach as the rest of this
 * file -- fixed seed, computed once, never re-rolled per frame/beat.
 */
function buildFashionLayout(): FashionTint[] {
  const random = createSeededRandom(hashStringToSeed('litverse-crowd-fashion'))
  const tints: FashionTint[] = []
  for (let i = 0; i < MAX_SILHOUETTES; i++) {
    const isCandidate = random() < FASHION_CANDIDATE_RATE
    const colorHex = FASHION_COLORS[Math.floor(random() * FASHION_COLORS.length)] ?? FASHION_COLORS[0]
    tints.push({
      isCandidate,
      color: new THREE.Color(colorHex),
      revealThreshold: random(),
    })
  }
  return tints
}

/**
 * Crowd abstraction: a single `InstancedMesh` of low-poly figure-like
 * silhouettes (tapered body + head, one draw call regardless of count),
 * deterministic seeded scatter, slow per-instance sine sway applied entirely
 * in `useFrame`. Real `MeshStandardMaterial` lighting response (roughness/
 * metalness) replaces the old toon shading; a per-instance `instanceColor`
 * buffer (rather than material.color) carries the base/fashion tinting so
 * each figure can differ without any extra draw calls.
 */
export function Silhouettes({ lerpedRef, animation }: SilhouettesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const layout = useMemo(buildLayout, [])
  const fashionLayout = useMemo(buildFashionLayout, [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geometry = useMemo(buildFigureGeometry, [])

  // Beat-level state, per the design constraints (only sentence/beat-level
  // fields may trigger R3F re-renders) -- read the same way
  // `MotifEffects.tsx` reads store fields to gate its own per-beat behavior.
  const activeSceneBeatId = useReadingStore((state) => state.activeSceneBeatId)

  useFrame(({ clock }) => {
    const lerped = lerpedRef.current
    const mesh = meshRef.current
    if (!lerped || !mesh) return

    const count = Math.max(0, Math.min(MAX_SILHOUETTES, Math.round(lerped.silhouetteCount)))
    mesh.count = count

    const varietyIntensity =
      activeSceneBeatId && PEAK_FASHION_BEAT_IDS.has(activeSceneBeatId)
        ? FASHION_INTENSITY_PEAK
        : FASHION_INTENSITY_BASELINE

    const elapsed = clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const instance = layout[i]
      if (!instance) continue
      const sway =
        animation === 'sway'
          ? Math.sin(elapsed * instance.swaySpeed + instance.swayPhase) * instance.swayAmplitude
          : 0
      dummy.position.set(instance.x, BASE_Y, instance.z)
      dummy.rotation.set(0, instance.rotationY + sway * 0.4, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      const fashion = fashionLayout[i]
      const showFashion = !!fashion && fashion.isCandidate && fashion.revealThreshold < varietyIntensity
      mesh.setColorAt(i, showFashion && fashion ? fashion.color : BASE_SILHOUETTE_COLOR)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    if (materialRef.current) {
      materialRef.current.emissive.set(lerped.lighting.keyLightColor)
      // Emissive is angle-independent -- it was doing the job of making the
      // figures visible, but that also flattened them into a uniform-color
      // cutout with no shading gradient. Base color carries visibility now
      // (bright enough for the key light's diffuse/NdotL response to
      // actually vary across the form), so emissive only needs to be a thin
      // warm rim on top, not the dominant term.
      materialRef.current.emissiveIntensity = Math.min(0.18, lerped.lighting.keyLightIntensity * 0.08)
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_SILHOUETTES]}
      frustumCulled={false}
      castShadow
      receiveShadow
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial ref={materialRef} roughness={0.6} metalness={0.05} />
    </instancedMesh>
  )
}
