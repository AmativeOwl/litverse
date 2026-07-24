import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
import { getToonGradientMap } from './toonGradientTexture'

interface FloorProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * One large low-poly floor plane. Uses `MeshToonMaterial` (cel-shaded,
 * quantized into discrete light/shadow bands via the shared gradient map)
 * rather than `MeshStandardMaterial` -- `metalness`/`roughness` don't apply
 * to toon shading, so they're dropped along with the switch. Tinted from
 * `palette.primary`, updated imperatively every frame exactly as before.
 */
export function Floor({ lerpedRef }: FloorProps) {
  const materialRef = useRef<THREE.MeshToonMaterial>(null)

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped || !materialRef.current) return
    materialRef.current.color.set(lerped.palette.primary)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[60, 60, 1, 1]} />
      <meshToonMaterial ref={materialRef} gradientMap={getToonGradientMap()} />
    </mesh>
  )
}
