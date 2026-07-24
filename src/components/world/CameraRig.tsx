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
  /**
   * Which part of the world each beat is *about*: beat id -> azimuth degrees
   * (scene polar convention x = cos, z = sin) of the sector that sentence's
   * prose describes. The rig faces the camera toward this anchor, so each
   * beat frames its own vignette -- the beach sentence looks at the
   * waterfront plate, the weekend sentence at the cars. Sourced from the
   * per-scene plate registry (ScenePlateSet.cameraAzimuthDeg) so the camera
   * and the paintings always agree; beats missing from the map fall back to
   * the original fixed framing.
   */
  azimuthByBeatDeg: Record<string, number>
}

/** Full zoom while dwelling at a card. */
const ZOOM_DWELL = 1
/** Damping rates (per second): the approach is a slow cinematic settle
 * (~95% in roughly 7s -- most of a sentence's narration, so the push-in
 * itself is part of the shot, per user feedback that faster zooms rushed
 * it), the retreat brisker but still unhurried. Same-sector card swaps do
 * NOT move the camera at all -- consecutive sentences on the same sector
 * simply crossfade their plates while the camera keeps dwelling (user
 * feedback: no zoom-out/in between cards that share a wall). */
const APPROACH_RATE = 0.45
const RETREAT_RATE = 1.8

function azimuthRadForBeat(azimuthByBeatDeg: Record<string, number>, beatId: string): number {
  const deg = azimuthByBeatDeg[beatId]
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
export function CameraRig({ lerpedRef, azimuthByBeatDeg }: CameraRigProps) {
  const { camera } = useThree()
  const behaviorRef = useRef<CameraBehavior | null>(null)
  const behaviorStartRef = useRef(0)
  const lookAtTarget = useRef(new THREE.Vector3())
  // shot-choreography state -- mutated per frame, never React state
  const zoomRef = useRef(0)

  useFrame(({ clock }, delta) => {
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
      azimuthRadForBeat(azimuthByBeatDeg, lerped.fromId),
      azimuthRadForBeat(azimuthByBeatDeg, lerped.toId),
      easeInOutCubic(lerped.t),
    )

    // --- shot choreography: approach / dwell / retreat -----------------------
    // Retreat only for actual sector moves (beat transitions); same-sector
    // card swaps keep dwelling while the plates crossfade.
    const beatTransitioning = lerped.fromId !== lerped.toId && lerped.t < 1
    const zoomTarget = beatTransitioning ? 0 : ZOOM_DWELL
    const rate = zoomTarget < zoomRef.current ? RETREAT_RATE : APPROACH_RATE
    zoomRef.current += (zoomTarget - zoomRef.current) * (1 - Math.exp(-delta * rate))

    const elapsedInBehavior = clock.elapsedTime - behaviorStartRef.current
    const pose = computeCameraPose(
      behavior,
      lerped.camera.speed,
      lerped.camera.fov,
      elapsedInBehavior,
      azimuthRad,
      zoomRef.current,
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
