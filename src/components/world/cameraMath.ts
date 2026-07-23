import { lerp } from './beatMath'

export type CameraBehavior = 'slow-orbit' | 'static-drift' | 'push-in' | 'pull-back'

export interface CameraPose {
  position: [number, number, number]
  lookAt: [number, number, number]
  fov: number
}

const ORBIT_RADIUS = 9
const ORBIT_HEIGHT = 2.6
const DRIFT_AMPLITUDE_X = 0.6
const DRIFT_AMPLITUDE_Y = 0.25
const DRIFT_BASE_DISTANCE = 8
const DOLLY_FAR_DISTANCE = 11
const DOLLY_NEAR_DISTANCE = 5.5
const DOLLY_HEIGHT = 2

function easeInOutCubicLocal(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2
}

/**
 * Pure function computing where the scripted camera should be this frame,
 * given its named behavior, a per-beat speed multiplier, and seconds elapsed
 * since the *current behavior* became active. Kept free of THREE/R3F so it's
 * directly unit testable; CameraRig.tsx calls this every useFrame tick and
 * applies the result to the real camera object.
 *
 * `push-in`/`pull-back` are one-shot dolly moves that ease toward a bound and
 * hold; `slow-orbit`/`static-drift` are continuous periodic motion.
 */
export function computeCameraPose(
  behavior: CameraBehavior,
  speed: number,
  fov: number,
  elapsedSeconds: number,
): CameraPose {
  const safeSpeed = Number.isFinite(speed) ? Math.max(speed, 0) : 0

  switch (behavior) {
    case 'slow-orbit': {
      const angle = elapsedSeconds * safeSpeed
      return {
        position: [Math.cos(angle) * ORBIT_RADIUS, ORBIT_HEIGHT, Math.sin(angle) * ORBIT_RADIUS],
        lookAt: [0, 1, 0],
        fov,
      }
    }
    case 'static-drift': {
      const x = Math.sin(elapsedSeconds * safeSpeed) * DRIFT_AMPLITUDE_X
      const y = ORBIT_HEIGHT + Math.sin(elapsedSeconds * safeSpeed * 0.6) * DRIFT_AMPLITUDE_Y
      return {
        position: [x, y, DRIFT_BASE_DISTANCE],
        lookAt: [0, 1, 0],
        fov,
      }
    }
    case 'push-in': {
      const progress = easeInOutCubicLocal(elapsedSeconds * safeSpeed * 0.2)
      const distance = lerp(DOLLY_FAR_DISTANCE, DOLLY_NEAR_DISTANCE, progress)
      return { position: [0, DOLLY_HEIGHT, distance], lookAt: [0, 1, 0], fov }
    }
    case 'pull-back': {
      const progress = easeInOutCubicLocal(elapsedSeconds * safeSpeed * 0.2)
      const distance = lerp(DOLLY_NEAR_DISTANCE, DOLLY_FAR_DISTANCE, progress)
      return { position: [0, DOLLY_HEIGHT, distance], lookAt: [0, 1, 0], fov }
    }
    default: {
      const exhaustiveCheck: never = behavior
      return exhaustiveCheck
    }
  }
}
