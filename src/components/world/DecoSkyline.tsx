import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { hexToRgbNormalized, lerp } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'

interface DecoSkylineProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Background architecture: a ring of stepped "wedding cake" Art Deco
 * ziggurat towers on the horizon, evoking both real Deco skyscrapers and the
 * classic black-cutout-skyline-against-a-colored-sky painted backdrops used
 * in mid-century animated shorts. Purely decorative/static -- unlike the
 * crowd (Silhouettes.tsx) these never sway or move, only their material
 * color lerps per-beat, so this stays cheap even at a larger scatter radius.
 */

// Silhouettes.tsx scatters its crowd out to a radius of 22 units; the
// skyline ring below starts well beyond that (MIN_DISTANCE), so it always
// sits behind every foreground element and reads as background.
//
// These distances are measured from the *scene origin*, not the camera, so
// they can't be picked in isolation from Atmosphere.tsx's fog. That fog is
// `THREE.Fog(color, 8, 40)` -- linear, fully opaque (100% fog color) at 40
// units from the *camera*. The camera never sits at the origin: CameraRig's
// `slow-orbit`/`static-drift` behaviors (see cameraMath.ts) keep it on a
// radius-9 circle at height 2.6. Worst case (building diametrically opposite
// the camera's current azimuth), camera-to-building distance is
// sqrt(d^2 + 2*d*9 + 9^2 + 2.6^2) for an origin-distance of `d`. The original
// 30-42 range put that worst case at ~51 units -- and even the *average*
// case (~31-43) sat at or past the fully-opaque 40 threshold -- so most of
// the ring rendered as flat fog-colored blocks indistinguishable from the
// sky, defeating the point of a visible skyline. 25-30 keeps the worst case
// (~39) just inside the fog gradient at every camera azimuth, while the near
// edge (25) still clears Silhouettes.tsx's FLOOR_RADIUS = 22 by more than
// any building's half-width, so nothing pokes through the crowd.
const MIN_DISTANCE = 25
const MAX_DISTANCE = 30

const BUILDING_COUNT = 12
const WINDOWS_PER_BUILDING = 6
const WINDOW_COUNT = BUILDING_COUNT * WINDOWS_PER_BUILDING

interface Segment {
  width: number
  depth: number
  height: number
}

/**
 * Four distinct ziggurat profiles (4-5 tapering tiers each, capped with a
 * narrower "spire" tier) for visual variety across the ring. Each is later
 * merged into a single reusable geometry and instanced across whichever
 * buildings the seeded layout assigns to that variant.
 */
const VARIANTS: readonly Segment[][] = [
  // 0: classic broad-based Deco tower
  [
    { width: 3.6, depth: 3.0, height: 2.0 },
    { width: 2.8, depth: 2.3, height: 1.6 },
    { width: 2.1, depth: 1.7, height: 1.3 },
    { width: 1.4, depth: 1.1, height: 1.0 },
    { width: 0.7, depth: 0.6, height: 1.8 },
  ],
  // 1: stockier, four tiers
  [
    { width: 3.0, depth: 2.6, height: 1.8 },
    { width: 2.2, depth: 1.9, height: 1.4 },
    { width: 1.5, depth: 1.3, height: 1.1 },
    { width: 0.9, depth: 0.8, height: 1.6 },
  ],
  // 2: slender and tall
  [
    { width: 2.2, depth: 2.0, height: 2.4 },
    { width: 1.7, depth: 1.5, height: 1.6 },
    { width: 1.3, depth: 1.1, height: 1.2 },
    { width: 0.9, depth: 0.8, height: 0.9 },
    { width: 0.5, depth: 0.45, height: 1.7 },
  ],
  // 3: wide and low with a tall crown
  [
    { width: 3.8, depth: 3.2, height: 1.5 },
    { width: 2.8, depth: 2.4, height: 1.3 },
    { width: 1.9, depth: 1.6, height: 1.1 },
    { width: 1.1, depth: 1.0, height: 2.0 },
  ],
]

interface Tier {
  halfWidth: number
  halfDepth: number
  yBottom: number
  yTop: number
}

