import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { hexToRgbNormalized, lerp, easeInOutCubic } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'

interface DecoWaterfrontProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Distant daytime memory: "I watched his guests diving from the tower of his
 * raft, or taking the sun on the hot sand of his beach while his two
 * motorboats slit the waters of the Sound, drawing aquaplanes over cataracts
 * of foam." Follows `DecoSkyline`/`DecoFountain`'s established pattern
 * (seeded/fixed placement, `mergeGeometries`-once static geometry, real
 * `MeshStandardMaterial` tinted per-beat in `useFrame`) with one addition:
 * this is the only Deco prop that's beat-*gated in visibility*, not just emphasis.
 * The passage's daytime/beach content is a single memory sitting inside an
 * otherwise evening scene, so it should read as essentially absent except
 * during `daytime-leisure`, where it should clearly brighten into a sunlit
 * silhouette.
 *
 * Placement: kept inside a narrow angle/radius wedge (10-50 deg, radius
 * 18-21) well clear of `DecoFountain` (radius ~15.8, angle ~-35 deg) and
 * beyond `Silhouettes.tsx`'s FLOOR_RADIUS = 22 crowd core, at the same
 * "distant background" cardinality as `DecoSkyline`.
 */

const DAYTIME_BEAT_ID = 'daytime-leisure'

// Fully hidden except while transitioning into/out of daytime-leisure, when
// it fades up to full visibility -- and even at its dimmest floor, a faint
// silhouette (never fully invisible/culled) per spec.
const HIDDEN_OPACITY = 0.05
const HIDDEN_COLOR_MIX = 0.08

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// Raft: centered in the middle of the placement wedge.
const RAFT_ANGLE_DEG = 28
const RAFT_RADIUS = 19.3
const RAFT_X = Math.cos(degToRad(RAFT_ANGLE_DEG)) * RAFT_RADIUS
const RAFT_Z = Math.sin(degToRad(RAFT_ANGLE_DEG)) * RAFT_RADIUS
const RAFT_ROTATION_Y = degToRad(200)

// Two motorboats spread toward either edge of the wedge, clear of the raft.
const BOAT_ANGLE_DEG: readonly number[] = [14, 46]
const BOAT_RADIUS: readonly number[] = [19.6, 18.7]
const BOAT_HEADING_DEG: readonly number[] = [-40, 205]

const RAFT_WIDTH = 2.6
const RAFT_DEPTH = 1.9
const RAFT_THICKNESS = 0.14
const LEG_HEIGHT = 0.5
const LEG_RADIUS = 0.07
const TOWER_HEIGHT = 1.5
const TOWER_POST_SIZE = 0.12
const TOWER_PLATFORM_WIDTH = 0.7
const TOWER_PLATFORM_DEPTH = 0.6
const TOWER_PLATFORM_THICKNESS = 0.08

const HULL_LENGTH = 1.6
const HULL_WIDTH = 0.55
const HULL_HEIGHT = 0.32

const WAKE_POINTS_PER_BOAT = 14
const WAKE_LENGTH = 2.2
const WAKE_SPREAD = 0.5

/** Builds the raft assembly (floating platform on pontoon legs, plus a short diving tower at one corner) as one merged static geometry. */
function buildRaftGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = []

  const platform = new THREE.BoxGeometry(RAFT_WIDTH, RAFT_THICKNESS, RAFT_DEPTH)
  platform.translate(0, LEG_HEIGHT + RAFT_THICKNESS / 2, 0)
  pieces.push(platform)

  const legInsetX = RAFT_WIDTH / 2 - 0.2
  const legInsetZ = RAFT_DEPTH / 2 - 0.2
  const legOffsets: readonly [number, number][] = [
    [legInsetX, legInsetZ],
    [-legInsetX, legInsetZ],
    [legInsetX, -legInsetZ],
    [-legInsetX, -legInsetZ],
  ]
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, LEG_HEIGHT, 6)
    leg.translate(lx, LEG_HEIGHT / 2, lz)
    pieces.push(leg)
  }

  // Tower post rises from one corner of the platform.
  const towerX = legInsetX
  const towerZ = legInsetZ
  const platformTopY = LEG_HEIGHT + RAFT_THICKNESS
  const post = new THREE.BoxGeometry(TOWER_POST_SIZE, TOWER_HEIGHT, TOWER_POST_SIZE)
  post.translate(towerX, platformTopY + TOWER_HEIGHT / 2, towerZ)
  pieces.push(post)

  const towerTop = new THREE.BoxGeometry(TOWER_PLATFORM_WIDTH, TOWER_PLATFORM_THICKNESS, TOWER_PLATFORM_DEPTH)
  towerTop.translate(towerX, platformTopY + TOWER_HEIGHT + TOWER_PLATFORM_THICKNESS / 2, towerZ)
  pieces.push(towerTop)

  const merged = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  return merged
}

