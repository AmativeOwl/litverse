import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { hexToRgbNormalized } from './beatMath'

interface StringLightsProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * "...enough coloured lights to make a Christmas tree of Gatsby's enormous
 * garden." Catenary strands of glowing bulbs strung between slim poles over
 * the crowd -- the signature Gatsby-garden image.
 *
 * Follows the established set-piece conventions (seeded/fixed placement,
 * merge-once geometry, unlit materials tinted per-beat imperatively in
 * `useFrame` off `lerpedRef`): an arc of poles at radius 8.5 spanning
 * 210-330 degrees, inside every other set-piece's radius band (buffet 12-16,
 * bar 12, cars 17-21, fountain ~15.8) so nothing clips, reading as a light
 * layer *over* the party area in front of them.
 *
 * Audio-reactivity: bulb color tracks `palette.accent`, and bulb visibility
 * is driven by how dark the lerped background is (`nightnessOf`) -- the
 * text's own stage direction, "The lights grow brighter as the earth lurches
 * away from the sun," made continuous. No beat-id special-casing: daytime
 * beats have bright backgrounds so the strands fade out, night beats fade
 * them up, and the beat lerp animates the transition for free.
 */

const POLE_COUNT = 5
const ARC_START_DEG = 210
const ARC_END_DEG = 330
const ARC_RADIUS = 8.5
const POLE_HEIGHT = 3.4
const POLE_RADIUS = 0.05
/** How far below the pole tops the strand midpoint sags. */
const STRAND_SAG = 0.55
const BULBS_PER_STRAND = 13
const WIRE_SEGMENTS = 16
const BULB_SIZE = 0.24

/** Fixed pole positions along the arc -- pure and exported for tests. */
export function buildPolePositions(): { x: number; z: number }[] {
  const positions: { x: number; z: number }[] = []
  for (let i = 0; i < POLE_COUNT; i++) {
    const t = i / (POLE_COUNT - 1)
    const deg = ARC_START_DEG + (ARC_END_DEG - ARC_START_DEG) * t
    const rad = (deg * Math.PI) / 180
    positions.push({ x: Math.cos(rad) * ARC_RADIUS, z: Math.sin(rad) * ARC_RADIUS })
  }
  return positions
}

/**
 * Point along one strand: parabolic sag between two pole tops. `t` in [0,1].
 * A true catenary is cosh-based, but at this sag/span ratio a parabola is
 * visually identical and cheaper. Pure and exported for tests.
 */
export function strandPointAt(
  from: { x: number; z: number },
  to: { x: number; z: number },
  t: number,
): { x: number; y: number; z: number } {
  return {
    x: from.x + (to.x - from.x) * t,
    // 4t(1-t) is 0 at both ends, 1 at the middle
    y: POLE_HEIGHT - STRAND_SAG * 4 * t * (1 - t),
    z: from.z + (to.z - from.z) * t,
  }
}

/**
 * 0 = bright day (lights off), 1 = deep night (lights full). Driven by the
 * *lerped* background color's relative luminance so it animates smoothly
 * through every beat transition. Pure and exported for tests.
 */
export function nightnessOf(backgroundHex: string): number {
  const [r, g, b] = hexToRgbNormalized(backgroundHex)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // smoothstep between "clearly daylight" and "clearly night" luminances
  const t = Math.min(1, Math.max(0, (0.45 - luminance) / (0.45 - 0.12)))
  return t * t * (3 - 2 * t)
}

/** All poles merged into one geometry: shaft + a small finial sphere each. */
function buildPolesGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const { x, z } of buildPolePositions()) {
    const shaft = new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS * 1.4, POLE_HEIGHT, 8)
    shaft.translate(x, POLE_HEIGHT / 2, z)
    parts.push(shaft)
    const finial = new THREE.SphereGeometry(POLE_RADIUS * 2, 8, 6)
    finial.translate(x, POLE_HEIGHT, z)
    parts.push(finial)
  }
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return merged
}

