import type { CardSpec, ScenePlateSet } from '../../types-plates'
import type { SceneBeat } from '../../types'
import { composeCard } from '../../components/world/decoCardComposer'
import {
  darkenHex,
  drawBandedSky,
  drawDecoFrame,
  drawGothicArch,
  drawSilhouetteFigure,
  drawSunburst,
  lightenHex,
  mixHex,
  withMirrorSymmetry,
} from '../../components/world/decoPlateKit'

type Palette = SceneBeat['palette']

/**
 * Painted-plate registry for The Masque of the Red Death -- the second
 * per-scene data module, and the proof that the painted-world engine is
 * book-agnostic: PaintedPlates.tsx and decoPlateKit.ts are untouched; this
 * text contributed three new nouns to the shared lexicon (gothic-arch,
 * brazier, clock) that every future text now inherits.
 *
 * Where Gatsby's registry proved the grammar with one data card (w-crates),
 * this one leans on it: five of the nine beat mids are pure CardSpec data --
 * the shape the compiler emits -- with hand-written paint functions kept
 * for the four compositions that need custom color work (the seven-room
 * spectrum, the black chamber) or hero staging (the abbey, the revel).
 *
 * Compiler laws honored in data: SEVEN rooms in the spectrum corridor
 * (numeric fidelity -- Poe counts them), the black chamber holds NO figures
 * ("no one of the maskers ventured" -- negation: never render the denied
 * image), and the frozen-dreams window's figures carry explicit
 * `motion: still` -- the one legal exception to "figures are never
 * statues," because the text itself freezes them.
 *
 * Sector map: nine beats at clean 40-degree spacing (no set-piece-era
 * legacy positions to respect, unlike Gatsby's).
 */

// ---------------------------------------------------------------------------
// far plates
// ---------------------------------------------------------------------------

/** Exterior night: stars over the battlemented silhouette of a castellated abbey. Topmost band == background for a seamless edge. */
function paintAbbeyNightFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.74, [
    p.background,
    mixHex(p.background, p.primary, 0.3),
    mixHex(p.background, p.primary, 0.55),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.45)
  ctx.fillRect(0, h * 0.74, w, h * 0.26)
  // stars
  ctx.fillStyle = lightenHex(p.accent, 0.4)
  for (let i = 0; i < 50; i++) {
    ctx.globalAlpha = 0.2 + ((i * 41) % 10) / 16
    ctx.fillRect((i * 137) % w, (i * 59) % (h * 0.5), 1.6, 1.6)
  }
  ctx.globalAlpha = 1
  // mirrored abbey skyline: a keep with battlements, flanking towers with
  // pointed roofs, a few arrow-slit lights
  withMirrorSymmetry(ctx, w, () => {
    const wall = darkenHex(p.background, 0.35)
    ctx.fillStyle = wall
    // curtain wall with crenellation
    ctx.fillRect(w * 0.04, h * 0.6, w * 0.3, h * 0.14)
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(w * (0.045 + i * 0.033), h * 0.57, w * 0.016, h * 0.03)
    }
    // tower with pointed roof
    ctx.fillRect(w * 0.09, h * 0.38, w * 0.05, h * 0.36)
    ctx.beginPath()
    ctx.moveTo(w * 0.085, h * 0.38)
    ctx.lineTo(w * 0.115, h * 0.28)
    ctx.lineTo(w * 0.145, h * 0.38)
    ctx.closePath()
    ctx.fill()
    // slit lights
    ctx.fillStyle = p.accent
    ctx.globalAlpha = 0.8
    ctx.fillRect(w * 0.112, h * 0.44, Math.max(1.2, w * 0.003), h * 0.02)
    ctx.fillRect(w * 0.112, h * 0.52, Math.max(1.2, w * 0.003), h * 0.02)
    ctx.globalAlpha = 1
  })
}

/**
 * Interior far plate for every in-suite beat: a dark banded hall wall with a
 * receding row of glowing gothic windows. Palette-parameterized, so the same
 * function reads icy in the blue room, infernal in the brazier corridor, and
 * funereal at midnight.
 */
function paintGothicHallFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.78, [
    p.background,
    mixHex(p.background, p.primary, 0.35),
    mixHex(p.background, p.primary, 0.6),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.4)
  ctx.fillRect(0, h * 0.78, w, h * 0.22)
  // a mirrored rank of tall windows, dimmer toward the edges (depth)
  withMirrorSymmetry(ctx, w, () => {
    for (let i = 0; i < 4; i++) {
      const cx = w * (0.08 + i * 0.115)
      const wh = h * (0.34 + i * 0.045)
      ctx.globalAlpha = 0.4 + i * 0.15
      drawGothicArch(
        ctx,
        cx,
        h * 0.78,
        wh * 0.24,
        wh,
        mixHex(p.accent, p.background, 0.35),
        darkenHex(p.background, 0.3),
      )
    }
    ctx.globalAlpha = 1
  })
}

// ---------------------------------------------------------------------------
// artisan mid plates
// ---------------------------------------------------------------------------

/**
 * masque-onset: the castellated abbey receiving the thousand -- gate wall,
 * a lofty iron-barred gate, courtiers streaming in. ("This wall had gates of
 * iron. The courtiers, having entered, brought furnaces and massy hammers
 * and welded the bolts.")
 */
function paintOnsetMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  drawBandedSky(ctx, 0, w, h * 0.62, [
    darkenHex(p.background, 0.2),
    p.background,
    mixHex(p.background, p.primary, 0.5),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.35)
  ctx.fillRect(0, h * 0.62, w, h * 0.38)
  // gate wall, mirrored
  const wall = mixHex(p.primary, p.background, 0.35)
  withMirrorSymmetry(ctx, w, () => {
    ctx.fillStyle = wall
    ctx.fillRect(0, h * 0.34, w * 0.34, h * 0.36)
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(w * (0.01 + i * 0.055), h * 0.3, w * 0.028, h * 0.04)
    }
    // gate tower
    ctx.fillRect(w * 0.3, h * 0.22, w * 0.08, h * 0.48)
    ctx.beginPath()
    ctx.moveTo(w * 0.295, h * 0.22)
    ctx.lineTo(w * 0.34, h * 0.13)
    ctx.lineTo(w * 0.385, h * 0.22)
    ctx.closePath()
    ctx.fill()
  })
  // the iron gate: pointed-arch opening, glowing from the revel within, barred
  const gateW = w * 0.16
  drawGothicArch(ctx, w * 0.5, h * 0.7, gateW, h * 0.4, mixHex(p.accent, p.background, 0.15), darkenHex(p.background, 0.4))
  ctx.strokeStyle = darkenHex(p.background, 0.5)
  ctx.lineWidth = Math.max(1.4, h * 0.008)
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(w * 0.5 + i * gateW * 0.18, h * 0.7)
    ctx.lineTo(w * 0.5 + i * gateW * 0.18, h * 0.7 - h * 0.34)
    ctx.stroke()
  }
  // courtiers streaming toward the gate (bob as they walk)
  const shade = darkenHex(p.background, 0.45)
  for (let i = 0; i < 5; i++) {
    const phase = (t * 0.05 + i * 0.2) % 1
    const fx = w * (0.06 + phase * 0.36)
    const bob = Math.abs(Math.sin((t * 1.6 + i) * Math.PI)) * h * 0.006
    drawSilhouetteFigure(ctx, fx, h * 0.86 - bob, h * 0.17, 'stand', shade)
  }
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * suite-spectrum: the seven chambers as a receding corridor of pointed
 * arches, each glazed in Poe's own named hue -- blue, purple, green, orange,
 * white, violet, and last the black chamber's scarlet. SEVEN arches exactly:
 * the text counts them ("These were seven -- an imperial suite"), so seven
 * render (numeric fidelity). The hues are Poe's, not the palette's -- the
 * one composition where hardcoded color IS the fidelity rule -- mixed only
 * lightly toward the beat palette so the corridor still sits in the scene.
 */
