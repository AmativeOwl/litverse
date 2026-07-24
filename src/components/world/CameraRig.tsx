import { useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
import {
  computeCameraPose,
  DEFAULT_CAMERA_AZIMUTH_RAD,
  lerpAngleRad,
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
 * The shot cycle (user-specified): PARALLAX DRIFT wide -- the camera
 * tracks laterally so the 3D layers slide against the flat card -- then a
 * SNAP PUSH-IN (a fast, decisive axial dolly with an ease-out landing, the
 * card purely scaling up centered), then a SCALE-MATCHED LOCK: every card
 * lands on the identical framing (fixed distance + normalized CARD_FOV),
 * so consecutive cards read as matched cuts. Exit is a brisk damped
 * retreat, then the drift-glide to the next wall.
 * - PUSH_SECONDS: duration of the snap push-in (ease-out cubic).
 * - RETREAT_RATE: damped exit (~95% in ~2s).
 * - PAN: azimuth pursuit (~95% in ~6s), decoupled from the ~1s beat lerp.
 * Sequencing keys on remaining pan distance; same-sector card swaps have
 * zero pan distance, so the lock simply holds while plates crossfade.
 */
const PUSH_SECONDS = 0.7
const RETREAT_RATE = 1.4
const PAN_RATE = 0.5
const PAN_SETTLED_RAD = 0.15

type ShotPhase = 'wide' | 'push' | 'dwell' | 'retreat'

function easeOutCubic(u: number): number {
  const clamped = u < 0 ? 0 : u > 1 ? 1 : u
  return 1 - (1 - clamped) ** 3
}

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
  const lookAtTarget = useRef(new THREE.Vector3())
  // shot-choreography state -- mutated per frame, never React state
  const zoomRef = useRef(0)
  const azimuthRef = useRef<number | null>(null)
  const phaseRef = useRef<ShotPhase>('wide')
  const pushStartRef = useRef(0)

  useFrame(({ clock }, delta) => {
    const lerped = lerpedRef.current
    if (!lerped) return

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

    // --- the shot cycle: drift wide -> snap push -> locked dwell -> retreat --
    const settled = panError <= PAN_SETTLED_RAD
    switch (phaseRef.current) {
      case 'wide':
        zoomRef.current = 0
        if (settled) {
          phaseRef.current = 'push'
          pushStartRef.current = clock.elapsedTime
        }
        break
      case 'push': {
        if (!settled) {
          phaseRef.current = 'retreat'
          break
        }
        const u = (clock.elapsedTime - pushStartRef.current) / PUSH_SECONDS
        zoomRef.current = easeOutCubic(u) * ZOOM_DWELL
        if (u >= 1) {
          zoomRef.current = ZOOM_DWELL
          phaseRef.current = 'dwell'
        }
        break
      }
      case 'dwell':
        zoomRef.current = ZOOM_DWELL
        if (!settled) phaseRef.current = 'retreat'
        break
      case 'retreat':
        zoomRef.current += (0 - zoomRef.current) * (1 - Math.exp(-delta * RETREAT_RATE))
        if (zoomRef.current < 0.005) {
          zoomRef.current = 0
          phaseRef.current = 'wide'
        }
        break
    }

    // The wide pose is always the parallax drift -- a slow lateral track
    // that slides the 3D layers against the flat card. (Beat data's named
    // behaviors are superseded by the drift/snap/lock cycle.)
    const pose = computeCameraPose(
      'static-drift',
      lerped.camera.speed,
      lerped.camera.fov,
      clock.elapsedTime,
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
