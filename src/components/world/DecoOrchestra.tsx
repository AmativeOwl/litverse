import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { clamp01, hexToRgbNormalized, lerp, lerpColorHex } from './beatMath'
import { useReadingStore } from '../../store/readingStore'

interface DecoOrchestraProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Orchestra bandstand set-piece: a low stepped "canvas platform" -- the
 * passage's own detail ("a momentary hush; the orchestra leader varies his
 * rhythm obligingly for her" while a soloist dances "on the canvas
 * platform") -- backed by a handful of static hero musicians and their
 * instruments. Gives "a whole pitful of oboes and trombones and saxophones
 * and viols and cornets and piccolos, and low and high drums" a literal,
 * game-like prop instead of another abstract crowd silhouette.
 *
 * Follows DecoFountain/DecoSkyline's established recipe: every static shape
 * is `mergeGeometries`'d once at mount; per-frame work only ever mutates
 * material color/intensity/light strength/group scale via refs, never React
 * state -- this is a detailed *prop*, not a rigged character, so the
 * musicians never move beyond whatever ambient tint/emphasis pulse the rest
 * of the scene gets (no bones, no per-part animation).
 *
 * Placement geometry: the whole footprint is authored in a local (depth,
 * lateral) frame -- local +X is "depth" (radial, growing *away* from the
 * scene origin), local +Z is "lateral" (tangential spread) -- inside one
 * outer <group> positioned at ORCHESTRA_RADIUS along ORCHESTRA_ANGLE and
 * rotated by -ORCHESTRA_ANGLE around Y. That specific rotation sign was
 * verified numerically (not guessed): it's the one rotation for which
 * three.js's rotateY formula (x' = x*cos(theta) + z*sin(theta),
 * z' = -x*sin(theta) + z*cos(theta)) sends local +X to the world radial unit
 * vector (cos(angle), sin(angle)) and local +Z to the world tangential unit
 * vector (-sin(angle), cos(angle)) simultaneously -- the opposite pairing
 * (local X -> tangential, local Z -> radial) is a mirror image of that
 * rotation and has no solution as a pure rotateY. Doing this once at the
 * group means every local coordinate below can be plain, readable
 * depth/lateral numbers instead of hand-rolled per-point trig.
 *
 * Every local coordinate used below stays within depth [-1.2, 1.8] / lateral
 * [-2, 2] of the group origin, which keeps the whole prop's world-space
 * footprint inside the assigned 60-100deg / radius 12-16 wedge -- worst-case
 * corners land at r=15.73 (angle 87.3deg) and r=12.76 (angle 71.0deg), both
 * comfortably inside bounds. That's clear of Silhouettes.tsx's
 * FLOOR_RADIUS = 22 crowd scatter and of DecoFountain's own placement
 * (angle atan2(-9,13) = approx -35deg, radius approx 15.8 -- an entirely
 * different angular sector).
 */
const ORCHESTRA_ANGLE = (80 * Math.PI) / 180
const ORCHESTRA_RADIUS = 13.8
const GROUP_POSITION: [number, number, number] = [
  Math.cos(ORCHESTRA_ANGLE) * ORCHESTRA_RADIUS,
  0,
  Math.sin(ORCHESTRA_ANGLE) * ORCHESTRA_RADIUS,
]
const GROUP_ROTATION: [number, number, number] = [0, -ORCHESTRA_ANGLE, 0]

const BEATS_WITH_EMPHASIS = new Set(['orchestra-tuning', 'dancing-under-lights'])

// --- Shared helpers -------------------------------------------------------

/** A cylinder stretched and rotated so it spans exactly from `start` to `end` -- the one reusable primitive behind every "arm" (and, unrotated, every drum/stool shell). */
function buildLimbGeometry(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  segments = 6,
): THREE.BufferGeometry {
  const direction = new THREE.Vector3().subVectors(end, start)
  const length = Math.max(0.001, direction.length())
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments)
  geometry.translate(0, length / 2, 0)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  )
  geometry.applyQuaternion(quaternion)
  geometry.translate(start.x, start.y, start.z)
  return geometry
}

// --- Platform ("canvas platform") -----------------------------------------

const PLATFORM_DEPTH = 0.3
const PLATFORM_LATERAL = 0
const PLATFORM_TOP_Y = 0.3
const PLATFORM_RINGS: ReadonlyArray<{
  radiusTop: number
  radiusBottom: number
  height: number
  yBottom: number
}> = [
  { radiusTop: 1.35, radiusBottom: 1.5, height: 0.16, yBottom: 0 },
  { radiusTop: 0.95, radiusBottom: 1.1, height: 0.14, yBottom: 0.16 },
]

