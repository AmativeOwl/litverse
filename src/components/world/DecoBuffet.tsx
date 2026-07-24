import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { hexToRgbNormalized, lerp } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'
import { useReadingStore } from '../../store/readingStore'

interface DecoBuffetProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Foreground prop: a buffet table lifted straight from the Ch.3 text ("On
 * buffet tables, garnished with glistening hors-d'oeuvre, spiced baked hams
 * crowded against salads of harlequin designs and pastry pigs and turkeys
 * bewitched to a dark gold" / "enough coloured lights to make a Christmas
 * tree of Gatsby's enormous garden" / the Friday-fruiterer oranges-and-lemons
 * passage). Follows `DecoFountain.tsx`'s established pattern -- seeded/fixed
 * placement decided once, geometry merged once via `mergeGeometries` for the
 * table itself and instanced per food type, only material color (lerped from
 * the beat palette) and a coloured-light emphasis value driven per-frame.
 *
 * Unlike the Deco skyline/fountain (unlit flat silhouettes, meant to recede),
 * the table and food use lit `MeshStandardMaterial` -- this prop is meant to
 * read as a detailed, close-up, "game-like" piece of the world per the
 * visual-direction pivot, not a receding backdrop silhouette.
 *
 * Placement derivation (mirrors `DecoFountain.tsx`'s comment style): a single
 * table anchored at 205 degrees / radius 14 from the scene origin, well
 * inside the 190-220 degree / 12-16 radius sector this prop was assigned.
 * The table's long axis runs tangential to the radius at the anchor (purely
 * aesthetic -- "a table set along the garden path"), and every food item is
 * placed within +/-1.75 local units of the table center along that same
 * tangent. Checking the two extreme food positions against that assignment:
 *   - low end (local x = -1.75): world angle ~198.5 degrees, radius ~14.1
 *   - high end (local x = +1.75): world angle ~211.6 degrees, radius ~14.1
 * both comfortably inside 190-220 / 12-16, with ~8 degrees of margin on each
 * side. Clear of `DecoFountain`'s own placement (13, -9; ~325 degrees from
 * origin) and well inside `Silhouettes.tsx`'s FLOOR_RADIUS = 22 crowd
 * scatter, matching how the fountain itself sits as a foreground set-piece.
 */
const ANCHOR_ANGLE_DEG = 205
const ANCHOR_RADIUS = 14
const ANCHOR_ANGLE_RAD = (ANCHOR_ANGLE_DEG * Math.PI) / 180
const ANCHOR_X = Math.cos(ANCHOR_ANGLE_RAD) * ANCHOR_RADIUS
const ANCHOR_Z = Math.sin(ANCHOR_ANGLE_RAD) * ANCHOR_RADIUS

// Tangent direction at the anchor point -- the table's local +X axis is
// aligned to this, so the table sits "along the path" rather than pointing
// straight at (or away from) the scene origin.
const TANGENT_X = -Math.sin(ANCHOR_ANGLE_RAD)
const TANGENT_Z = Math.cos(ANCHOR_ANGLE_RAD)
const TABLE_ROTATION_Y = Math.atan2(TANGENT_X, TANGENT_Z)

const TABLE_WIDTH = 4.0
const TABLE_DEPTH = 1.5
const TABLE_TOP_THICKNESS = 0.12
const LEG_HEIGHT = 1.0
const TABLE_TOP_Y = LEG_HEIGHT + TABLE_TOP_THICKNESS / 2
const CLOTH_SKIRT_HEIGHT = 0.5

const EVENING_BEAT_ID = 'evening-bar-setup'

/** Rotates a table-local (x, z) offset by `TABLE_ROTATION_Y` and translates it to the anchor -- every food/light position is authored in this local space. */
function localToWorld(x: number, y: number, z: number): [number, number, number] {
  const cos = Math.cos(TABLE_ROTATION_Y)
  const sin = Math.sin(TABLE_ROTATION_Y)
  return [ANCHOR_X + (x * cos + z * sin), y, ANCHOR_Z + (-x * sin + z * cos)]
}

/**
 * Tabletop + a slightly wider, shorter "skirt" box hanging just under it (the
 * draped-cloth suggestion -- reads as an overhanging tablecloth edge without
 * modeling actual cloth) + four thin inset legs, merged into one mesh so the
 * whole table is a single draw call, matching `DecoFountain`'s basin
 * approach.
 */
function buildTableGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = []

  const top = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_TOP_THICKNESS, TABLE_DEPTH)
  top.translate(0, TABLE_TOP_Y, 0)
  pieces.push(top)

  const skirt = new THREE.BoxGeometry(TABLE_WIDTH + 0.3, CLOTH_SKIRT_HEIGHT, TABLE_DEPTH + 0.3)
  skirt.translate(0, TABLE_TOP_Y - TABLE_TOP_THICKNESS / 2 - CLOTH_SKIRT_HEIGHT / 2 + 0.02, 0)
  pieces.push(skirt)

  const legInsetX = TABLE_WIDTH / 2 - 0.35
  const legInsetZ = TABLE_DEPTH / 2 - 0.25
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.CylinderGeometry(0.05, 0.06, LEG_HEIGHT, 8)
      leg.translate(sx * legInsetX, LEG_HEIGHT / 2, sz * legInsetZ)
      pieces.push(leg)
    }
  }

  const merged = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  return merged
}

interface FoodInstance {
  x: number
  y: number
  z: number
  rotationY: number
  scale: [number, number, number]
  /** Only used by the fruit pyramid, to alternate orange/lemon tint per instance-color. */
  colorVariant?: number
}

interface FoodLayout {
  hams: FoodInstance[]
  turkeyBodies: FoodInstance[]
  drumsticks: FoodInstance[]
  fruit: FoodInstance[]
  saladBowls: FoodInstance[]
  pastries: FoodInstance[]
  lights: [number, number, number][]
}

/**
 * Deterministic (fixed-seed) placement of every food prop and coloured light,
 * authored in table-local space. All positions/rotations are computed once
 * here and written to instance matrices at mount -- nothing here is
 * recomputed per frame.
 */
function buildFoodLayout(): FoodLayout {
  const random = createSeededRandom(hashStringToSeed('litverse-deco-buffet'))

  const hams: FoodInstance[] = [
    { x: -1.5, y: TABLE_TOP_Y + 0.16, z: -0.25, rotationY: 0.3, scale: [1, 1, 1] },
    { x: -1.05, y: TABLE_TOP_Y + 0.15, z: 0.28, rotationY: -0.5, scale: [0.92, 0.92, 0.92] },
  ]

  const turkeyBodies: FoodInstance[] = [
    { x: -0.05, y: TABLE_TOP_Y + 0.22, z: 0.05, rotationY: 0.2, scale: [1, 1, 1] },
  ]

  const drumsticks: FoodInstance[] = []
  turkeyBodies.forEach((turkey) => {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + random() * 0.4
      const r = 0.22
      drumsticks.push({
        x: turkey.x + Math.cos(angle) * r,
        y: turkey.y - 0.05,
        z: turkey.z + Math.sin(angle) * r,
        rotationY: angle,
        scale: [1, 1, 1],
      })
    }
  })

  // Fruit pyramid: 6 base + 3 mid + 1 top, alternating orange/lemon tint --
  // covers both the "oranges and lemons" fruiterer passage and the buffet's
  // "pyramid of pulpless halves" imagery in one prop.
  const fruit: FoodInstance[] = []
  const fruitBaseX = 0.85
  const fruitBaseZ = -0.05
  const fruitRadius = 0.11
  const layerCounts = [6, 3, 1]
  let fruitY = TABLE_TOP_Y + fruitRadius
  let colorToggle = 0
  layerCounts.forEach((count, layerIndex) => {
    const ringRadius = count > 1 ? 0.2 - layerIndex * 0.06 : 0
    for (let i = 0; i < count; i++) {
      const angle = count > 1 ? (i / count) * Math.PI * 2 : 0
      fruit.push({
        x: fruitBaseX + Math.cos(angle) * ringRadius,
        y: fruitY,
        z: fruitBaseZ + Math.sin(angle) * ringRadius,
        rotationY: 0,
        scale: [1, 1, 1],
        colorVariant: colorToggle % 2,
      })
      colorToggle++
    }
    fruitY += fruitRadius * 1.7
  })

  const saladBowls: FoodInstance[] = [
    { x: -1.75, y: TABLE_TOP_Y + 0.02, z: -0.05, rotationY: 0, scale: [1, 1, 1] },
    { x: 1.55, y: TABLE_TOP_Y + 0.02, z: 0.3, rotationY: 0, scale: [0.85, 0.85, 0.85] },
  ]

  const pastries: FoodInstance[] = []
  for (let i = 0; i < 3; i++) {
    pastries.push({
      x: 1.35 + i * 0.16,
      y: TABLE_TOP_Y + 0.1,
      z: -0.3 + (i % 2) * 0.12,
      rotationY: random() * Math.PI,
      scale: [1, 1, 1],
    })
  }

  // Coloured lights strung along both long edges of the tabletop, just above
  // it -- "enough coloured lights to make a Christmas tree" of the garden.
  const lights: [number, number, number][] = []
  const lightCount: number = 12
  for (let i = 0; i < lightCount; i++) {
    const t = lightCount === 1 ? 0.5 : i / (lightCount - 1)
    const x = -TABLE_WIDTH / 2 + t * TABLE_WIDTH
    const side = i % 2 === 0 ? 1 : -1
    lights.push([x, TABLE_TOP_Y + 0.3 + random() * 0.1, side * (TABLE_DEPTH / 2 + 0.05)])
  }

  return { hams, turkeyBodies, drumsticks, fruit, saladBowls, pastries, lights }
}

