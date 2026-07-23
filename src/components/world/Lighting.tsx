import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'

interface LightingProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/** One warm key light + ambient, both parameterized from `lighting`, updated imperatively every frame. */
export function Lighting({ lerpedRef }: LightingProps) {
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const keyLightRef = useRef<THREE.DirectionalLight>(null)

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped) return
    if (ambientRef.current) {
      ambientRef.current.intensity = lerped.lighting.ambientIntensity
    }
    if (keyLightRef.current) {
      keyLightRef.current.intensity = lerped.lighting.keyLightIntensity
      keyLightRef.current.color.set(lerped.lighting.keyLightColor)
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} />
      <directionalLight ref={keyLightRef} position={[6, 9, 4]} />
    </>
  )
}