/** One Points position buffer holding every bulb on every strand. */
function buildBulbPositions(): Float32Array {
  const poles = buildPolePositions()
  const strandCount = poles.length - 1
  const positions = new Float32Array(strandCount * BULBS_PER_STRAND * 3)
  let offset = 0
  for (let s = 0; s < strandCount; s++) {
    const from = poles[s]
    const to = poles[s + 1]
    if (!from || !to) continue
    for (let i = 0; i < BULBS_PER_STRAND; i++) {
      // skip t=0/t=1 (inside the pole finials)
      const t = (i + 1) / (BULBS_PER_STRAND + 1)
      const p = strandPointAt(from, to, t)
      positions[offset++] = p.x
      positions[offset++] = p.y
      positions[offset++] = p.z
    }
  }
  return positions
}

/** Wire polylines, one per strand. */
function buildWireGeometries(): THREE.BufferGeometry[] {
  const poles = buildPolePositions()
  const wires: THREE.BufferGeometry[] = []
  for (let s = 0; s < poles.length - 1; s++) {
    const from = poles[s]
    const to = poles[s + 1]
    if (!from || !to) continue
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= WIRE_SEGMENTS; i++) {
      const p = strandPointAt(from, to, i / WIRE_SEGMENTS)
      points.push(new THREE.Vector3(p.x, p.y, p.z))
    }
    wires.push(new THREE.BufferGeometry().setFromPoints(points))
  }
  return wires
}

/**
 * Soft radial sprite so each bulb renders as a small glow instead of a hard
 * square point; additive blending lets overlapping glows (and Bloom) stack.
 * Lazily created once at module scope, same pattern as toonGradientTexture.
 */
let bulbSpriteTexture: THREE.Texture | null = null
function getBulbSprite(): THREE.Texture {
  if (bulbSpriteTexture) return bulbSpriteTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.7)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  bulbSpriteTexture = new THREE.CanvasTexture(canvas)
  return bulbSpriteTexture
}

const POLE_BASE_COLOR = new THREE.Color('#1c1428')
const workingColor = new THREE.Color()

export function StringLights({ lerpedRef }: StringLightsProps) {
  const poleMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const bulbMaterialRef = useRef<THREE.PointsMaterial>(null)

  const polesGeometry = useMemo(buildPolesGeometry, [])
  // THREE.Line objects built imperatively and rendered via <primitive>:
  // R3F's lowercase <line> JSX collides with the SVG line element type under
  // strict TS. One shared material, mutated per frame below.
  const wires = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ transparent: true })
    const lines = buildWireGeometries().map((geometry) => new THREE.Line(geometry, material))
    return { material, lines }
  }, [])
  const bulbGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(buildBulbPositions(), 3))
    return geometry
  }, [])

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped) return
    const nightness = nightnessOf(lerped.palette.background)

    if (poleMaterialRef.current) {
      // dark silhouette tone nudged toward the fog color, like DecoSkyline
      workingColor.set(lerped.palette.fog)
      poleMaterialRef.current.color.copy(POLE_BASE_COLOR).lerp(workingColor, 0.35)
    }
    wires.material.color.copy(POLE_BASE_COLOR)
    wires.material.opacity = 0.35 + nightness * 0.35
    if (bulbMaterialRef.current) {
      bulbMaterialRef.current.color.set(lerped.palette.accent)
      bulbMaterialRef.current.opacity = nightness
      bulbMaterialRef.current.size = BULB_SIZE * (0.75 + nightness * 0.45)
    }
  })

  return (
    <group>
      <mesh geometry={polesGeometry}>
        <meshBasicMaterial ref={poleMaterialRef} />
      </mesh>
      {wires.lines.map((lineObject, index) => (
        <primitive key={index} object={lineObject} />
      ))}
      <points geometry={bulbGeometry}>
        <pointsMaterial
          ref={bulbMaterialRef}
          map={getBulbSprite()}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  )
}
