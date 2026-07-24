import type { CardSpec, ElementSpec, MotionSpec, PlatePaintFn } from '../../types-plates'
import type { SceneBeat } from '../../types'
import {
  darkenHex,
  drawBandedSky,
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
  drawZigguratTower,
  lightenHex,
  mixHex,
  withMirrorSymmetry,
} from './decoPlateKit'

type Palette = SceneBeat['palette']

/**
 * The card composer: interprets a `CardSpec` -- nouns as objects, verbs as
 * movements -- into a `PlatePaintFn`, i.e. a living painting built entirely
 * from data (see types-plates.ts, "The card grammar"). This is the
 * text-agnostic rendering path of the reading compiler: the compiler mines
 * a sentence into a spec; this module turns the spec into the picture.
 * Hand-written paint functions remain the artisan tier for hero cards.
 */

// ---------------------------------------------------------------------------
// The verb library: each motion verb is a pure function of time returning a
// transform. Exported for tests -- verbs are the reusable half of the
// grammar, so their behavior is pinned.
// ---------------------------------------------------------------------------

export interface MotionTransform {
  /** Offsets as fractions of the plate's [width, height]. */
  dx: number
  dy: number
  /** Rotation in radians (applied where the noun supports it). */
  rot: number
  alpha: number
  scale: number
  /** For phased verbs (dive, burst): 0..1 progress through the cycle, else undefined. */
  cycle?: number
}

const IDENTITY: MotionTransform = { dx: 0, dy: 0, rot: 0, alpha: 1, scale: 1 }

export function motionTransform(motion: MotionSpec | undefined, t: number): MotionTransform {
  if (!motion || motion.verb === 'still') return IDENTITY
  const speed = motion.speed ?? 1
  const amp = motion.amplitude ?? 1
  const phase = motion.phase ?? 0
  const loop = motion.loopSeconds ?? 6
  const tt = t * speed + phase

  switch (motion.verb) {
    case 'sway':
      return { ...IDENTITY, dx: Math.sin(tt * 1.2) * 0.006 * amp, rot: Math.sin(tt * 1.2) * 0.02 * amp }
    case 'bob':
      return { ...IDENTITY, dy: Math.abs(Math.sin(tt * 2.4)) * -0.006 * amp }
    case 'pace':
      return { ...IDENTITY, dx: Math.sin(tt * 0.35) * 0.16 * amp, dy: Math.abs(Math.sin(tt * 2.4)) * -0.004 * amp }
    case 'scrub':
      return { ...IDENTITY, dx: Math.sin(tt * 3.1) * 0.007 * amp }
    case 'weave': {
      const u = ((t * speed) / loop + phase) % 1.2
      return { ...IDENTITY, dx: u * 1.2 - 0.1 - 0, dy: Math.sin(u * 9) * -0.055 * amp, cycle: u }
    }
    case 'cross': {
      const u = ((t * speed) / loop + phase) % 1.3
      return { ...IDENTITY, dx: u * 1.3 - 0.15, cycle: u }
    }
    case 'glide': {
      const u = ((t * speed) / loop + phase) % 1
      return { ...IDENTITY, dx: u * 0.5, dy: Math.sin(u * Math.PI * 2) * 0.05 * amp, cycle: u }
    }
    case 'rise': {
      const u = ((t * speed) / (loop * 0.5) + phase) % 1
      return { ...IDENTITY, dy: -u * 0.16 * amp, alpha: 1 - u * 0.7, cycle: u }
    }
    case 'fall': {
      const u = ((t * speed) / (loop * 0.5) + phase) % 1
      return { ...IDENTITY, dy: u * 0.12 * amp, alpha: 1 - u * 0.5, cycle: u }
    }
    case 'twinkle':
      return { ...IDENTITY, alpha: 0.55 + 0.45 * Math.sin(tt * 3) }
    case 'breathe':
      return { ...IDENTITY, scale: 1 + 0.12 * Math.sin(tt * 0.9) * amp }
    case 'flutter':
      return { ...IDENTITY, rot: Math.sin(tt * 9) * 0.3 * amp, dy: Math.sin(tt * 5.3) * 0.008 * amp }
    case 'orbit': {
      return { ...IDENTITY, dx: Math.cos(tt * 0.8) * 0.012 * amp, dy: Math.sin(tt * 1.05) * 0.02 * amp }
    }
    case 'dive': {
      const u = ((t * speed) / loop + phase) % 1
      if (u < 0.3) {
        // poised, with a late anticipatory dip
        const crouch = u > 0.24 ? Math.sin(((u - 0.24) / 0.06) * Math.PI) * 0.008 : 0
        return { ...IDENTITY, dy: crouch, cycle: u }
      }
      if (u < 0.62) {
        const v = (u - 0.3) / 0.32
        return { ...IDENTITY, dx: v, dy: (-0.35 * v + 1.35 * v * v), rot: -0.4 + v * 2.0, cycle: u }
      }
      // underwater / gone until the loop restarts
      return { ...IDENTITY, alpha: 0, cycle: u }
    }
    case 'burst': {
      const u = ((t * speed) / (loop * 0.4) + phase) % 1
      return { ...IDENTITY, scale: 0.3 + u * 1.4, alpha: 1 - u, cycle: u }
    }
    default:
      return IDENTITY
  }
}

