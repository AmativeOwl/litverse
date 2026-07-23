import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { SceneBeat } from '../../types'
import { computeTransitionProgress, lerpSceneBeat, type LerpedSceneBeat } from './beatMath'

interface TransitionState {
  from: SceneBeat
  to: SceneBeat
  startMs: number
}

/** Builds a pseudo-`SceneBeat` snapshot of "wherever the lerp currently is", so that
 * interrupting an in-flight transition (beat changes again before the previous
 * transition finished) blends onward from the current on-screen state instead of
 * jumping back to the fully-settled previous beat. */
function snapshotAsBeat(id: string, lerped: LerpedSceneBeat, silhouettes: SceneBeat['silhouettes']): SceneBeat {
  return {
    id,
    palette: lerped.palette,
    lighting: lerped.lighting,
    particles: lerped.particles,
    camera: lerped.camera,
    silhouettes: silhouettes ? { ...silhouettes, count: lerped.silhouetteCount } : undefined,
    transitionDurationMs: 0,
  }
}

/**
 * Interpolates every numeric/color field of the active `SceneBeat` on every
 * animation frame via `useFrame`, honoring `transitionDurationMs`. Returns a
 * stable ref object (never a piece of React state) that per-frame consumers
 * (lights, fog, floor, particles, silhouettes, camera rig) read inside their
 * own `useFrame` callbacks and apply imperatively to their three.js objects.
 *
 * Must be called from a component rendered inside a react-three-fiber
 * `<Canvas>` (it uses `useFrame`).
 */
export function useLerpedSceneBeat(targetBeat: SceneBeat): RefObject<LerpedSceneBeat> {
  const transitionRef = useRef<TransitionState>({
    from: targetBeat,
    to: targetBeat,
    startMs: 0,
  })
  const lerpedRef = useRef<LerpedSceneBeat>(lerpSceneBeat(targetBeat, targetBeat, 1))
  const prevIdRef = useRef(targetBeat.id)

  // Beat-level state change (activeSceneBeatId) is exactly what's allowed to
  // trigger a re-render here; this effect only *starts* a transition, it
  // never drives the per-frame animation itself.
  useEffect(() => {
    if (targetBeat.id === prevIdRef.current) return
    const inFlightSnapshot = snapshotAsBeat(prevIdRef.current, lerpedRef.current, transitionRef.current.to.silhouettes)
    transitionRef.current = { from: inFlightSnapshot, to: targetBeat, startMs: performance.now() }
    prevIdRef.current = targetBeat.id
  }, [targetBeat])

  useFrame(() => {
    const { from, to, startMs } = transitionRef.current
    const progress = computeTransitionProgress(startMs, performance.now(), to.transitionDurationMs)
    lerpedRef.current = lerpSceneBeat(from, to, progress)
  })

  return lerpedRef
}
