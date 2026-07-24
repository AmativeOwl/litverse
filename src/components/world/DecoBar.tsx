import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { lerpColorHex } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'
import { useReadingStore } from '../../store/readingStore'

interface DecoBarProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Foreground prop: the Chapter 3 bar ("a bar with a real brass rail was set
 * up, and stocked with gins and liquors and cordials") -- a low counter with
 * a taller back-bar box for bottle shelving, a brass foot rail along the
 * counter's front face, and a handful of bottles on the shelf. Reuses the
 * Deco set-pieces' established pattern (seeded/fixed placement decided once,
 * static geometry merged once via `mergeGeometries`, only material
 * color/intensity animated per-frame) but with real PBR `MeshStandardMaterial`
 * (metalness/roughness) rather than the flat unlit silhouette treatment
 * `DecoSkyline`/`DecoFountain` use -- this prop is meant to read as a solid,
 * detailed, lit piece of furniture up close, not a silhouette.
 *
 * Placement: a fixed angle/radius sector (not a scatter -- there's only one
 * bar), chosen to sit in the same "refreshments" area as the buffet
 * (assigned 190-220 degrees, radius 12-16 in a sibling worktree) without
 * overlapping it -- this prop stays within 220-250 degrees, radius 10-14 from
 * the scene origin. The counter itself is oriented tangentially (its front
 * face, where the rail runs, points back toward the origin) so it reads as
 * facing the crowd/camera rather than edge-on.
 */
const BAR_CENTER_ANGLE_DEG = 235
const BAR_RADIUS = 12
const BAR_ANGLE = (BAR_CENTER_ANGLE_DEG * Math.PI) / 180
const BAR_X = Math.cos(BAR_ANGLE) * BAR_RADIUS
const BAR_Z = Math.sin(BAR_ANGLE) * BAR_RADIUS
// Rotates the prop's local -Z axis (its "front") to point from (BAR_X, BAR_Z)
// back toward the scene origin -- see the derivation this satisfies:
// world-forward = (-sin(rotY), 0, -cos(rotY)) must equal the unit vector
// toward the origin, (-cos(BAR_ANGLE), 0, -sin(BAR_ANGLE)).
const BAR_ROTATION_Y = Math.atan2(Math.cos(BAR_ANGLE), Math.sin(BAR_ANGLE))

const COUNTER_WIDTH = 5
const COUNTER_DEPTH = 1.2
const COUNTER_HEIGHT = 1.05

const BACKBAR_WIDTH = 5.2
const BACKBAR_DEPTH = 0.6
const BACKBAR_HEIGHT = 1.9
// Back-bar sits directly behind the counter (local +Z, i.e. away from the
// origin) with its front face touching the counter's back face.
const BACKBAR_CENTER_Z = COUNTER_DEPTH / 2 + BACKBAR_DEPTH / 2

const RAIL_HEIGHT = 0.32
const RAIL_RADIUS = 0.045
const RAIL_LENGTH = COUNTER_WIDTH - 0.4
// Just proud of the counter's front face (local -Z is "front", toward the origin).
const RAIL_Z = -COUNTER_DEPTH / 2 - 0.08

const BOTTLE_COUNT: number = 11

interface BottleLayoutEntry {
  x: number
  z: number
  rotationY: number
  scale: number
  colorIndex: number
}

function buildStructureGeometry(): THREE.BufferGeometry {
  const counter = new THREE.BoxGeometry(COUNTER_WIDTH, COUNTER_HEIGHT, COUNTER_DEPTH)
  counter.translate(0, COUNTER_HEIGHT / 2, 0)

  const backBar = new THREE.BoxGeometry(BACKBAR_WIDTH, BACKBAR_HEIGHT, BACKBAR_DEPTH)
  backBar.translate(0, BACKBAR_HEIGHT / 2, BACKBAR_CENTER_Z)

  const merged = mergeGeometries([counter, backBar])
  counter.dispose()
  backBar.dispose()
  return merged
}

function buildRailGeometry(): THREE.BufferGeometry {
  // Default cylinder axis is Y; rotate onto X so it runs along the counter's width.
  const geometry = new THREE.CylinderGeometry(RAIL_RADIUS, RAIL_RADIUS, RAIL_LENGTH, 12)
  geometry.rotateZ(Math.PI / 2)
  geometry.translate(0, RAIL_HEIGHT, RAIL_Z)
  return geometry
}

/** A single bottle: a cylindrical body with a narrower cylindrical neck, merged into one mesh. */
function buildBottleGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.075, 0.095, 0.5, 10)
  body.translate(0, 0.25, 0)

  const neck = new THREE.CylinderGeometry(0.035, 0.05, 0.2, 8)
  neck.translate(0, 0.5 + 0.1, 0)

  const merged = mergeGeometries([body, neck])
  body.dispose()
  neck.dispose()
  return merged
}

/** Deterministic scatter of bottles along the back-bar's shelf-top surface. */
function buildBottleLayout(): BottleLayoutEntry[] {
  const random = createSeededRandom(hashStringToSeed('litverse-deco-bar-bottles'))
  const margin = 0.35
  const usableWidth = BACKBAR_WIDTH - margin * 2
  const entries: BottleLayoutEntry[] = []
  for (let i = 0; i < BOTTLE_COUNT; i++) {
    const t = BOTTLE_COUNT === 1 ? 0.5 : i / (BOTTLE_COUNT - 1)
    const x = -usableWidth / 2 + usableWidth * t + (random() - 0.5) * 0.12
    const z = BACKBAR_CENTER_Z + (random() - 0.5) * (BACKBAR_DEPTH * 0.5)
    entries.push({
      x,
      z,
      rotationY: random() * Math.PI * 2,
      scale: 0.85 + random() * 0.35,
      colorIndex: Math.floor(random() * 4),
    })
  }
  return entries
}

