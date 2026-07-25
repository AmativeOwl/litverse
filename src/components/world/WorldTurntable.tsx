import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { ScenePlateSet } from '../../types-plates'
import type { LerpedSceneBeat } from './beatMath'
import { DEFAULT_CAMERA_AZIMUTH_RAD, lerpAngleRad } from './cameraMath'
import { tileSlotAzimuths } from './decoPlateKit'

interface WorldTurntableProps {
  lerpedRef: RefObject<LerpedSceneBeat>
  plateSet: ScenePlateSet
  children: ReactNode
}

/**
 * The zoetrope stage: the viewer stands still, the ring of paintings turns.
 *
 * This inverts the camera-travel model (pan -> push -> dwell -> retreat)
 * that preceded it: the camera now NEVER moves -- it lives permanently
 * inside the cyclorama facing a fixed direction -- and beat transitions
 * instead rotate this group so the active beat's sector swings around to
 * face the viewer, paintings sliding past like a zoetrope drum. "The images
 * move, not me" (user direction; also the original cyclorama pitch --
 * perceptually identical to camera travel, mechanically simpler, and it
 * kills the wide-shot framing where half the frame was empty floor).
 *
 * Sectors hang at their retiled SLOT azimuths (tileSlotAzimuths -- the same
 * even spacing PaintedPlates cuts the shells to, so frames abut seamlessly);
 * the beat's authored azimuth is looked up through the same map here so the
 * drum always turns the right painting to the front. Rotation.y =
 * slotAzimuth - viewAzimuth brings a shell hung at `slotAzimuth` around to
 * the fixed view direction (rotating a group by theta maps a child at
 * azimuth A to azimuth A - theta). Damped shortest-arc pursuit with a snap,
 * same feel as the retired camera pan.
 */
const TURN_RATE = 0.5
/** Snap out the asymptotic tail -- a settled stage must actually be still. */
const TURN_SNAP_RAD = 0.002

/**
 * Per-frame angular speed of the drum (rad/s), written here every frame and
 * read by PaintedPlates -- module-level mutable per the established
 * per-frame-ref idiom, never React state. The living-painting repaint loop
 * pauses while the drum is visibly turning: a 12fps canvas repaint means a
 * GPU texture upload, and those uploads read as hitches ("ticks") exactly
 * when the eye is tracking smooth rotation. Frozen card animation during a
 * ~6s slide is imperceptible; the hitches were not.
 */
export const turntableMotion = { radPerSec: 0 }

export function WorldTurntable({ lerpedRef, plateSet, children }: WorldTurntableProps) {
  const groupRef = useRef<Group>(null)
  const angleRef = useRef<number | null>(null)

  // Same derivation as PaintedPlates, narrative-first (cameraAzimuthDeg key
  // order is the beat sequence): consecutive story beats sit in adjacent
  // slots, so this turntable advances one frame per beat -- sequential,
  // never sweeping across unrelated scenes to reach a far one.
  const slotByAuthoredDeg = useMemo(
    () =>
      tileSlotAzimuths([
        ...Object.values(plateSet.cameraAzimuthDeg),
        ...plateSet.plates.map((def) => def.azimuthDeg),
        ...(plateSet.windows ?? []).map((window) => window.plate.azimuthDeg),
      ]),
    [plateSet],
  )

  useFrame((_, delta) => {
    const lerped = lerpedRef.current
    const group = groupRef.current
    if (!lerped || !group) return
    const authoredDeg = plateSet.cameraAzimuthDeg[lerped.toId]
    const slotDeg = authoredDeg === undefined ? undefined : slotByAuthoredDeg.get(authoredDeg) ?? authoredDeg
    const sectorRad = slotDeg === undefined ? DEFAULT_CAMERA_AZIMUTH_RAD : (slotDeg * Math.PI) / 180
    const target = sectorRad - DEFAULT_CAMERA_AZIMUTH_RAD
    if (angleRef.current === null) angleRef.current = target // first frame: open already facing the first beat
    const error = Math.abs(
      Math.atan2(Math.sin(target - angleRef.current), Math.cos(target - angleRef.current)),
    )
    const previous = angleRef.current
    angleRef.current = lerpAngleRad(angleRef.current, target, 1 - Math.exp(-delta * TURN_RATE))
    if (error < TURN_SNAP_RAD) angleRef.current = target
    turntableMotion.radPerSec = delta > 0 ? Math.abs(angleRef.current - previous) / delta : 0
    group.rotation.y = angleRef.current
  })

  return <group ref={groupRef}>{children}</group>
}
