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
const DRIFT_AMPLITUDE_LATERAL = 0.6
const DRIFT_AMPLITUDE_Y = 0.25
const DRIFT_BASE_DISTANCE = 8
const DOLLY_FAR_DISTANCE = 11
const DOLLY_NEAR_DISTANCE = 5.5
const DOLLY_HEIGHT = 2
/** How far from the origin, toward the featured sector, the camera aims. */
const LOOKAT_BIAS = 2.2
const LOOKAT_HEIGHT = 1

// --- "inside the card" framing (zoom = 1): the cyclorama dwell --------------
// Since the cyclorama pivot (see CLAUDE.md "immersive cyclorama + cinema
// mode"), cards are curved cylindrical shells wrapped around the scene
// origin, painted on their INSIDE face. The push is no longer a photocard
// standoff -- it is a THRESHOLD CROSSING: the camera travels across the
// origin to stand inside the shell's embrace on the sector side, where the
// painting wraps into peripheral vision. The dwell then looks slowly around
// (`dwellYawRad`, driven by CameraRig) instead of holding a locked frame --
// the camera still never moves *positionally* within a frame.
const CARD_RADIUS = 20
/**
 * How far from the origin, toward the sector, the camera stands while
 * inside the card -- the "you are IN the painting" lever, tuned twice by
 * user feedback: 4 read as watching a screen from a seat; 13 (7 units off
 * the wall) overflowed the frame so much the composition couldn't be read
 * whole. 9 is the split: ~11 units off the mid shell, the painting's full
 * 10-unit height just fills the frame at the ~51-degree half-pane lens, so
 * you see the whole scene while its neighbors connect at the frame edges
 * and the surround stays painted in every direction.
 */
const DWELL_RADIUS = 9
const CARD_CENTER_Y = 4.0
/** Travel arc: a gentle crane lift over the scene center during the crossing
 * -- pure axial travel read as flat; the lift gives the threshold a small
 * "stepping over" cadence. */
const CRANE_ARC = 1.2
/** Behavior motion fully dies at zoom=1: the dwell position is LOCKED -- the
 * camera's only in-frame motion is the slow look-around yaw; positional
 * motion belongs to the travel between frames (user feedback). */
const ZOOMED_MOTION_SCALE = 0

// --- aspect-aware dwell lens -------------------------------------------------
// The one real math task of the cinema-mode pivot: the old CARD_FOV=55
// constant assumed the ~1.2 half-pane aspect. Inside the shell, what must
// stay constant across aspects is the HORIZONTAL field -- how much of the
// arc wraps the view -- because the shell has no hard top/bottom story but
// does have arc edges. So the dwell derives a vertical fov from a target
// horizontal field via the standard hfov/vfov relation, clamped so extreme
// panes can neither tunnel-vision nor fisheye.
// 54 rather than the initial 60: at the half-pane aspect (~1.2) this
// derives ~46 degrees vertical, which keeps the frame's vertical span
// (y 4 +/- 11*tan(23deg) = -0.7..8.7) just inside the mid card's painted
// -0.8..9.2 -- at 60 the lens overshot the card's edges and the backdrop
// ring showed through as a horizontal bar cutting across compositions.
const DWELL_TARGET_HFOV_DEG = 54
const DWELL_FOV_MIN_DEG = 34
const DWELL_FOV_MAX_DEG = 60

/**
 * Vertical fov (degrees) that yields DWELL_TARGET_HFOV_DEG of horizontal
 * field at the given viewport aspect (width/height). Wider panes get a
 * narrower vertical fov so the horizontal wrap stays constant; the clamp
 * keeps tall/narrow panes from blowing past the comfortable wide-angle
 * range. Pure and exported for tests.
 */
export function dwellFovForAspect(aspect: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1.2
  const halfHfovRad = ((DWELL_TARGET_HFOV_DEG / 2) * Math.PI) / 180
  const vfovDeg = (2 * Math.atan(Math.tan(halfHfovRad) / safeAspect) * 180) / Math.PI
  return Math.min(DWELL_FOV_MAX_DEG, Math.max(DWELL_FOV_MIN_DEG, vfovDeg))
}

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
  aspect = 1.2,
  dwellYawRad = 0,
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

  // --- blend toward the interior (cyclorama) dwell ---------------------------
  // Zoomed position stands INSIDE the shell's embrace, DWELL_RADIUS out from
  // the origin on the sector side -- the threshold crossing travels across
  // the scene center with a gentle crane lift. The dwell gaze aims at the
  // shell surface, swept by `dwellYawRad` for the slow look-around (yaw only
  // reaches full strength as the crossing completes, so mid-travel frames
  // stay aimed at the destination).
  const eased = easeInOutCubicLocal(safeZoom)
  const [nearX, nearZ] = polar(safeAzimuth, DWELL_RADIUS)
  const crane = Math.sin(Math.PI * eased) * CRANE_ARC
  const [cardLookX, cardLookZ] = polar(safeAzimuth + dwellYawRad * eased, CARD_RADIUS)
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
    fov: lerp(fov, dwellFovForAspect(aspect), eased),
  }
}
