import { lerp } from './beatMath'

export type CameraBehavior = 'slow-orbit' | 'static-drift' | 'push-in' | 'pull-back'

export interface CameraPose {
  position: [number, number, number]
  lookAt: [number, number, number]
  fov: number
}

const ORBIT_RADIUS = 9
const ORBIT_HEIGHT = 2.6
/** slow-orbit swings +/- this many radians around its azimuth anchor (a pendulum, not a full circle, so the featured sector stays in frame). */
const ORBIT_SWING = 0.6
// Wide enough to read as true parallax: the 3D layers (crowd, string
// lights, particles) slide visibly against the flat card during the drift.
const DRIFT_AMPLITUDE_LATERAL = 1.5
const DRIFT_AMPLITUDE_Y = 0.25
const DRIFT_BASE_DISTANCE = 8
const DOLLY_FAR_DISTANCE = 11
const DOLLY_NEAR_DISTANCE = 5.5
const DOLLY_HEIGHT = 2
/** How far from the origin, toward the featured sector, the camera aims. */
const LOOKAT_BIAS = 2.2
const LOOKAT_HEIGHT = 1

// --- "inside the card" framing (zoom = 1) -----------------------------------
// Mid plates hang at radius ~19-20, sized ~18x10 with center ~4.2 up. A
// camera ~11 units in front of one fills the frame with the painting. That
// puts the zoomed camera at radius ~9 on the SECTOR side of the origin
// (the dolly crosses the scene), so the crane arc below lifts the travel
// over the crowd's heads instead of through them.
const CARD_RADIUS = 20
// The dwell frames the WHOLE card -- gold frame included -- like a
// photocard pressed on a table: the card comfortably inside the frame with
// its surroundings visible. Two levers make that reliable: distance (the
// pane is roughly square-ish, so the card's 18-unit WIDTH is the binding
// constraint, needing ~18 units of standoff) and a normalized dwell fov
// (each beat's lens, 45-56, is blended toward CARD_FOV as zoom settles, so
// the framing stops depending on which beat we arrived from).
const CARD_NEAR_DISTANCE = 18
const CARD_FOV = 55
const CARD_CENTER_Y = 4.0
/** Near-flat travel arc: the push-in is a straight axial dolly so the card
 * purely SCALES UP centered (the "scale match" read) -- just enough lift to
 * soften any pass through a crowd figure. */
const CRANE_ARC = 0.6
/** Behavior motion fully dies at zoom=1: the dwell frame is LOCKED -- the
 * camera moves between frames, never within them; all motion during a dwell
 * belongs to the painting itself (user feedback). */
const ZOOMED_MOTION_SCALE = 0

/**
 * The azimuth every pose faced before per-beat anchoring existed: the camera
 * sat on +z (polar angle 90 degrees) looking across the origin toward -z
 * (270 degrees). Passing this default reproduces the original framing.
 */
export const DEFAULT_CAMERA_AZIMUTH_RAD = (3 * Math.PI) / 2

function easeInOutCubicLocal(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2
}

/**
 * Shortest-arc interpolation between two angles in radians -- 350deg -> 10deg
 * travels +20deg through 0, not -340deg the long way round. Pure and exported
 * for tests; CameraRig uses it to ease the azimuth anchor across a beat
 * transition.
 */
export function lerpAngleRad(a: number, b: number, t: number): number {
  const TWO_PI = Math.PI * 2
  let delta = (b - a) % TWO_PI
  if (delta > Math.PI) delta -= TWO_PI
  if (delta < -Math.PI) delta += TWO_PI
  return a + delta * t
}

/** Point on the ground-plane circle at `angleRad` (scene polar convention: x = cos, z = sin). */
function polar(angleRad: number, radius: number): [number, number] {
  return [Math.cos(angleRad) * radius, Math.sin(angleRad) * radius]
}

/**
 * Pure function computing where the scripted camera should be this frame,
 * given its named behavior, a per-beat speed multiplier, seconds elapsed
 * since the *current behavior* became active, and the azimuth (radians) of
 * the world sector this beat features. Kept free of THREE/R3F so it's
 * directly unit testable; CameraRig.tsx calls this every useFrame tick and
 * applies the result to the real camera object.
 *
 * Azimuth anchoring is what lets each beat "paint a new picture" from one
 * persistent world: the camera stands on the opposite side of the origin
 * from the featured sector and aims toward it, so the set-piece that the
 * prose is describing fills the frame while unrelated sectors fall out of
 * view behind the camera. Every set-piece lives in its own angular sector,
 * so this needs no per-piece visibility choreography.
 *
 * `push-in`/`pull-back` are one-shot dolly moves that ease toward a bound and
 * hold; `slow-orbit` is a pendulum swing around the anchor (not a full
 * circle, which would face away from the subject half the time);
 * `static-drift` bobs gently in place.
 */
