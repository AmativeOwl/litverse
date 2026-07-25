import type { CardSpec, ScenePlateSet } from '../../types-plates'
import type { SceneBeat } from '../../types'
import { composeCard } from '../../components/world/decoCardComposer'
import { darkenHex, drawBandedSky, lightenHex, mixHex } from '../../components/world/decoPlateKit'

type Palette = SceneBeat['palette']

/**
 * Painted-plate registry for Twenty Thousand Leagues Under the Seas -- the
 * third per-scene data module. Where Masque proved the grammar at scale
 * with five data mids, this registry goes all the way: EVERY mid is a
 * CardSpec composed through the closed noun/verb lexicon -- zero artisan
 * paint functions -- the exact shape the Phase-B compiler emits.
 *
 * Compiler laws honored in data: "two oblong openings" / "two crystal
 * plates" render as exactly TWO doors (numeric fidelity); the darkness card
 * is nearly empty -- the dark is the subject, and painting detail into it
 * would render what the text just extinguished.
 *
 * Sector map: seven beats in story order at even ~51.4 degree spacing
 * (rounded like Masque's clean 40s).
 */

// ---------------------------------------------------------------------------
// far plates
// ---------------------------------------------------------------------------

/** Brass-lit salon interior: warm banded wall, a row of dim ceiling globes. */
function paintSalonFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.76, [
    p.background,
    mixHex(p.background, p.primary, 0.35),
    mixHex(p.background, p.primary, 0.6),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.4)
  ctx.fillRect(0, h * 0.76, w, h * 0.24)
  // unpolished half-globes sunk in the ceiling volutes, evenly spaced
  ctx.fillStyle = lightenHex(p.accent, 0.15)
  for (let i = 0; i < 6; i++) {
    const cx = w * (0.09 + i * 0.165)
    ctx.globalAlpha = 0.75
    ctx.beginPath()
    ctx.arc(cx, h * 0.08, h * 0.03, 0, Math.PI)
    ctx.fill()
    // soft glow pool under each globe
    ctx.globalAlpha = 0.12
    ctx.beginPath()
    ctx.arc(cx, h * 0.16, h * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Open sea horizon for the hymn/freedom beats: banded sky over a swell line. */
function paintOpenSeaFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.6, [
    p.background,
    mixHex(p.background, p.primary, 0.3),
    mixHex(p.background, p.primary, 0.55),
  ])
  // the sea below the horizon, two darker bands
  ctx.fillStyle = mixHex(p.primary, p.background, 0.3)
  ctx.fillRect(0, h * 0.6, w, h * 0.2)
  ctx.fillStyle = darkenHex(p.primary, 0.3)
  ctx.fillRect(0, h * 0.8, w, h * 0.2)
  // horizon glints
  ctx.fillStyle = lightenHex(p.accent, 0.25)
  for (let i = 0; i < 30; i++) {
    ctx.globalAlpha = 0.15 + ((i * 43) % 10) / 22
    ctx.fillRect((i * 157) % w, h * (0.61 + ((i * 29) % 12) / 100), Math.max(2, w * 0.006), 1.6)
  }
  ctx.globalAlpha = 1
}

/**
 * Deep water for every submerged beat: dark banded depth with drifting
 * luminous specks -- palette-parameterized, so it reads void-black in the
 * darkness beat, gunmetal while the panels slide, electric in liquid light,
 * and clear blue in the abyss.
 */
function paintDeepWaterFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h, [
    darkenHex(p.background, 0.25),
    p.background,
    mixHex(p.background, p.primary, 0.4),
    mixHex(p.background, p.primary, 0.65),
  ])
  // suspended animalcule specks, denser toward the bottom bands
  ctx.fillStyle = lightenHex(p.accent, 0.3)
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.08 + ((i * 37) % 10) / 40
    ctx.fillRect((i * 149) % w, (i * 83) % h, 1.5, 1.5)
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// CardSpec mids -- every one pure data through the closed lexicon
// ---------------------------------------------------------------------------

/** lg-salon: the brass-lit dining salon -- lamps, the laden table, host and guest. */
const SALON_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.74,
  frame: false,
  elements: [
    { noun: 'brazier', at: [0.2, 0.9], size: 0.22, colorRole: 'accent', mirror: true },
    { noun: 'crate', at: [0.5, 0.9], size: 0.16, colorRole: 'primary' },
    { noun: 'ham', at: [0.5, 0.8], size: 0.08, colorRole: 'accent-light' },
    { noun: 'figure', at: [0.38, 0.93], size: 0.24, pose: 'stand', colorRole: 'shadow' },
    { noun: 'figure', at: [0.64, 0.93], size: 0.22, pose: 'serve', colorRole: 'primary-light' },
  ],
}

