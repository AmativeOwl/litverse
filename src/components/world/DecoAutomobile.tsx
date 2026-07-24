import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { lerp } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'
import { useReadingStore } from '../../store/readingStore'

interface DecoAutomobileProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Foreground driveway prop: a handful of parked cars evoking the passage's
 * "his Rolls-Royce became an omnibus... his station wagon scampered like a
 * brisk yellow bug" and "the cars from New York are parked five deep in the
 * drive." A simplified but readable silhouette -- low cabin box, longer/lower
 * hood box, four outward-facing wheel cylinders, a thin-bar grille -- merged
 * once via `mergeGeometries` and placed with a fixed seed, following the same
 * pattern as `DecoSkyline`/`DecoFountain`.
 *
 * Unlike those two (unlit `MeshBasicMaterial` silhouettes tinted from the
 * beat palette), these use real lit `MeshStandardMaterial` paint -- this
 * project's move from toon/unlit materials toward PBR for concrete "prop"
 * objects -- so body color stays a fixed, recognizable car color (dark
 * lacquer / brisk yellow) and the *mood* comes from `Lighting.tsx`'s
 * per-beat key light actually striking real roughness/metalness, not from
 * re-tinting the paint itself.
 *
 * Instanced across two `InstancedMesh`es sharing one merged geometry -- one
 * per paint tone -- rather than one mesh with per-instance color, because
 * roughness/metalness (glossy black lacquer vs. matte yellow) are
 * material-level properties an instance-color attribute can't vary.
 */

// Placement: angle (atan2(z, x) in the XZ plane, degrees from +X) 260-300,
// radius 17-21 -- a foreground driveway patch near the outer edge of
// `Silhouettes.tsx`'s FLOOR_RADIUS = 22 crowd scatter, but clear of
// `DecoFountain` (angle atan2(-9, 13) ~= 325deg, radius sqrt(13^2+9^2) ~= 15.8,
// and its railing at radius 11 spanning ~295-355deg) and well inside
// `DecoSkyline`'s ring (radius 25-30).
const ANGLE_MIN_DEG = 260
const ANGLE_MAX_DEG = 300
const RADIUS_MIN = 17
const RADIUS_MAX = 21

const CAR_COUNT: number = 3
// First two instances are the dark "Rolls-Royce" tone, the rest the "brisk
// yellow" station-wagon tone -- matching the passage's Rolls-as-omnibus
// (ferrying multiple parties) getting the more numerous treatment.
const ROLLS_COUNT = 2

const WHEEL_RADIUS = 0.34
const WHEEL_THICKNESS = 0.22
const TRACK_HALF_WIDTH = 0.75
const AXLE_FRONT_Z = 0.9
const AXLE_REAR_Z = -0.9

/**
 * Builds one car silhouette in local space (nose toward +Z) and merges it
 * into a single `BufferGeometry`: a cabin box set back toward the rear, a
 * longer/lower hood box toward the front, four wheel cylinders rotated so
 * their flat circular face points outward (sideways) rather than down, and a
 * few thin bars suggesting a front grille.
 */
function buildCarGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []

  const cabin = new THREE.BoxGeometry(1.3, 0.55, 1.3)
  cabin.translate(0, 0.775, -0.4)
  parts.push(cabin)

  const hood = new THREE.BoxGeometry(1.2, 0.38, 1.6)
  hood.translate(0, 0.69, 0.75)
  parts.push(hood)

  const wheelOffsets: ReadonlyArray<readonly [x: number, z: number]> = [
    [TRACK_HALF_WIDTH, AXLE_FRONT_Z],
    [-TRACK_HALF_WIDTH, AXLE_FRONT_Z],
    [TRACK_HALF_WIDTH, AXLE_REAR_Z],
    [-TRACK_HALF_WIDTH, AXLE_REAR_Z],
  ]
  for (const [x, z] of wheelOffsets) {
    // Default cylinder axis is Y (disc in the XZ plane); rotating 90deg
    // around Z swings that axis onto X, so the disc now spans Y-Z and the
    // wheel reads as a circle from the car's side profile, "facing outward"
    // the way an axle would.
    const wheel = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_THICKNESS, 12)
    wheel.rotateZ(Math.PI / 2)
    wheel.translate(x, WHEEL_RADIUS, z)
    parts.push(wheel)
  }

  const grilleFrontZ = 0.75 + 1.6 / 2 + 0.03
  const grilleBarYs: readonly number[] = [0.56, 0.63, 0.7]
  for (const y of grilleBarYs) {
    const bar = new THREE.BoxGeometry(0.9, 0.035, 0.05)
    bar.translate(0, y, grilleFrontZ)
    parts.push(bar)
  }

  const merged = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  return merged
}

