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

// ---------------------------------------------------------------------------
// The card grammar: nouns as objects, verbs as movements.
//
// A CardSpec is a fully DATA-driven animated card: the compiler mines a
// sentence's nouns into `ObjectNoun`s (the drawing kit's object lexicon) and
// its verbs into `MotionVerb`s (the motion library's closed verb lexicon --
// "scampered" -> 'weave', "toiled" -> 'scrub', "diving" -> 'dive'), and
// `decoCardComposer.ts` interprets the spec into a living painting. This is
// what makes the pipeline text-agnostic: a new book compiles to specs, not
// to hand-written paint functions (which remain the artisan tier for hero
// cards). A text demanding a genuinely new noun/verb extends the shared
// lexicons -- benefiting every text after it.
// ---------------------------------------------------------------------------

export type MotionVerb =
  | 'still'
  | 'sway' // gentle side-to-side, standing figures / hanging things
  | 'bob' // small vertical rhythm, walking / floating
  | 'weave' // travel across the frame on a serpentine line (the scampering car)
  | 'cross' // travel straight across the frame on a loop (a boat, a walker)
  | 'pace' // walk back and forth over a short range
  | 'scrub' // short quick horizontal strokes in place (mopping, polishing)
  | 'dive' // the leap arc: poise, parabola with rotation, then reset
  | 'rise' // drift upward on a loop, fading (bubbles, smoke, notes)
  | 'fall' // drift downward on a loop, fading (drips, leaves, confetti)
  | 'twinkle' // alpha shimmer in place (lights, stars)
  | 'breathe' // slow scale pulse (a glow, a spotlight)
  | 'flutter' // rapid small rotation jitter (moths, flags)
  | 'orbit' // small elliptical loop around the anchor point
  | 'burst' // radial expansion cycle: appear, expand, fade (splash, sparkle)
  | 'glide' // travel a slow sine path across the frame (the weaving dancer)
  | 'bounce' // cartoon hop with squash-and-stretch at the impact (rubber-hose era)

export interface MotionSpec {
  verb: MotionVerb
  /** Cycles-per-second-ish rate multiplier; 1 = the verb's natural pace. */
  speed?: number
  /** Displacement scale as a fraction of plate height; 1 = the verb's natural amplitude. */
  amplitude?: number
  /** Loop length in seconds for traveling/cyclic verbs (weave, cross, dive, burst...). */
  loopSeconds?: number
  /** Phase offset so identical verbs on sibling elements don't move in lockstep. */
  phase?: number
  /** For traveling verbs: destination [xFrac, yFrac] (start is the element's `at`). */
  toward?: readonly [number, number]
}

export type ObjectNoun =
  | 'figure' // silhouette person (pose via `pose`)
  | 'car'
  | 'boat'
  | 'crate'
  | 'door'
  | 'fruit-pyramid'
  | 'juice-machine'
  | 'ham'
  | 'turkey'
  | 'pastry-row'
  | 'lights-strand'
  | 'ziggurat'
  | 'sun'
  | 'waves'
  | 'stars'
  | 'spray' // upward fan of spray/sparks (fountain, splash source)

export interface ElementSpec {
  noun: ObjectNoun
  /** Anchor position as fractions of the plate [x, y]. */
  at: readonly [number, number]
  /** Element size as a fraction of plate height (each noun scales sensibly from it). */
  size?: number
  /** Figures only. */
  pose?: 'stand' | 'dance' | 'serve' | 'mop' | 'horn'
  /** Palette role driving the element's color. */
  colorRole?: 'accent' | 'accent-light' | 'primary' | 'primary-light' | 'shadow'
  /** Draw this element and its mirror twin (the reference posters' symmetry). */
  mirror?: boolean
  motion?: MotionSpec
}

export interface CardSpec {
  /** How many flat sky bands to lay down (palette-derived). */
  skyBands?: number
  /** Ground line as a fraction of plate height (default 0.66). */
  groundY?: number
  /** Draw the deco poster frame (default true). */
  frame?: boolean
  elements: readonly ElementSpec[]
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
