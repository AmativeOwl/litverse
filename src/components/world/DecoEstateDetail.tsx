import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { hexToRgbNormalized, lerp } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'

interface DecoEstateDetailProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Background/mid-ground set-dressing suggesting the mansion's own facade --
 * a partial classical colonnade (veranda), a low "halls and salons" wall
 * segment with window-box cutouts, and a scatter of garden furniture.
 * Reuses `DecoSkyline.tsx`/`DecoFountain.tsx`'s established pattern: seeded
 * fixed placement decided once, geometry merged once via `mergeGeometries`,
 * unlit `MeshBasicMaterial` silhouettes with only material color lerped
 * per-beat in `useFrame` -- no new technique introduced.
 *
 * Unlike `DecoFountain` (a single off-to-one-side set-piece) or the beat-
 * gated props other tracks are adding, this is baseline "this is a mansion
 * garden" scene-setting: always present, never emphasized/de-emphasized by
 * beat, only re-tinted like the rest of the Deco backdrop.
 *
 * Placement: kept within angle range 100-180 degrees (atan2(z, x) in the XZ
 * plane) and radius range 18-21 from the origin -- near the outer edge of
 * `Silhouettes.tsx`'s crowd scatter (`FLOOR_RADIUS = 22`), but a little
 * closer/more prominent than `DecoSkyline`'s 25-30 ring since this is meant
 * to read as the mansion's own architecture, not the far horizon. This
 * angular wedge and radius band don't overlap `DecoFountain`'s placement
 * (`FOUNTAIN_X = 13, FOUNTAIN_Z = -9`, i.e. angle atan2(-9,13) ~ -35 degrees,
 * radius ~15.8, plus its railing at radius 11) or `cameraMath.ts`'s
 * `ORBIT_RADIUS = 9` dolly range.
 */
const COLONNADE_ANGLE_START = (110 * Math.PI) / 180
const COLONNADE_ANGLE_END = (170 * Math.PI) / 180
const COLONNADE_RADIUS = 19

const FACADE_ANGLE_START = (105 * Math.PI) / 180
const FACADE_ANGLE_END = (175 * Math.PI) / 180
const FACADE_RADIUS = 20.5

const FURNITURE_ANGLE_START = (108 * Math.PI) / 180
const FURNITURE_ANGLE_END = (172 * Math.PI) / 180
const FURNITURE_RADIUS_MIN = 18.2
const FURNITURE_RADIUS_MAX = 18.8

const COLUMN_COUNT = 7
const COLUMN_SHAFT_HEIGHT = 2.6
const COLUMN_SHAFT_TOP_RADIUS = 0.14
const COLUMN_SHAFT_BOTTOM_RADIUS = 0.18
const COLUMN_CAPITAL_SIZE = 0.5
const COLUMN_CAPITAL_HEIGHT = 0.22
const COLUMN_TOTAL_HEIGHT = COLUMN_CAPITAL_HEIGHT * 2 + COLUMN_SHAFT_HEIGHT

const LINTEL_HEIGHT = 0.24
const LINTEL_THICKNESS = 0.55

const WALL_SAMPLE_COUNT = 6
const WALL_HEIGHT = 2.2
const WALL_THICKNESS = 0.4

const WINDOW_WIDTH = 0.55
const WINDOW_HEIGHT = 0.8
const WINDOW_DEPTH = 0.08

const FURNITURE_COUNT = 5

/** A point on the arc at `radius`, `angle` measured from +X in the XZ plane. */
function arcPoint(angle: number, radius: number): { x: number; z: number; angle: number } {
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, angle }
}

function evenlySpacedArcPoints(
  angleStart: number,
  angleEnd: number,
  radius: number,
  count: number,
): { x: number; z: number; angle: number }[] {
  const points: { x: number; z: number; angle: number }[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    points.push(arcPoint(angleStart + (angleEnd - angleStart) * t, radius))
  }
  return points
}

interface ArcSegment {
  midX: number
  midZ: number
  midAngle: number
  chordAngle: number
  length: number
}

/** Chord-approximated segments between consecutive arc points -- same
 * technique `DecoFountain.tsx`'s railing uses to connect posts. */
function computeArcSegments(points: readonly { x: number; z: number; angle: number }[]): ArcSegment[] {
  const segments: ArcSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dz = b.z - a.z
    segments.push({
      midX: (a.x + b.x) / 2,
      midZ: (a.z + b.z) / 2,
      midAngle: (a.angle + b.angle) / 2,
      chordAngle: Math.atan2(dz, dx),
      length: Math.sqrt(dx * dx + dz * dz),
    })
  }
  return segments
}

/** Merges a box per segment (length x height x thickness, oriented along the
 * chord, centered at `yCenter`) into one static mesh -- the same
 * merge-once-then-static-mesh approach as `DecoFountain`'s railing. */
