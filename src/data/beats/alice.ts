import type { SceneBeat } from '../../types'

/**
 * Scene beats for Alice's Adventures in Wonderland (the rabbit-hole
 * excerpt). Six moods trace the arc: the drowsy golden riverbank, the
 * White Rabbit's rose-tinted flash of alarm, the earthen burrow, the long
 * dreamy indigo fall, the marmalade-warm cupboard walls, and the soft
 * violet wondering that carries the monologue. World palettes sit darker
 * than the Storybook pack's nursery-cream cover language so fog and bloom
 * still read -- the pack speaks through hue (leaf golds, rose, amber,
 * violet), not through paper brightness.
 *
 * Camera behaviors are dormant data (the zoetrope rig superseded them) but
 * remain required by the SceneBeat contract.
 */
export const ALICE_BEATS: readonly SceneBeat[] = [
  {
    id: 'al-riverbank',
    palette: { background: '#3c4423', primary: '#7a8a4a', accent: '#f2d98c', fog: '#2c3319' },
    lighting: { ambientIntensity: 0.65, keyLightIntensity: 1.8, keyLightColor: '#f2d98c', bloomStrength: 0.6 },
    particles: { type: 'dust', density: 40, speed: 0.14, sizeRange: [0.06, 0.2] },
    camera: { behavior: 'static-drift', speed: 0.1, fov: 50 },
    silhouettes: { count: 8, animation: 'sway' },
    transitionDurationMs: 1100,
  },
  {
    id: 'al-white-rabbit',
    palette: { background: '#3f2b38', primary: '#8a5468', accent: '#f2a5b8', fog: '#2e1f29' },
    lighting: { ambientIntensity: 0.6, keyLightIntensity: 1.9, keyLightColor: '#f2a5b8', bloomStrength: 0.7 },
    particles: { type: 'bokeh', density: 55, speed: 0.35, sizeRange: [0.07, 0.22] },
    camera: { behavior: 'static-drift', speed: 0.14, fov: 51 },
    silhouettes: { count: 6, animation: 'sway' },
    transitionDurationMs: 950,
  },
  {
    id: 'al-rabbit-hole',
    palette: { background: '#2a1c12', primary: '#5c4226', accent: '#c98d4f', fog: '#1e140d' },
    lighting: { ambientIntensity: 0.5, keyLightIntensity: 1.5, keyLightColor: '#c98d4f', bloomStrength: 0.55 },
    particles: { type: 'dust', density: 35, speed: 0.2, sizeRange: [0.05, 0.18] },
    camera: { behavior: 'static-drift', speed: 0.1, fov: 50 },
    silhouettes: { count: 4, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'al-falling',
    palette: { background: '#141a36', primary: '#33406e', accent: '#8ea8e8', fog: '#0e1226' },
    lighting: { ambientIntensity: 0.55, keyLightIntensity: 1.6, keyLightColor: '#8ea8e8', bloomStrength: 0.8 },
    particles: { type: 'bokeh', density: 50, speed: 0.1, sizeRange: [0.08, 0.26] },
    camera: { behavior: 'static-drift', speed: 0.08, fov: 50 },
    silhouettes: { count: 4, animation: 'sway' },
    transitionDurationMs: 1200,
  },
  {
    id: 'al-cupboards',
    palette: { background: '#241610', primary: '#6a4326', accent: '#ffb45e', fog: '#1a100a' },
    lighting: { ambientIntensity: 0.6, keyLightIntensity: 1.9, keyLightColor: '#ffb45e', bloomStrength: 0.75 },
    particles: { type: 'embers', density: 45, speed: 0.2, sizeRange: [0.06, 0.2] },
    camera: { behavior: 'static-drift', speed: 0.1, fov: 50 },
    silhouettes: { count: 4, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'al-musing',
    palette: { background: '#241d33', primary: '#4a3f66', accent: '#c9b8f0', fog: '#181322' },
    lighting: { ambientIntensity: 0.55, keyLightIntensity: 1.6, keyLightColor: '#c9b8f0', bloomStrength: 0.65 },
    particles: { type: 'dust', density: 30, speed: 0.12, sizeRange: [0.05, 0.18] },
    camera: { behavior: 'static-drift', speed: 0.08, fov: 50 },
    silhouettes: { count: 5, animation: 'sway' },
    transitionDurationMs: 1150,
  },
]
