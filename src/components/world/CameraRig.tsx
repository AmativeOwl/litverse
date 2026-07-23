import { useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
import { computeCameraPose, type CameraBehavior } from './cameraMath'

interface CameraRigProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Applies `computeCameraPose` to the default R3F camera every frame. This is
 * the scripted rig the design constraints require in place of
 * `OrbitControls` -- the camera is never user-driven here.
 *
 * Tracks how long the *current* camera behavior has been active (not global
 * clock time), so a one-shot move like push-in/pull-back always restarts
 * cleanly from its own t=0 whenever `camera.behavior` changes, rather than
 * evaluating a pose for an arbitrary elapsed time it never actually played
 * through.
 */
export function CameraRig({ lerpedRef }: CameraRigProps) {
  const { camera } = useThree()
  const behaviorRef = useRef<CameraBehavior | null>(null)
  const behaviorStartRef = useRef(0)
  const lookAtTarget = useRef(new THREE.Vector3())

  useFrame(({ clock }) => {
    const lerped = lerpedRef.current
    if (!lerped) return

    const behavior = lerped.camera.behavior
    if (behaviorRef.current !== behavior) {
      behaviorRef.current = behavior
      behaviorStartRef.current = clock.elapsedTime
    }

    const elapsedInBehavior = clock.elapsedTime - behaviorStartRef.current
    const pose = computeCameraPose(behavior, lerped.camera.speed, lerped.camera.fov, elapsedInBehavior)

    camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    lookAtTarget.current.set(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2])
    camera.lookAt(lookAtTarget.current)

    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== pose.fov) {
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
