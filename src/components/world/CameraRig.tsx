import { useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
import { computeCameraPose, DEFAULT_CAMERA_AZIMUTH_RAD } from './cameraMath'

interface CameraRigProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * The fixed interior viewpoint of the zoetrope model: the camera stands
 * permanently inside the cyclorama (the zoom=1 pose of computeCameraPose:
 * DWELL_RADIUS out from center toward a fixed azimuth, ~7 units off the mid
 * shell surface, aspect-aware dwell lens) and NEVER travels. All scene
 * changes are the WorldTurntable rotating the paintings past the viewer --
 * "the images move, not me." The camera's only motion is the slow
 * look-around yaw below: a head-turn, not a walk.
 *
 * This retires the shot cycle (wide -> focus -> push -> dwell -> retreat)
 * of the camera-travel era; the scripted-rig constraint holds -- there is
 * still no user-driven camera anywhere.
 */

/** Look-around: a slow pendulum sweep of the gaze. One full left-right
 * period ~17s; 0.16 rad of azimuth sweep is roughly +/-24 degrees of gaze
 * rotation at the ~7-unit standoff -- a head-turn around the interior
 * without ever centering a shell's arc edge. */
const YAW_SPEED = 0.37
const YAW_AMPLITUDE_RAD = 0.16
/** The yaw eases in over the first few seconds after mount (sin * ramp^2:
 * zero yaw AND zero yaw-velocity at t=0, so the scene opens still). */
const YAW_RAMP_SECONDS = 3

export function CameraRig({ lerpedRef }: CameraRigProps) {
  const { camera, size } = useThree()
  const lookAtTarget = useRef(new THREE.Vector3())
  const aspectRef = useRef(size.width / Math.max(1, size.height))
  aspectRef.current = size.width / Math.max(1, size.height)

  useFrame(({ clock }) => {
    const lerped = lerpedRef.current
    if (!lerped) return

    const t = clock.elapsedTime
    const ramp = Math.min(1, t / YAW_RAMP_SECONDS)
    const yawRad = Math.sin(t * YAW_SPEED) * YAW_AMPLITUDE_RAD * ramp * ramp

    const pose = computeCameraPose(
      'static-drift',
      0,
      lerped.camera.fov,
      t,
      DEFAULT_CAMERA_AZIMUTH_RAD,
      1, // permanently inside -- zoom never leaves the interior pose
      aspectRef.current,
      yawRad,
    )

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
