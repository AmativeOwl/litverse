import { Uniform } from 'three'
import { BlendFunction, Effect } from 'postprocessing'

/**
 * Art-direction constants. These are intentionally NOT SceneBeat data (per
 * the task's "no palette data changes are in scope" constraint) -- they're
 * a fixed art pass, tuned once by eye, in the same spirit as Bloom's
 * `luminanceThreshold`/`luminanceSmoothing` staying fixed props in
 * PostProcessing.tsx while only `intensity` gets mutated per frame.
 *
 * Kept deliberately subtle throughout: the goal is "still legible as the
 * existing scene, now painted," not an Instagram filter.
 */
const DEFAULT_POSTERIZE_LEVELS = 6.0
const DEFAULT_BLEED_AMOUNT = 0.35
const BLEED_TEXEL_RADIUS = 1.5
const DEFAULT_GRAIN_OPACITY = 0.018
const DEFAULT_SPLIT_TONE_STRENGTH = 0.05
const DEFAULT_ORNAMENT_OPACITY = 0.045

// Screen-space UV anchor the sunburst rays radiate from -- "roughly
// top-center", approximating the key light's usual position above the scene
// without needing to project the actual light into screen space.
const SUNBURST_ORIGIN = '0.5, 0.85'
const SUNBURST_RAY_COUNT = 9.0
const SUNBURST_RAY_SHARPNESS = 6.0
const SCALLOP_COUNT = 12.0

const fragmentShader = /* glsl */ `
  uniform float posterizeLevels;
  uniform float bleedAmount;
  uniform float grainOpacity;
  uniform float grainTime;
  uniform float splitToneStrength;
  uniform float ornamentOpacity;
  uniform vec3 ornamentColor;

  // 1. Flat color banding (posterize) -- quantizing luminance/color into a
  // handful of discrete steps is the single biggest lever for "flat gouache"
  // vs. a smooth PBR gradient. Quantizing per-channel (floor(c*levels+0.5))
  // looks right on paper but blows up on dark, low-saturation colors: with
  // levels=6 (~0.167 per step), a muted color whose channels sit just above
  // vs. just below a rounding boundary (e.g. the crowd silhouettes' dark
  // warm-grey) gets its channels rounded to DIFFERENT steps independently --
  // R rounds up to 1/6 while G/B round down to 0 -- turning a barely-visible
  // figure into a solid saturated red blob. Quantizing luminance and rescaling
  // the original color to match preserves hue/chroma (true "value banding",
  // matching how flat gouache actually reads) instead of shifting hue.
  vec3 quantizeColor(vec3 color, float levels) {
    float lum = max(dot(color, vec3(0.299, 0.587, 0.114)), 0.0001);
    // max(1.0, ...) keeps the lowest representable band at 1/levels rather
    // than letting round-to-nearest collapse the bottom ~1/(2*levels) of the
    // luminance range (anything below ~0.083 at levels=6) to a literal zero
    // multiplier. Without this, any moody/low-key SceneBeat (dark palette +
    // modest lighting -- several of the expanded per-sentence beats, e.g.
    // "dusk-arrival"/"evening-bar-setup", are exactly this) posterizes to a
    // fully black floor/crowd with zero shading definition instead of a dim
    // banded one, since floor(x+0.5) still produces bucket 0 for the entire
    // bottom band. This only raises the *floor* of the quantization -- true
    // black (lum clamped to 0.0001 above) still posterizes to band 1's
    // (~1/levels) multiplier of a near-zero color, so it still renders as
    // effectively black; only genuinely dark-but-nonzero content is rescued.
    float quantizedLum = max(1.0, floor(lum * levels + 0.5)) / levels;
    return color * (quantizedLum / lum);
  }

  // 3. Canvas/paper grain -- procedural hash noise, no texture asset needed.
  float grainHash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 posterized = quantizeColor(inputColor.rgb, posterizeLevels);

    // 2. Soft edge bleed/diffusion -- a cheap few-texel directional blur of
    // the posterized image blended back at partial strength, approximating
    // painted/watercolor edge bleed without a full multi-pass blur pipeline.
    vec2 bleedDir = normalize(vec2(1.0, 0.65)) * texelSize * ${BLEED_TEXEL_RADIUS.toFixed(2)};
    vec3 bled = vec3(0.0);
    bled += quantizeColor(texture2D(inputBuffer, uv + bleedDir * 1.5).rgb, posterizeLevels);
    bled += quantizeColor(texture2D(inputBuffer, uv + bleedDir * 0.5).rgb, posterizeLevels);
    bled += quantizeColor(texture2D(inputBuffer, uv - bleedDir * 0.5).rgb, posterizeLevels);
    bled += quantizeColor(texture2D(inputBuffer, uv - bleedDir * 1.5).rgb, posterizeLevels);
    bled *= 0.25;
    vec3 painted = mix(posterized, bled, bleedAmount);

    // 3. Canvas/paper grain, blended at low opacity.
    float grain = grainHash(uv * resolution.xy + grainTime);
    painted += (grain - 0.5) * grainOpacity;

    // 4. Warm/cool split-tone grade -- shadows pushed slightly cool,
    // highlights pushed slightly warm.
    float lum = dot(painted, vec3(0.299, 0.587, 0.114));
    float shadowWeight = 1.0 - smoothstep(0.0, 0.6, lum);
    float highlightWeight = smoothstep(0.4, 1.0, lum);
    painted += vec3(-0.02, 0.0, 0.04) * shadowWeight * splitToneStrength;
    painted += vec3(0.04, 0.016, -0.02) * highlightWeight * splitToneStrength;

    // 5. Deco ornament overlay -- thin gold sunburst rays from roughly
    // top-center, plus a subtle scalloped fan-motif vignette at the frame
    // edges (a repeating arc/SDF-ish pattern), both tinted from the current
    // beat's accent/key-light color and kept at low opacity so they frame
    // the scene rather than clutter it.
    vec2 sunOrigin = vec2(${SUNBURST_ORIGIN});
    vec2 toSun = uv - sunOrigin;
    float sunAngle = atan(toSun.y, toSun.x);
    float sunDist = length(toSun);
    float rays = pow(abs(sin(sunAngle * ${SUNBURST_RAY_COUNT.toFixed(1)})), ${SUNBURST_RAY_SHARPNESS.toFixed(1)});
    // Falls off to 0 well before the frame edge (rather than spanning almost
    // the whole viewport) so the rays read as a faint suggestion near their
    // top-center origin instead of dominating the entire scene.
    float rayFalloff = smoothstep(0.45, 0.05, sunDist);
    float sunburst = rays * rayFalloff;

    vec2 centered = uv - 0.5;
    float edgeAngle = atan(centered.y, centered.x);
    float edgeDist = length(centered);
    float scallop = sin(edgeAngle * ${SCALLOP_COUNT.toFixed(1)}) * 0.015;
    float vignette = smoothstep(0.34 + scallop, 0.62 + scallop, edgeDist);

    vec3 ornament = ornamentColor * (sunburst * 0.4 + vignette * 0.35) * ornamentOpacity;
    painted += ornament;

    outputColor = vec4(painted, inputColor.a);
  }
`

