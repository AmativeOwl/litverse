import type { SceneBeat } from '../../types'

/**
 * Scene beats for The Masque of the Red Death. Poe authored the palette arc
 * himself: an imperial suite of seven rooms, each a single colour -- blue,
 * purple, green, orange, white, violet, and the black chamber with its
 * scarlet panes -- lit only by brazier-fire through stained glass. The nine
 * beats trace the excerpt: the masked ball's onset, the suite, the rooms,
 * the firelight, the ebony clock, the revel, the writhing dreams, and the
 * first stroke of midnight.
 *
 * Camera behaviors are dormant data (the photocard drift/pan/push cycle
 * superseded them) but remain required by the SceneBeat contract.
 */
export const MASQUE_BEATS: readonly SceneBeat[] = [
  {
    id: 'masque-onset',
    palette: { background: '#1a0f2e', primary: '#4a2a5a', accent: '#d4af6a', fog: '#140b22' },
    lighting: { ambientIntensity: 0.55, keyLightIntensity: 1.6, keyLightColor: '#d4af6a', bloomStrength: 0.6 },
    particles: { type: 'dust', density: 45, speed: 0.2, sizeRange: [0.06, 0.2] },
    camera: { behavior: 'static-drift', speed: 0.1, fov: 50 },
    silhouettes: { count: 18, animation: 'sway' },
    transitionDurationMs: 1100,
  },
  {
    id: 'room-blue',
    palette: { background: '#0e1a3a', primary: '#2a4a8a', accent: '#7ab0ff', fog: '#0a1228' },
    lighting: { ambientIntensity: 0.6, keyLightIntensity: 1.8, keyLightColor: '#7ab0ff', bloomStrength: 0.7 },
    particles: { type: 'bokeh', density: 40, speed: 0.18, sizeRange: [0.08, 0.24] },
    camera: { behavior: 'static-drift', speed: 0.1, fov: 50 },
    silhouettes: { count: 12, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'suite-spectrum',
    palette: { background: '#241438', primary: '#4a7a4a', accent: '#ffb050', fog: '#180f28' },
    lighting: { ambientIntensity: 0.65, keyLightIntensity: 1.9, keyLightColor: '#ffb050', bloomStrength: 0.75 },
    particles: { type: 'bokeh', density: 60, speed: 0.25, sizeRange: [0.08, 0.26] },
    camera: { behavior: 'static-drift', speed: 0.12, fov: 51 },
    silhouettes: { count: 16, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'room-black',
    palette: { background: '#0a0508', primary: '#1e0d14', accent: '#c1121f', fog: '#070304' },
    lighting: { ambientIntensity: 0.4, keyLightIntensity: 1.4, keyLightColor: '#c1121f', bloomStrength: 0.85 },
    particles: { type: 'embers', density: 30, speed: 0.15, sizeRange: [0.05, 0.18] },
    camera: { behavior: 'static-drift', speed: 0.08, fov: 49 },
    silhouettes: { count: 6, animation: 'still' },
    transitionDurationMs: 1200,
  },
  {
    id: 'braziers',
    palette: { background: '#241206', primary: '#7a3a10', accent: '#ffb347', fog: '#1a0d05' },
    lighting: { ambientIntensity: 0.6, keyLightIntensity: 2.0, keyLightColor: '#ffb347', bloomStrength: 0.9 },
    particles: { type: 'embers', density: 70, speed: 0.35, sizeRange: [0.06, 0.22] },
    camera: { behavior: 'static-drift', speed: 0.12, fov: 51 },
    silhouettes: { count: 14, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'ebony-clock',
    palette: { background: '#0d0a08', primary: '#2a2018', accent: '#b08d57', fog: '#0a0705' },
    lighting: { ambientIntensity: 0.45, keyLightIntensity: 1.5, keyLightColor: '#b08d57', bloomStrength: 0.6 },
    particles: { type: 'dust', density: 25, speed: 0.1, sizeRange: [0.05, 0.16] },
    camera: { behavior: 'static-drift', speed: 0.07, fov: 49 },
    silhouettes: { count: 8, animation: 'still' },
    transitionDurationMs: 1200,
  },
  {
    id: 'revel-bold',
    palette: { background: '#2e1020', primary: '#8a2a4a', accent: '#ffd166', fog: '#200a15' },
    lighting: { ambientIntensity: 0.7, keyLightIntensity: 2.2, keyLightColor: '#ffd166', bloomStrength: 1.0 },
    particles: { type: 'confetti', density: 90, speed: 0.5, sizeRange: [0.08, 0.28] },
    camera: { behavior: 'static-drift', speed: 0.14, fov: 53 },
    silhouettes: { count: 26, animation: 'sway' },
    transitionDurationMs: 950,
  },
  {
    id: 'dreams',
    palette: { background: '#251035', primary: '#7a4a9a', accent: '#ffd166', fog: '#1a0b26' },
    lighting: { ambientIntensity: 0.68, keyLightIntensity: 2.1, keyLightColor: '#ffd166', bloomStrength: 1.1 },
    particles: { type: 'bokeh', density: 100, speed: 0.45, sizeRange: [0.08, 0.3] },
    camera: { behavior: 'static-drift', speed: 0.14, fov: 54 },
    silhouettes: { count: 30, animation: 'sway' },
    transitionDurationMs: 1000,
  },
  {
    id: 'midnight',
    palette: { background: '#0f070d', primary: '#3a1020', accent: '#d94f4f', fog: '#0a0509' },
    lighting: { ambientIntensity: 0.42, keyLightIntensity: 1.5, keyLightColor: '#d94f4f', bloomStrength: 0.8 },
    particles: { type: 'embers', density: 35, speed: 0.2, sizeRange: [0.05, 0.2] },
    camera: { behavior: 'static-drift', speed: 0.08, fov: 49 },
    silhouettes: { count: 10, animation: 'still' },
    transitionDurationMs: 1200,
  },
]
