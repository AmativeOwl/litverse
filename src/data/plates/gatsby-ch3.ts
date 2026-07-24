import type { CardSpec, ScenePlateSet } from '../../types-plates'
import type { SceneBeat } from '../../types'
import { composeCard } from '../../components/world/decoCardComposer'
import {
  darkenHex,
  drawBandedSky,
  drawBeamCone,
  drawCarProfile,
  drawDecoFrame,
  drawFruitPyramid,
  drawGlazedHam,
  drawJuiceMachine,
  drawPastryRow,
  drawSilhouetteFigure,
  drawStringDots,
  drawSunburst,
  drawTurkey,
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

/** daytime-leisure: sun, the Sound, diving tower and raft, the dive-and-splash cycle, a motorboat crossing. */
function paintDaytimeMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
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
      t * (0.7 + i * 0.2),
    )
  }
  withMirrorSymmetry(ctx, w, () => {
    ctx.fillStyle = darkenHex(p.background, 0.4)
    ctx.fillRect(w * 0.14, h * 0.3, w * 0.012, h * 0.32)
    ctx.fillRect(w * 0.2, h * 0.3, w * 0.012, h * 0.32)
    ctx.fillRect(w * 0.12, h * 0.3, w * 0.11, h * 0.018)
    drawSilhouetteFigure(ctx, w * 0.3, h * 0.62, h * 0.16, 'stand', darkenHex(p.background, 0.4))
  })
  // --- the act of diving and splashing, on a ~6.5s loop ---------------------
  const diveT = (t / 6.5) % 1
  const diverColor = darkenHex(p.background, 0.5)
  const towerX = w * 0.17
  const towerTopY = h * 0.285
  const entryX = w * 0.37
  const entryY = h * 0.63
  if (diveT < 0.3) {
    // poised on the platform, a small anticipatory crouch just before the leap
    const crouch = diveT > 0.24 ? Math.sin(((diveT - 0.24) / 0.06) * Math.PI) * h * 0.008 : 0
    drawSilhouetteFigure(ctx, towerX, towerTopY + crouch, h * 0.075, 'stand', diverColor)
  } else if (diveT < 0.62) {
    // the flight: a headfirst arc from platform to water
    const u = (diveT - 0.3) / 0.32
    const dx = towerX + (entryX - towerX) * u
    const dy = towerTopY + (-0.35 * u + 1.35 * u * u) * (entryY - towerTopY)
    const angle = -0.4 + u * 2.0 // rotates from near-horizontal leap to vertical entry
    ctx.save()
    ctx.translate(dx, dy)
    ctx.rotate(angle)
    ctx.strokeStyle = diverColor
    ctx.lineWidth = h * 0.016
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, -h * 0.028)
    ctx.lineTo(0, h * 0.028)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, -h * 0.038, h * 0.011, 0, Math.PI * 2)
    ctx.fillStyle = diverColor
    ctx.fill()
    ctx.restore()
  } else if (diveT < 0.78) {
    // the splash: a white fan bursting up from the entry point
    const v = (diveT - 0.62) / 0.16
    drawSunburst(ctx, entryX, entryY, h * 0.01, h * (0.03 + v * 0.07), 7, lightenHex(p.primary, 0.5), Math.PI * 1.15, Math.PI * 1.85, 1 - v * 0.6)
  }
  if (diveT >= 0.62) {
    // ripples widening from the entry, fading as the loop closes
    const r = (diveT - 0.62) / 0.38
    ctx.strokeStyle = lightenHex(p.primary, 0.4)
    ctx.lineWidth = Math.max(1, h * 0.005)
    ctx.globalAlpha = 1 - r
    for (const ring of [0.6, 1]) {
      ctx.beginPath()
      ctx.ellipse(entryX, entryY, w * 0.05 * r * ring, h * 0.012 * r * ring, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  // motorboat crossing the Sound, wake trailing behind
  const boatX = w * (0.85 - ((t * 0.022) % 0.5))
  ctx.fillStyle = darkenHex(p.background, 0.55)
  ctx.fillRect(boatX - w * 0.07, h * 0.72, w * 0.14, h * 0.03)
  ctx.fillRect(boatX + w * 0.01, h * 0.69, w * 0.03, h * 0.03)
  drawSunburst(ctx, boatX + w * 0.07, h * 0.735, w * 0.01, w * 0.11, 6, lightenHex(p.primary, 0.35), -Math.PI * 0.15, Math.PI * 0.15, 0.9)
  drawDecoFrame(ctx, w, h, mixHex(p.accent, '#b98a3a', 0.5))
}

/** weekend-traffic: gate ziggurats, the car queue, headlight beam cones, the brisk yellow bug scampering through. */
function paintWeekendMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
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
  // the stately queue, bearing parties to and from the city
  drawCarProfile(ctx, w * 0.5, h * 0.88, w * 0.3, darkenHex(p.background, 0.6), p.accent)
  drawCarProfile(ctx, w * 0.28, h * 0.76, w * 0.18, darkenHex(p.background, 0.5), p.accent)
  drawCarProfile(ctx, w * 0.72, h * 0.76, w * 0.18, darkenHex(p.background, 0.5), p.accent)
  drawCarProfile(ctx, w * 0.4, h * 0.68, w * 0.11, darkenHex(p.background, 0.42), p.accent)
  drawCarProfile(ctx, w * 0.6, h * 0.68, w * 0.11, darkenHex(p.background, 0.42), p.accent)
  drawBeamCone(ctx, w * 0.35, h * 0.85, w * 0.22, h * 0.05, mixHex(p.accent, '#ffffff', 0.15))
  drawBeamCone(ctx, w * 0.2, h * 0.74, w * 0.15, h * 0.035, p.accent)
  // the brisk yellow bug, scampering through the queue on a weaving line
  const bugT = ((t * 0.055) % 1.2) - 0.1
  const bugX = w * bugT
  const bugY = h * (0.815 - 0.055 * Math.sin(bugT * 9))
  const bugLen = w * 0.13
  drawBeamCone(ctx, bugX + bugLen * 0.45, bugY - bugLen * 0.09, w * 0.12, h * 0.03, mixHex(p.accent, '#ffffff', 0.3))
  drawCarProfile(ctx, bugX, bugY, bugLen, mixHex(p.accent, '#c9a227', 0.55), lightenHex(p.accent, 0.3))
  drawDecoFrame(ctx, w, h, p.accent)
}

/** monday-lull: the pale morning colonnade, servants scrubbing at the ravages, the orange pyramid by the door. */
function paintMondayMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
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
  // the servants at work: moppers scrub in short strokes, the third paces
  // the veranda with a tray of gathered glasses
  const scrubA = Math.sin(t * 3.1) * w * 0.007
  const scrubB = Math.sin(t * 2.7 + 2) * w * 0.007
  drawSilhouetteFigure(ctx, w * 0.3 + scrubA, h * 0.9, h * 0.17, 'mop', darkenHex(p.background, 0.35))
  drawSilhouetteFigure(ctx, w * 0.68 + scrubB, h * 0.9, h * 0.17, 'mop', darkenHex(p.background, 0.35))
  const paceX = w * (0.5 + 0.16 * Math.sin(t * 0.35))
  const paceBob = Math.abs(Math.sin(t * 2.4)) * h * 0.004
  drawSilhouetteFigure(ctx, paceX, h * 0.88 + paceBob, h * 0.15, 'serve', darkenHex(p.background, 0.3))
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
  t = 0,
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
  // tiered fountain with a spray fan, shimmering
  const cx = w / 2
  const fy = h * 0.82
  drawSunburst(ctx, cx, fy - h * 0.3, h * 0.02, h * (0.125 + 0.012 * Math.sin(t * 1.7)), 9, p.accent, -Math.PI * 0.85, -Math.PI * 0.15, 0.7 + 0.2 * Math.sin(t * 2.3))
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
function paintOrchestraMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
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
  drawStringDots(ctx, w, h * 0.12, h * 0.05, 20, lightenHex(p.accent, 0.2), Math.max(1.5, h * 0.006), t)
  drawStringDots(ctx, w, h * 0.2, h * 0.045, 17, p.accent, Math.max(1.2, h * 0.005), t + 1.6)
  drawDecoFrame(ctx, w, h, p.accent)
}