function computeTiers(segments: readonly Segment[]): Tier[] {
  let y = 0
  const tiers: Tier[] = []
  for (const segment of segments) {
    tiers.push({
      halfWidth: segment.width / 2,
      halfDepth: segment.depth / 2,
      yBottom: y,
      yTop: y + segment.height,
    })
    y += segment.height
  }
  return tiers
}

/**
 * Stacks progressively narrower `BoxGeometry` tiers (a "wedding cake"
 * ziggurat profile) and merges them once into a single `BufferGeometry`, so
 * an entire tapered tower is one draw-call-friendly mesh, matching the
 * merge-once-then-instance approach `Silhouettes.tsx` uses for its figures.
 */
function buildZigguratGeometry(segments: readonly Segment[]): THREE.BufferGeometry {
  let y = 0
  const boxes: THREE.BufferGeometry[] = []
  for (const segment of segments) {
    const box = new THREE.BoxGeometry(segment.width, segment.height, segment.depth)
    box.translate(0, y + segment.height / 2, 0)
    boxes.push(box)
    y += segment.height
  }
  const merged = mergeGeometries(boxes)
  boxes.forEach((box) => box.dispose())
  return merged
}

interface BuildingInstance {
  x: number
  z: number
  rotationY: number
  heightScale: number
  widthScale: number
  variantIndex: number
}

interface Layout {
  buildings: BuildingInstance[]
  windowPositions: Float32Array
}

/** Picks a point on one of a tier's four vertical faces, inset from the
 * corners so window lights never land exactly on an edge. Returned in the
 * variant's local (unscaled) space -- the caller applies the same
 * width/height scale + rotation + translation used for the building's own
 * instance matrix, so window points always stay glued to their tower. */
function pickWindowLocalPoint(
  random: () => number,
  tier: Tier,
): [x: number, y: number, z: number] {
  const faceIndex = Math.floor(random() * 4)
  const marginWidth = tier.halfWidth * 0.7
  const marginDepth = tier.halfDepth * 0.7
  const tierSpan = tier.yTop - tier.yBottom
  const y = tier.yBottom + tierSpan * 0.2 + tierSpan * 0.6 * random()

  switch (faceIndex) {
    case 0:
      return [tier.halfWidth, y, (random() * 2 - 1) * marginDepth]
    case 1:
      return [-tier.halfWidth, y, (random() * 2 - 1) * marginDepth]
    case 2:
      return [(random() * 2 - 1) * marginWidth, y, tier.halfDepth]
    default:
      return [(random() * 2 - 1) * marginWidth, y, -tier.halfDepth]
  }
}

/**
 * Deterministic ring layout (fixed seed, not beat-dependent -- same pattern
 * as `Silhouettes.tsx`'s crowd scatter) for both the buildings themselves
 * and their window-light points. Window points are computed once here, in
 * world space, rather than recomputed per frame.
 */
function buildLayout(variantTiers: readonly Tier[][]): Layout {
  const random = createSeededRandom(hashStringToSeed('litverse-deco-skyline'))
  const buildings: BuildingInstance[] = []
  const windowPositions = new Float32Array(WINDOW_COUNT * 3)
  let cursor = 0

  for (let i = 0; i < BUILDING_COUNT; i++) {
    const angle = random() * Math.PI * 2
    const distance = MIN_DISTANCE + random() * (MAX_DISTANCE - MIN_DISTANCE)
    const rotationY = random() * Math.PI * 2
    const heightScale = 0.8 + random() * 0.6
    const widthScale = 0.85 + random() * 0.35
    const variantIndex = Math.floor(random() * variantTiers.length)
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance

    buildings.push({ x, z, rotationY, heightScale, widthScale, variantIndex })

    const tiers = variantTiers[variantIndex] ?? variantTiers[0]
    const cos = Math.cos(rotationY)
    const sin = Math.sin(rotationY)

    for (let w = 0; w < WINDOWS_PER_BUILDING; w++) {
      const tierList = tiers ?? []
      const tierIndex = Math.floor(random() * tierList.length)
      const tier = tierList[tierIndex] ?? tierList[0]
      if (!tier) {
        cursor += 3
        continue
      }
      const [lx, ly, lz] = pickWindowLocalPoint(random, tier)
      const sx = lx * widthScale
      const sz = lz * widthScale
      windowPositions[cursor++] = x + (sx * cos - sz * sin)
      windowPositions[cursor++] = ly * heightScale
      windowPositions[cursor++] = z + (sx * sin + sz * cos)
    }
  }

  return { buildings, windowPositions }
}