/**
 * A simple readable hull silhouette: starts from a plain box and pinches the
 * bow half's z-extent toward the centerline (wide flat transom stern,
 * tapering to a point at the bow) while lifting the bow's bottom edge toward
 * the deck line (the "angled bow cut" of a planing speedboat hull) -- cheaper
 * and simpler than a revolved `LatheGeometry` hull, and reads just as clearly
 * as a silhouette at this scale.
 */
function buildHullGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(HULL_LENGTH, HULL_HEIGHT, HULL_WIDTH, 1, 1, 1)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const halfLength = HULL_LENGTH / 2
  const halfHeight = HULL_HEIGHT / 2

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    if (x <= 0) continue // stern half stays a flat transom, untouched

    const t = x / halfLength // 0 at midship, 1 at the very bow tip
    const z = position.getZ(i)
    position.setZ(i, z * (1 - t)) // pinch hull width to a point at the bow

    const y = position.getY(i)
    if (y < 0) {
      // Lift the bow's underside toward the deck line -- the hull "rises" as
      // it narrows, suggesting a planing speedboat prow rather than a barge.
      position.setY(i, y + (halfHeight - y) * t * 0.55)
    }
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

interface WakePoint {
  x: number
  y: number
  z: number
}

/** Sparse points trailing behind a boat, reusing DecoSkyline's window-light points technique for a cheap foam/wake suggestion. */
function buildWakeLayout(seedLabel: string): WakePoint[] {
  const random = createSeededRandom(hashStringToSeed(seedLabel))
  const points: WakePoint[] = []
  for (let i = 0; i < WAKE_POINTS_PER_BOAT; i++) {
    const t = i / (WAKE_POINTS_PER_BOAT - 1)
    const spread = WAKE_SPREAD * t
    points.push({
      x: -HULL_LENGTH * 0.5 - WAKE_LENGTH * t,
      y: 0.02 + random() * 0.03,
      z: (random() * 2 - 1) * spread,
    })
  }
  return points
}

