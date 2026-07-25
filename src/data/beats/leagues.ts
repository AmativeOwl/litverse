import type { SceneBeat } from '../../types'

/**
 * Scene beats for Twenty Thousand Leagues Under the Seas (the Nemo sea-hymn
 * + liquid-light salon reveal excerpt). The arc is the excerpt's own light
 * cycle: brass-lit salon conversation, the speech's teal surge and defiant
 * deep, the sudden dark when the luminous ceiling dies, the sliding-metal
 * hush of the panels, the electric blaze of liquid light, and the calm
 * immense-aquarium abyss. Palettes translate the Victorian-engraving pack
 * anchors (ivory/plate-ink/brass/sea-teal) into scene-world darks.
 *
 * Camera behaviors are dormant data (the zoetrope rig superseded them) but
 * remain required by the SceneBeat contract.
 */
export const LEAGUES_BEATS: readonly SceneBeat[] = [
  {
    id: 'lg-salon',
    palette: { background: '#241a10', primary: '#6a4a26', accent: '#d4a24e', fog: '#1a130c' },
    lighting: { ambientIntensity: 0.6, keyLightIntensity: 1.7, keyLightColor: '#d4a24e', bloomStrength: 0.6 },
    particles: { type: 'dust', density: 40, speed: 0.16, sizeRange: [0.06, 0.2] },
    camera: { behavior: 'static-drift', speed: 0.1, fov: 50 },
    silhouettes: { count: 4, animation: 'sway' },
    transitionDurationMs: 1100,
  },
  {
    id: 'lg-sea-hymn',
    palette: { background: '#0d2b30', primary: '#2f5d5a', accent: '#c9a050', fog: '#092023' },
    lighting: { ambientIntensity: 0.62, keyLightIntensity: 1.8, keyLightColor: '#c9a050', bloomStrength: 0.7 },
    particles: { type: 'bokeh', density: 50, speed: 0.22, sizeRange: [0.07, 0.24] },
    camera: { behavior: 'static-drift', speed: 0.11, fov: 50 },
    silhouettes: { count: 6, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'lg-freedom',
    palette: { background: '#0a1d2b', primary: '#1e4256', accent: '#7ac0d8', fog: '#071620' },
    lighting: { ambientIntensity: 0.55, keyLightIntensity: 1.9, keyLightColor: '#7ac0d8', bloomStrength: 0.8 },
    particles: { type: 'bokeh', density: 55, speed: 0.28, sizeRange: [0.07, 0.24] },
    camera: { behavior: 'static-drift', speed: 0.12, fov: 51 },
    silhouettes: { count: 3, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'lg-darkness',
    palette: { background: '#08090c', primary: '#14161c', accent: '#3a4a5a', fog: '#050609' },
    lighting: { ambientIntensity: 0.35, keyLightIntensity: 1.2, keyLightColor: '#3a4a5a', bloomStrength: 0.45 },
    particles: { type: 'dust', density: 18, speed: 0.08, sizeRange: [0.05, 0.14] },
    camera: { behavior: 'static-drift', speed: 0.07, fov: 49 },
    silhouettes: { count: 3, animation: 'still' },
    transitionDurationMs: 1200,
  },
  {
    id: 'lg-panels',
    palette: { background: '#10141a', primary: '#2a3440', accent: '#8a9aa8', fog: '#0b0e13' },
    lighting: { ambientIntensity: 0.45, keyLightIntensity: 1.4, keyLightColor: '#8a9aa8', bloomStrength: 0.5 },
    particles: { type: 'dust', density: 28, speed: 0.12, sizeRange: [0.05, 0.16] },
    camera: { behavior: 'static-drift', speed: 0.09, fov: 50 },
    silhouettes: { count: 3, animation: 'still' },
    transitionDurationMs: 1100,
  },
  {
    id: 'lg-liquid-light',
    palette: { background: '#06303c', primary: '#0f5e6e', accent: '#7ae8ff', fog: '#04242e' },
    lighting: { ambientIntensity: 0.7, keyLightIntensity: 2.1, keyLightColor: '#7ae8ff', bloomStrength: 0.95 },
    particles: { type: 'bokeh', density: 75, speed: 0.3, sizeRange: [0.08, 0.28] },
    camera: { behavior: 'static-drift', speed: 0.12, fov: 51 },
    silhouettes: { count: 3, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'lg-abyss',
    palette: { background: '#071a30', primary: '#1a3a5e', accent: '#9ac8f0', fog: '#051224' },
    lighting: { ambientIntensity: 0.6, keyLightIntensity: 1.7, keyLightColor: '#9ac8f0', bloomStrength: 0.75 },
    particles: { type: 'bokeh', density: 45, speed: 0.14, sizeRange: [0.07, 0.24] },
    camera: { behavior: 'static-drift', speed: 0.08, fov: 50 },
    silhouettes: { count: 4, animation: 'still' },
    transitionDurationMs: 1200,
  },
]