/** lg-sea-hymn: the sea as everything -- open swell, low sun, a small vessel crossing. */
const SEA_HYMN_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.62,
  frame: false,
  elements: [
    { noun: 'sun', at: [0.5, 0.3], size: 0.15, colorRole: 'accent', motion: { verb: 'breathe', amplitude: 0.25, speed: 0.35 } },
    { noun: 'waves', at: [0.5, 0.72], size: 0.26 },
    { noun: 'boat', at: [0.26, 0.64], size: 0.09, colorRole: 'shadow', motion: { verb: 'cross', loopSeconds: 30, amplitude: 0.5 } },
  ],
}

/** lg-freedom: "There I am free!" -- one figure against the vast water and early stars. */
const FREEDOM_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.68,
  frame: false,
  elements: [
    { noun: 'stars', at: [0.5, 0.3], size: 0.26 },
    { noun: 'waves', at: [0.5, 0.76], size: 0.24 },
    { noun: 'figure', at: [0.5, 0.7], size: 0.26, pose: 'stand', colorRole: 'accent', motion: { verb: 'sway', amplitude: 0.5, speed: 0.5 } },
  ],
}

/**
 * lg-darkness: the luminous ceiling dies. Nearly empty by law -- the text
 * just extinguished the light, so the card renders the dark itself: only a
 * few faint specks survive.
 */
const DARKNESS_CARD: CardSpec = {
  skyBands: 2,
  groundY: 0.85,
  frame: false,
  elements: [{ noun: 'stars', at: [0.5, 0.4], size: 0.16, colorRole: 'primary-light', motion: { verb: 'twinkle', speed: 0.4 } }],
}

/**
 * lg-panels: "panels were working at the sides" / "two oblong openings" /
 * "two crystal plates" -- exactly TWO doors (numeric fidelity), a lone
 * watcher between them.
 */
const PANELS_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.78,
  frame: false,
  elements: [
    { noun: 'door', at: [0.26, 0.76], size: 0.42, colorRole: 'primary-light' },
    { noun: 'door', at: [0.74, 0.76], size: 0.42, colorRole: 'primary-light' },
    { noun: 'figure', at: [0.5, 0.93], size: 0.24, pose: 'stand', colorRole: 'shadow' },
  ],
}

/** lg-liquid-light: the electric blaze through the panes -- the dark hull below, spray of brilliance, strung gleam. */
const LIQUID_LIGHT_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.7,
  frame: false,
  elements: [
    { noun: 'lights-strand', at: [0.5, 0.24], size: 0.1, colorRole: 'accent', motion: { verb: 'twinkle', speed: 1.2 } },
    { noun: 'waves', at: [0.5, 0.78], size: 0.26 },
    { noun: 'spray', at: [0.5, 0.62], size: 0.3, colorRole: 'accent-light', motion: { verb: 'burst', loopSeconds: 5, amplitude: 0.7 } },
    { noun: 'boat', at: [0.5, 0.88], size: 0.12, colorRole: 'shadow', motion: { verb: 'bob', amplitude: 0.25, speed: 0.4 } },
  ],
}

/** lg-abyss: the immense aquarium -- luminous field, slow water, two watchers at the glass. */
const ABYSS_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.72,
  frame: false,
  elements: [
    { noun: 'stars', at: [0.5, 0.34], size: 0.3, colorRole: 'accent-light', motion: { verb: 'twinkle', speed: 0.5 } },
    { noun: 'waves', at: [0.5, 0.8], size: 0.24 },
    { noun: 'figure', at: [0.4, 0.94], size: 0.22, pose: 'stand', colorRole: 'shadow' },
    { noun: 'figure', at: [0.6, 0.94], size: 0.2, pose: 'stand', colorRole: 'primary-light' },
  ],
}

// ---------------------------------------------------------------------------
// window cards
// ---------------------------------------------------------------------------

/** lg-p6-s3: "Two crystal plates separated us from the sea." -- the pair of panes, hero-scale. */
const CRYSTAL_PLATES_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.8,
  frame: false,
  elements: [
    { noun: 'door', at: [0.3, 0.78], size: 0.52, colorRole: 'accent-light' },
    { noun: 'door', at: [0.7, 0.78], size: 0.52, colorRole: 'accent-light' },
    { noun: 'spray', at: [0.5, 0.5], size: 0.2, colorRole: 'accent', motion: { verb: 'twinkle', speed: 0.8 } },
  ],
}

/** lg-p9-s2: "as if this pure crystal had been the glass of an immense aquarium" -- watchers dwarfed at the glass. */
const AQUARIUM_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.76,
  frame: false,
  elements: [
    { noun: 'door', at: [0.5, 0.74], size: 0.6, colorRole: 'accent-light' },
    { noun: 'stars', at: [0.5, 0.3], size: 0.24, colorRole: 'accent', motion: { verb: 'twinkle', speed: 0.5 } },
    { noun: 'figure', at: [0.34, 0.94], size: 0.2, pose: 'stand', colorRole: 'shadow' },
    { noun: 'figure', at: [0.62, 0.94], size: 0.18, pose: 'stand', colorRole: 'shadow' },
  ],
}

