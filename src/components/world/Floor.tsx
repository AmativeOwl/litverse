import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'

interface FloorProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * One large low-poly floor plane. Uses `MeshStandardMaterial` (real
 * roughness/metalness lighting response, PBR-lit rather than cel-shaded)
 * -- a matte surface (~0.6 roughness, low metalness) so it catches the key
 * light/bloom and the new IBL environment realistically. Tinted from
 * `palette.primary`, still updated imperatively every frame exactly as
 * before -- only the material type + its fixed roughness/metalness changed.
 */
export function Floor({ lerpedRef }: FloorProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped || !materialRef.current) return
    materialRef.current.color.set(lerped.palette.primary)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60, 1, 1]} />
      <meshStandardMaterial ref={materialRef} roughness={0.6} metalness={0.05} />
    </mesh>
  )
}