function buildConnectedSegmentsGeometry(
  segments: readonly ArcSegment[],
  height: number,
  thickness: number,
  yCenter: number,
): THREE.BufferGeometry {
  const boxes: THREE.BufferGeometry[] = segments.map((segment) => {
    const box = new THREE.BoxGeometry(segment.length, height, thickness)
    box.rotateY(-segment.chordAngle)
    box.translate(segment.midX, yCenter, segment.midZ)
    return box
  })
  const merged = mergeGeometries(boxes)
  boxes.forEach((box) => box.dispose())
  return merged
}

/** Stacks a tapered cylinder shaft between a small box capital top/bottom,
 * merged once -- one instance-ready "column" mesh. */
function buildColumnGeometry(): THREE.BufferGeometry {
  const base = new THREE.BoxGeometry(COLUMN_CAPITAL_SIZE, COLUMN_CAPITAL_HEIGHT, COLUMN_CAPITAL_SIZE)
  base.translate(0, COLUMN_CAPITAL_HEIGHT / 2, 0)

  const shaft = new THREE.CylinderGeometry(
    COLUMN_SHAFT_TOP_RADIUS,
    COLUMN_SHAFT_BOTTOM_RADIUS,
    COLUMN_SHAFT_HEIGHT,
    8,
  )
  shaft.translate(0, COLUMN_CAPITAL_HEIGHT + COLUMN_SHAFT_HEIGHT / 2, 0)

  const top = new THREE.BoxGeometry(COLUMN_CAPITAL_SIZE, COLUMN_CAPITAL_HEIGHT, COLUMN_CAPITAL_SIZE)
  top.translate(0, COLUMN_CAPITAL_HEIGHT + COLUMN_SHAFT_HEIGHT + COLUMN_CAPITAL_HEIGHT / 2, 0)

  const merged = mergeGeometries([base, shaft, top])
  ;[base, shaft, top].forEach((piece) => piece.dispose())
  return merged
}

/** A simple garden bench: a seat slab over a solid low plinth. */
function buildBenchGeometry(): THREE.BufferGeometry {
  const seat = new THREE.BoxGeometry(0.9, 0.08, 0.32)
  seat.translate(0, 0.34, 0)
  const plinth = new THREE.BoxGeometry(0.7, 0.28, 0.22)
  plinth.translate(0, 0.14, 0)
  const merged = mergeGeometries([seat, plinth])
  ;[seat, plinth].forEach((piece) => piece.dispose())
  return merged
}

/** A simple garden planter box: a base tub with a slightly wider rim lip. */
function buildPlanterGeometry(): THREE.BufferGeometry {
  const base = new THREE.BoxGeometry(0.5, 0.35, 0.5)
  base.translate(0, 0.175, 0)
  const rim = new THREE.BoxGeometry(0.56, 0.06, 0.56)
  rim.translate(0, 0.38, 0)
  const merged = mergeGeometries([base, rim])
  ;[base, rim].forEach((piece) => piece.dispose())
  return merged
}

interface FurnitureInstance {
  x: number
  z: number
  rotationY: number
  variantIndex: 0 | 1
}

function buildFurnitureLayout(): FurnitureInstance[] {
  const random = createSeededRandom(hashStringToSeed('litverse-deco-estate-furniture'))
  const instances: FurnitureInstance[] = []
  for (let i = 0; i < FURNITURE_COUNT; i++) {
    const angle = FURNITURE_ANGLE_START + random() * (FURNITURE_ANGLE_END - FURNITURE_ANGLE_START)
    const radius = FURNITURE_RADIUS_MIN + random() * (FURNITURE_RADIUS_MAX - FURNITURE_RADIUS_MIN)
    const rotationY = random() * Math.PI * 2
    instances.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      rotationY,
      // Alternate bench/planter (with a fixed seeded jitter already applied
      // to position/rotation above) so the scatter is guaranteed a mix of
      // both rather than leaving one variant to chance.
      variantIndex: i % 2 === 0 ? 0 : 1,
    })
  }
  return instances
}

/**
 * Partial veranda colonnade + glimpsed "halls and salons" facade + garden
 * furniture scatter, evoking "already the halls and salons and verandas are
 * gaudy with primary colours" and Gatsby's "enormous garden". Always
 * present and beat-agnostic in emphasis -- only material color lerps
 * per-beat, same recipe as `DecoSkyline`/`DecoFountain`.
 */