const ROOM_HUES = ['#2a4a8a', '#6a3a8a', '#2a7a4a', '#c96a1e', '#e8e2d2', '#7a5a9a', '#c1121f'] as const

function paintSpectrumMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  drawBandedSky(ctx, 0, w, h * 0.72, [
    darkenHex(p.background, 0.3),
    p.background,
    mixHex(p.background, p.primary, 0.4),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.4)
  ctx.fillRect(0, h * 0.72, w, h * 0.28)
  // seven arches receding left-to-right along the "sharp turn" diagonal,
  // each glowing its own hue; the scarlet-black seventh smallest and last
  for (let i = 0; i < 7; i++) {
    const frac = i / 6
    const cx = w * (0.1 + frac * 0.78)
    const ah = h * (0.52 - frac * 0.18)
    const baseY = h * (0.72 - frac * 0.05)
    const hue = ROOM_HUES[i] ?? p.accent
    const pane = mixHex(hue, p.background, 0.18)
    // glow halo breathes gently, out of phase per room
    const glow = 0.16 + 0.08 * Math.sin(t * 1.3 + i * 1.1)
    ctx.globalAlpha = glow
    ctx.fillStyle = pane
    ctx.beginPath()
    ctx.arc(cx, baseY - ah * 0.45, ah * 0.62, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    drawGothicArch(ctx, cx, baseY, ah * 0.34, ah, pane, darkenHex(p.background, i === 6 ? 0.6 : 0.35))
  }
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * room-black: the seventh chamber -- black velvet hangings, scarlet panes,
 * blood-colored light pooling on the sable carpet. EMPTY of figures: "no one
 * of the maskers ventured" (negation law -- never render the denied image).
 */
function paintBlackRoomMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  // near-black velvet bands
  drawBandedSky(ctx, 0, w, h * 0.7, [
    darkenHex(p.background, 0.5),
    darkenHex(p.background, 0.3),
    p.background,
  ])
  ctx.fillStyle = darkenHex(p.background, 0.55)
  ctx.fillRect(0, h * 0.7, w, h * 0.3)
  // velvet drape folds
  ctx.strokeStyle = darkenHex(p.background, 0.2)
  ctx.lineWidth = Math.max(1, h * 0.006)
  for (let i = 0; i < 9; i++) {
    ctx.beginPath()
    ctx.moveTo(w * (0.06 + i * 0.11), 0)
    ctx.lineTo(w * (0.06 + i * 0.11), h * 0.7)
    ctx.stroke()
  }
  const scarlet = mixHex(p.accent, '#c1121f', 0.6)
  // two mirrored scarlet windows, firelight from without pulsing slowly
  withMirrorSymmetry(ctx, w, () => {
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.7)
    ctx.globalAlpha = pulse
    drawGothicArch(ctx, w * 0.24, h * 0.66, w * 0.09, h * 0.44, scarlet, darkenHex(p.background, 0.6))
    // blood light pooling beneath, a flat rhombus on the carpet
    ctx.globalAlpha = 0.3 * pulse
    ctx.fillStyle = scarlet
    ctx.beginPath()
    ctx.moveTo(w * 0.24, h * 0.68)
    ctx.lineTo(w * 0.33, h * 0.9)
    ctx.lineTo(w * 0.15, h * 0.9)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  })
  drawDecoFrame(ctx, w, h, scarlet)
}

/**
 * revel-bold: the gay and magnificent revel -- glare, glitter, piquancy and
 * phantasm; arabesque figures whirling under a sunburst blaze. The one
 * all-out composition of the set, matching "his plans were bold and fiery."
 */
function paintRevelMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  drawBandedSky(ctx, 0, w, h * 0.66, [
    darkenHex(p.background, 0.25),
    p.background,
    mixHex(p.background, p.primary, 0.55),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.3)
  ctx.fillRect(0, h * 0.66, w, h * 0.34)
  // the blaze: a great half-sunburst crowning the hall
  drawSunburst(ctx, w * 0.5, h * 0.2, h * 0.08, h * 0.5, 22, mixHex(p.accent, '#ffd166', 0.5), Math.PI * 0.08, Math.PI * 0.92, 0.5)
  // glitter dots drifting
  ctx.fillStyle = lightenHex(p.accent, 0.3)
  for (let i = 0; i < 26; i++) {
    const phase = (t * 0.12 + i * 0.038) % 1
    ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(t * 2 + i * 2.4))
    ctx.beginPath()
    ctx.arc((i * 149) % w, h * (0.16 + phase * 0.4), Math.max(1.2, h * 0.006), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // arabesque dancers: mirrored ring of whirling figures, scale-varied
  const shade = darkenHex(p.background, 0.45)
  withMirrorSymmetry(ctx, w, () => {
    for (let i = 0; i < 4; i++) {
      const sway = Math.sin(t * (1.1 + i * 0.17) + i * 2.1) * w * 0.008
      const fh = h * (0.2 + (i % 2) * 0.05)
      drawSilhouetteFigure(ctx, w * (0.1 + i * 0.1) + sway, h * 0.92, fh, 'dance', i % 2 === 0 ? shade : mixHex(shade, p.accent, 0.25))
    }
  })
  drawDecoFrame(ctx, w, h, p.accent)
}

// ---------------------------------------------------------------------------
// CardSpec mid plates -- the grammar-at-scale proof: pure data, the shape
// generate-plate-specs.ts emits, interpreted by decoCardComposer
// ---------------------------------------------------------------------------

/** room-blue: the eastern chamber, vividly blue -- the palette does the tinting. */
const ROOM_BLUE_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.72,
  elements: [
    { noun: 'gothic-arch', at: [0.26, 0.68], size: 0.46, colorRole: 'accent', mirror: true },
    { noun: 'gothic-arch', at: [0.5, 0.7], size: 0.56, colorRole: 'accent-light' },
    { noun: 'brazier', at: [0.13, 0.9], size: 0.2, mirror: true },
    { noun: 'figure', at: [0.4, 0.93], size: 0.22, pose: 'stand', colorRole: 'shadow' },
    { noun: 'figure', at: [0.61, 0.93], size: 0.2, pose: 'dance', colorRole: 'primary-light' },
  ],
}

/**
 * braziers: the corridors' tripods of fire glaring through the tinted glass.
 * ("There stood, opposite to each window, a heavy tripod, bearing a brazier
 * of fire.") Flames flicker from t inside the noun renderer.
 */
const BRAZIERS_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.74,
  elements: [
    { noun: 'gothic-arch', at: [0.28, 0.7], size: 0.44, colorRole: 'accent', mirror: true },
    { noun: 'gothic-arch', at: [0.5, 0.72], size: 0.5, colorRole: 'accent-light' },
    { noun: 'brazier', at: [0.28, 0.92], size: 0.26, mirror: true },
    { noun: 'brazier', at: [0.5, 0.94], size: 0.3 },
    { noun: 'figure', at: [0.09, 0.94], size: 0.2, pose: 'stand', colorRole: 'shadow', mirror: true },
  ],
}

/**
 * ebony-clock: the gigantic clock, pendulum swinging its dull heavy clang;
 * the waltzers pause mid-step to hearken (sway = the grammar's un-verbed
 * figure default, fitting the uneasy hush).
 */
const EBONY_CLOCK_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.76,
  elements: [
    { noun: 'gothic-arch', at: [0.18, 0.72], size: 0.4, colorRole: 'primary-light', mirror: true },
    { noun: 'clock', at: [0.5, 0.94], size: 0.72 },
    { noun: 'figure', at: [0.28, 0.94], size: 0.21, pose: 'stand', colorRole: 'shadow' },
    { noun: 'figure', at: [0.7, 0.94], size: 0.19, pose: 'stand', colorRole: 'shadow' },
    { noun: 'figure', at: [0.82, 0.94], size: 0.22, pose: 'horn', colorRole: 'primary-light' },
  ],
}