function buildPlatformGeometry(): THREE.BufferGeometry {
  const rings = PLATFORM_RINGS.map((ring) => {
    const geometry = new THREE.CylinderGeometry(ring.radiusTop, ring.radiusBottom, ring.height, 20)
    geometry.translate(PLATFORM_DEPTH, ring.yBottom + ring.height / 2, PLATFORM_LATERAL)
    return geometry
  })
  const merged = mergeGeometries(rings)
  rings.forEach((ring) => ring.dispose())
  return merged
}

// --- Instruments -----------------------------------------------------------

/** Drum: a cylindrical shell + a flatter, slightly wider cylinder "cap" standing in for the drumhead, per the passage's "low and high drums". */
function buildDrumGeometry(bodyRadius: number, bodyHeight: number): THREE.BufferGeometry {
  const shell = new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 16)
  shell.translate(0, bodyHeight / 2, 0)
  const cap = new THREE.CylinderGeometry(bodyRadius * 1.08, bodyRadius * 1.08, bodyHeight * 0.08, 16)
  cap.translate(0, bodyHeight + (bodyHeight * 0.08) / 2, 0)
  const merged = mergeGeometries([shell, cap])
  shell.dispose()
  cap.dispose()
  return merged
}

/**
 * A brass instrument: a curved tube (CatmullRomCurve3 path from mouthpiece to
 * bell) ending in a wider flared cone. The cone's apex is glued to the
 * curve's endpoint and oriented along the curve's own end tangent, so the
 * bell continues the tube's direction instead of pointing off at a random
 * angle.
 */
function buildBrassGeometry(
  points: THREE.Vector3[],
  tubeRadius: number,
  bellRadius: number,
  bellLength: number,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points)
  const tube = new THREE.TubeGeometry(curve, 24, tubeRadius, 8, false)
  const endPoint = curve.getPointAt(1)
  const tangent = curve.getTangentAt(1).normalize()
  const bell = new THREE.ConeGeometry(bellRadius, bellLength, 10)
  // Apex at local origin, base flaring toward local -Y -- then rotate so
  // "apex -> base" (local -Y) aligns with the curve's own forward tangent.
  bell.translate(0, -bellLength / 2, 0)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), tangent)
  bell.applyQuaternion(quaternion)
  bell.translate(endPoint.x, endPoint.y, endPoint.z)
  const merged = mergeGeometries([tube, bell])
  tube.dispose()
  bell.dispose()
  return merged
}

/** Standing bass/viol body: a LatheGeometry waist-in/waist-out profile (echoing Silhouettes.tsx's body-lathe technique, shaped like an instrument rather than a coat) plus a thin neck and a small scroll knob on top. */
function buildViolGeometry(): THREE.BufferGeometry {
  const bodyProfile = [
    [0.05, 0],
    [0.22, 0.05],
    [0.3, 0.28],
    [0.16, 0.5],
    [0.32, 0.75],
    [0.24, 1.05],
    [0.1, 1.25],
    [0.06, 1.32],
  ].map(([radius, y]) => new THREE.Vector2(radius as number, y as number))
  const body = new THREE.LatheGeometry(bodyProfile, 12)

  const neck = new THREE.CylinderGeometry(0.035, 0.045, 0.53, 8)
  neck.translate(0, 1.32 + 0.53 / 2, 0)

  const scroll = new THREE.SphereGeometry(0.06, 8, 6)
  scroll.translate(0, 1.32 + 0.53, 0)

  const merged = mergeGeometries([body, neck, scroll])
  body.dispose()
  neck.dispose()
  scroll.dispose()
  return merged
}

interface InstrumentInstance {
  geometry: THREE.BufferGeometry
  depth: number
  lateral: number
  y: number
  rotationY?: number
  rotationZ?: number
}

function buildInstrumentsGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = []

  const instances: InstrumentInstance[] = [
    // Standing bass/viol, resting beside the bassist.
    { geometry: buildViolGeometry(), depth: 0.75, lateral: -1.4, y: PLATFORM_TOP_Y },
    // Cornet, held up near the cornetist's mouth.
    {
      geometry: buildBrassGeometry(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.05, 0.08, 0.02),
          new THREE.Vector3(0.02, 0.18, 0.12),
          new THREE.Vector3(-0.05, 0.24, 0.28),
        ],
        0.028,
        0.09,
        0.15,
      ),
      depth: 1.12,
      lateral: 0.15,
      y: PLATFORM_TOP_Y + 0.95,
      rotationY: Math.PI / 2,
    },
    // Second brass instrument (trombone-like), leaning near the stage's front edge -- the "a couple of brass instruments" the passage's "oboes and trombones ... and cornets" calls for.
    {
      geometry: buildBrassGeometry(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.08, 0.25, 0.05),
          new THREE.Vector3(0.05, 0.55, 0.22),
          new THREE.Vector3(-0.05, 0.85, 0.4),
          new THREE.Vector3(-0.02, 1.05, 0.6),
        ],
        0.036,
        0.14,
        0.22,
      ),
      depth: -0.85,
      lateral: -1.75,
      y: PLATFORM_TOP_Y,
      rotationZ: -0.3,
    },
    // Low (bass) drum beside the drummer.
    { geometry: buildDrumGeometry(0.32, 0.52), depth: 0.5, lateral: 1.55, y: PLATFORM_TOP_Y },
    // High (smaller) drum stacked alongside it.
    { geometry: buildDrumGeometry(0.2, 0.32), depth: 0.25, lateral: 1.78, y: PLATFORM_TOP_Y },
  ]

  for (const instance of instances) {
    const geometry = instance.geometry
    if (instance.rotationZ) geometry.rotateZ(instance.rotationZ)
    if (instance.rotationY) geometry.rotateY(instance.rotationY)
    geometry.translate(instance.depth, instance.y, instance.lateral)
    pieces.push(geometry)
  }

  const merged = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  return merged
}