export function DecoEstateDetail({ lerpedRef }: DecoEstateDetailProps) {
  const columnPoints = useMemo(
    () => evenlySpacedArcPoints(COLONNADE_ANGLE_START, COLONNADE_ANGLE_END, COLONNADE_RADIUS, COLUMN_COUNT),
    [],
  )
  const facadePoints = useMemo(
    () => evenlySpacedArcPoints(FACADE_ANGLE_START, FACADE_ANGLE_END, FACADE_RADIUS, WALL_SAMPLE_COUNT),
    [],
  )
  const lintelSegments = useMemo(() => computeArcSegments(columnPoints), [columnPoints])
  const facadeSegments = useMemo(() => computeArcSegments(facadePoints), [facadePoints])

  const columnGeometry = useMemo(buildColumnGeometry, [])
  const lintelGeometry = useMemo(
    () => buildConnectedSegmentsGeometry(lintelSegments, LINTEL_HEIGHT, LINTEL_THICKNESS, COLUMN_TOTAL_HEIGHT + LINTEL_HEIGHT / 2),
    [lintelSegments],
  )
  const wallGeometry = useMemo(
    () => buildConnectedSegmentsGeometry(facadeSegments, WALL_HEIGHT, WALL_THICKNESS, WALL_HEIGHT / 2),
    [facadeSegments],
  )
  const windowGeometry = useMemo(() => new THREE.BoxGeometry(WINDOW_WIDTH, WINDOW_HEIGHT, WINDOW_DEPTH), [])
  const benchGeometry = useMemo(buildBenchGeometry, [])
  const planterGeometry = useMemo(buildPlanterGeometry, [])

  const furniture = useMemo(buildFurnitureLayout, [])
  const benchInstances = useMemo(() => furniture.filter((item) => item.variantIndex === 0), [furniture])
  const planterInstances = useMemo(() => furniture.filter((item) => item.variantIndex === 1), [furniture])

  // Shared unlit silhouette material for the colonnade/wall/furniture,
  // mutated in-place per-beat -- same "dark tint blended from the palette's
  // two darkest tones" recipe as DecoSkyline/DecoFountain, so this backdrop
  // re-lights in lockstep with the rest of the Deco set-dressing.
  const structureMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#050505', fog: true }), [])
  // Windows read as recessed voids against the lighter wall -- a further-
  // darkened variant of the same tint rather than a separately-lit surface.
  const windowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#020202', fog: true }), [])

  const columnMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const windowMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const benchMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const planterMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Instance matrices are static (positions/rotations decided once by the
  // seeded layout above) -- written once at mount via `useEffect`, the same
  // approach `DecoSkyline.tsx` uses for its buildings, rather than
  // recomputed every frame the way the crowd's continuous sway is.
  useEffect(() => {
    const columnMesh = columnMeshRef.current
    if (columnMesh) {
      columnPoints.forEach((point, index) => {
        dummy.position.set(point.x, 0, point.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        columnMesh.setMatrixAt(index, dummy.matrix)
      })
      columnMesh.instanceMatrix.needsUpdate = true
    }

    const windowMesh = windowMeshRef.current
    if (windowMesh) {
      const frontFaceRadius = FACADE_RADIUS - WALL_THICKNESS / 2
      const windowRadius = frontFaceRadius - WINDOW_DEPTH / 2 + 0.02
      facadeSegments.forEach((segment, index) => {
        const point = arcPoint(segment.midAngle, windowRadius)
        dummy.position.set(point.x, WALL_HEIGHT * 0.55, point.z)
        dummy.rotation.set(0, -segment.chordAngle, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        windowMesh.setMatrixAt(index, dummy.matrix)
      })
      windowMesh.instanceMatrix.needsUpdate = true
    }

    const benchMesh = benchMeshRef.current
    if (benchMesh) {
      benchInstances.forEach((item, index) => {
        dummy.position.set(item.x, 0, item.z)
        dummy.rotation.set(0, item.rotationY, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        benchMesh.setMatrixAt(index, dummy.matrix)
      })
      benchMesh.instanceMatrix.needsUpdate = true
    }

    const planterMesh = planterMeshRef.current
    if (planterMesh) {
      planterInstances.forEach((item, index) => {
        dummy.position.set(item.x, 0, item.z)
        dummy.rotation.set(0, item.rotationY, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        planterMesh.setMatrixAt(index, dummy.matrix)
      })
      planterMesh.instanceMatrix.needsUpdate = true
    }
  }, [columnPoints, facadeSegments, benchInstances, planterInstances, dummy])

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped) return

    const [fr, fg, fb] = hexToRgbNormalized(lerped.palette.fog)
    const [br, bg, bb] = hexToRgbNormalized(lerped.palette.background)
    const shade: [number, number, number] = [
      lerp(fr, br, 0.5) * 0.5,
      lerp(fg, bg, 0.5) * 0.5,
      lerp(fb, bb, 0.5) * 0.5,
    ]
    structureMaterial.color.setRGB(...shade)
    windowMaterial.color.setRGB(shade[0] * 0.4, shade[1] * 0.4, shade[2] * 0.4)
  })

  return (
    <group>
      <instancedMesh
        ref={columnMeshRef}
        args={[columnGeometry, structureMaterial, columnPoints.length]}
        frustumCulled={false}
      />
      <mesh geometry={lintelGeometry} material={structureMaterial} frustumCulled={false} />
      <mesh geometry={wallGeometry} material={structureMaterial} frustumCulled={false} />
      <instancedMesh
        ref={windowMeshRef}
        args={[windowGeometry, windowMaterial, facadeSegments.length]}
        frustumCulled={false}
      />
      {benchInstances.length > 0 && (
        <instancedMesh
          ref={benchMeshRef}
          args={[benchGeometry, structureMaterial, benchInstances.length]}
          frustumCulled={false}
        />
      )}
      {planterInstances.length > 0 && (
        <instancedMesh
          ref={planterMeshRef}
          args={[planterGeometry, structureMaterial, planterInstances.length]}
          frustumCulled={false}
        />
      )}
    </group>
  )
}