/** dancing-under-lights: the gypsy alone on the canvas platform under a spotlight sunburst. */
function paintDancingMid(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
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
  // the dancer, arms up, center-lit, swaying with the music
  drawSilhouetteFigure(ctx, w / 2 + Math.sin(t * 1.4) * w * 0.006, h * 0.85, h * (0.3 + 0.006 * Math.sin(t * 2.8)), 'dance', darkenHex(p.background, 0.65))
  // watchers in shadow, mirrored
  withMirrorSymmetry(ctx, w, () => {
    drawSilhouetteFigure(ctx, w * 0.16, h * 0.94, h * 0.2, 'stand', darkenHex(p.background, 0.5))
    drawSilhouetteFigure(ctx, w * 0.24, h * 0.95, h * 0.21, 'stand', darkenHex(p.background, 0.55))
  })
  drawStringDots(ctx, w, h * 0.1, h * 0.06, 22, p.accent, Math.max(1.4, h * 0.0055), t)
  drawStringDots(ctx, w, h * 0.18, h * 0.05, 18, lightenHex(p.primary, 0.25), Math.max(1.1, h * 0.0045), t + 1.1)
  drawDecoFrame(ctx, w, h, p.accent)
}

// ---------------------------------------------------------------------------
// window plates: what a specific 3-4 sentence run literally describes
// ---------------------------------------------------------------------------

/**
 * p2-s1 only: "Every Friday five crates of oranges and lemons arrived from a
 * fruiterer in New York -- every Monday these same oranges and lemons left
 * his back door in a pyramid of pulpless halves."
 *
 * THE CARD-GRAMMAR PROOF: this card is pure data -- nouns as objects, verbs
 * as movements -- interpreted by decoCardComposer, exactly the shape the
 * compiler's mining pass emits for any text. ("arrived" -> the delivery
 * figure paces with its load; everything else holds still, Monday-quiet.)
 */
