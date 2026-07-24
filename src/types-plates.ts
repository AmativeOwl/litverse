import type { SceneBeat } from './types'

/**
 * Painted-plate types for the multiplane painted-world pivot (see CLAUDE.md,
 * "Painted-world pivot"). Deliberately a separate module from the frozen
 * `types.ts` contract, exactly like `types-motifs.ts`: plates are an
 * independently-evolvable authoring layer keyed by existing beat/sentence
 * ids, not a change to the core content shape.
 */

export type PlateLayer = 'far' | 'mid' | 'near'

/**
 * Paints one plate onto a 2D canvas. Receives the plate's own beat palette
 * (from scene-beats.json) so compositions are palette-parameterized -- the
 * same paint function produces a different painting for a different scene's
 * palette, which is what keeps the kit reusable across texts.
 *
 * `timeSeconds` (optional) makes a plate a *living painting*: the renderer
 * repaints active plates at ~12fps -- deliberately "on twos," the cel rate
 * of the golden-age animated shorts this look quotes -- passing elapsed
 * time. Static paint functions simply ignore the parameter; animated ones
 * derive small deterministic motion from it (flutter, twinkle, a turning
 * crank). Never use randomness at paint time -- derive everything from
 * `timeSeconds` so repaints are stable.
 */
export type PlatePaintFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: SceneBeat['palette'],
  timeSeconds?: number,
) => void

/**
 * Where a plate's pixels come from: a procedural paint function (the
 * default -- zero assets, palette-reactive), or a pre-rendered PNG under
 * public/ (the offline build-time image-gen fallback for plates where
 * procedural drawing falls short; same serving pattern as narration audio).
 */
export type PlateSource =
  | { kind: 'paint'; paint: PlatePaintFn }
  | { kind: 'png'; url: string }

export interface PlateDef {
  id: string
  layer: PlateLayer
  /** Angular sector (degrees, scene polar convention x=cos/z=sin) the plate hangs in -- matches the CameraRig azimuth anchor that faces it. */
  azimuthDeg: number
  /** Beats during which this plate is visible (vignetteVisibility crossfade on entry/exit). */
  memberBeatIds: readonly string[]
  source: PlateSource
  /** Distance from scene origin; defaults per layer (far 26 / mid 20 / near 13.5). */
  radius?: number
  /** Plane size in world units [width, height]; defaults per layer. */
  size?: readonly [number, number]
  /** Living painting: repaint this plate at ~12fps while visible, passing timeSeconds to its paint fn. Paint-source plates only. */
  animated?: boolean
}

/**
 * A 3-4 sentence "window" whose mid-plate depicts what those sentences
 * literally describe, crossfaded as narration crosses window boundaries.
 * Sentence-level gating -- permitted by the design constraints (only
 * word-level state is barred from the R3F subtree).
 */
export interface PlateWindow {
  id: string
  sentenceIds: readonly string[]
  plate: PlateDef
}

/**
 * Everything the painted world needs for one scene/text. THE reusability
 * seam: a new book gets a new ScenePlateSet data module; the renderer
 * (PaintedPlates.tsx) and kit (decoPlateKit.ts) never change.
 */
export interface ScenePlateSet {
  sceneId: string
  /** Per-beat camera azimuth anchors (degrees) -- consumed by CameraRig. */
  cameraAzimuthDeg: Record<string, number>
  plates: readonly PlateDef[]
  windows?: readonly PlateWindow[]
}