/**
 * dreams: "a multitude of dreams" stalking the chambers, writhing in and
 * about, taking hue from the rooms -- gliding dancers in varied palette
 * roles among the glowing arches.
 */
const DREAMS_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.74,
  elements: [
    { noun: 'gothic-arch', at: [0.16, 0.7], size: 0.42, colorRole: 'accent', mirror: true },
    { noun: 'gothic-arch', at: [0.38, 0.72], size: 0.48, colorRole: 'primary-light', mirror: true },
    { noun: 'figure', at: [0.2, 0.93], size: 0.22, pose: 'dance', colorRole: 'accent', motion: { verb: 'glide', amplitude: 0.5, loopSeconds: 9, phase: 0.1 } },
    { noun: 'figure', at: [0.45, 0.93], size: 0.24, pose: 'dance', colorRole: 'primary-light', motion: { verb: 'glide', amplitude: 0.6, loopSeconds: 11, phase: 0.45 } },
    { noun: 'figure', at: [0.66, 0.93], size: 0.2, pose: 'dance', colorRole: 'accent-light', motion: { verb: 'glide', amplitude: 0.45, loopSeconds: 8, phase: 0.7 } },
    { noun: 'figure', at: [0.85, 0.93], size: 0.22, pose: 'dance', colorRole: 'shadow', motion: { verb: 'glide', amplitude: 0.55, loopSeconds: 10, phase: 0.9 } },
  ],
}

/**
 * midnight: the sounding of midnight upon the clock -- the clock looms, the
 * crowd stands arrested. The `still` verbs are deliberate and legal: the
 * text freezes them ("the dreams are stiff-frozen as they stand"), the one
 * sanctioned exception to figures-are-never-statues. The clock keeps
 * swinging -- midnight is the only thing still moving.
 */
const MIDNIGHT_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.76,
  elements: [
    { noun: 'gothic-arch', at: [0.15, 0.72], size: 0.4, colorRole: 'accent', mirror: true },
    { noun: 'clock', at: [0.5, 0.94], size: 0.78 },
    { noun: 'figure', at: [0.24, 0.94], size: 0.2, pose: 'stand', colorRole: 'shadow', motion: { verb: 'still' }, mirror: true },
    { noun: 'figure', at: [0.35, 0.94], size: 0.23, pose: 'dance', colorRole: 'shadow', motion: { verb: 'still' }, mirror: true },
  ],
}

// ---------------------------------------------------------------------------
// window cards
// ---------------------------------------------------------------------------

/** mq-p2-s8 + s9: the tall narrow Gothic window and its color-shifting stained glass -- the suite's defining device, hero-scale. */
const GOTHIC_WINDOWS_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.78,
  elements: [
    { noun: 'gothic-arch', at: [0.5, 0.76], size: 0.64, colorRole: 'accent-light' },
    { noun: 'gothic-arch', at: [0.26, 0.74], size: 0.5, colorRole: 'accent', mirror: true },
    { noun: 'brazier', at: [0.5, 0.95], size: 0.22 },
  ],
}

/** mq-p5-s4: "arabesque figures with unsuited limbs and appointments" -- a frieze of off-kilter dancers, sizes deliberately mismatched. */
const ARABESQUE_CARD: CardSpec = {
  skyBands: 4,
  groundY: 0.74,
  elements: [
    { noun: 'figure', at: [0.14, 0.93], size: 0.3, pose: 'dance', colorRole: 'accent', motion: { verb: 'sway', amplitude: 1.4, speed: 1.3 } },
    { noun: 'figure', at: [0.32, 0.93], size: 0.15, pose: 'horn', colorRole: 'primary-light', motion: { verb: 'bounce', amplitude: 0.5, loopSeconds: 2.6 } },
    { noun: 'figure', at: [0.5, 0.93], size: 0.34, pose: 'dance', colorRole: 'shadow', motion: { verb: 'sway', amplitude: 1.1, speed: 0.7, phase: 1.3 } },
    { noun: 'figure', at: [0.68, 0.93], size: 0.18, pose: 'mop', colorRole: 'accent-light', motion: { verb: 'orbit', amplitude: 0.35, loopSeconds: 5 } },
    { noun: 'figure', at: [0.86, 0.93], size: 0.27, pose: 'serve', colorRole: 'primary-light', motion: { verb: 'sway', amplitude: 1.5, speed: 1.6, phase: 2.2 } },
  ],
}

