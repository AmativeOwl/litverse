import type { ScenePlateSet } from '../../types-plates'
import type { SceneBeat } from '../../types'
import {
  darkenHex,
  drawBandedSky,
  drawDecoFrame,
  drawSilhouetteFigure,
  drawStringDots,
  drawSunburst,
  drawWindows,
  drawZigguratTower,
  lightenHex,
  mixHex,
  withMirrorSymmetry,
} from '../../components/world/decoPlateKit'

type Palette = SceneBeat['palette']

/**
 * Painted-plate registry for the Gatsby Ch.3 party scene -- THE per-scene
 * data module of the painted-world pivot (see CLAUDE.md). A future text gets
 * its own file with this exact shape; the renderer (PaintedPlates.tsx) and
 * drawing kit (decoPlateKit.ts) stay untouched.
 *
 * Compositions were approved from the procedural concept board (same
 * drawing approach, same palettes) -- mid plates keep the deco poster frame
 * from the board, which reads in-scene as a theatrical flat the camera
 * drifts past; far plates are frameless sky bands whose topmost color is
 * exactly `palette.background` so their upper edge dissolves seamlessly
 * into the scene backdrop.
 *
 * Sector map (degrees) inherited from the set-piece era so motif positions
 * remain meaningful: waterfront 28, orchestra/canvas-platform 80, estate
 * 140, buffet 205-222, bar 235, drive/cars 280, fountain court 325.
 */

// ---------------------------------------------------------------------------
// far plates: frameless sky/skyline bands
// ---------------------------------------------------------------------------

function paintNightSkylineFar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Palette,
): void {
  // top band == scene background => seamless upper edge
  drawBandedSky(ctx, 0, w, h * 0.72, [
    p.background,
    mixHex(p.background, p.primary, 0.3),
    mixHex(p.background, p.primary, 0.55),
    mixHex(p.primary, p.accent, 0.2),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.45)
  ctx.fillRect(0, h * 0.72, w, h * 0.28)
  // stars
  ctx.fillStyle = lightenHex(p.accent, 0.4)
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.2 + ((i * 37) % 10) / 16
    ctx.fillRect((i * 131) % w, (i * 53) % (h * 0.5), 1.6, 1.6)
  }
  ctx.globalAlpha = 1
  // mirrored ziggurat skyline with lit windows
  withMirrorSymmetry(ctx, w, () => {
    drawZigguratTower(ctx, w * 0.07, h * 0.72, w * 0.05, h * 0.5, 4, darkenHex(p.background, 0.4))
    drawZigguratTower(ctx, w * 0.16, h * 0.72, w * 0.035, h * 0.34, 3, darkenHex(p.background, 0.25))
    drawZigguratTower(ctx, w * 0.28, h * 0.72, w * 0.045, h * 0.42, 4, darkenHex(p.background, 0.35))
    drawWindows(ctx, w * 0.07, h * 0.72, w * 0.05, h * 0.44, p.accent, 0.37)
    drawWindows(ctx, w * 0.28, h * 0.72, w * 0.045, h * 0.36, p.accent, 0.41)
  })
}

// ---------------------------------------------------------------------------
// mid plates: framed poster compositions (from the approved concept board)
// ---------------------------------------------------------------------------

