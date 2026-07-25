import { useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { LerpedSceneBeat } from './beatMath'
import { DEFAULT_CAMERA_AZIMUTH_RAD, lerpAngleRad } from './cameraMath'

interface WorldTurntableProps {
  lerpedRef: RefObject<LerpedSceneBeat>
  /** Beat id -> sector azimuth degrees (the plate registry's cameraAzimuthDeg map, its name a relic of the camera-travel era). */
  azimuthByBeatDeg: Record<string, number>
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
 * Rotation.y = sectorAzimuth - viewAzimuth brings a plate hung at
 * `sectorAzimuth` around to the fixed view direction (rotating a group by
 * theta maps a child at azimuth A to azimuth A - theta). Damped shortest-arc
 * pursuit with a snap, same feel as the retired camera pan.
 */
const TURN_RATE = 0.5
/** Snap out the asymptotic tail -- a settled stage must actually be still. */
const TURN_SNAP_RAD = 0.002

export function WorldTurntable({ lerpedRef, azimuthByBeatDeg, children }: WorldTurntableProps) {
  const groupRef = useRef<Group>(null)
  const angleRef = useRef<number | null>(null)

  useFrame((_, delta) => {
    const lerped = lerpedRef.current
    const group = groupRef.current
    if (!lerped || !group) return
    const deg = azimuthByBeatDeg[lerped.toId]
    const sectorRad = deg === undefined ? DEFAULT_CAMERA_AZIMUTH_RAD : (deg * Math.PI) / 180
    const target = sectorRad - DEFAULT_CAMERA_AZIMUTH_RAD
    if (angleRef.current === null) angleRef.current = target // first frame: open already facing the first beat
    const error = Math.abs(
      Math.atan2(Math.sin(target - angleRef.current), Math.cos(target - angleRef.current)),
    )
    angleRef.current = lerpAngleRad(angleRef.current, target, 1 - Math.exp(-delta * TURN_RATE))
    if (error < TURN_SNAP_RAD) angleRef.current = target
    group.rotation.y = angleRef.current
  })

  return <group ref={groupRef}>{children}</group>
}
