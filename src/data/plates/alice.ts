import type { CardSpec, ScenePlateSet } from '../../types-plates'
import type { SceneBeat } from '../../types'
import { composeCard } from '../../components/world/decoCardComposer'
import { darkenHex, drawBandedSky, lightenHex, mixHex } from '../../components/world/decoPlateKit'

type Palette = SceneBeat['palette']

/**
 * Painted-plate registry for Alice's Adventures in Wonderland (the
 * rabbit-hole excerpt) -- the third per-scene data module. All six beat
 * mids are pure CardSpec data composed through the closed noun/verb
 * grammar (the compiler-emitted shape); the only hand-written paint here
 * is the pair of palette-parameterized far painters (meadow, well shaft).
 *
 * Compiler laws honored in data: TWO figures on the riverbank (Alice and
 * her sister -- the text seats exactly two), ONE small crossing figure for
 * the White Rabbit (one rabbit), and the falling/musing cards keep a single
 * falling figure (one Alice in the well).
 *
 * Sector map: six beats at clean 60-degree spacing, story order.
 */

// ---------------------------------------------------------------------------
// far plates
// ---------------------------------------------------------------------------

/** Daylight meadow: banded sky over a soft ground band, sparse daisy flecks. */
function paintMeadowFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.7, [
    p.background,
    mixHex(p.background, p.primary, 0.35),
    mixHex(p.background, p.primary, 0.6),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.3)
  ctx.fillRect(0, h * 0.7, w, h * 0.3)
  // a second, nearer meadow swell
  ctx.fillStyle = darkenHex(p.primary, 0.45)
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 1.06, w * 0.62, h * 0.3, 0, Math.PI, 0)
  ctx.fill()
  // daisy flecks strewn on the banks
  ctx.fillStyle = lightenHex(p.accent, 0.35)
  for (let i = 0; i < 34; i++) {
    ctx.globalAlpha = 0.25 + ((i * 37) % 10) / 18
    ctx.fillRect((i * 149) % w, h * (0.72 + ((i * 61) % 24) / 100), 2, 2)
  }
  ctx.globalAlpha = 1
}

/**
 * Inside the well: near-dark vertical shaft walls with faint brick seams
 * and drifting glints -- palette-parameterized so it reads earthen in the
 * burrow, indigo mid-fall, marmalade-warm at the cupboards, violet while
 * musing.
 */
function paintWellFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h, [
    darkenHex(p.background, 0.3),
    p.background,
    mixHex(p.background, p.primary, 0.4),
    darkenHex(p.background, 0.2),
  ])
  // vertical shaft seams
  ctx.strokeStyle = darkenHex(p.background, 0.45)
  ctx.lineWidth = Math.max(1.2, h * 0.006)
  for (let i = 0; i < 10; i++) {
    ctx.beginPath()
    ctx.moveTo(w * (0.05 + i * 0.1), 0)
    ctx.lineTo(w * (0.05 + i * 0.1), h)
    ctx.stroke()
  }
  // brick courses, sparse
  ctx.strokeStyle = mixHex(p.background, p.primary, 0.25)
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.moveTo(0, h * (0.12 + i * 0.15))
    ctx.lineTo(w, h * (0.12 + i * 0.15))
    ctx.stroke()
  }
  // drifting glints
  ctx.fillStyle = lightenHex(p.accent, 0.3)
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.18 + ((i * 41) % 10) / 20
    ctx.fillRect((i * 137) % w, (i * 83) % h, 1.6, 1.6)
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// CardSpec mids -- pure data, interpreted by decoCardComposer
// ---------------------------------------------------------------------------

/** al-riverbank: the bank, the river, and exactly TWO figures (Alice and her sister with the pictureless book). */
const RIVERBANK_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.68,
  elements: [
    { noun: 'sun', at: [0.74, 0.2], size: 0.14, motion: { verb: 'breathe', amplitude: 0.3, speed: 0.35 } },
    { noun: 'waves', at: [0.5, 0.78], size: 0.22 },
    { noun: 'figure', at: [0.28, 0.93], size: 0.21, pose: 'stand', colorRole: 'shadow' },
    { noun: 'figure', at: [0.38, 0.93], size: 0.18, pose: 'stand', colorRole: 'primary-light' },
  ],
}

/**
 * al-white-rabbit: ONE small pale figure dashing across the meadow (one
 * rabbit -- numeric fidelity), a startled Alice, and the waistcoat watch
 * as a small clock by the hedge.
 */
