import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
import { hexToRgbNormalized, lerp } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'

interface ParticlesProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Shared capacity for the particle point cloud. drei's `<Sparkles>` fully
 * remounts (new key, re-randomized positions) whenever its `count`/`scale`
 * props change identity, so both are kept fixed for the component's whole
 * lifetime. "Fewer/more particles" per beat is instead achieved by mutating
 * per-vertex buffer attributes (opacity/size/speed/color) directly in
 * `useFrame` -- the same imperative, zero-React-state pattern already used by
 * Atmosphere/Floor/Lighting/Silhouettes in this module.
 */
const CAPACITY = 200
const SCALE: [number, number, number] = [22, 6, 22]
const ORIGIN: [number, number, number] = [0, 3, 0]

interface ParticleFactors {
  sizeFactor: Float32Array
  speedFactor: Float32Array
}

function buildFactors(): ParticleFactors {
  const random = createSeededRandom(hashStringToSeed('litverse-particle-factors'))
  const sizeFactor = new Float32Array(CAPACITY)
  const speedFactor = new Float32Array(CAPACITY)
  for (let i = 0; i < CAPACITY; i++) {
    sizeFactor[i] = random()
    speedFactor[i] = 0.6 + random() * 0.8
  }
  return { sizeFactor, speedFactor }
}

/** Light per-type tint so 'embers' read warmer and 'dust' read cooler/duller
 * than the raw palette accent, without needing a different shader per type. */
function tintForType(
  type: LerpedSceneBeat['particles']['type'],
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  switch (type) {
    case 'embers':
      return [lerp(r, 1, 0.35), lerp(g, 0.45, 0.35), lerp(b, 0.15, 0.35)]
    case 'dust':
      return [lerp(r, 0.6, 0.4), lerp(g, 0.6, 0.4), lerp(b, 0.6, 0.4)]
    default:
      return [r, g, b]
  }
}

/**
 * Particle field reused for every `particles.type` (bokeh/confetti/embers/
 * dust/none) by varying color/size/speed/visible-count per beat, per the
 * Three.js-world spec. `type: 'none'` is handled by dropping visible count
 * to zero rather than unmounting, so the transition into/out of "no
 * particles" lerps (via density) instead of popping.
 */
export function Particles({ lerpedRef }: ParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const { sizeFactor, speedFactor } = useMemo(buildFactors, [])

  // Stable Float32Array identities so Sparkles' internal useMemo never
  // reallocates them -- we mutate the contents in place instead.
  const sizes = useMemo(() => new Float32Array(CAPACITY), [])
  const opacities = useMemo(() => new Float32Array(CAPACITY), [])
  const speeds = useMemo(() => new Float32Array(CAPACITY), [])
  const colors = useMemo(() => new Float32Array(CAPACITY * 3), [])

  useFrame(() => {
    const lerped = lerpedRef.current
    const points = pointsRef.current
    if (!lerped || !points) return

    const { particles } = lerped
    const isNone = particles.type === 'none'
    const activeCount = isNone ? 0 : Math.max(0, Math.min(CAPACITY, Math.round(particles.density)))
    const [minSize, maxSize] = particles.sizeRange
    const [baseR, baseG, baseB] = hexToRgbNormalized(lerped.palette.accent)
    const [r, g, b] = tintForType(particles.type, baseR, baseG, baseB)

    for (let i = 0; i < CAPACITY; i++) {
      opacities[i] = i < activeCount ? 1 : 0
      sizes[i] = lerp(minSize, maxSize, sizeFactor[i] ?? 0)
      speeds[i] = particles.speed * (speedFactor[i] ?? 1)
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    const attributes = points.geometry.attributes as Record<
      string,
      THREE.BufferAttribute | undefined
    >
    if (attributes.size) attributes.size.needsUpdate = true
    if (attributes.opacity) attributes.opacity.needsUpdate = true
    if (attributes.speed) attributes.speed.needsUpdate = true
    if (attributes.color) attributes.color.needsUpdate = true
  })

  return (
    <Sparkles
      ref={pointsRef}
      count={CAPACITY}
      scale={SCALE}
      position={ORIGIN}
      size={sizes}
      opacity={opacities}
      speed={speeds}
      color={colors}
      noise={1}
    />
  )
}