/** dusk-arrival: the fountain court -- tiered fountain, gates, first guests. */
function paintDuskFountainMid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Palette,
): void {
  drawBandedSky(ctx, 0, w, h * 0.66, [
    darkenHex(p.background, 0.25),
    p.background,
    mixHex(p.background, p.primary, 0.45),
    mixHex(p.primary, p.accent, 0.25),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.35)
  ctx.fillRect(0, h * 0.66, w, h * 0.34)
  ctx.fillStyle = lightenHex(p.accent, 0.4)
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.25 + ((i * 37) % 10) / 14
    ctx.fillRect((i * 97) % w, (i * 53) % (h * 0.4), 1.4, 1.4)
  }
  ctx.globalAlpha = 1
  withMirrorSymmetry(ctx, w, () => {
    drawZigguratTower(ctx, w * 0.12, h * 0.66, w * 0.1, h * 0.34, 4, darkenHex(p.background, 0.45))
    drawZigguratTower(ctx, w * 0.24, h * 0.66, w * 0.07, h * 0.24, 3, darkenHex(p.background, 0.3))
    drawWindows(ctx, w * 0.12, h * 0.66, w * 0.1, h * 0.3, p.accent, 0.37)
  })
  // tiered fountain with a spray fan
  const cx = w / 2
  const fy = h * 0.82
  drawSunburst(ctx, cx, fy - h * 0.3, h * 0.02, h * 0.13, 9, p.accent, -Math.PI * 0.85, -Math.PI * 0.15, 0.9)
  ctx.fillStyle = mixHex(p.primary, p.background, 0.3)
  const tiers: ReadonlyArray<readonly [number, number]> = [
    [0.16, 0],
    [0.11, 0.07],
    [0.06, 0.13],
  ]
  for (const [tierWidth, dy] of tiers) {
    ctx.beginPath()
    ctx.ellipse(cx, fy - h * dy - h * 0.02, w * tierWidth, h * 0.028, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(cx - w * 0.012, fy - h * dy - h * 0.1, w * 0.024, h * 0.08)
  }
  // gate posts + arriving guests
  withMirrorSymmetry(ctx, w, () => {
    ctx.fillStyle = darkenHex(p.primary, 0.45)
    ctx.fillRect(w * 0.33, h * 0.6, w * 0.008, h * 0.26)
    drawSilhouetteFigure(ctx, w * 0.4, h * 0.94, h * 0.2, 'stand', darkenHex(p.background, 0.5))
  })
  drawDecoFrame(ctx, w, h, p.accent)
}

/** orchestra-tuning: the glowing sunburst bandstand shell with musicians. */
function paintOrchestraMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.64, [
    darkenHex(p.background, 0.3),
    p.background,
    mixHex(p.background, p.primary, 0.5),
    mixHex(p.primary, p.accent, 0.15),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.4)
  ctx.fillRect(0, h * 0.64, w, h * 0.36)
  withMirrorSymmetry(ctx, w, () => {
    drawZigguratTower(ctx, w * 0.1, h * 0.64, w * 0.08, h * 0.3, 4, darkenHex(p.background, 0.5))
    drawWindows(ctx, w * 0.1, h * 0.64, w * 0.08, h * 0.26, p.accent, 0.41)
  })
  const cx = w / 2
  const by = h * 0.78
  const R = h * 0.3
  ctx.fillStyle = darkenHex(p.background, 0.5)
  ctx.beginPath()
  ctx.ellipse(cx, by + h * 0.02, R * 1.5, h * 0.035, 0, 0, Math.PI * 2)
  ctx.fill()
  const shellBands: ReadonlyArray<readonly [string, number]> = [
    [lightenHex(p.accent, 0.25), 0.4],
    [p.accent, 0.7],
    [mixHex(p.accent, p.background, 0.65), 1],
  ]
  for (let i = shellBands.length - 1; i >= 0; i--) {
    const band = shellBands[i]
    if (!band) continue
    ctx.fillStyle = band[0]
    ctx.beginPath()
    ctx.arc(cx, by, R * band[1], Math.PI, 0)
    ctx.closePath()
    ctx.fill()
  }
  drawSunburst(ctx, cx, by, R * 0.42, R * 0.98, 11, darkenHex(p.background, 0.35), Math.PI, Math.PI * 2, 0.5)
  ctx.strokeStyle = lightenHex(p.accent, 0.3)
  ctx.lineWidth = Math.max(2, h * 0.008)
  ctx.beginPath()
  ctx.arc(cx, by, R, Math.PI, 0)
  ctx.stroke()
  drawSunburst(ctx, cx, by - R, h * 0.005, h * 0.05, 5, lightenHex(p.accent, 0.3), -Math.PI * 0.8, -Math.PI * 0.2, 1)
  const seats: readonly number[] = [-0.22, -0.08, 0.06, 0.2]
  seats.forEach((dx, i) => {
    drawSilhouetteFigure(
      ctx,
      cx + R * 2 * dx,
      by,
      R * (0.62 + (i % 2) * 0.1),
      i % 2 ? 'horn' : 'stand',
      darkenHex(p.background, 0.6),
    )
  })
  drawStringDots(ctx, w, h * 0.12, h * 0.05, 20, lightenHex(p.accent, 0.2), Math.max(1.5, h * 0.006))
  drawStringDots(ctx, w, h * 0.2, h * 0.045, 17, p.accent, Math.max(1.2, h * 0.005))
  drawDecoFrame(ctx, w, h, p.accent)
}

