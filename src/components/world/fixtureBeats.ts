import type { SceneBeat } from '../../types'

/**
 * Local Phase-1 test fixtures for WorldScene. Deliberately NOT imported from
 * `src/data/scene-beats.json` — that file is owned by the content track. The
 * shape/values below are patterned after its "arrival" / "peak-revelry"
 * beats for realism, but authored independently so this component has no
 * dependency on data outside its own ownership. Swapping these for the real
 * beat set (read via the store's `activeSceneBeatId`) is a Phase 2
 * integration step, not part of this track.
 */
export const FIXTURE_BEATS: Record<string, SceneBeat> = {
  arrival: {
    id: 'arrival',
    palette: {
      background: '#0b1026',
      primary: '#3a4a7a',
      accent: '#f4c98a',
      fog: '#12172e',
    },
    lighting: {
      ambientIntensity: 0.4,
      keyLightIntensity: 1.2,
      keyLightColor: '#f4c98a',
      bloomStrength: 0.6,
    },
    particles: {
      type: 'bokeh',
      density: 40,
      speed: 0.2,
      sizeRange: [0.05, 0.2],
    },
    camera: {
      behavior: 'static-drift',
      speed: 0.1,
      fov: 50,
    },
    silhouettes: {
      count: 14,
      animation: 'sway',
    },
    transitionDurationMs: 2000,
  },
  'peak-revelry': {
    id: 'peak-revelry',
    palette: {
      background: '#26102e',
      primary: '#7a3a63',
      accent: '#ffd15c',
      fog: '#2e1230',
    },
    lighting: {
      ambientIntensity: 0.55,
      keyLightIntensity: 1.8,
      keyLightColor: '#ffb347',
      bloomStrength: 1.1,
    },
    particles: {
      type: 'confetti',
      density: 110,
      speed: 0.9,
      sizeRange: [0.04, 0.16],
    },
    camera: {
      behavior: 'slow-orbit',
      speed: 0.18,
      fov: 55,
    },
    silhouettes: {
      count: 48,
      animation: 'sway',
    },
    transitionDurationMs: 2500,
  },
}

export const DEFAULT_BEAT_ID = 'arrival'

export function resolveFixtureBeat(activeSceneBeatId: string | null): SceneBeat {
  const beat = activeSceneBeatId ? FIXTURE_BEATS[activeSceneBeatId] : undefined
  return beat ?? FIXTURE_BEATS[DEFAULT_BEAT_ID]!
}
