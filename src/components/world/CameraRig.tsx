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
  /**
   * Identity of the card currently on stage: the active window id when a
   * sentence window is up, else the active beat id. Drives the shot
   * choreography -- on arrival the camera cranes over the crowd and dollies
   * INTO the card until the painting fills the frame, dwells there with a
   * whisper of float, pulls back when the card changes, and (for a new
   * sector) pans before pushing into the next one. Same-sector card swaps
   * get a partial retreat-and-return pulse rather than a full pull-out.
   */
  activeCardKey: string
}

/** Full zoom while dwelling inside a card. */
const ZOOM_DWELL = 1
/** Retreat depth for a same-sector card swap -- a punctuation pulse, not a full pull-out. */
const ZOOM_PULSE = 0.35
/** Seconds the pulse holds before re-approaching. */
const PULSE_SECONDS = 1.1
/** Damping rates (per second): the approach is a slow cinematic settle
 * (~95% in roughly 7s -- most of a sentence's narration, so the push-in
 * itself is part of the shot, per user feedback that faster zooms rushed
 * it), the retreat brisker but still unhurried. */
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
export function CameraRig({ lerpedRef, azimuthByBeatDeg, activeCardKey }: CameraRigProps) {
  const { camera } = useThree()
  const behaviorRef = useRef<CameraBehavior | null>(null)
  const behaviorStartRef = useRef(0)
  const lookAtTarget = useRef(new THREE.Vector3())
  // shot-choreography state -- mutated per frame, never React state
  const zoomRef = useRef(0)
  const cardKeyRef = useRef(activeCardKey)
  const pulseRemainingRef = useRef(0)
  // mirror the prop into a ref so the useFrame closure stays fresh
  const activeCardKeyRef = useRef(activeCardKey)
  activeCardKeyRef.current = activeCardKey

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
    const cardKey = activeCardKeyRef.current
    if (cardKey !== cardKeyRef.current) {
      cardKeyRef.current = cardKey
      // a new card in the same sector: partial retreat, then re-approach
      pulseRemainingRef.current = PULSE_SECONDS
    }
    if (pulseRemainingRef.current > 0) pulseRemainingRef.current -= delta

    const beatTransitioning = lerped.fromId !== lerped.toId && lerped.t < 1
    const zoomTarget = beatTransitioning ? 0 : pulseRemainingRef.current > 0 ? ZOOM_PULSE : ZOOM_DWELL
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