/**
 * mq-p5-s10 + s11: "all is still... the dreams are stiff-frozen as they
 * stand" -- the same dancer frieze arrested mid-gesture (explicit `still`,
 * the text-sanctioned exception), only the clock's voice moving.
 */
const FROZEN_DREAMS_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.74,
  elements: [
    { noun: 'clock', at: [0.5, 0.94], size: 0.66 },
    { noun: 'figure', at: [0.16, 0.93], size: 0.26, pose: 'dance', colorRole: 'shadow', motion: { verb: 'still' } },
    { noun: 'figure', at: [0.3, 0.93], size: 0.2, pose: 'horn', colorRole: 'primary-light', motion: { verb: 'still' } },
    { noun: 'figure', at: [0.68, 0.93], size: 0.24, pose: 'dance', colorRole: 'shadow', motion: { verb: 'still' } },
    { noun: 'figure', at: [0.84, 0.93], size: 0.18, pose: 'stand', colorRole: 'accent', motion: { verb: 'still' } },
  ],
}

// ---------------------------------------------------------------------------
// the registry
// ---------------------------------------------------------------------------

export const MASQUE_PLATES: ScenePlateSet = {
  sceneId: 'masque',
  cameraAzimuthDeg: {
    'masque-onset': 0,
    'room-blue': 40,
    'suite-spectrum': 80,
    'room-black': 120,
    braziers: 160,
    'ebony-clock': 200,
    'revel-bold': 240,
    dreams: 280,
    midnight: 320,
  },
  plates: [
    // --- masque-onset (the abbey, 0) ---
    {
      id: 'mq-far-abbey-0',
      layer: 'far',
      azimuthDeg: 0,
      memberBeatIds: ['masque-onset'],
      source: { kind: 'paint', paint: paintAbbeyNightFar },
    },
    {
      id: 'mq-mid-onset',
      layer: 'mid',
      azimuthDeg: 0,
      memberBeatIds: ['masque-onset'],
      animated: true,
      source: { kind: 'paint', paint: paintOnsetMid },
    },
    // --- room-blue (40) ---
    {
      id: 'mq-far-hall-40',
      layer: 'far',
      azimuthDeg: 40,
      memberBeatIds: ['room-blue'],
      source: { kind: 'paint', paint: paintGothicHallFar },
    },
    {
      id: 'mq-mid-room-blue',
      layer: 'mid',
      azimuthDeg: 40,
      memberBeatIds: ['room-blue'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(ROOM_BLUE_CARD) },
    },
    // --- suite-spectrum (80) ---
    {
      id: 'mq-far-hall-80',
      layer: 'far',
      azimuthDeg: 80,
      memberBeatIds: ['suite-spectrum'],
      source: { kind: 'paint', paint: paintGothicHallFar },
    },
    {
      id: 'mq-mid-spectrum',
      layer: 'mid',
      azimuthDeg: 80,
      memberBeatIds: ['suite-spectrum'],
      animated: true,
      source: { kind: 'paint', paint: paintSpectrumMid },
    },
    // --- room-black (120) ---
    {
      id: 'mq-far-hall-120',
      layer: 'far',
      azimuthDeg: 120,
      memberBeatIds: ['room-black'],
      source: { kind: 'paint', paint: paintGothicHallFar },
    },
    {
      id: 'mq-mid-room-black',
      layer: 'mid',
      azimuthDeg: 120,
      memberBeatIds: ['room-black'],
      animated: true,
      source: { kind: 'paint', paint: paintBlackRoomMid },
    },
    // --- braziers (160) ---
    {
      id: 'mq-far-hall-160',
      layer: 'far',
      azimuthDeg: 160,
      memberBeatIds: ['braziers'],
      source: { kind: 'paint', paint: paintGothicHallFar },
    },
    {
      id: 'mq-mid-braziers',
      layer: 'mid',
      azimuthDeg: 160,
      memberBeatIds: ['braziers'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(BRAZIERS_CARD) },
    },
    // --- ebony-clock (200) ---
    {
      id: 'mq-far-hall-200',
      layer: 'far',
      azimuthDeg: 200,
      memberBeatIds: ['ebony-clock'],
      source: { kind: 'paint', paint: paintGothicHallFar },
    },
    {
      id: 'mq-mid-ebony-clock',
      layer: 'mid',
      azimuthDeg: 200,
      memberBeatIds: ['ebony-clock'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(EBONY_CLOCK_CARD) },
    },
    // --- revel-bold (240) ---
    {
      id: 'mq-far-hall-240',
      layer: 'far',
      azimuthDeg: 240,
      memberBeatIds: ['revel-bold'],
      source: { kind: 'paint', paint: paintGothicHallFar },
    },
    {
      id: 'mq-mid-revel',
      layer: 'mid',
      azimuthDeg: 240,
      memberBeatIds: ['revel-bold'],
      animated: true,
      source: { kind: 'paint', paint: paintRevelMid },
    },
    // --- dreams (280) ---
    {
      id: 'mq-far-hall-280',
      layer: 'far',
      azimuthDeg: 280,
      memberBeatIds: ['dreams'],
      source: { kind: 'paint', paint: paintGothicHallFar },
    },
    {
      id: 'mq-mid-dreams',
      layer: 'mid',
      azimuthDeg: 280,
      memberBeatIds: ['dreams'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(DREAMS_CARD) },
    },
    // --- midnight (320) ---
    {
      id: 'mq-far-hall-320',
      layer: 'far',
      azimuthDeg: 320,
      memberBeatIds: ['midnight'],
      source: { kind: 'paint', paint: paintGothicHallFar },
    },
    {
      id: 'mq-mid-midnight',
      layer: 'mid',
      azimuthDeg: 320,
      memberBeatIds: ['midnight'],
      animated: true,
      source: { kind: 'paint', paint: composeCard(MIDNIGHT_CARD) },
    },
  ],
  windows: [
    {
      id: 'mq-w-gothic-windows',
      sentenceIds: ['mq-p2-s8', 'mq-p2-s9'], // the tall narrow Gothic window / stained glass varying with the room
      plate: {
        id: 'mq-win-gothic-windows',
        layer: 'mid',
        azimuthDeg: 0, // masque-onset sector (s8/s9 precede the room-by-room walk)
        memberBeatIds: ['masque-onset'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: composeCard(GOTHIC_WINDOWS_CARD) },
      },
    },
    {
      id: 'mq-w-arabesque',
      sentenceIds: ['mq-p5-s4'], // arabesque figures with unsuited limbs and appointments
      plate: {
        id: 'mq-win-arabesque',
        layer: 'mid',
        azimuthDeg: 280, // dreams sector
        memberBeatIds: ['dreams'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: composeCard(ARABESQUE_CARD) },
      },
    },
    {
      id: 'mq-w-frozen-dreams',
      sentenceIds: ['mq-p5-s10', 'mq-p5-s11'], // all is still / the dreams are stiff-frozen as they stand
      plate: {
        id: 'mq-win-frozen-dreams',
        layer: 'mid',
        azimuthDeg: 280, // dreams sector
        memberBeatIds: ['dreams'],
        radius: 19.2,
        animated: true,
        source: { kind: 'paint', paint: composeCard(FROZEN_DREAMS_CARD) },
      },
    },
  ],
}