// --- Musicians (hero figures) ----------------------------------------------

const HEAD_RADIUS = 0.135
const HEAD_OVERLAP = 0.3

/** Body (LatheGeometry revolve, same technique as Silhouettes.tsx) + head, in figure-local space (feet at y=0). */
function buildTorsoGeometry(
  profile: ReadonlyArray<readonly [number, number]>,
  bodyHeight: number,
): THREE.BufferGeometry {
  const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y))
  const body = new THREE.LatheGeometry(points, 10)
  const head = new THREE.SphereGeometry(HEAD_RADIUS, 10, 8)
  head.translate(0, bodyHeight - HEAD_RADIUS * HEAD_OVERLAP, 0)
  const merged = mergeGeometries([body, head])
  body.dispose()
  head.dispose()
  return merged
}

const STANDING_HEIGHT = 1.05
const STANDING_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.22, 0],
  [0.17, 0.14],
  [0.11, 0.48],
  [0.16, 0.74],
  [0.075, STANDING_HEIGHT],
]

const SEATED_HEIGHT = 0.62
const SEATED_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.2, 0],
  [0.18, 0.1],
  [0.15, 0.3],
  [0.17, 0.48],
  [0.07, SEATED_HEIGHT],
]
const STOOL_HEIGHT = 0.32
const STOOL_RADIUS = 0.16

interface ArmSpec {
  start: [number, number, number]
  end: [number, number, number]
  radius: number
}

interface MusicianSpec {
  pose: 'standing' | 'seated'
  depth: number
  lateral: number
  arms: ArmSpec[]
}

/** Three static hero musicians in fixed poses -- a standing bassist (beside the viol), a standing cornetist (horn raised to mouth height), and a seated drummer (stool + torso, arms angled down to the drums). No rig, no animation beyond the shared per-frame tint/emphasis every other prop in the scene gets. */
const MUSICIANS: MusicianSpec[] = [
  {
    pose: 'standing',
    depth: 0.9,
    lateral: -1.1,
    arms: [
      { start: [0, 0.78, -0.15], end: [-0.22, 0.55, -0.55], radius: 0.045 },
      { start: [0, 0.78, -0.1], end: [-0.12, 1.0, -0.4], radius: 0.045 },
    ],
  },
  {
    pose: 'standing',
    depth: 1.0,
    lateral: 0.1,
    arms: [
      { start: [0, 0.78, 0.13], end: [0.14, 0.93, 0.32], radius: 0.045 },
      { start: [0, 0.78, -0.13], end: [0.14, 0.93, 0.06], radius: 0.045 },
    ],
  },
  {
    pose: 'seated',
    depth: 0.75,
    lateral: 1.15,
    arms: [
      { start: [0, STOOL_HEIGHT + 0.4, 0.16], end: [0.36, STOOL_HEIGHT + 0.14, 0.35], radius: 0.04 },
      { start: [0, STOOL_HEIGHT + 0.4, -0.16], end: [0.36, STOOL_HEIGHT + 0.14, -0.06], radius: 0.04 },
    ],
  },
]

function buildMusiciansGeometry(): THREE.BufferGeometry {
  const figures: THREE.BufferGeometry[] = []

  for (const musician of MUSICIANS) {
    const parts: THREE.BufferGeometry[] = []

    if (musician.pose === 'standing') {
      parts.push(buildTorsoGeometry(STANDING_PROFILE, STANDING_HEIGHT))
    } else {
      const torso = buildTorsoGeometry(SEATED_PROFILE, SEATED_HEIGHT)
      torso.translate(0, STOOL_HEIGHT, 0)
      const stool = new THREE.CylinderGeometry(STOOL_RADIUS, STOOL_RADIUS * 1.1, STOOL_HEIGHT, 10)
      stool.translate(0, STOOL_HEIGHT / 2, 0)
      parts.push(torso, stool)
    }

    for (const arm of musician.arms) {
      parts.push(
        buildLimbGeometry(
          new THREE.Vector3(...arm.start),
          new THREE.Vector3(...arm.end),
          arm.radius,
        ),
      )
    }

    const figure = mergeGeometries(parts)
    parts.forEach((part) => part.dispose())
    figure.translate(musician.depth, PLATFORM_TOP_Y, musician.lateral)
    figures.push(figure)
  }

  const merged = mergeGeometries(figures)
  figures.forEach((figure) => figure.dispose())
  return merged
}

