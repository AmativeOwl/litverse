import type { ScenePlateSet } from '../../types-plates'

/**
 * Painted-plate registry for the Gatsby Ch.3 party scene -- THE per-scene
 * data module of the painted-world pivot (see CLAUDE.md). A future text gets
 * its own file with this exact shape; the renderer (PaintedPlates.tsx) and
 * drawing kit (decoPlateKit.ts) stay untouched.
 *
 * `cameraAzimuthDeg` is the single source of truth for which world sector
 * each beat faces (consumed by CameraRig); every plate's `azimuthDeg`
 * matches its beats' entry here so the camera anchor and the painting agree.
 *
 * Sector map (degrees, scene polar convention x=cos/z=sin), inherited from
 * the set-piece era so motif positions remain meaningful: waterfront 28,
 * orchestra/canvas-platform 80, estate 140, buffet 205-222, bar 235,
 * drive/cars 280, fountain court 325.
 */
export const GATSBY_PLATES: ScenePlateSet = {
  sceneId: 'gatsby-ch3',
  cameraAzimuthDeg: {
    'dusk-arrival': 325,
    'daytime-leisure': 28,
    'weekend-traffic': 280,
    'monday-lull': 140,
    'evening-bar-setup': 222,
    'orchestra-tuning': 80,
    'full-swing-cocktails': 235,
    'dancing-under-lights': 80,
  },
  // Populated beat-by-beat as the pivot lands (flagships first: dusk-arrival,
  // orchestra-tuning, dancing-under-lights), then the 3-4-sentence windows.
  plates: [],
  windows: [],
}