/**
 * Ring of stepped Art Deco ziggurat silhouettes beyond the crowd's scatter
 * radius, with sparse gold window-light point-sprites. Buildings are static
 * (positions set once at mount, never recomputed in `useFrame`) -- only
 * material color lerps per-beat, unlike the crowd's continuous sway.
 */
export function DecoSkyline({ lerpedRef }: DecoSkylineProps) {
  const variantGeometries = useMemo(() => VARIANTS.map((segments) => buildZigguratGeometry(segments)), [])
  const variantTiers = useMemo(() => VARIANTS.map((segments) => computeTiers(segments)), [])

  const { buildings, windowPositions } = useMemo(() => buildLayout(variantTiers), [variantTiers])

  const buildingsByVariant = useMemo(() => {
    const groups: number[][] = variantTiers.map(() => [])
    buildings.forEach((building, index) => {
      groups[building.variantIndex]?.push(index)
    })
    return groups
  }, [buildings, variantTiers])

  // Shared, mutable-in-place material instances -- one each for every
  // variant's InstancedMesh and for the window-light points, updated
  // imperatively in useFrame rather than via React state/props. Buildings
  // now use `MeshStandardMaterial` (real lighting response) instead of the
  // old unlit `MeshBasicMaterial` -- facades stay fairly flat/matte (high
  // roughness, low metalness) but are now actually lit rather than
  // fully unlit-emissive silhouettes.
  const buildingMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.9, metalness: 0.05, fog: true }),
    [],
  )
  const windowMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ffd166',
        size: 0.3,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true,
      }),
    [],
  )

  const windowGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(windowPositions, 3))
    return geometry
  }, [windowPositions])

  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Positions/rotations/scales are written once here at mount -- per the
  // spec, static architecture has no business recomputing instance matrices
  // every frame the way the crowd's sway does.
  useEffect(() => {
    buildingsByVariant.forEach((indices, variantIndex) => {
      const mesh = meshRefs.current[variantIndex]
      if (!mesh) return
      indices.forEach((buildingIndex, localIndex) => {
        const building = buildings[buildingIndex]
        if (!building) return
        dummy.position.set(building.x, 0, building.z)
        dummy.rotation.set(0, building.rotationY, 0)
        dummy.scale.set(building.widthScale, building.heightScale, building.widthScale)
        dummy.updateMatrix()
        mesh.setMatrixAt(localIndex, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    })
  }, [buildingsByVariant, buildings, dummy])

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped) return

    // Buildings tint from the palette's two darkest tones (fog + background)
    // so the skyline recedes correctly into the haze and still shifts mood
    // per-beat, while staying dark enough to read as a flat silhouette.
    const [fr, fg, fb] = hexToRgbNormalized(lerped.palette.fog)
    const [br, bg, bb] = hexToRgbNormalized(lerped.palette.background)
    buildingMaterial.color.setRGB(
      lerp(fr, br, 0.5) * 0.5,
      lerp(fg, bg, 0.5) * 0.5,
      lerp(fb, bb, 0.5) * 0.5,
    )

    const [ar, ag, ab] = hexToRgbNormalized(lerped.palette.accent)
    windowMaterial.color.setRGB(ar, ag, ab)
  })

  return (
    <group>
      {variantGeometries.map((geometry, variantIndex) => {
        const count = buildingsByVariant[variantIndex]?.length ?? 0
        if (count === 0) return null
        return (
          <instancedMesh
            key={variantIndex}
            ref={(el) => {
              meshRefs.current[variantIndex] = el
            }}
            args={[geometry, buildingMaterial, count]}
            frustumCulled={false}
            castShadow
            receiveShadow
          />
        )
      })}
      <points args={[windowGeometry, windowMaterial]} frustumCulled={false} />
    </group>
  )
}