// --- Component ---------------------------------------------------------

/**
 * Bandstand prop: platform (unlit flat-silhouette tint, matching
 * DecoFountain/DecoSkyline's architecture treatment) plus musicians and
 * instruments rendered with real `MeshStandardMaterial` PBR shading (low
 * metalness, moderate roughness) per the scene's move toward detailed,
 * game-like hero props. Brightens (emissive boost + a small stage light +
 * a subtle scale bump) during `orchestra-tuning` and `dancing-under-lights`,
 * more subdued the rest of the time -- driven by a `useFrame`-lerped ref,
 * never React state, reading `activeSceneBeatId` the same way
 * `MotifEffects.tsx` does.
 */
export function DecoOrchestra({ lerpedRef }: DecoOrchestraProps) {
  const activeSceneBeatId = useReadingStore((s) => s.activeSceneBeatId)

  const platformGeometry = useMemo(buildPlatformGeometry, [])
  const instrumentsGeometry = useMemo(buildInstrumentsGeometry, [])
  const musiciansGeometry = useMemo(buildMusiciansGeometry, [])

  const platformMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#050505', fog: true }), [])
  const musiciansMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#3a3248', roughness: 0.75, metalness: 0.08 }),
    [],
  )
  const instrumentsMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8a5a2a', roughness: 0.45, metalness: 0.18 }),
    [],
  )

  const groupRef = useRef<THREE.Group>(null)
  const stageLightRef = useRef<THREE.PointLight>(null)
  const emphasisRef = useRef(0)

  useFrame((_, delta) => {
    const lerped = lerpedRef.current
    if (!lerped) return

    const target = BEATS_WITH_EMPHASIS.has(activeSceneBeatId ?? '') ? 1 : 0
    emphasisRef.current += (target - emphasisRef.current) * clamp01(delta * 2.5)
    const emphasis = emphasisRef.current

    // Platform: same dark fog/background-blend silhouette recipe as
    // DecoFountain/DecoSkyline, so all Deco set-pieces re-light in step.
    const [fr, fg, fb] = hexToRgbNormalized(lerped.palette.fog)
    const [br, bg, bb] = hexToRgbNormalized(lerped.palette.background)
    platformMaterial.color.setRGB(lerp(fr, br, 0.5) * 0.5, lerp(fg, bg, 0.5) * 0.5, lerp(fb, bb, 0.5) * 0.5)

    // Musicians/instruments: real PBR albedo tinted from the beat palette,
    // brightened toward the accent color and a warmer emissive as emphasis
    // rises, so they read as "lit up" during the tuning/dancing beats
    // without ever leaving MeshStandardMaterial's real lighting response.
    musiciansMaterial.color.set(lerpColorHex('#3a3248', lerped.palette.primary, 0.35 + emphasis * 0.15))
    musiciansMaterial.emissive.set(lerped.lighting.keyLightColor)
    musiciansMaterial.emissiveIntensity = 0.03 + emphasis * 0.22

    instrumentsMaterial.color.set(lerpColorHex('#8a5a2a', lerped.palette.accent, 0.3 + emphasis * 0.25))
    instrumentsMaterial.emissive.set(lerped.palette.accent)
    instrumentsMaterial.emissiveIntensity = 0.05 + emphasis * 0.35

    if (stageLightRef.current) {
      stageLightRef.current.color.set(lerped.lighting.keyLightColor)
      stageLightRef.current.intensity = emphasis * lerped.lighting.keyLightIntensity * 1.6
    }

    if (groupRef.current) {
      const scale = lerp(1, 1.05, emphasis)
      groupRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group ref={groupRef} position={GROUP_POSITION} rotation={GROUP_ROTATION}>
      <mesh geometry={platformGeometry} material={platformMaterial} frustumCulled={false} />
      <mesh geometry={instrumentsGeometry} material={instrumentsMaterial} frustumCulled={false} />
      <mesh geometry={musiciansGeometry} material={musiciansMaterial} frustumCulled={false} />
      <pointLight
        ref={stageLightRef}
        position={[PLATFORM_DEPTH, PLATFORM_TOP_Y + 1.6, PLATFORM_LATERAL]}
        distance={6}
        intensity={0}
      />
    </group>
  )
}
