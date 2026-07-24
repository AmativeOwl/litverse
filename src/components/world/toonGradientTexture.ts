import * as THREE from 'three'

/**
 * Standard three.js toon-shading "gradient map" recipe: a tiny 1D grayscale
 * texture whose N texels become the N discrete light/shadow bands
 * `MeshToonMaterial` quantizes its lighting response into (instead of the
 * smooth continuous falloff `MeshStandardMaterial` produces). `NearestFilter`
 * on both min/mag filters is load-bearing here -- linear filtering would
 * blend adjacent texels together and wash the hard band edges back out into
 * a smooth gradient, defeating the entire point of "toon" shading.
 *
 * Built once as a module-scope singleton (lazily, on first call) since it's
 * pure derived data with no per-beat/per-frame variation -- every material
 * that wants the cel-shaded look shares the same texture instance.
 */
const STEPS = 4

let sharedGradientMap: THREE.DataTexture | null = null

export function getToonGradientMap(): THREE.DataTexture {
  if (sharedGradientMap) return sharedGradientMap

  const data = new Uint8Array(STEPS)
  for (let i = 0; i < STEPS; i++) {
    // Evenly spaced bands from dark to (nearly) full bright, e.g. for
    // STEPS = 4: 0, 85, 170, 255.
    data[i] = Math.round((i / (STEPS - 1)) * 255)
  }

  const texture = new THREE.DataTexture(data, STEPS, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true

  sharedGradientMap = texture
  return texture
}