export interface DecoPaintEffectOptions {
  blendFunction?: BlendFunction
  posterizeLevels?: number
  bleedAmount?: number
  grainOpacity?: number
  splitToneStrength?: number
  ornamentOpacity?: number
  ornamentColor?: [number, number, number]
}

/**
 * Layers a painterly Art-Deco identity on top of the existing clean
 * "Journey-style" render, purely as a GLSL fragment-shader post-process (no
 * new textures/image assets): posterize -> edge bleed -> grain -> split-tone
 * -> Deco ornament overlay, in that order, per the task's 5-layer spec.
 *
 * Follows the same `Effect` subclass shape as `postprocessing`'s own
 * `BloomEffect`/`BrightnessContrastEffect`: a `mainImage`-shaped fragment
 * shader plus a `Map<string, Uniform>` of settable uniforms. Only
 * `ornamentColor` and `grainTime` are meant to be mutated per frame (see
 * `PostProcessing.tsx`, mirroring how it mutates `bloomRef.current.intensity`
 * every frame while leaving Bloom's other props fixed) -- the rest are fixed
 * art-direction constants for today's pass, not per-beat data.
 */
export class DecoPaintEffect extends Effect {
  constructor({
    blendFunction = BlendFunction.NORMAL,
    posterizeLevels = DEFAULT_POSTERIZE_LEVELS,
    bleedAmount = DEFAULT_BLEED_AMOUNT,
    grainOpacity = DEFAULT_GRAIN_OPACITY,
    splitToneStrength = DEFAULT_SPLIT_TONE_STRENGTH,
    ornamentOpacity = DEFAULT_ORNAMENT_OPACITY,
    ornamentColor = [0.96, 0.79, 0.54],
  }: DecoPaintEffectOptions = {}) {
    super('DecoPaintEffect', fragmentShader, {
      blendFunction,
      uniforms: new Map<string, Uniform<number | [number, number, number]>>([
        ['posterizeLevels', new Uniform(posterizeLevels)],
        ['bleedAmount', new Uniform(bleedAmount)],
        ['grainOpacity', new Uniform(grainOpacity)],
        ['grainTime', new Uniform(0)],
        ['splitToneStrength', new Uniform(splitToneStrength)],
        ['ornamentOpacity', new Uniform(ornamentOpacity)],
        ['ornamentColor', new Uniform(ornamentColor)],
      ]),
    })
  }

  /** Slowly-incrementing time uniform driving the canvas-grain hash -- mutated per frame from `PostProcessing.tsx`'s useFrame, same pattern as every other per-frame value in this codebase. */
  get grainTime(): number {
    return this.uniforms.get('grainTime')!.value as number
  }

  set grainTime(value: number) {
    this.uniforms.get('grainTime')!.value = value
  }

  /** Gold ornament tint (sunburst rays + scalloped vignette), settable per frame from the active beat's `palette.accent`/`lighting.keyLightColor`. */
  get ornamentColor(): [number, number, number] {
    return this.uniforms.get('ornamentColor')!.value as [number, number, number]
  }

  set ornamentColor(value: [number, number, number]) {
    const uniform = this.uniforms.get('ornamentColor')!
    const current = uniform.value as [number, number, number]
    current[0] = value[0]
    current[1] = value[1]
    current[2] = value[2]
  }
}