// ---------------------------------------------------------------------------
// the registry
// ---------------------------------------------------------------------------

export const LEAGUES_PLATES: ScenePlateSet = {
  sceneId: 'leagues',
  cameraAzimuthDeg: {
    'lg-salon': 0,
    'lg-sea-hymn': 51,
    'lg-freedom': 103,
    'lg-darkness': 154,
    'lg-panels': 206,
    'lg-liquid-light': 257,
    'lg-abyss': 309,
  },
  plates: [
    // --- lg-salon (0) ---
    { id: 'lg-far-salon-0', layer: 'far', azimuthDeg: 0, memberBeatIds: ['lg-salon'], source: { kind: 'paint', paint: paintSalonFar } },
    { id: 'lg-mid-salon', layer: 'mid', azimuthDeg: 0, memberBeatIds: ['lg-salon'], animated: true, source: { kind: 'paint', paint: composeCard(SALON_CARD) } },
    // --- lg-sea-hymn (51) ---
    { id: 'lg-far-sea-51', layer: 'far', azimuthDeg: 51, memberBeatIds: ['lg-sea-hymn'], source: { kind: 'paint', paint: paintOpenSeaFar } },
    { id: 'lg-mid-sea-hymn', layer: 'mid', azimuthDeg: 51, memberBeatIds: ['lg-sea-hymn'], animated: true, source: { kind: 'paint', paint: composeCard(SEA_HYMN_CARD) } },
    // --- lg-freedom (103) ---
    { id: 'lg-far-sea-103', layer: 'far', azimuthDeg: 103, memberBeatIds: ['lg-freedom'], source: { kind: 'paint', paint: paintOpenSeaFar } },
    { id: 'lg-mid-freedom', layer: 'mid', azimuthDeg: 103, memberBeatIds: ['lg-freedom'], animated: true, source: { kind: 'paint', paint: composeCard(FREEDOM_CARD) } },
    // --- lg-darkness (154) ---
    { id: 'lg-far-deep-154', layer: 'far', azimuthDeg: 154, memberBeatIds: ['lg-darkness'], source: { kind: 'paint', paint: paintDeepWaterFar } },
    { id: 'lg-mid-darkness', layer: 'mid', azimuthDeg: 154, memberBeatIds: ['lg-darkness'], animated: true, source: { kind: 'paint', paint: composeCard(DARKNESS_CARD) } },
    // --- lg-panels (206) ---
    { id: 'lg-far-deep-206', layer: 'far', azimuthDeg: 206, memberBeatIds: ['lg-panels'], source: { kind: 'paint', paint: paintDeepWaterFar } },
    { id: 'lg-mid-panels', layer: 'mid', azimuthDeg: 206, memberBeatIds: ['lg-panels'], animated: true, source: { kind: 'paint', paint: composeCard(PANELS_CARD) } },
    // --- lg-liquid-light (257) ---
    { id: 'lg-far-deep-257', layer: 'far', azimuthDeg: 257, memberBeatIds: ['lg-liquid-light'], source: { kind: 'paint', paint: paintDeepWaterFar } },
    { id: 'lg-mid-liquid-light', layer: 'mid', azimuthDeg: 257, memberBeatIds: ['lg-liquid-light'], animated: true, source: { kind: 'paint', paint: composeCard(LIQUID_LIGHT_CARD) } },
    // --- lg-abyss (309) ---
    { id: 'lg-far-deep-309', layer: 'far', azimuthDeg: 309, memberBeatIds: ['lg-abyss'], source: { kind: 'paint', paint: paintDeepWaterFar } },
    { id: 'lg-mid-abyss', layer: 'mid', azimuthDeg: 309, memberBeatIds: ['lg-abyss'], animated: true, source: { kind: 'paint', paint: composeCard(ABYSS_CARD) } },
  ],
  windows: [
    {
      id: 'lg-w-crystal-plates',
      sentenceIds: ['lg-p6-s3'], // Two crystal plates separated us from the sea.
      plate: {
        id: 'lg-win-crystal-plates',
        layer: 'mid',
        azimuthDeg: 257, // lg-liquid-light sector
        memberBeatIds: ['lg-liquid-light'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: composeCard(CRYSTAL_PLATES_CARD) },
      },
    },
    {
      id: 'lg-w-aquarium',
      sentenceIds: ['lg-p9-s2'], // the glass of an immense aquarium
      plate: {
        id: 'lg-win-aquarium',
        layer: 'mid',
        azimuthDeg: 309, // lg-abyss sector
        memberBeatIds: ['lg-abyss'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: composeCard(AQUARIUM_CARD) },
      },
    },
  ],
}
