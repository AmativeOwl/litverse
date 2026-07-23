import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
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
  const { scene } = useThree()
  const fogRef = useRef<THREE.Fog | null>(null)
  const backgroundRef = useRef<THREE.Color | null>(null)

  useEffect(() => {
    const fog = new THREE.Fog(new THREE.Color('#000000'), 8, 26)
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
