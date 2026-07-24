import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
import { FLOOR_RADIUS } from './Silhouettes'

interface LightingProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/** One warm key light + ambient, both parameterized from `lighting`, updated imperatively every frame. */
export function Lighting({ lerpedRef }: LightingProps) {
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const keyLightRef = useRef<THREE.DirectionalLight>(null)

  // Shadow-camera frustum is fixed configuration (not per-beat data), so it's
  // set up once here rather than every frame. Sized to the crowd's actual
  // scatter radius (`FLOOR_RADIUS = 22`, shared with Silhouettes.tsx/
  // DecoSkyline.tsx) instead of three's tiny +/-5 orthographic-camera
  // default, which would clip most of the scene out of the shadow map.
  // Orthographic cameras don't recompute their projection matrix
  // automatically when left/right/top/bottom change, so `updateProjectionMatrix`
  // must be called once after setting them.
  useEffect(() => {
    const light = keyLightRef.current
    if (!light) return
    const shadowCamera = light.shadow.camera
    shadowCamera.left = -FLOOR_RADIUS
    shadowCamera.right = FLOOR_RADIUS
    shadowCamera.top = FLOOR_RADIUS
    shadowCamera.bottom = -FLOOR_RADIUS
    shadowCamera.near = 0.5
    shadowCamera.far = 50
    shadowCamera.updateProjectionMatrix()
    light.shadow.mapSize.set(2048, 2048)
    light.shadow.bias = -0.0005
  }, [])

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
      <directionalLight ref={keyLightRef} position={[6, 9, 4]} castShadow />
    </>
  )
}