export function DecoWaterfront({ lerpedRef }: DecoWaterfrontProps) {
  const raftGeometry = useMemo(buildRaftGeometry, [])
  const hullGeometry = useMemo(buildHullGeometry, [])
  const wakeLayouts = useMemo(
    () => BOAT_ANGLE_DEG.map((_, index) => buildWakeLayout(`litverse-deco-waterfront-wake-${index}`)),
    [],
  )

  const wakePositions = useMemo(
    () => wakeLayouts.map((points) => new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))),
    [wakeLayouts],
  )

  // Raft/tower and motorboat hulls: weathered-wood/wet-stone-ish surface --
  // fairly high roughness (matte, not glossy plastic), low metalness -- so
  // they pick up real lighting/shadow like `DecoFountain`'s basin and
  // `DecoSkyline`'s towers, instead of standing out as flat unlit silhouettes
  // now that the rest of the scene uses real `MeshStandardMaterial` lighting.
  // Still `transparent`/opacity-driven (not `visible` toggling) so the
  // beat-gated fade in `useFrame` below keeps working unchanged.
  const structureMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#050505',
        roughness: 0.7,
        metalness: 0.08,
        transparent: true,
        opacity: HIDDEN_OPACITY,
        fog: true,
      }),
    [],
  )
  const wakeMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#eaf6ff',
        size: 0.16,
        sizeAttenuation: true,
        transparent: true,
        opacity: HIDDEN_OPACITY,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true,
      }),
    [],
  )

  const wakeGeometries = useMemo(
    () =>
      wakePositions.map((positions) => {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        return geometry
      }),
    [wakePositions],
  )

  const wakeGroupRefs = useRef<Array<THREE.Group | null>>([])

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped) return

    // Visibility gate: fully present only in/around `daytime-leisure`, eased
    // (LerpedSceneBeat.t is raw/pre-easing per its own doc comment, so we
    // ease it ourselves the same way `lerpSceneBeat` eases every other field)
    // rather than snapping, so it fades in step with the rest of the beat
    // transition instead of popping.
    const easedT = easeInOutCubic(lerped.t)
    let visibility: number
    if (lerped.fromId === DAYTIME_BEAT_ID && lerped.toId === DAYTIME_BEAT_ID) {
      visibility = 1
    } else if (lerped.toId === DAYTIME_BEAT_ID) {
      visibility = easedT
    } else if (lerped.fromId === DAYTIME_BEAT_ID) {
      visibility = 1 - easedT
    } else {
      visibility = 0
    }

    // Dim/desaturated "recedes into haze" tint (same recipe DecoSkyline and
    // DecoFountain use) for every other beat, blended toward a bright,
    // sunlit tint (palette primary/accent, undamped) as visibility rises --
    // so the prop reads as "in shadow, barely there" normally and "lit by
    // full daylight" specifically during daytime-leisure.
    const [fr, fg, fb] = hexToRgbNormalized(lerped.palette.fog)
    const [br, bg, bb] = hexToRgbNormalized(lerped.palette.background)
    const dimShade: [number, number, number] = [
      lerp(fr, br, 0.5) * 0.5,
      lerp(fg, bg, 0.5) * 0.5,
      lerp(fb, bb, 0.5) * 0.5,
    ]
    const [pr, pg, pb] = hexToRgbNormalized(lerped.palette.primary)
    const [ar, ag, ab] = hexToRgbNormalized(lerped.palette.accent)
    const sunlitShade: [number, number, number] = [lerp(pr, ar, 0.4), lerp(pg, ag, 0.4), lerp(pb, ab, 0.4)]

    structureMaterial.color.setRGB(
      lerp(dimShade[0], sunlitShade[0], visibility),
      lerp(dimShade[1], sunlitShade[1], visibility),
      lerp(dimShade[2], sunlitShade[2], visibility),
    )
    structureMaterial.opacity = lerp(HIDDEN_OPACITY, 1, visibility)

    wakeMaterial.color.setRGB(
      lerp(dimShade[0] * HIDDEN_COLOR_MIX, ar, visibility),
      lerp(dimShade[1] * HIDDEN_COLOR_MIX, ag, visibility),
      lerp(dimShade[2] * HIDDEN_COLOR_MIX, ab, visibility),
    )
    wakeMaterial.opacity = lerp(HIDDEN_OPACITY * 0.4, 0.85, visibility)

    wakeGroupRefs.current.forEach((group) => {
      if (group) group.visible = visibility > 0.01
    })
  })

  return (
    <group>
      <mesh
        geometry={raftGeometry}
        material={structureMaterial}
        position={[RAFT_X, 0, RAFT_Z]}
        rotation={[0, RAFT_ROTATION_Y, 0]}
        frustumCulled={false}
      />
      {BOAT_ANGLE_DEG.map((angleDeg, index) => {
        const radius = BOAT_RADIUS[index] ?? RAFT_RADIUS
        const headingDeg = BOAT_HEADING_DEG[index] ?? 0
        const x = Math.cos(degToRad(angleDeg)) * radius
        const z = Math.sin(degToRad(angleDeg)) * radius
        const headingRad = degToRad(headingDeg)
        const wakeGeometry = wakeGeometries[index]
        return (
          <group key={index} position={[x, HULL_HEIGHT / 2 + 0.05, z]} rotation={[0, headingRad, 0]}>
            <mesh geometry={hullGeometry} material={structureMaterial} frustumCulled={false} />
            <group
              ref={(el) => {
                wakeGroupRefs.current[index] = el
              }}
            >
              {wakeGeometry && <points geometry={wakeGeometry} material={wakeMaterial} frustumCulled={false} />}
            </group>
          </group>
        )
      })}
    </group>
  )
}