const WHITE_RABBIT_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.7,
  elements: [
    { noun: 'sun', at: [0.16, 0.22], size: 0.12 },
    { noun: 'figure', at: [0.34, 0.92], size: 0.22, pose: 'stand', colorRole: 'shadow' },
    {
      noun: 'figure',
      at: [0.12, 0.94],
      size: 0.12,
      pose: 'dance',
      colorRole: 'accent-light',
      motion: { verb: 'cross', loopSeconds: 7, amplitude: 0.6, toward: [0.9, 0.94] },
    },
    { noun: 'clock', at: [0.78, 0.94], size: 0.22, colorRole: 'accent' },
  ],
}

/** al-rabbit-hole: the dark door under the hedge and Alice diving after, never once considering. */
const RABBIT_HOLE_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.72,
  elements: [
    { noun: 'door', at: [0.64, 0.9], size: 0.3, colorRole: 'shadow' },
    {
      noun: 'figure',
      at: [0.3, 0.86],
      size: 0.22,
      pose: 'dance',
      colorRole: 'primary-light',
      motion: { verb: 'dive', loopSeconds: 6, amplitude: 0.8, toward: [0.6, 0.9] },
    },
  ],
}

/** al-falling: the long dreamy drop -- stars wheeling past, one falling Alice. */
const FALLING_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.94,
  elements: [
    { noun: 'stars', at: [0.5, 0.34], size: 0.32 },
    {
      noun: 'figure',
      at: [0.5, 0.5],
      size: 0.24,
      pose: 'dance',
      colorRole: 'accent-light',
      motion: { verb: 'fall', loopSeconds: 9, amplitude: 0.9 },
    },
    { noun: 'stars', at: [0.22, 0.66], size: 0.16 },
  ],
}

/** al-cupboards: the well walls filled with shelves -- crates, a cupboard door, warm jar-glints; Alice still drifting past. */
const CUPBOARDS_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.88,
  elements: [
    { noun: 'crate', at: [0.16, 0.62], size: 0.16, mirror: true },
    { noun: 'crate', at: [0.2, 0.86], size: 0.19, mirror: true },
    { noun: 'door', at: [0.08, 0.4], size: 0.2, colorRole: 'primary', mirror: true },
    { noun: 'lights-strand', at: [0.5, 0.24], size: 0.1, colorRole: 'accent', motion: { verb: 'twinkle' } },
    {
      noun: 'figure',
      at: [0.5, 0.56],
      size: 0.22,
      pose: 'dance',
      colorRole: 'accent-light',
      motion: { verb: 'fall', loopSeconds: 12, amplitude: 0.5 },
    },
  ],
}

/** al-musing: the wondering monologue -- a lone small figure under wheeling stars. */
const MUSING_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.8,
  elements: [
    { noun: 'stars', at: [0.5, 0.36], size: 0.3 },
    { noun: 'stars', at: [0.78, 0.6], size: 0.14 },
    { noun: 'figure', at: [0.42, 0.94], size: 0.2, pose: 'stand', colorRole: 'primary-light' },
  ],
}

// ---------------------------------------------------------------------------
// window cards
// ---------------------------------------------------------------------------

/** al-p3-s3: the Rabbit ACTUALLY TOOK A WATCH OUT of its waistcoat-pocket -- the watch hero-scale, the chase in motion. */
const WATCH_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.76,
  elements: [
    { noun: 'clock', at: [0.5, 0.92], size: 0.6, colorRole: 'accent' },
    {
      noun: 'figure',
      at: [0.1, 0.94],
      size: 0.12,
      pose: 'dance',
      colorRole: 'accent-light',
      motion: { verb: 'cross', loopSeconds: 6, amplitude: 0.5, toward: [0.85, 0.94] },
    },
    { noun: 'figure', at: [0.24, 0.93], size: 0.2, pose: 'stand', colorRole: 'shadow' },
  ],
}

/** al-p6-s3: the ORANGE MARMALADE jar -- shelf crates and one warm-lit strand over the labelled shelf. */
const MARMALADE_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.86,
  elements: [
    { noun: 'crate', at: [0.3, 0.62], size: 0.18 },
    { noun: 'crate', at: [0.5, 0.84], size: 0.22 },
    { noun: 'crate', at: [0.7, 0.6], size: 0.16 },
    { noun: 'lights-strand', at: [0.5, 0.3], size: 0.12, colorRole: 'accent', motion: { verb: 'twinkle' } },
  ],
}

// ---------------------------------------------------------------------------
// the registry
// ---------------------------------------------------------------------------

