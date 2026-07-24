import { useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
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
/**
 * The shot rhythm -- press in, watch, ease out, glide, press into the next
 * card (the user's "photocard" cadence). All damping rates are per-second:
 * - APPROACH: slow settle (~95% in ~7s), the push-in is part of the shot.
 * - RETREAT: an unhurried exit (~95% in ~3.5s), not a snap back.
 * - PAN: the camera's own azimuth pursuit (~95% in ~6s) -- deliberately
 *   DECOUPLED from the beat lerp's ~1s transitionDurationMs, which was far
 *   too fast for a camera move; palettes may snap moods quickly, the
 *   camera glides.
 * Sequencing is driven by remaining pan distance, not the beat clock: while
 * the camera still has more than PAN_SETTLED_RAD left to turn it stays
 * retreated; once the new wall is nearly ahead, the approach begins. Same-
 * sector card swaps have zero pan distance, so the dwell simply continues
 * while plates crossfade.
 */
const APPROACH_RATE = 0.45
const RETREAT_RATE = 0.9
const PAN_RATE = 0.5
const PAN_SETTLED_RAD = 0.15

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
  const azimuthRef = useRef<number | null>(null)

  useFrame(({ clock }, delta) => {
    const lerped = lerpedRef.current
    if (!lerped) return

    const behavior = lerped.camera.behavior
    if (behaviorRef.current !== behavior) {
      behaviorRef.current = behavior
      behaviorStartRef.current = clock.elapsedTime
    }

    // --- the camera's own pan: damped shortest-arc pursuit of the target ----
    const targetAzimuth = azimuthRadForBeat(azimuthByBeatDeg, lerped.toId)
    if (azimuthRef.current === null) azimuthRef.current = targetAzimuth
    const panError = Math.abs(
      Math.atan2(Math.sin(targetAzimuth - azimuthRef.current), Math.cos(targetAzimuth - azimuthRef.current)),
    )
    azimuthRef.current = lerpAngleRad(
      azimuthRef.current,
      targetAzimuth,
      1 - Math.exp(-delta * PAN_RATE),
    )
    // snap out the asymptotic tail -- a locked frame must actually lock
    if (panError < 0.002) azimuthRef.current = targetAzimuth
    const azimuthRad = azimuthRef.current

    // --- shot choreography: ease out while turning, press in on arrival -----
    const zoomTarget = panError > PAN_SETTLED_RAD ? 0 : ZOOM_DWELL
    const rate = zoomTarget < zoomRef.current ? RETREAT_RATE : APPROACH_RATE
    zoomRef.current += (zoomTarget - zoomRef.current) * (1 - Math.exp(-delta * rate))
    // same snap for the zoom: exponential damping never finishes on its own,
    // which read as perpetual creep during what should be a still frame
    if (zoomTarget === ZOOM_DWELL && zoomRef.current > 0.995) zoomRef.current = ZOOM_DWELL
    if (zoomTarget === 0 && zoomRef.current < 0.005) zoomRef.current = 0

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
