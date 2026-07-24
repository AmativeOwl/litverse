import type { ScenePlateSet } from '../../types-plates'
import type { SceneBeat } from '../../types'
import {
  darkenHex,
  drawBandedSky,
  drawBeamCone,
  drawCarProfile,
  drawDecoFrame,
  drawSilhouetteFigure,
  drawStringDots,
  drawSunburst,
  drawWaveBand,
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

/** Bright daytime far plate: banded day sky over stylized water. Topmost band == background for a seamless edge. */
function paintDaySkyFar(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.6, [
    p.background,
    mixHex(p.background, p.primary, 0.35),
    mixHex(p.background, p.primary, 0.65),
  ])
  ctx.fillStyle = mixHex(p.background, darkenHex(p.primary, 0.15), 0.55)
  ctx.fillRect(0, h * 0.6, w, h * 0.4)
  for (let i = 0; i < 4; i++) {
    drawWaveBand(
      ctx,
      h * (0.66 + i * 0.08),
      w,
      h * 0.006,
      w * 0.1,
      lightenHex(p.primary, 0.15 + i * 0.1),
      Math.max(1, h * 0.005),
    )
  }
}

// ---------------------------------------------------------------------------
// mid plates: framed poster compositions (from the approved concept board)
// ---------------------------------------------------------------------------

/** daytime-leisure: sun, the Sound, diving tower and raft, motorboat wake fans. */
function paintDaytimeMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.55, [
    lightenHex(p.background, 0.25),
    mixHex(p.background, p.primary, 0.4),
    p.primary,
  ])
  ctx.fillStyle = mixHex(p.background, '#2a6aa5', 0.5)
  ctx.fillRect(0, h * 0.55, w, h * 0.45)
  const sx = w * 0.5
  const sy = h * 0.2
  drawSunburst(ctx, sx, sy, h * 0.1, h * 0.24, 24, lightenHex(p.accent, 0.15), 0, Math.PI * 2, 0.7)
  ctx.fillStyle = p.accent
  ctx.beginPath()
  ctx.arc(sx, sy, h * 0.085, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    drawWaveBand(
      ctx,
      h * (0.62 + i * 0.09),
      w,
      h * 0.008,
      w * 0.12,
      lightenHex(p.primary, 0.2 + i * 0.1),
      Math.max(1, h * 0.006),
    )
  }
  withMirrorSymmetry(ctx, w, () => {
    ctx.fillStyle = darkenHex(p.background, 0.4)
    ctx.fillRect(w * 0.14, h * 0.3, w * 0.012, h * 0.32)
    ctx.fillRect(w * 0.2, h * 0.3, w * 0.012, h * 0.32)
    ctx.fillRect(w * 0.12, h * 0.3, w * 0.11, h * 0.018)
    drawSilhouetteFigure(ctx, w * 0.3, h * 0.62, h * 0.16, 'stand', darkenHex(p.background, 0.4))
  })
  // diver arc
  ctx.strokeStyle = darkenHex(p.background, 0.5)
  ctx.lineWidth = h * 0.012
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(w * 0.35, h * 0.42, h * 0.09, -Math.PI * 0.1, Math.PI * 0.6)
  ctx.stroke()
  // motorboat + wake fan
  ctx.fillStyle = darkenHex(p.background, 0.55)
  ctx.fillRect(w * 0.58, h * 0.72, w * 0.14, h * 0.03)
  ctx.fillRect(w * 0.66, h * 0.69, w * 0.03, h * 0.03)
  drawSunburst(ctx, w * 0.58, h * 0.735, w * 0.01, w * 0.13, 6, lightenHex(p.primary, 0.35), Math.PI * 0.85, Math.PI * 1.15, 0.9)
  drawDecoFrame(ctx, w, h, mixHex(p.accent, '#b98a3a', 0.5))
}

/** weekend-traffic: gate ziggurats, the car queue, headlight beam cones, the brisk yellow bug. */
function paintWeekendMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.6, [
    darkenHex(p.background, 0.2),
    p.background,
    mixHex(p.background, p.accent, 0.3),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.45)
  ctx.fillRect(0, h * 0.6, w, h * 0.4)
  withMirrorSymmetry(ctx, w, () => {
    drawZigguratTower(ctx, w * 0.08, h * 0.6, w * 0.09, h * 0.34, 3, darkenHex(p.background, 0.55))
  })
  ctx.fillStyle = mixHex(p.background, p.accent, 0.15)
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(w * 0.5 - w * 0.006, h * (0.64 + (i / 5) * 0.3), w * 0.012, h * 0.04)
  }
  drawCarProfile(ctx, w * 0.5, h * 0.88, w * 0.3, darkenHex(p.background, 0.6), p.accent)
  drawCarProfile(ctx, w * 0.28, h * 0.76, w * 0.18, darkenHex(p.background, 0.5), p.accent)
  drawCarProfile(ctx, w * 0.72, h * 0.76, w * 0.18, mixHex(p.accent, '#c9a227', 0.55))
  drawCarProfile(ctx, w * 0.4, h * 0.68, w * 0.11, darkenHex(p.background, 0.42), p.accent)
  drawCarProfile(ctx, w * 0.6, h * 0.68, w * 0.11, darkenHex(p.background, 0.42), p.accent)
  drawBeamCone(ctx, w * 0.35, h * 0.85, w * 0.22, h * 0.05, mixHex(p.accent, '#ffffff', 0.15))
  drawBeamCone(ctx, w * 0.2, h * 0.74, w * 0.15, h * 0.035, p.accent)
  drawDecoFrame(ctx, w, h, p.accent)
}