// ---------------------------------------------------------------------------
// Noun renderers
// ---------------------------------------------------------------------------

function roleColor(role: ElementSpec['colorRole'], p: Palette): string {
  switch (role) {
    case 'accent':
      return p.accent
    case 'accent-light':
      return lightenHex(p.accent, 0.3)
    case 'primary':
      return mixHex(p.primary, p.background, 0.25)
    case 'primary-light':
      return lightenHex(p.primary, 0.3)
    case 'shadow':
    default:
      return darkenHex(p.background, 0.45)
  }
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Palette,
  el: ElementSpec,
  t: number,
): void {
  // Grammar default: figures are never statues. An un-verbed figure sways
  // gently, phase-desynced by its position so crowds don't move in lockstep.
  const motion: typeof el.motion =
    el.motion ?? (el.noun === 'figure'
      ? { verb: 'sway', amplitude: 0.7, phase: el.at[0] * 7 + el.at[1] * 13 }
      : undefined)
  const m = motionTransform(motion, t)
  if (m.alpha <= 0.01) return
  const x = w * (el.at[0] + m.dx)
  const y = h * (el.at[1] + m.dy)
  const size = h * (el.size ?? 0.2) * m.scale
  const color = roleColor(el.colorRole, p)
  ctx.save()
  ctx.globalAlpha = m.alpha
  if (m.rot !== 0) {
    ctx.translate(x, y)
    ctx.rotate(m.rot)
    ctx.translate(-x, -y)
  }
  switch (el.noun) {
    case 'figure':
      drawSilhouetteFigure(ctx, x, y, size, el.pose ?? 'stand', color)
      break
    case 'car':
      drawCarProfile(ctx, x, y, size * 2.2, color, p.accent)
      break
    case 'boat':
      ctx.fillStyle = color
      ctx.fillRect(x - size, y, size * 2, size * 0.4)
      ctx.fillRect(x + size * 0.1, y - size * 0.4, size * 0.4, size * 0.4)
      break
    case 'crate': {
      ctx.fillStyle = darkenHex(p.primary, 0.25)
      ctx.fillRect(x - size * 0.55, y - size, size * 1.1, size)
      ctx.fillStyle = color
      for (let i = 0; i < 4; i++) {
        ctx.beginPath()
        ctx.arc(x - size * 0.36 + i * size * 0.24, y - size, size * 0.16, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'door':
      ctx.fillStyle = darkenHex(p.background, 0.35)
      ctx.fillRect(x - size * 0.25, y - size, size * 0.5, size)
      ctx.strokeStyle = mixHex(p.accent, '#9a8a5a', 0.4)
      ctx.lineWidth = Math.max(1.2, h * 0.006)
      ctx.strokeRect(x - size * 0.25, y - size, size * 0.5, size)
      break
    case 'fruit-pyramid':
      drawFruitPyramid(ctx, x, y, 3, size * 0.12, mixHex(p.accent, '#d98324', 0.55))
      break
    case 'juice-machine':
      drawJuiceMachine(ctx, x, y, size, darkenHex(p.primary, 0.15), p.accent, t)
      break
    case 'ham':
      drawGlazedHam(ctx, x, y, size, mixHex(p.accent, '#b0522a', 0.55), lightenHex(p.accent, 0.4))
      break
    case 'turkey':
      drawTurkey(ctx, x, y, size, mixHex(p.accent, '#c98a2a', 0.4), lightenHex(p.accent, 0.25))
      break
    case 'pastry-row':
      drawPastryRow(ctx, x, y, 6, size * 0.6, size * 0.3, mixHex(p.accent, '#ffdf9e', 0.5))
      break
    case 'lights-strand':
      drawStringDots(ctx, w, y, h * 0.05, 18, color === darkenHex(p.background, 0.45) ? p.accent : color, Math.max(1.3, h * 0.005), el.motion?.verb === 'twinkle' ? t + (el.motion.phase ?? 0) : undefined)
      break
    case 'ziggurat':
      drawZigguratTower(ctx, x, y, size * 0.8, size * 2.2, 4, color)
      break
    case 'sun':
      drawSunburst(ctx, x, y, size * 0.55, size * 1.3, 20, lightenHex(p.accent, 0.15), 0, Math.PI * 2, 0.7 * m.alpha)
      ctx.fillStyle = p.accent
      ctx.beginPath()
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'waves':
      for (let i = 0; i < 3; i++) {
        drawWaveBand(ctx, y + i * h * 0.08, w, h * 0.008, w * 0.12, lightenHex(p.primary, 0.2 + i * 0.1), Math.max(1, h * 0.006), t * (0.7 + i * 0.2))
      }
      break
    case 'stars':
      ctx.fillStyle = lightenHex(p.accent, 0.4)
      for (let i = 0; i < 50; i++) {
        ctx.globalAlpha = m.alpha * (0.2 + ((i * 37) % 10) / 14)
        ctx.fillRect((i * 131) % w, (i * 47) % (y || h * 0.45), 1.5, 1.5)
      }
      break
    case 'spray':
      drawSunburst(ctx, x, y, size * 0.1, size, 8, color === darkenHex(p.background, 0.45) ? p.accent : color, -Math.PI * 0.85, -Math.PI * 0.15, 0.8 * m.alpha)
      break
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// The composer
// ---------------------------------------------------------------------------

/** Interprets a CardSpec into a plate paint function. Deterministic in (spec, palette, t). */
export function composeCard(spec: CardSpec): PlatePaintFn {
  return (ctx, w, h, p, t = 0) => {
    const groundY = spec.groundY ?? 0.66
    const bandCount = spec.skyBands ?? 3
    const bands: string[] = []
    for (let i = 0; i < bandCount; i++) {
      bands.push(mixHex(darkenHex(p.background, 0.25), mixHex(p.background, p.primary, 0.5), i / Math.max(1, bandCount - 1)))
    }
    drawBandedSky(ctx, 0, w, h * groundY, bands)
    ctx.fillStyle = darkenHex(p.primary, 0.35)
    ctx.fillRect(0, h * groundY, w, h * (1 - groundY))
    for (const el of spec.elements) {
      if (el.mirror) {
        withMirrorSymmetry(ctx, w, () => drawElement(ctx, w, h, p, el, t))
      } else {
        drawElement(ctx, w, h, p, el, t)
      }
    }
    if (spec.frame !== false) drawDecoFrame(ctx, w, h, p.accent)
  }
}