// Gin (clear/pale), amber liquor, deep red cordial, deep green cordial --
// "gins and liquors and cordials so long forgotten" gets a small but
// deliberate spread of glass tones rather than one uniform bottle color.
const BOTTLE_COLORS = ['#dce7e0', '#a8641f', '#5c0f1e', '#123d24'] as const

const BRASS_BASE_COLOR = '#c9a227'
const EMPHASIS_BEAT_IDS = new Set(['evening-bar-setup', 'full-swing-cocktails'])
// How quickly the emphasis blend chases its 0/1 target per second -- smooths
// the transition instead of snapping the instant the store's beat id flips.
const EMPHASIS_RATE = 2.5

/**
 * The Chapter-3 bar counter: brass foot rail, back-bar shelving, and a
 * handful of bottles. Uses real `MeshStandardMaterial` (metalness/roughness)
 * rather than the flat unlit look of the other Deco set-pieces, per this
 * prop's brief -- it's meant to read as a detailed, physically-lit object up
 * close. Static geometry/layout built once; only material color/intensity
 * (palette-driven tint plus a beat-driven "busier/brighter" emphasis during
 * `evening-bar-setup` and `full-swing-cocktails`) is animated in `useFrame`.
 */
export function DecoBar({ lerpedRef }: DecoBarProps) {
  const structureGeometry = useMemo(buildStructureGeometry, [])
  const railGeometry = useMemo(buildRailGeometry, [])
  const bottleGeometry = useMemo(buildBottleGeometry, [])
  const bottleLayout = useMemo(buildBottleLayout, [])

  const woodMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b1c12', roughness: 0.75, metalness: 0.05 }),
    [],
  )
  const brassMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: BRASS_BASE_COLOR,
        metalness: 0.9,
        roughness: 0.22,
        emissive: BRASS_BASE_COLOR,
        emissiveIntensity: 0.12,
      }),
    [],
  )
  const bottleMaterials = useMemo(
    () =>
      BOTTLE_COLORS.map(
        (color) =>
          new THREE.MeshStandardMaterial({
            color,
            roughness: 0.1,
            metalness: 0,
            transparent: true,
            opacity: 0.8,
            emissive: color,
            emissiveIntensity: 0.05,
          }),
      ),
    [],
  )

  // Beat-level store state (allowed to trigger a re-render per the project's
  // word-level-state rule) -- read the same way MotifEffects.tsx does. The
  // value is just captured here; useFrame's callback closure is refreshed by
  // R3F every render, so the per-frame smoothing below always sees the
  // latest id without needing an extra ref.
  const activeSceneBeatId = useReadingStore((s) => s.activeSceneBeatId)

  const barLightRef = useRef<THREE.PointLight>(null)
  const emphasisRef = useRef(0)

  useFrame((_, delta) => {
    const lerped = lerpedRef.current
    const target = activeSceneBeatId !== null && EMPHASIS_BEAT_IDS.has(activeSceneBeatId) ? 1 : 0
    const rate = 1 - Math.exp(-EMPHASIS_RATE * Math.max(delta, 0))
    emphasisRef.current += (target - emphasisRef.current) * rate
    const emphasis = emphasisRef.current

    const accent = lerped?.palette.accent ?? '#ffd166'
    brassMaterial.emissive.set(lerpColorHex(BRASS_BASE_COLOR, accent, 0.35 * emphasis))
    brassMaterial.emissiveIntensity = 0.12 + emphasis * 0.55

    bottleMaterials.forEach((material, index) => {
      const base = BOTTLE_COLORS[index] ?? BOTTLE_COLORS[0]
      material.emissiveIntensity = 0.05 + emphasis * 0.3
      material.emissive.set(lerpColorHex(base, accent, 0.2 * emphasis))
    })

    const light = barLightRef.current
    if (light) {
      light.color.set(accent)
      light.intensity = 0.4 + emphasis * 1.4
    }
  })

  return (
    <group position={[BAR_X, 0, BAR_Z]} rotation={[0, BAR_ROTATION_Y, 0]}>
      <mesh geometry={structureGeometry} material={woodMaterial} frustumCulled={false} />
      <mesh geometry={railGeometry} material={brassMaterial} frustumCulled={false} />
      {bottleLayout.map((bottle, index) => (
        <mesh
          key={index}
          geometry={bottleGeometry}
          material={bottleMaterials[bottle.colorIndex] ?? bottleMaterials[0]}
          position={[bottle.x, BACKBAR_HEIGHT, bottle.z]}
          rotation={[0, bottle.rotationY, 0]}
          scale={[bottle.scale, bottle.scale, bottle.scale]}
          frustumCulled={false}
        />
      ))}
      <pointLight
        ref={barLightRef}
        position={[0, RAIL_HEIGHT + 0.6, RAIL_Z - 0.3]}
        intensity={0.4}
        distance={6}
        color={BRASS_BASE_COLOR}
      />
    </group>
  )
}