/** dancing-under-lights: the gypsy alone on the canvas platform under a spotlight sunburst. */
function paintDancingMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.66, [
    darkenHex(p.background, 0.3),
    p.background,
    mixHex(p.background, p.primary, 0.3),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.4)
  ctx.fillRect(0, h * 0.66, w, h * 0.34)
  drawSunburst(ctx, w / 2, h * 0.06, h * 0.06, h * 0.75, 13, mixHex(p.accent, p.primary, 0.25), Math.PI * 0.28, Math.PI * 0.72, 0.5)
  // canvas platform
  ctx.fillStyle = mixHex(p.primary, p.background, 0.55)
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.85, w * 0.2, h * 0.045, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = p.accent
  ctx.lineWidth = Math.max(1.5, h * 0.006)
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.85, w * 0.2, h * 0.045, 0, 0, Math.PI * 2)
  ctx.stroke()
  // the dancer, arms up, center-lit
  drawSilhouetteFigure(ctx, w / 2, h * 0.85, h * 0.3, 'dance', darkenHex(p.background, 0.65))
  // watchers in shadow, mirrored
  withMirrorSymmetry(ctx, w, () => {
    drawSilhouetteFigure(ctx, w * 0.16, h * 0.94, h * 0.2, 'stand', darkenHex(p.background, 0.5))
    drawSilhouetteFigure(ctx, w * 0.24, h * 0.95, h * 0.21, 'stand', darkenHex(p.background, 0.55))
  })
  drawStringDots(ctx, w, h * 0.1, h * 0.06, 22, p.accent, Math.max(1.4, h * 0.0055))
  drawStringDots(ctx, w, h * 0.18, h * 0.05, 18, lightenHex(p.primary, 0.25), Math.max(1.1, h * 0.0045))
  drawDecoFrame(ctx, w, h, p.accent)
}

// ---------------------------------------------------------------------------
// the registry
// ---------------------------------------------------------------------------

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
  plates: [
    // --- dusk-arrival (fountain court, 325) ---
    {
      id: 'far-skyline-325',
      layer: 'far',
      azimuthDeg: 325,
      memberBeatIds: ['dusk-arrival'],
      source: { kind: 'paint', paint: paintNightSkylineFar },
    },
    {
      id: 'mid-dusk-fountain',
      layer: 'mid',
      azimuthDeg: 325,
      memberBeatIds: ['dusk-arrival'],
      source: { kind: 'paint', paint: paintDuskFountainMid },
    },
    // --- orchestra sector (80), far plate shared with dancing ---
    {
      id: 'far-skyline-80',
      layer: 'far',
      azimuthDeg: 80,
      memberBeatIds: ['orchestra-tuning', 'dancing-under-lights'],
      source: { kind: 'paint', paint: paintNightSkylineFar },
    },
    {
      id: 'mid-orchestra',
      layer: 'mid',
      azimuthDeg: 80,
      memberBeatIds: ['orchestra-tuning'],
      source: { kind: 'paint', paint: paintOrchestraMid },
    },
    {
      // slightly inside the orchestra plate so the crossfade between the two
      // 80-degree mids layers cleanly instead of coinciding in depth
      id: 'mid-dancing',
      layer: 'mid',
      azimuthDeg: 80,
      memberBeatIds: ['dancing-under-lights'],
      radius: 19.4,
      source: { kind: 'paint', paint: paintDancingMid },
    },
  ],
  // Populated by the window track step (3-4 sentence scene windows).
  windows: [],
}