const CRATES_CARD: CardSpec = {
  skyBands: 3,
  groundY: 0.68,
  elements: [
    { noun: 'door', at: [0.51, 0.74], size: 0.58 },
    { noun: 'crate', at: [0.14, 0.86], size: 0.1, colorRole: 'accent' },
    { noun: 'crate', at: [0.26, 0.86], size: 0.1, colorRole: 'accent-light' },
    { noun: 'crate', at: [0.2, 0.7], size: 0.1, colorRole: 'accent' },
    { noun: 'crate', at: [0.72, 0.86], size: 0.1, colorRole: 'accent-light' },
    { noun: 'crate', at: [0.84, 0.86], size: 0.1, colorRole: 'accent' },
    { noun: 'fruit-pyramid', at: [0.51, 0.9], size: 0.55 },
    { noun: 'figure', at: [0.34, 0.93], size: 0.24, pose: 'serve', colorRole: 'shadow', motion: { verb: 'pace', amplitude: 0.55, speed: 0.8 } },
  ],
}

/**
 * p2-s2 only: "There was a machine in the kitchen which could extract the
 * juice of two hundred oranges in half an hour if a little button was
 * pressed two hundred times by a butler's thumb."
 */
function paintJuiceMachineWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  // kitchen interior: banded wall, counter line
  drawBandedSky(ctx, 0, w, h * 0.7, [
    lightenHex(p.background, 0.15),
    p.background,
    mixHex(p.background, p.primary, 0.45),
  ])
  ctx.fillStyle = mixHex(p.primary, p.background, 0.3)
  ctx.fillRect(0, h * 0.7, w, h * 0.3)
  const orange = mixHex(p.accent, '#d98324', 0.55)
  // the machine, hero-scale center, crank turning
  drawJuiceMachine(ctx, w * 0.52, h * 0.88, h * 0.56, darkenHex(p.primary, 0.15), p.accent, t)
  // juice dripping from the spout into the glass
  ctx.fillStyle = lightenHex(p.accent, 0.2)
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.9 + i * 0.33) % 1
    ctx.globalAlpha = 1 - phase * 0.5
    ctx.beginPath()
    ctx.arc(w * 0.52, h * (0.76 + phase * 0.1), Math.max(1, h * 0.006), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // the butler at the little button, pressing (two hundred times)
  const press = Math.max(0, Math.sin(t * 3.1)) * h * 0.008
  drawSilhouetteFigure(ctx, w * 0.34, h * 0.92 + press, h * 0.28, 'serve', darkenHex(p.background, 0.4))
  // two hundred oranges, waiting
  drawFruitPyramid(ctx, w * 0.76, h * 0.88, 4, h * 0.02, orange)
  drawFruitPyramid(ctx, w * 0.88, h * 0.88, 3, h * 0.018, orange)
  // a row of filled juice glasses
  ctx.fillStyle = lightenHex(p.accent, 0.2)
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(w * (0.12 + i * 0.045), h * 0.63, w * 0.02, h * 0.05)
  }
  drawDecoFrame(ctx, w, h, mixHex(p.accent, '#9a8a5a', 0.4))
}

/**
 * p3-s1 only: "a corps of caterers came down with several hundred feet of
 * canvas and enough coloured lights to make a Christmas tree of Gatsby's
 * enormous garden."
 */
function paintCanvasLightsWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  drawBandedSky(ctx, 0, w, h * 0.6, [
    darkenHex(p.background, 0.25),
    p.background,
    mixHex(p.background, p.primary, 0.45),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.4)
  ctx.fillRect(0, h * 0.6, w, h * 0.4)
  // the canvas canopy: scalloped tent band across the top
  ctx.fillStyle = lightenHex(p.primary, 0.3)
  ctx.fillRect(0, 0, w, h * 0.1)
  for (let i = 0; i < 12; i++) {
    ctx.beginPath()
    ctx.arc(w * (0.04 + i * 0.084), h * 0.1, w * 0.032, 0, Math.PI)
    ctx.fill()
  }
  // enough coloured lights for a Christmas tree -- twinkling
  const lightColors = [p.accent, mixHex(p.accent, '#ff6b6b', 0.5), mixHex(p.accent, '#6bd6ff', 0.4)]
  lightColors.forEach((color, i) => {
    drawStringDots(ctx, w, h * (0.2 + i * 0.1), h * 0.055, 19 - i * 2, color, Math.max(1.4, h * 0.0055), t + i * 2.2)
  })
  // rigging poles + the corps of caterers at work
  withMirrorSymmetry(ctx, w, () => {
    ctx.fillStyle = darkenHex(p.primary, 0.4)
    ctx.fillRect(w * 0.12, h * 0.2, w * 0.008, h * 0.55)
    drawSilhouetteFigure(ctx, w * 0.2, h * 0.93, h * 0.22, 'serve', darkenHex(p.background, 0.5))
    drawSilhouetteFigure(ctx, w * 0.34, h * 0.95, h * 0.2, 'mop', darkenHex(p.background, 0.45))
  })
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * p3-s2 only: "On buffet tables, garnished with glistening hors-d'oeuvre,
 * spiced baked hams crowded against salads of harlequin designs and pastry
 * pigs and turkeys bewitched to a dark gold."
 */
function paintBuffetWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  drawBandedSky(ctx, 0, w, h * 0.6, [
    darkenHex(p.background, 0.25),
    p.background,
    mixHex(p.background, p.primary, 0.45),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.4)
  ctx.fillRect(0, h * 0.6, w, h * 0.4)
  // a single garland overhead -- the full light rig is the p3-s1 window's show
  drawStringDots(ctx, w, h * 0.12, h * 0.05, 17, p.accent, Math.max(1.3, h * 0.005), t)
  // the long draped buffet table
  ctx.fillStyle = lightenHex(p.primary, 0.35)
  ctx.fillRect(w * 0.12, h * 0.62, w * 0.76, h * 0.05)
  ctx.fillStyle = mixHex(p.primary, p.background, 0.25)
  ctx.fillRect(w * 0.12, h * 0.67, w * 0.76, h * 0.2)
  // scalloped drape edge
  ctx.fillStyle = lightenHex(p.primary, 0.35)
  for (let i = 0; i < 10; i++) {
    ctx.beginPath()
    ctx.arc(w * (0.16 + i * 0.076), h * 0.67, w * 0.028, 0, Math.PI)
    ctx.fill()
  }
  // the spread: hams, the turkey centerpiece, harlequin salads, pastry row, fruit pyramid
  const gold = mixHex(p.accent, '#c98a2a', 0.4)
  drawGlazedHam(ctx, w * 0.24, h * 0.575, w * 0.09, mixHex(p.accent, '#b0522a', 0.55), lightenHex(p.accent, 0.4))
  drawGlazedHam(ctx, w * 0.76, h * 0.575, w * 0.09, mixHex(p.accent, '#b0522a', 0.55), lightenHex(p.accent, 0.4))
  drawTurkey(ctx, w * 0.5, h * 0.545, w * 0.1, gold, lightenHex(p.accent, 0.25))
  // harlequin salad bowls: diamond-checked
  for (const bx of [0.37, 0.63]) {
    ctx.fillStyle = darkenHex(p.primary, 0.2)
    ctx.beginPath()
    ctx.ellipse(w * bx, h * 0.6, w * 0.035, h * 0.022, 0, 0, Math.PI)
    ctx.fill()
    ctx.fillStyle = lightenHex(p.accent, 0.15)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      const dx = w * bx - w * 0.018 + i * w * 0.018
      ctx.moveTo(dx, h * 0.585)
      ctx.lineTo(dx + w * 0.009, h * 0.6)
      ctx.lineTo(dx, h * 0.615)
      ctx.lineTo(dx - w * 0.009, h * 0.6)
      ctx.closePath()
      ctx.fill()
    }
  }
  drawPastryRow(ctx, w * 0.3, h * 0.635, 7, w * 0.058, h * 0.028, mixHex(p.accent, '#ffdf9e', 0.5))
  drawFruitPyramid(ctx, w * 0.13, h * 0.62, 3, h * 0.017, mixHex(p.accent, '#d98324', 0.5))
  // caterers
  drawSilhouetteFigure(ctx, w * 0.07, h * 0.95, h * 0.22, 'serve', darkenHex(p.background, 0.5))
  drawSilhouetteFigure(ctx, w * 0.93, h * 0.95, h * 0.22, 'serve', darkenHex(p.background, 0.5))
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * p1-s2: "In his blue gardens men and girls came and went like moths among
 * the whisperings and the champagne and the stars."
 */
function paintMothsWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  drawBandedSky(ctx, 0, w, h * 0.7, [
    darkenHex(p.background, 0.3),
    p.background,
    mixHex(p.background, p.primary, 0.4),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.35)
  ctx.fillRect(0, h * 0.7, w, h * 0.3)
  // the stars
  ctx.fillStyle = lightenHex(p.accent, 0.4)
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.2 + ((i * 37) % 10) / 13
    ctx.fillRect((i * 131) % w, (i * 47) % (h * 0.5), 1.5, 1.5)
  }
  ctx.globalAlpha = 1
  // a giant champagne coupe, center -- bowl, stem, rising bubble dots
  const cx = w / 2
  ctx.strokeStyle = p.accent
  ctx.lineWidth = Math.max(2, h * 0.008)
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.09, h * 0.34)
  ctx.quadraticCurveTo(cx, h * 0.52, cx + w * 0.09, h * 0.34)
  ctx.moveTo(cx, h * 0.5)
  ctx.lineTo(cx, h * 0.72)
  ctx.moveTo(cx - w * 0.05, h * 0.72)
  ctx.lineTo(cx + w * 0.05, h * 0.72)
  ctx.stroke()
  // bubbles rising in the coupe, looping deterministically on t
  ctx.fillStyle = lightenHex(p.accent, 0.3)
  for (let i = 0; i < 8; i++) {
    const phase = (t * 0.12 + i * 0.125) % 1
    ctx.globalAlpha = 1 - phase * 0.7
    ctx.beginPath()
    ctx.arc(cx + Math.sin(i * 2.1) * w * 0.04, h * (0.5 - phase * 0.16), Math.max(1.2, h * 0.006 - i * 0.3), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // moths: paired-triangle wings circling two glowing garden lamps, mirrored
  withMirrorSymmetry(ctx, w, () => {
    ctx.fillStyle = p.accent
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 2.3)
    ctx.beginPath()
    ctx.arc(w * 0.22, h * 0.4, h * 0.02, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = mixHex(p.primary, '#ffffff', 0.35)
    const moths: ReadonlyArray<readonly [number, number, number]> = [
      [0.16, 0.3, 0.5],
      [0.27, 0.5, -0.4],
      [0.2, 0.55, 0.2],
      [0.31, 0.26, -0.7],
    ]
    moths.forEach(([mx, my, rot], i) => {
      // each moth loops a small ellipse around the lamp and flutters
      const orbit = t * (0.5 + i * 0.13) + i * 1.7
      const ox = Math.cos(orbit) * w * 0.012
      const oy = Math.sin(orbit * 1.3) * h * 0.02
      const flutter = Math.sin(t * 9 + i * 2.1) * 0.45
      ctx.save()
      ctx.translate(w * mx + ox, h * my + oy)
      ctx.rotate(rot + flutter * 0.3)
      const s = h * 0.018
      const wingLift = 1 - Math.abs(flutter) * 0.5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-s * 1.6, -s * wingLift)
      ctx.lineTo(-s * 1.2, s * 0.4)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(s * 1.6, -s * wingLift)
      ctx.lineTo(s * 1.2, s * 0.4)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    })
    // men and girls, coming and going
    drawSilhouetteFigure(ctx, w * 0.1, h * 0.94, h * 0.2, 'stand', darkenHex(p.background, 0.5))
    drawSilhouetteFigure(ctx, w * 0.17, h * 0.95, h * 0.21, 'stand', darkenHex(p.background, 0.55))
  })
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * p4-s1: "no thin five-piece affair, but a whole pitful of oboes and
 * trombones and saxophones and viols and cornets and piccolos, and low and
 * high drums."
 */
function paintInstrumentsWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.6, [
    darkenHex(p.background, 0.3),
    p.background,
    mixHex(p.background, p.primary, 0.5),
  ])
  ctx.fillStyle = darkenHex(p.primary, 0.4)
  ctx.fillRect(0, h * 0.6, w, h * 0.4)
  // the band riser
  ctx.fillStyle = darkenHex(p.background, 0.45)
  ctx.fillRect(w * 0.1, h * 0.66, w * 0.8, h * 0.05)
  // the whole pitful, as a silhouette lineup: horns raised in a row
  const players: readonly number[] = [0.2, 0.32, 0.44, 0.56, 0.68]
  players.forEach((px, i) => {
    drawSilhouetteFigure(ctx, w * px, h * 0.66, h * (0.26 + (i % 2) * 0.03), 'horn', darkenHex(p.background, 0.6))
  })
  // low and high drums: a big bass drum disc with crossed tension lines
  const dx = w * 0.82
  const dy = h * 0.55
  const dr = h * 0.11
  ctx.fillStyle = mixHex(p.accent, p.background, 0.5)
  ctx.beginPath()
  ctx.arc(dx, dy, dr, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = p.accent
  ctx.lineWidth = Math.max(1.5, h * 0.006)
  ctx.beginPath()
  ctx.arc(dx, dy, dr, 0, Math.PI * 2)
  ctx.moveTo(dx - dr * 0.7, dy - dr * 0.7)
  ctx.lineTo(dx + dr * 0.7, dy + dr * 0.7)
  ctx.moveTo(dx + dr * 0.7, dy - dr * 0.7)
  ctx.lineTo(dx - dr * 0.7, dy + dr * 0.7)
  ctx.stroke()
  // a viol: lathe-profile body + neck, leaning
  ctx.fillStyle = mixHex(p.accent, '#8a5a2a', 0.5)
  ctx.beginPath()
  ctx.ellipse(w * 0.11, h * 0.56, w * 0.028, h * 0.075, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = mixHex(p.accent, '#8a5a2a', 0.5)
  ctx.lineWidth = Math.max(2, h * 0.008)
  ctx.beginPath()
  ctx.moveTo(w * 0.115, h * 0.49)
  ctx.lineTo(w * 0.13, h * 0.3)
  ctx.stroke()
  // notes rising: sunburst rays + accent dots
  drawSunburst(ctx, w / 2, h * 0.3, h * 0.04, h * 0.12, 9, mixHex(p.accent, p.primary, 0.3), Math.PI * 1.15, Math.PI * 1.85, 0.6)
  ctx.fillStyle = p.accent
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.arc(w * (0.3 + i * 0.08), h * (0.22 - (i % 2) * 0.05), Math.max(1.5, h * 0.007), 0, Math.PI * 2)
    ctx.fill()
  }
  drawStringDots(ctx, w, h * 0.1, h * 0.045, 18, p.accent, Math.max(1.3, h * 0.005))
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * p4-s2: "...the halls and salons and verandas are gaudy with primary
 * colours, and hair bobbed in strange new ways, and shawls beyond the
 * dreams of Castile."
 */
function paintGaudyArrivalsWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  drawBandedSky(ctx, 0, w, h * 0.55, [
    darkenHex(p.background, 0.25),
    p.background,
    mixHex(p.background, p.primary, 0.45),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.4)
  ctx.fillRect(0, h * 0.55, w, h * 0.45)
  // glowing hall doorway behind
  ctx.fillStyle = mixHex(p.accent, '#ffdf9e', 0.4)
  ctx.fillRect(w * 0.44, h * 0.22, w * 0.12, h * 0.4)
  ctx.strokeStyle = p.accent
  ctx.lineWidth = Math.max(1.5, h * 0.007)
  ctx.strokeRect(w * 0.44, h * 0.22, w * 0.12, h * 0.4)
  // cars five deep in the drive, far left/right
  drawCarProfile(ctx, w * 0.1, h * 0.6, w * 0.13, darkenHex(p.background, 0.55), p.accent)
  drawCarProfile(ctx, w * 0.9, h * 0.6, w * 0.13, darkenHex(p.background, 0.55), p.accent)
  // the gaudy primary-colour crowd, mirrored: shawl arcs + bobbed hair
  const FASHION: readonly string[] = ['#e63946', '#457b9d', '#ffd166', '#2a9d8f', '#d62aa0']
  withMirrorSymmetry(ctx, w, () => {
    const spots: ReadonlyArray<readonly [number, number]> = [
      [0.16, 0.3],
      [0.28, 0.32],
      [0.4, 0.29],
    ]
    spots.forEach(([fx, fh], i) => {
      const color = FASHION[i % FASHION.length] ?? p.accent
      const x = w * fx
      const figH = h * fh
      const baseY = h * 0.97
      drawSilhouetteFigure(ctx, x, baseY, figH, 'stand', mixHex(color, darkenHex(p.background, 0.4), 0.35))
      // the shawl: an arc swept off the shoulders
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(2.5, figH * 0.06)
      ctx.beginPath()
      ctx.arc(x, baseY - figH * 0.66, figH * 0.34, Math.PI * 0.1, Math.PI * 0.9)
      ctx.stroke()
      // bobbed hair: a fringe block over the head
      ctx.fillStyle = darkenHex(p.background, 0.6)
      ctx.fillRect(x - figH * 0.1, baseY - figH * 0.97, figH * 0.2, figH * 0.08)
    })
  })
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * p5-s1: "The lights grow brighter as the earth lurches away from the sun,
 * and now the orchestra is playing yellow cocktail music..."
 */
function paintYellowMusicWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  drawBandedSky(ctx, 0, w, h * 0.62, [
    darkenHex(p.background, 0.3),
    p.background,
    mixHex(p.background, p.primary, 0.35),
    mixHex(p.primary, p.accent, 0.3),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.45)
  ctx.fillRect(0, h * 0.62, w, h * 0.38)
  // the sun, half-lurched below the horizon, rays clipped upward
  const sy = h * 0.62
  drawSunburst(ctx, w * 0.5, sy, h * 0.09, h * 0.2, 13, p.accent, Math.PI * 1.05, Math.PI * 1.95, 0.8)
  ctx.fillStyle = mixHex(p.accent, '#ff9a3a', 0.4)
  ctx.beginPath()
  ctx.arc(w * 0.5, sy, h * 0.08, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
  // the lights growing brighter: three twinkling strands, biggest dots of any plate
  drawStringDots(ctx, w, h * 0.12, h * 0.05, 20, p.accent, Math.max(2, h * 0.008), t)
  drawStringDots(ctx, w, h * 0.22, h * 0.045, 17, lightenHex(p.accent, 0.25), Math.max(1.7, h * 0.007), t + 1.3)
  drawStringDots(ctx, w, h * 0.32, h * 0.04, 14, lightenHex(p.primary, 0.25), Math.max(1.4, h * 0.006), t + 2.6)
  // yellow cocktail music: a gramophone horn pouring note-dots that drift away
  ctx.fillStyle = mixHex(p.accent, p.primary, 0.25)
  ctx.beginPath()
  ctx.moveTo(w * 0.14, h * 0.52)
  ctx.lineTo(w * 0.26, h * 0.38)
  ctx.lineTo(w * 0.26, h * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = p.accent
  for (let i = 0; i < 7; i++) {
    const drift = (t * 0.04 + i * 0.07) % 0.52
    const nx = w * (0.3 + drift)
    const ny = h * (0.42 - Math.sin((drift * 9 + i) * 1.1) * 0.06)
    ctx.globalAlpha = 1 - (drift / 0.52) * 0.6
    ctx.beginPath()
    ctx.arc(nx, ny, Math.max(1.6, h * 0.007), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(nx + h * 0.006, ny - h * 0.055, Math.max(1, h * 0.003), h * 0.055)
  }
  ctx.globalAlpha = 1
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * p5-s3: "The groups change more swiftly... confident girls who weave here
 * and there... glide on through the sea-change of faces and voices and
 * colour under the constantly changing light."
 */
function paintSeaChangeWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  drawBandedSky(ctx, 0, w, h * 0.64, [
    darkenHex(p.background, 0.3),
    p.background,
    mixHex(p.background, p.primary, 0.35),
  ])
  ctx.fillStyle = darkenHex(p.background, 0.42)
  ctx.fillRect(0, h * 0.64, w, h * 0.36)
  // bokeh: the constantly changing light
  for (let i = 0; i < 12; i++) {
    const t = ((i * 61) % 100) / 100
    ctx.globalAlpha = 0.1 + t * 0.12
    ctx.fillStyle = i % 2 ? p.accent : lightenHex(p.primary, 0.2)
    ctx.beginPath()
    ctx.arc((i * 173) % w, h * (0.08 + t * 0.35), h * (0.02 + t * 0.045), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // three group clusters, dissolving and forming
  const clusters: ReadonlyArray<readonly [number, number]> = [
    [0.18, 0.9],
    [0.5, 0.86],
    [0.82, 0.9],
  ]
  for (const [cxf, byf] of clusters) {
    const cx = w * cxf
    const baseY = h * byf
    const members: ReadonlyArray<readonly [number, number]> = [
      [-0.055, 0.2],
      [0, 0.24],
      [0.055, 0.21],
      [-0.02, 0.18],
    ]
    for (const [dx, fh] of members) {
      drawSilhouetteFigure(ctx, cx + w * dx, baseY, h * fh, 'stand', darkenHex(p.background, 0.5))
    }
  }
  // the confident girl, weaving between clusters -- she and her dotted
  // glide path drift along the sine track together
  ctx.fillStyle = lightenHex(p.accent, 0.15)
  for (let i = 0; i < 14; i++) {
    const pathT = (i / 13 + t * 0.02) % 1
    ctx.globalAlpha = 0.4 + 0.6 * ((i + Math.floor(t * 4)) % 14) / 14
    ctx.beginPath()
    ctx.arc(w * (0.22 + pathT * 0.5), h * (0.78 + Math.sin(pathT * Math.PI * 2) * 0.05), Math.max(1, h * 0.004), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const glideT = (t * 0.02 + 0.55) % 1
  drawSilhouetteFigure(
    ctx,
    w * (0.22 + glideT * 0.5),
    h * (0.85 + Math.sin(glideT * Math.PI * 2) * 0.03),
    h * 0.26,
    'dance',
    mixHex(p.accent, darkenHex(p.background, 0.3), 0.4),
  )
  drawDecoFrame(ctx, w, h, p.accent)
}

/**
 * p6-s2: "A momentary hush; the orchestra leader varies his rhythm
 * obligingly for her... she is Gilda Gray's understudy from the Follies."
 */
function paintHushWindow(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, t = 0): void {
  // the hush: darker than any other plate, one beam, lots of negative space
  drawBandedSky(ctx, 0, w, h, [
    darkenHex(p.background, 0.5),
    darkenHex(p.background, 0.35),
    darkenHex(p.background, 0.2),
  ])
  // the single narrowed spotlight, breathing with the hush
  const cx = w * 0.5
  const breathe = 1 + 0.14 * Math.sin(t * 0.9)
  const gradient = ctx.createLinearGradient(cx, 0, cx, h * 0.86)
  gradient.addColorStop(0, mixHex(p.accent, '#ffffff', 0.2))
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.015 * breathe, 0)
  ctx.lineTo(cx + w * 0.015 * breathe, 0)
  ctx.lineTo(cx + w * 0.09 * breathe, h * 0.86)
  ctx.lineTo(cx - w * 0.09 * breathe, h * 0.86)
  ctx.closePath()
  ctx.fill()
  // her, mid-gesture in the beam, swaying almost imperceptibly
  drawSilhouetteFigure(ctx, cx + Math.sin(t * 1.1) * w * 0.004, h * 0.86, h * 0.3, 'dance', darkenHex(p.background, 0.65))
  // the orchestra leader on his podium, baton raised, obliging
  ctx.fillStyle = darkenHex(p.background, 0.55)
  ctx.fillRect(w * 0.16, h * 0.82, w * 0.07, h * 0.05)
  drawSilhouetteFigure(ctx, w * 0.195, h * 0.82, h * 0.22, 'horn', darkenHex(p.background, 0.62))
  // watchers leaning in from the edges, in shadow
  withMirrorSymmetry(ctx, w, () => {
    drawSilhouetteFigure(ctx, w * 0.05, h * 0.97, h * 0.2, 'stand', darkenHex(p.background, 0.55))
    drawSilhouetteFigure(ctx, w * 0.11, h * 0.99, h * 0.18, 'stand', darkenHex(p.background, 0.5))
  })
  drawDecoFrame(ctx, w, h, mixHex(p.accent, p.background, 0.25))
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
      animated: true,
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
      animated: true,
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
      animated: true,
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
      animated: true,
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
      animated: true,
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
      animated: true,
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
  // The window track: each window's mid plate depicts what its sentence run
  // literally describes, superseding the beat mid plate in the same sector
  // while active. Windows are sized to ~3-4 *rendered lines* of the text
  // pane -- one long Gatsby sentence, or a couple of short ones -- since a
  // two-long-sentence window ran ~7 lines and overstayed. (Sub-sentence
  // windows are off the table: that would need word-derived state in the
  // R3F subtree, which the design constraints forbid.) Window plate
  // azimuths match the camera sector of the sentences' beats
  // (test-enforced).
  windows: [
    {
      id: 'w-crates',
      sentenceIds: ['p2-s1'], // five crates of oranges and lemons / pyramid of pulpless halves
      plate: {
        id: 'win-crates',
        layer: 'mid',
        azimuthDeg: 140, // monday-lull sector
        memberBeatIds: ['monday-lull'],
        radius: 19.4,
        animated: true,
        // composed from CRATES_CARD -- the data-driven grammar path
        source: { kind: 'paint', paint: composeCard(CRATES_CARD) },
      },
    },
    {
      id: 'w-juice-machine',
      sentenceIds: ['p2-s2'], // the kitchen machine, the little button, the butler's thumb
      plate: {
        id: 'win-juice-machine',
        layer: 'mid',
        azimuthDeg: 140, // monday-lull sector
        memberBeatIds: ['monday-lull'],
        radius: 19.2,
        animated: true,
        source: { kind: 'paint', paint: paintJuiceMachineWindow },
      },
    },
    {
      id: 'w-canvas-lights',
      sentenceIds: ['p3-s1'], // several hundred feet of canvas + coloured lights
      plate: {
        id: 'win-canvas-lights',
        layer: 'mid',
        azimuthDeg: 222, // evening-bar-setup sector
        memberBeatIds: ['evening-bar-setup'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: paintCanvasLightsWindow },
      },
    },
    {
      id: 'w-buffet',
      sentenceIds: ['p3-s2'], // the buffet spread: hams, harlequin salads, pastry pigs, turkeys
      plate: {
        id: 'win-buffet',
        layer: 'mid',
        azimuthDeg: 222, // evening-bar-setup sector
        memberBeatIds: ['evening-bar-setup'],
        radius: 19.2,
        animated: true,
        source: { kind: 'paint', paint: paintBuffetWindow },
      },
    },
    // -- description-mining pass (full-passage sweep, 2026-07-24) ---------
    // Covered below: p1-s2, p4-s1, p4-s2, p5-s1, p5-s3, p6-s2.
    // Deliberately skipped (the beat plate already IS the sentence's
    // subject): p1-s1 music/fountain-court, p1-s3 raft/motorboats,
    // p1-s4 Rolls/yellow bug, p1-s5 servants repairing, p3-s3 brass-rail
    // bar, p4-s3 bar in full swing, p6-s1 the gypsy on the platform.
    // Skipped as abstract (the motif system covers them): p5-s2 laughter
    // spilled with prodigality, p6-s3 "The party has begun."
    {
      id: 'w-moths',
      sentenceIds: ['p1-s2'], // moths among the whisperings and the champagne and the stars
      plate: {
        id: 'win-moths',
        layer: 'mid',
        azimuthDeg: 325, // dusk-arrival sector
        memberBeatIds: ['dusk-arrival'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: paintMothsWindow },
      },
    },
    {
      id: 'w-instruments',
      sentenceIds: ['p4-s1'], // the whole pitful of oboes and trombones and saxophones
      plate: {
        id: 'win-instruments',
        layer: 'mid',
        azimuthDeg: 80, // orchestra-tuning sector
        memberBeatIds: ['orchestra-tuning'],
        radius: 19.4,
        source: { kind: 'paint', paint: paintInstrumentsWindow },
      },
    },
    {
      id: 'w-gaudy-arrivals',
      sentenceIds: ['p4-s2'], // halls gaudy with primary colours, bobbed hair, shawls of Castile
      plate: {
        id: 'win-gaudy-arrivals',
        layer: 'mid',
        azimuthDeg: 80, // orchestra-tuning sector
        memberBeatIds: ['orchestra-tuning'],
        radius: 19.1,
        source: { kind: 'paint', paint: paintGaudyArrivalsWindow },
      },
    },
    {
      id: 'w-yellow-music',
      sentenceIds: ['p5-s1'], // lights grow brighter, the earth lurches away from the sun
      plate: {
        id: 'win-yellow-music',
        layer: 'mid',
        azimuthDeg: 80, // dancing-under-lights sector
        memberBeatIds: ['dancing-under-lights'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: paintYellowMusicWindow },
      },
    },
    {
      id: 'w-sea-change',
      sentenceIds: ['p5-s3'], // groups dissolve and form; the girl weaving the sea-change of faces
      plate: {
        id: 'win-sea-change',
        layer: 'mid',
        azimuthDeg: 80, // dancing-under-lights sector
        memberBeatIds: ['dancing-under-lights'],
        radius: 19.1,
        animated: true,
        source: { kind: 'paint', paint: paintSeaChangeWindow },
      },
    },
    {
      id: 'w-gilda-hush',
      sentenceIds: ['p6-s2'], // the momentary hush; the obliging orchestra leader; Gilda Gray
      plate: {
        id: 'win-gilda-hush',
        layer: 'mid',
        azimuthDeg: 80, // dancing-under-lights sector
        memberBeatIds: ['dancing-under-lights'],
        radius: 19.4,
        animated: true,
        source: { kind: 'paint', paint: paintHushWindow },
      },
    },
  ],
}
