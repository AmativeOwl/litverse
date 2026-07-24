import { useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { easeInOutCubic, type LerpedSceneBeat } from './beatMath'
import {
  computeCameraPose,
  DEFAULT_CAMERA_AZIMUTH_RAD,
  lerpAngleRad,
  type CameraBehavior,
} from './cameraMath'

interface CameraRigProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Which part of the world each beat is *about*, as the azimuth (degrees, in
 * the scene's polar convention x = cos, z = sin) of the set-piece sector that
 * sentence's prose describes. The rig faces the camera toward this anchor, so
 * each beat frames its own vignette out of the one persistent world -- the
 * beach sentence looks at the waterfront, the weekend sentence at the cars --
 * instead of every beat re-lighting the same fixed view.
 *
 * Sector sources: DecoWaterfront raft 28deg, DecoOrchestra 80deg,
 * DecoEstateDetail colonnade 110-170deg, DecoBuffet 190-220deg, DecoBar
 * 235deg, DecoAutomobile 260-300deg, DecoFountain ~325deg.
 */
const BEAT_AZIMUTH_DEG: Record<string, number> = {
  'dusk-arrival': 325, // the garden tableau: fountain, skyline, first guests
  'daytime-leisure': 28, // "At high tide in the afternoon" -- raft, motorboats
  'weekend-traffic': 280, // "his Rolls-Royce became an omnibus" -- the drive
  'monday-lull': 140, // "eight servants... repairing the ravages" -- the house
  'evening-bar-setup': 222, // buffet tables + the bar being stocked
  'orchestra-tuning': 80, // "the orchestra has arrived" -- the bandstand
  'full-swing-cocktails': 235, // "the bar is in full swing"
  'dancing-under-lights': 80, // the canvas platform by the orchestra
}

function azimuthRadForBeat(beatId: string): number {
  const deg = BEAT_AZIMUTH_DEG[beatId]
  return deg === undefined ? DEFAULT_CAMERA_AZIMUTH_RAD : (deg * Math.PI) / 180
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
 *
 * The azimuth anchor eases along the shortest arc between the outgoing and
 * incoming beats' anchors during a transition (same eased-t treatment the
 * numeric beat fields get inside lerpSceneBeat), so the camera pans smoothly
 * from one vignette to the next instead of snapping.
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

    // LerpedSceneBeat.t is raw/pre-easing per its doc comment; ease it here
    // the same way lerpSceneBeat eases the numeric fields.
    const azimuthRad = lerpAngleRad(
      azimuthRadForBeat(lerped.fromId),
      azimuthRadForBeat(lerped.toId),
      easeInOutCubic(lerped.t),
    )

    const elapsedInBehavior = clock.elapsedTime - behaviorStartRef.current
    const pose = computeCameraPose(
      behavior,
      lerped.camera.speed,
      lerped.camera.fov,
      elapsedInBehavior,
      azimuthRad,
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
