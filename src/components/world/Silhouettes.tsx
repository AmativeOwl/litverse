import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneBeat } from '../../types'
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
const FLOOR_RADIUS = 22
const BASE_Y = 0.83

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

/**
 * Crowd abstraction: a single `InstancedMesh` of low-poly capsule
 * silhouettes (one draw call regardless of count), deterministic seeded
 * scatter, slow per-instance sine sway applied entirely in `useFrame`.
 */
export function Silhouettes({ lerpedRef, animation }: SilhouettesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const layout = useMemo(buildLayout, [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const lerped = lerpedRef.current
    const mesh = meshRef.current
    if (!lerped || !mesh) return

    const count = Math.max(0, Math.min(MAX_SILHOUETTES, Math.round(lerped.silhouetteCount)))
    mesh.count = count

    const elapsed = clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const instance = layout[i]
      if (!instance) continue
      const sway =
        animation === 'sway' ? Math.sin(elapsed * instance.swaySpeed + instance.swayPhase) * instance.swayAmplitude : 0
      dummy.position.set(instance.x, BASE_Y, instance.z)
      dummy.rotation.set(0, instance.rotationY + sway * 0.4, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    if (materialRef.current) {
      materialRef.current.emissive.set(lerped.lighting.keyLightColor)
      materialRef.current.emissiveIntensity = Math.min(0.35, lerped.lighting.keyLightIntensity * 0.12)
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_SILHOUETTES]} frustumCulled={false}>
      <capsuleGeometry args={[0.28, 1.1, 2, 6]} />
      <meshStandardMaterial ref={materialRef} color="#050508" roughness={0.8} metalness={0.05} />
    </instancedMesh>
  )
}