/**
 * A buffet table set-piece: one merged-geometry table (tabletop + draped
 * cloth-skirt suggestion + legs), instanced food props built from primitives
 * only (hams as capsules, a turkey body + drumstick nubs, a stacked-sphere
 * fruit pyramid, hemisphere salad bowls, cone pastries), and a sparse
 * points-based string of warm coloured lights along the table edge. Table
 * and food use lit `MeshStandardMaterial` so they read as detailed, close-up
 * props reacting to the scene's real key/ambient lighting, unlike the
 * unlit Deco silhouettes. Only material color (lerped from the beat
 * palette) and the coloured-lights' emphasis animate per-frame -- all
 * geometry/instance matrices are static, set once at mount.
 */
export function DecoBuffet({ lerpedRef }: DecoBuffetProps) {
  const tableGeometry = useMemo(buildTableGeometry, [])
  const hamGeometry = useMemo(() => {
    const geometry = new THREE.CapsuleGeometry(0.12, 0.22, 4, 8)
    geometry.rotateZ(Math.PI / 2)
    return geometry
  }, [])
  const turkeyGeometry = useMemo(() => new THREE.SphereGeometry(0.16, 12, 10), [])
  const drumstickGeometry = useMemo(() => new THREE.ConeGeometry(0.045, 0.16, 6), [])
  const fruitGeometry = useMemo(() => new THREE.SphereGeometry(0.11, 10, 8), [])
  // Lower hemisphere (equator to south pole) -- a shallow, open-topped "bowl" silhouette.
  const bowlGeometry = useMemo(
    () => new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    [],
  )
  const pastryGeometry = useMemo(() => new THREE.ConeGeometry(0.08, 0.14, 6), [])

  const layout = useMemo(buildFoodLayout, [])

  const tableMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ede2c8', roughness: 0.85, metalness: 0.02 }),
    [],
  )
  const hamMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.55, metalness: 0.05 }),
    [],
  )
  const turkeyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7a5220', roughness: 0.5, metalness: 0.05 }),
    [],
  )
  const drumstickMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#6b471c', roughness: 0.6, metalness: 0.02 }),
    [],
  )
  const fruitMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e8791a', roughness: 0.4, metalness: 0 }),
    [],
  )
  const bowlMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#cfe0b8', roughness: 0.7, metalness: 0 }),
    [],
  )
  const pastryMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c99a4e', roughness: 0.5, metalness: 0 }),
    [],
  )
  const lightMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ffd166',
        size: 0.16,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true,
      }),
    [],
  )

  const lightGeometry = useMemo(() => {
    const positions = new Float32Array(layout.lights.length * 3)
    layout.lights.forEach(([x, y, z], index) => {
      const [wx, wy, wz] = localToWorld(x, y, z)
      positions[index * 3] = wx
      positions[index * 3 + 1] = wy
      positions[index * 3 + 2] = wz
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [layout])

  const hamMeshRef = useRef<THREE.InstancedMesh>(null)
  const turkeyMeshRef = useRef<THREE.InstancedMesh>(null)
  const drumstickMeshRef = useRef<THREE.InstancedMesh>(null)
  const fruitMeshRef = useRef<THREE.InstancedMesh>(null)
  const bowlMeshRef = useRef<THREE.InstancedMesh>(null)
  const pastryMeshRef = useRef<THREE.InstancedMesh>(null)

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Instance matrices (and the fruit pyramid's alternating tint) are written
  // once at mount -- these props are static, unlike the crowd's continuous sway.
  useEffect(() => {
    const applyInstances = (mesh: THREE.InstancedMesh | null, instances: FoodInstance[]) => {
      if (!mesh) return
      instances.forEach((instance, index) => {
        const [wx, wy, wz] = localToWorld(instance.x, instance.y, instance.z)
        dummy.position.set(wx, wy, wz)
        dummy.rotation.set(0, TABLE_ROTATION_Y + instance.rotationY, 0)
        dummy.scale.set(instance.scale[0], instance.scale[1], instance.scale[2])
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    applyInstances(hamMeshRef.current, layout.hams)
    applyInstances(turkeyMeshRef.current, layout.turkeyBodies)
    applyInstances(drumstickMeshRef.current, layout.drumsticks)
    applyInstances(bowlMeshRef.current, layout.saladBowls)
    applyInstances(pastryMeshRef.current, layout.pastries)

    const fruitMesh = fruitMeshRef.current
    if (fruitMesh) {
      layout.fruit.forEach((instance, index) => {
        const [wx, wy, wz] = localToWorld(instance.x, instance.y, instance.z)
        dummy.position.set(wx, wy, wz)
        dummy.rotation.set(0, TABLE_ROTATION_Y, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        fruitMesh.setMatrixAt(index, dummy.matrix)
        fruitMesh.setColorAt(index, new THREE.Color(instance.colorVariant === 0 ? '#e8791a' : '#e8d84a'))
      })
      fruitMesh.instanceMatrix.needsUpdate = true
      if (fruitMesh.instanceColor) fruitMesh.instanceColor.needsUpdate = true
    }
  }, [dummy, layout])

  // Smoothed 0..1 emphasis value for the coloured lights -- eased toward its
  // target with THREE.MathUtils.damp rather than snapping, so the
  // evening-bar-setup transition reads as a glow building up, not a hard cut.
  const emphasisRef = useRef(0)

  useFrame((_state, delta) => {
    const lerped = lerpedRef.current
    if (lerped) {
      const [pr, pg, pb] = hexToRgbNormalized(lerped.palette.primary)
      // Cloth stays a warm cream, only lightly tinted toward the current
      // beat's primary color for cohesion with the rest of the lerped world.
      tableMaterial.color.setRGB(lerp(0.93, pr, 0.18), lerp(0.89, pg, 0.18), lerp(0.78, pb, 0.18))

      const [ar, ag, ab] = hexToRgbNormalized(lerped.palette.accent)
      lightMaterial.color.setRGB(ar, ag, ab)
    }

    // Emphasize the coloured lights specifically during evening-bar-setup --
    // read directly off the store here rather than subscribing via a React
    // hook, so this stays a per-frame effect and never triggers a re-render.
    const activeBeatId = useReadingStore.getState().activeSceneBeatId
    const target = activeBeatId === EVENING_BEAT_ID ? 1 : 0
    emphasisRef.current = THREE.MathUtils.damp(emphasisRef.current, target, 4, delta)
    lightMaterial.opacity = 0.55 + emphasisRef.current * 0.45
    lightMaterial.size = 0.14 + emphasisRef.current * 0.1
  })

  return (
    <group>
      <mesh
        geometry={tableGeometry}
        material={tableMaterial}
        position={[ANCHOR_X, 0, ANCHOR_Z]}
        rotation={[0, TABLE_ROTATION_Y, 0]}
        frustumCulled={false}
      />
      <instancedMesh ref={hamMeshRef} args={[hamGeometry, hamMaterial, layout.hams.length]} frustumCulled={false} />
      <instancedMesh
        ref={turkeyMeshRef}
        args={[turkeyGeometry, turkeyMaterial, layout.turkeyBodies.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={drumstickMeshRef}
        args={[drumstickGeometry, drumstickMaterial, layout.drumsticks.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={fruitMeshRef}
        args={[fruitGeometry, fruitMaterial, layout.fruit.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={bowlMeshRef}
        args={[bowlGeometry, bowlMaterial, layout.saladBowls.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={pastryMeshRef}
        args={[pastryGeometry, pastryMaterial, layout.pastries.length]}
        frustumCulled={false}
      />
      <points args={[lightGeometry, lightMaterial]} frustumCulled={false} />
    </group>
  )
}
