import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'

interface FloorProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * One large low-poly floor plane with a subtle reflective material (moderate
 * metalness/low roughness rather than a full planar-reflector render target
 * -- cheap enough to sit comfortably alongside Bloom + the crowd instances).
 * Tinted from `palette.primary`, updated imperatively every frame.
 */
export function Floor({ lerpedRef }: FloorProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped || !materialRef.current) return
    materialRef.current.color.set(lerped.palette.primary)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[60, 60, 1, 1]} />
      <meshStandardMaterial ref={materialRef} metalness={0.12} roughness={0.4} />
    </mesh>
  )
}