export function computeCameraPose(
  behavior: CameraBehavior,
  speed: number,
  fov: number,
  elapsedSeconds: number,
  azimuthRad: number = DEFAULT_CAMERA_AZIMUTH_RAD,
  zoom = 0,
): CameraPose {
  const safeSpeed = Number.isFinite(speed) ? Math.max(speed, 0) : 0
  const safeAzimuth = Number.isFinite(azimuthRad) ? azimuthRad : DEFAULT_CAMERA_AZIMUTH_RAD
  const safeZoom = Number.isFinite(zoom) ? Math.min(1, Math.max(0, zoom)) : 0
  // Camera stands opposite the featured sector...
  const cameraAzimuth = safeAzimuth + Math.PI
  // ...and aims at a point nudged from the origin toward the sector.
  const [lookX, lookZ] = polar(safeAzimuth, LOOKAT_BIAS)
  const lookAt: [number, number, number] = [lookX, LOOKAT_HEIGHT, lookZ]
  // The behavior's own motion attenuates (but never fully dies) as the
  // camera settles inside the card.
  const motionScale = 1 - safeZoom * (1 - ZOOMED_MOTION_SCALE)

  const basePose = ((): CameraPose => {
    switch (behavior) {
      case 'slow-orbit': {
        const swing = Math.sin(elapsedSeconds * safeSpeed * 0.9) * ORBIT_SWING * motionScale
        const [x, z] = polar(cameraAzimuth + swing, ORBIT_RADIUS)
        return { position: [x, ORBIT_HEIGHT, z], lookAt, fov }
      }
      case 'static-drift': {
        const [baseX, baseZ] = polar(cameraAzimuth, DRIFT_BASE_DISTANCE)
        // lateral bob along the tangent of the circle (perpendicular to the view axis)
        const lateral = Math.sin(elapsedSeconds * safeSpeed) * DRIFT_AMPLITUDE_LATERAL * motionScale
        const tangentX = -Math.sin(cameraAzimuth)
        const tangentZ = Math.cos(cameraAzimuth)
        const y = ORBIT_HEIGHT + Math.sin(elapsedSeconds * safeSpeed * 0.6) * DRIFT_AMPLITUDE_Y * motionScale
        return {
          position: [baseX + tangentX * lateral, y, baseZ + tangentZ * lateral],
          lookAt,
          fov,
        }
      }
      case 'push-in': {
        const progress = easeInOutCubicLocal(elapsedSeconds * safeSpeed * 0.2)
        const distance = lerp(DOLLY_FAR_DISTANCE, DOLLY_NEAR_DISTANCE, progress)
        const [x, z] = polar(cameraAzimuth, distance)
        return { position: [x, DOLLY_HEIGHT, z], lookAt, fov }
      }
      case 'pull-back': {
        const progress = easeInOutCubicLocal(elapsedSeconds * safeSpeed * 0.2)
        const distance = lerp(DOLLY_NEAR_DISTANCE, DOLLY_FAR_DISTANCE, progress)
        const [x, z] = polar(cameraAzimuth, distance)
        return { position: [x, DOLLY_HEIGHT, z], lookAt, fov }
      }
      default: {
        const exhaustiveCheck: never = behavior
        return exhaustiveCheck
      }
    }
  })()

  if (safeZoom === 0) return basePose

  // --- blend toward the "inside the card" framing ---------------------------
  // Zoomed position sits on the SECTOR side of the origin, CARD_NEAR_DISTANCE
  // in front of the mid plate; the crane arc lifts the travel over the crowd.
  const eased = easeInOutCubicLocal(safeZoom)
  const [nearX, nearZ] = polar(safeAzimuth, CARD_RADIUS - CARD_NEAR_DISTANCE)
  const crane = Math.sin(Math.PI * eased) * CRANE_ARC
  const [cardLookX, cardLookZ] = polar(safeAzimuth, CARD_RADIUS)
  return {
    position: [
      lerp(basePose.position[0], nearX, eased),
      lerp(basePose.position[1], CARD_CENTER_Y, eased) + crane,
      lerp(basePose.position[2], nearZ, eased),
    ],
    lookAt: [
      lerp(basePose.lookAt[0], cardLookX, eased),
      lerp(basePose.lookAt[1], CARD_CENTER_Y, eased),
      lerp(basePose.lookAt[2], cardLookZ, eased),
    ],
    fov: lerp(fov, CARD_FOV, eased),
  }
}
