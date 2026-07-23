import type { SceneBeat } from '../../types'

export function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Cubic ease-in-out, so beat transitions accelerate/decelerate rather than moving at constant speed. */
export function easeInOutCubic(t: number): number {
  const clamped = clamp01(t)
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  const int = parseInt(full, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(clamp01(v / 255) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Lerps two hex color strings (`#rrggbb` or `#rgb`) channel-by-channel. */
export function lerpColorHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t))
}

/**
 * Converts a hex color string to `[r, g, b]` floats in the 0..1 range
 * expected by three.js buffer-attribute color channels (as opposed to the
 * 0..255 ints `hexToRgb` deals in internally).
 */
export function hexToRgbNormalized(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return [r / 255, g / 255, b / 255]
}

/** Progress (0..1) through a beat transition, given when it started and how long it should take. */
export function computeTransitionProgress(startMs: number, nowMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1
  return clamp01((nowMs - startMs) / durationMs)
}

export interface LerpedSceneBeat {
  fromId: string
  toId: string
  /** Raw (pre-easing) transition progress, 0..1. */
  t: number
  palette: SceneBeat['palette']
  lighting: SceneBeat['lighting']
  particles: SceneBeat['particles']
  camera: SceneBeat['camera']
  silhouetteCount: number
}

/**
 * Interpolates every numeric/color field of two SceneBeats. Discrete enum
 * fields (`particles.type`, `camera.behavior`) snap to the target beat at the
 * transition's halfway point rather than at t=0, so the switch happens while
 * the other continuous fields (color, intensity, speed...) are already
 * blending -- it reads as one continuous transition rather than a hard cut at
 * the very start.
 */
export function lerpSceneBeat(from: SceneBeat, to: SceneBeat, tRaw: number): LerpedSceneBeat {
  const t = easeInOutCubic(tRaw)
  const snapToTarget = clamp01(tRaw) >= 0.5

  return {
    fromId: from.id,
    toId: to.id,
    t: clamp01(tRaw),
    palette: {
      background: lerpColorHex(from.palette.background, to.palette.background, t),
      primary: lerpColorHex(from.palette.primary, to.palette.primary, t),
      accent: lerpColorHex(from.palette.accent, to.palette.accent, t),
      fog: lerpColorHex(from.palette.fog, to.palette.fog, t),
    },
    lighting: {
      ambientIntensity: lerp(from.lighting.ambientIntensity, to.lighting.ambientIntensity, t),
      keyLightIntensity: lerp(from.lighting.keyLightIntensity, to.lighting.keyLightIntensity, t),
      keyLightColor: lerpColorHex(from.lighting.keyLightColor, to.lighting.keyLightColor, t),
      bloomStrength: lerp(from.lighting.bloomStrength, to.lighting.bloomStrength, t),
    },
    particles: {
      type: snapToTarget ? to.particles.type : from.particles.type,
      density: lerp(from.particles.density, to.particles.density, t),
      speed: lerp(from.particles.speed, to.particles.speed, t),
      sizeRange: [
        lerp(from.particles.sizeRange[0], to.particles.sizeRange[0], t),
        lerp(from.particles.sizeRange[1], to.particles.sizeRange[1], t),
      ],
    },
    camera: {
      behavior: snapToTarget ? to.camera.behavior : from.camera.behavior,
      speed: lerp(from.camera.speed, to.camera.speed, t),
      fov: lerp(from.camera.fov, to.camera.fov, t),
    },
    silhouetteCount: Math.round(lerp(from.silhouettes?.count ?? 0, to.silhouettes?.count ?? 0, t)),
  }
}