interface CarInstance {
  x: number
  z: number
  rotationY: number
  scale: number
}

interface CarLayout {
  rolls: CarInstance[]
  wagon: CarInstance[]
}

/** Deterministic driveway layout (fixed seed) -- same convention as DecoSkyline/DecoFountain's seeded placement. */
function buildLayout(): CarLayout {
  const random = createSeededRandom(hashStringToSeed('litverse-deco-automobile'))
  const angleMin = (ANGLE_MIN_DEG * Math.PI) / 180
  const angleMax = (ANGLE_MAX_DEG * Math.PI) / 180

  const rolls: CarInstance[] = []
  const wagon: CarInstance[] = []

  for (let i = 0; i < CAR_COUNT; i++) {
    const t = CAR_COUNT === 1 ? 0.5 : i / (CAR_COUNT - 1)
    const angle = lerp(angleMin, angleMax, t) + (random() - 0.5) * 0.03
    const radius = RADIUS_MIN + random() * (RADIUS_MAX - RADIUS_MIN)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    // Cars sit roughly nose-along the driveway's tangent direction (parked
    // side by side along the arc), with a small per-car jitter so the row
    // doesn't look laser-cut uniform.
    const tangent = angle + Math.PI / 2
    const rotationY = tangent + (random() - 0.5) * 0.25
    const scale = 0.92 + random() * 0.16

    const instance: CarInstance = { x, z, rotationY, scale }
    if (i < ROLLS_COUNT) {
      rolls.push(instance)
    } else {
      wagon.push(instance)
    }
  }

  return { rolls, wagon }
}

/** Beats where the passage's cars/arrivals are textually active -- parked cars read as more prominent/brighter-lit during these. */
const EMPHASIS_BEAT_IDS: ReadonlySet<string> = new Set(['weekend-traffic', 'orchestra-tuning'])
/** How quickly the emphasis glow eases toward its target per second -- smooths the beat-to-beat cut into a fade. */
const EMPHASIS_LERP_RATE = 3

export function DecoAutomobile({ lerpedRef }: DecoAutomobileProps) {
  const activeSceneBeatId = useReadingStore((state) => state.activeSceneBeatId)

  const carGeometry = useMemo(buildCarGeometry, [])
  const layout = useMemo(buildLayout, [])

  const rollsMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0b120e', // deep black with a hint of dark green -- an "elegant" Rolls-Royce lacquer
        roughness: 0.18,
        metalness: 0.6,
        emissive: '#0b120f',
        emissiveIntensity: 0.03,
      }),
    [],
  )
  const wagonMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f4c430', // "brisk yellow" station wagon
        roughness: 0.55,
        metalness: 0.1,
        emissive: '#f4c430',
        emissiveIntensity: 0.04,
      }),
    [],
  )

  const rollsMeshRef = useRef<THREE.InstancedMesh>(null)
  const wagonMeshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const emphasisRef = useRef(0)

  // Instance transforms are static -- parked cars don't move -- so they're
  // written once here, same as DecoSkyline's buildings, rather than
  // recomputed every frame.
  useEffect(() => {
    const applyInstances = (mesh: THREE.InstancedMesh | null, cars: CarInstance[]) => {
      if (!mesh) return
      cars.forEach((car, index) => {
        dummy.position.set(car.x, 0, car.z)
        dummy.rotation.set(0, car.rotationY, 0)
        dummy.scale.setScalar(car.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    applyInstances(rollsMeshRef.current, layout.rolls)
    applyInstances(wagonMeshRef.current, layout.wagon)
  }, [layout, dummy])

  useFrame((_state, delta) => {
    const lerped = lerpedRef.current
    if (!lerped) return

    const target = activeSceneBeatId !== null && EMPHASIS_BEAT_IDS.has(activeSceneBeatId) ? 1 : 0
    emphasisRef.current += (target - emphasisRef.current) * Math.min(1, delta * EMPHASIS_LERP_RATE)
    const emphasis = emphasisRef.current

    rollsMaterial.emissiveIntensity = lerp(0.03, 0.5, emphasis)
    wagonMaterial.emissiveIntensity = lerp(0.04, 0.6, emphasis)
  })

  return (
    <group>
      {layout.rolls.length > 0 && (
        <instancedMesh
          ref={rollsMeshRef}
          args={[carGeometry, rollsMaterial, layout.rolls.length]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
      )}
      {layout.wagon.length > 0 && (
        <instancedMesh
          ref={wagonMeshRef}
          args={[carGeometry, wagonMaterial, layout.wagon.length]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
      )}
    </group>
  )
}