export const ALICE_PLATES: ScenePlateSet = {
  sceneId: 'alice',
  cameraAzimuthDeg: {
    'al-riverbank': 0,
    'al-white-rabbit': 60,
    'al-rabbit-hole': 120,
    'al-falling': 180,
    'al-cupboards': 240,
    'al-musing': 300,
  },
  plates: [
    // --- al-riverbank (0) ---
    {
      id: 'al-far-meadow-0',
      layer: 'far',
      azimuthDeg: 0,
      memberBeatIds: ['al-riverbank'],
      source: { kind: 'paint', paint: paintMeadowFar },
    },
    {
      id: 'al-mid-riverbank',
      layer: 'mid',
      azimuthDeg: 0,
      memberBeatIds: ['al-riverbank'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(RIVERBANK_CARD) },
    },
    // --- al-white-rabbit (60) ---
    {
      id: 'al-far-meadow-60',
      layer: 'far',
      azimuthDeg: 60,
      memberBeatIds: ['al-white-rabbit'],
      source: { kind: 'paint', paint: paintMeadowFar },
    },
    {
      id: 'al-mid-white-rabbit',
      layer: 'mid',
      azimuthDeg: 60,
      memberBeatIds: ['al-white-rabbit'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(WHITE_RABBIT_CARD) },
    },
    // --- al-rabbit-hole (120) ---
    {
      id: 'al-far-well-120',
      layer: 'far',
      azimuthDeg: 120,
      memberBeatIds: ['al-rabbit-hole'],
      source: { kind: 'paint', paint: paintWellFar },
    },
    {
      id: 'al-mid-rabbit-hole',
      layer: 'mid',
      azimuthDeg: 120,
      memberBeatIds: ['al-rabbit-hole'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(RABBIT_HOLE_CARD) },
    },
    // --- al-falling (180) ---
    {
      id: 'al-far-well-180',
      layer: 'far',
      azimuthDeg: 180,
      memberBeatIds: ['al-falling'],
      source: { kind: 'paint', paint: paintWellFar },
    },
    {
      id: 'al-mid-falling',
      layer: 'mid',
      azimuthDeg: 180,
      memberBeatIds: ['al-falling'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(FALLING_CARD) },
    },
    // --- al-cupboards (240) ---
    {
      id: 'al-far-well-240',
      layer: 'far',
      azimuthDeg: 240,
      memberBeatIds: ['al-cupboards'],
      source: { kind: 'paint', paint: paintWellFar },
    },
    {
      id: 'al-mid-cupboards',
      layer: 'mid',
      azimuthDeg: 240,
      memberBeatIds: ['al-cupboards'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(CUPBOARDS_CARD) },
    },
    // --- al-musing (300) ---
    {
      id: 'al-far-well-300',
      layer: 'far',
      azimuthDeg: 300,
      memberBeatIds: ['al-musing'],
      source: { kind: 'paint', paint: paintWellFar },
    },
    {
      id: 'al-mid-musing',
      layer: 'mid',
      azimuthDeg: 300,
      memberBeatIds: ['al-musing'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(MUSING_CARD) },
    },
  ],
  windows: [
    {
      id: 'al-w-watch',
      sentenceIds: ['al-p3-s3'], // the Rabbit actually took a watch out of its waistcoat-pocket
      plate: {
        id: 'al-win-watch',
        layer: 'mid',
        azimuthDeg: 60, // white-rabbit sector
        memberBeatIds: ['al-white-rabbit'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: composeCard(WATCH_CARD) },
      },
    },
    {
      id: 'al-w-marmalade',
      sentenceIds: ['al-p6-s3'], // the jar labelled ORANGE MARMALADE
      plate: {
        id: 'al-win-marmalade',
        layer: 'mid',
        azimuthDeg: 240, // cupboards sector
        memberBeatIds: ['al-cupboards'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: composeCard(MARMALADE_CARD) },
      },
    },
  ],
}

/**
 * The registry's CardSpecs as inspectable data, keyed by card name -- the
 * eval layer's window into what composeCard() closures otherwise hide
 * (scripts/evals/ runs compiler-law assertions over these).
 */
export const ALICE_CARD_SPECS: Record<string, CardSpec> = {
  riverbank: RIVERBANK_CARD,
  'white-rabbit': WHITE_RABBIT_CARD,
  'rabbit-hole': RABBIT_HOLE_CARD,
  falling: FALLING_CARD,
  cupboards: CUPBOARDS_CARD,
  musing: MUSING_CARD,
  watch: WATCH_CARD,
  marmalade: MARMALADE_CARD,
}
