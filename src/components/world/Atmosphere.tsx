import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { LerpedSceneBeat } from './beatMath'

interface AtmosphereProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Owns `scene.fog` and `scene.background`, both driven straight from the
 * beat's `palette`. Mutates the underlying THREE objects every frame inside
 * `useFrame` -- never re-renders, never touches React state.
 */
export function Atmosphere({ lerpedRef }: AtmosphereProps) {
  const { scene, gl } = useThree()
  const fogRef = useRef<THREE.Fog | null>(null)
  const backgroundRef = useRef<THREE.Color | null>(null)

  // Fake-HDRI image-based lighting/reflections with zero bundled assets and
  // zero network fetches: three's own procedural `RoomEnvironment` (a small
  // scene of lit boxes -- see three/examples/jsm/environments/RoomEnvironment.js)
  // rendered once through a `PMREMGenerator` into a prefiltered environment
  // map, assigned to `scene.environment` so every `MeshStandardMaterial` in
  // the scene picks up real ambient reflections/specular response instead of
  // flat ambient-only lighting. Built once on mount (not per-frame/per-beat
  // -- this is fixed scene-level setup, the same category as the fog/
  // background effect below, just IBL instead of fog).
  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl)
    const environmentTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environmentTexture
    pmremGenerator.dispose()
    return () => {
      scene.environment = null
      environmentTexture.dispose()
    }
  }, [scene, gl])

  useEffect(() => {
    // far=26 (the original value) fully obscured anything past 26 units from
    // the camera -- but the crowd/particle scatter radius is 22 units *from
    // the scene origin*, and the camera itself sits ~8-9 units out, so
    // far-side instances were ~30 units from the camera and disappeared
    // entirely into fog. far=40 keeps the whole scatter radius visible from
    // any camera position the rig actually uses.
    const fog = new THREE.Fog(new THREE.Color('#000000'), 8, 40)
    const background = new THREE.Color('#000000')
    fogRef.current = fog
    backgroundRef.current = background
    scene.fog = fog
    scene.background = background
    return () => {
      scene.fog = null
      scene.background = null
    }
  }, [scene])

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped) return
    fogRef.current?.color.set(lerped.palette.fog)
    backgroundRef.current?.set(lerped.palette.background)
  })

  return null
}