/** monday-lull: the pale morning colonnade, servants with mops, the orange pyramid by the door. */
function paintMondayMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.62, [
    lightenHex(p.background, 0.2),
    p.background,
    mixHex(p.background, p.primary, 0.6),
  ])
  ctx.fillStyle = mixHex(p.primary, p.background, 0.4)
  ctx.fillRect(0, h * 0.62, w, h * 0.38)
  withMirrorSymmetry(ctx, w, () => {
    ctx.fillStyle = mixHex(p.primary, '#ffffff', 0.12)
    ctx.fillRect(w * 0.06, h * 0.3, w * 0.36, h * 0.32)
    ctx.fillStyle = p.background
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(w * (0.09 + i * 0.085), h * 0.34, w * 0.02, h * 0.24)
    }
    ctx.fillStyle = mixHex(p.primary, '#ffffff', 0.2)
    ctx.beginPath()
    ctx.moveTo(w * 0.04, h * 0.3)
    ctx.lineTo(w * 0.24, h * 0.22)
    ctx.lineTo(w * 0.44, h * 0.3)
    ctx.closePath()
    ctx.fill()
  })
  drawSilhouetteFigure(ctx, w * 0.3, h * 0.9, h * 0.17, 'mop', darkenHex(p.background, 0.35))
  drawSilhouetteFigure(ctx, w * 0.5, h * 0.88, h * 0.15, 'serve', darkenHex(p.background, 0.3))
  drawSilhouetteFigure(ctx, w * 0.68, h * 0.9, h * 0.17, 'mop', darkenHex(p.background, 0.35))
  // the pyramid of pulpless halves
  ctx.fillStyle = mixHex(p.accent, '#d98324', 0.5)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col <= row; col++) {
      ctx.beginPath()
      ctx.arc(w * 0.85 - row * h * 0.016 + col * h * 0.032, h * 0.94 - (2 - row) * h * 0.028, h * 0.014, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  drawDecoFrame(ctx, w, h, mixHex(p.accent, '#9a8a5a', 0.4))
}

/** evening-bar-setup: hall columns, bottle rows, the counter with THE brass rail, buffet pyramid, caterers. */
function paintBarSetupMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.58, [
    darkenHex(p.background, 0.25),
    p.background,
    mixHex(p.background, p.primary, 0.5),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.4)
  ctx.fillRect(0, h * 0.58, w, h * 0.42)
  withMirrorSymmetry(ctx, w, () => {
    ctx.fillStyle = mixHex(p.primary, p.background, 0.35)
    ctx.fillRect(w * 0.07, h * 0.16, w * 0.035, h * 0.44)
    ctx.fillRect(w * 0.058, h * 0.14, w * 0.06, h * 0.02)
  })
  ctx.fillStyle = darkenHex(p.primary, 0.3)
  ctx.fillRect(w * 0.2, h * 0.36, w * 0.6, h * 0.2)
  const bottleColors = [p.accent, lightenHex(p.primary, 0.3), mixHex(p.accent, '#ff6b6b', 0.4), lightenHex(p.background, 0.5)]
  for (let i = 0; i < 12; i++) {
    const bx = w * (0.23 + i * 0.045)
    ctx.fillStyle = bottleColors[i % 4] ?? p.accent
    ctx.fillRect(bx, h * 0.4, w * 0.014, h * 0.09)
    ctx.fillRect(bx + w * 0.004, h * 0.37, w * 0.006, h * 0.03)
  }
  ctx.fillStyle = darkenHex(p.background, 0.55)
  ctx.fillRect(w * 0.16, h * 0.6, w * 0.68, h * 0.16)
  ctx.strokeStyle = p.accent
  ctx.lineWidth = Math.max(2, h * 0.012)
  ctx.beginPath()
  ctx.moveTo(w * 0.16, h * 0.8)
  ctx.lineTo(w * 0.84, h * 0.8)
  ctx.stroke()
  ctx.fillStyle = mixHex(p.accent, '#ffdf9e', 0.4)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      ctx.beginPath()
      ctx.arc(w * 0.5 - row * h * 0.02 + col * h * 0.04, h * 0.57 - (3 - row) * h * 0.033, h * 0.016, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  drawSilhouetteFigure(ctx, w * 0.12, h * 0.94, h * 0.2, 'serve', darkenHex(p.background, 0.5))
  drawSilhouetteFigure(ctx, w * 0.88, h * 0.94, h * 0.2, 'serve', darkenHex(p.background, 0.5))
  drawDecoFrame(ctx, w, h, p.accent)
}

/** full-swing-cocktails: bokeh discs, the center glow, floating deco cocktail glasses, raised-arm crowd. */
function paintFullSwingMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.62, [
    darkenHex(p.background, 0.25),
    p.background,
    mixHex(p.background, p.primary, 0.35),
    mixHex(p.primary, p.accent, 0.2),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.35)
  ctx.fillRect(0, h * 0.62, w, h * 0.38)
  for (let i = 0; i < 16; i++) {
    const t = ((i * 61) % 100) / 100
    ctx.globalAlpha = 0.12 + t * 0.12
    ctx.fillStyle = i % 3 ? p.accent : lightenHex(p.primary, 0.2)
    ctx.beginPath()
    ctx.arc((i * 151) % w, h * (0.1 + t * 0.4), h * (0.02 + t * 0.05), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  drawSunburst(ctx, w / 2, h * 0.34, h * 0.03, h * 0.16, 16, p.accent, 0, Math.PI * 2, 0.45)
  withMirrorSymmetry(ctx, w, () => {
    const glasses: ReadonlyArray<readonly [number, number]> = [
      [0.3, 0.3],
      [0.42, 0.22],
    ]
    for (const [gx, gy] of glasses) {
      ctx.strokeStyle = p.accent
      ctx.lineWidth = Math.max(1.2, h * 0.006)
      ctx.beginPath()
      ctx.moveTo(w * gx - h * 0.03, h * gy)
      ctx.lineTo(w * gx + h * 0.03, h * gy)
      ctx.lineTo(w * gx, h * gy + h * 0.045)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(w * gx, h * (gy + 0.045))
      ctx.lineTo(w * gx, h * (gy + 0.085))
      ctx.stroke()
    }
    drawSilhouetteFigure(ctx, w * 0.14, h * 0.96, h * 0.22, 'dance', darkenHex(p.background, 0.55))
    drawSilhouetteFigure(ctx, w * 0.26, h * 0.94, h * 0.2, 'horn', darkenHex(p.background, 0.5))
    drawSilhouetteFigure(ctx, w * 0.38, h * 0.96, h * 0.23, 'dance', darkenHex(p.background, 0.55))
  })
  drawSilhouetteFigure(ctx, w * 0.5, h * 0.97, h * 0.24, 'dance', darkenHex(p.background, 0.6))
  drawDecoFrame(ctx, w, h, p.accent)
}

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
    // --- daytime-leisure (the Sound, 28) ---
    {
      id: 'far-daysky-28',
      layer: 'far',
      azimuthDeg: 28,
      memberBeatIds: ['daytime-leisure'],
      source: { kind: 'paint', paint: paintDaySkyFar },
    },
    {
      id: 'mid-daytime-sound',
      layer: 'mid',
      azimuthDeg: 28,
      memberBeatIds: ['daytime-leisure'],
      source: { kind: 'paint', paint: paintDaytimeMid },
    },
    // --- weekend-traffic (the drive, 280) ---
    {
      id: 'far-skyline-280',
      layer: 'far',
      azimuthDeg: 280,
      memberBeatIds: ['weekend-traffic'],
      source: { kind: 'paint', paint: paintNightSkylineFar },
    },
    {
      id: 'mid-weekend-cars',
      layer: 'mid',
      azimuthDeg: 280,
      memberBeatIds: ['weekend-traffic'],
      source: { kind: 'paint', paint: paintWeekendMid },
    },
    // --- monday-lull (the estate, 140) ---
    {
      id: 'far-daysky-140',
      layer: 'far',
      azimuthDeg: 140,
      memberBeatIds: ['monday-lull'],
      source: { kind: 'paint', paint: paintDaySkyFar },
    },
    {
      id: 'mid-monday-estate',
      layer: 'mid',
      azimuthDeg: 140,
      memberBeatIds: ['monday-lull'],
      source: { kind: 'paint', paint: paintMondayMid },
    },
    // --- evening-bar-setup (hall & buffet, 222) ---
    {
      id: 'far-skyline-222',
      layer: 'far',
      azimuthDeg: 222,
      memberBeatIds: ['evening-bar-setup'],
      source: { kind: 'paint', paint: paintNightSkylineFar },
    },
    {
      id: 'mid-bar-setup',
      layer: 'mid',
      azimuthDeg: 222,
      memberBeatIds: ['evening-bar-setup'],
      source: { kind: 'paint', paint: paintBarSetupMid },
    },
    // --- full-swing-cocktails (the garden bar, 235) ---
    {
      id: 'far-skyline-235',
      layer: 'far',
      azimuthDeg: 235,
      memberBeatIds: ['full-swing-cocktails'],
      source: { kind: 'paint', paint: paintNightSkylineFar },
    },
    {
      id: 'mid-full-swing',
      layer: 'mid',
      azimuthDeg: 235,
      memberBeatIds: ['full-swing-cocktails'],
      source: { kind: 'paint', paint: paintFullSwingMid },
    },
  ],
  // Populated by the window track step (3-4 sentence scene windows).
  windows: [],
}
