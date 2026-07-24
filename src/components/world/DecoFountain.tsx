import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { LerpedSceneBeat } from './beatMath'
import { hexToRgbNormalized, lerp } from './beatMath'
import { createSeededRandom, hashStringToSeed } from './seededRandom'

interface DecoFountainProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Foreground Deco motif: a stepped circular fountain basin plus a short
 * wrought-iron-scroll railing silhouette, evoking the gouache Deco-fountain /
 * scalloped-canopy / ironwork reference images. Reuses `DecoSkyline.tsx`'s
 * proven pattern -- seeded/fixed placement decided once, geometry merged
 * once via `mergeGeometries`, only material color (and the spray's cheap
 * vertical bob) driven per-frame -- rather than introducing a new technique.
 *
 * Placement: offset to one side at a mid-ground distance (comfortably inside
 * `Silhouettes.tsx`'s FLOOR_RADIUS = 22 crowd scatter, but well outside
 * `cameraMath.ts`'s ORBIT_RADIUS = 9 / dolly range 5.5-11) so it reads as a
 * fixed set-piece off to one side rather than sitting in the camera's own
 * flight path or blocking the default center-of-frame composition.
 */
const FOUNTAIN_X = 13
const FOUNTAIN_Z = -9

// Railing traces a short arc at the same angle as the fountain, at a smaller
// radius so it sits nearer camera / more "foreground" than the fountain
// itself, without crossing into the camera's own orbit/dolly positions.
const RAILING_RADIUS = 11
const RAILING_ARC_SPAN = Math.PI / 3
const RAILING_CENTER_ANGLE = Math.atan2(FOUNTAIN_Z, FOUNTAIN_X)
const RAILING_POST_COUNT: number = 9
const RAILING_POST_HEIGHT = 0.5
const RAILING_RAIL_HEIGHT_TOP = 0.42
const RAILING_RAIL_HEIGHT_MID = 0.22

const SPRAY_COUNT = 3

interface BasinRing {
  radiusTop: number
  radiusBottom: number
  height: number
  yBottom: number
}

// Three tapering rings, each narrower and taller than the one below --
// classic stepped/wedding-cake fountain basin silhouette.
const BASIN_RINGS: readonly BasinRing[] = [
  { radiusTop: 2.4, radiusBottom: 2.6, height: 0.22, yBottom: 0 },
  { radiusTop: 1.5, radiusBottom: 1.7, height: 0.55, yBottom: 0.22 },
  { radiusTop: 0.7, radiusBottom: 0.9, height: 0.9, yBottom: 0.77 },
]

function buildBasinGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = []
  for (const ring of BASIN_RINGS) {
    const geometry = new THREE.CylinderGeometry(ring.radiusTop, ring.radiusBottom, ring.height, 16)
    geometry.translate(0, ring.yBottom + ring.height / 2, 0)
    pieces.push(geometry)
  }
  const merged = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  return merged
}

interface SprayJet {
  x: number
  z: number
  phase: number
  speed: number
  baseY: number
}

function buildSprayLayout(): SprayJet[] {
  const random = createSeededRandom(hashStringToSeed('litverse-deco-fountain-spray'))
  const jets: SprayJet[] = []
  const topRing = BASIN_RINGS[BASIN_RINGS.length - 1]
  const baseY = topRing ? topRing.yBottom + topRing.height : 1.67
  for (let i = 0; i < SPRAY_COUNT; i++) {
    const angle = (i / SPRAY_COUNT) * Math.PI * 2 + random() * 0.3
    const radius = 0.15 + random() * 0.1
    jets.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      phase: random() * Math.PI * 2,
      speed: 0.8 + random() * 0.4,
      baseY,
    })
  }
  return jets
}

function buildSprayGeometry(): THREE.BufferGeometry {
  // A single thin, tall cone (tapering to a point) reused (transformed per
  // instance below) to suggest a jet of water -- cheap enough not to need
  // instancing at this count.
  return new THREE.ConeGeometry(0.06, 0.9, 6)
}

interface RailingLayout {
  posts: { x: number; z: number; rotationY: number }[]
  rails: THREE.BufferGeometry
}

function buildRailingLayout(): RailingLayout {
  const random = createSeededRandom(hashStringToSeed('litverse-deco-railing'))
  const posts: { x: number; z: number; rotationY: number }[] = []
  const railSegments: THREE.BufferGeometry[] = []

  const postGeometries: THREE.BufferGeometry[] = []
  for (let i = 0; i < RAILING_POST_COUNT; i++) {
    const t = RAILING_POST_COUNT === 1 ? 0.5 : i / (RAILING_POST_COUNT - 1)
    const angle = RAILING_CENTER_ANGLE - RAILING_ARC_SPAN / 2 + RAILING_ARC_SPAN * t
    // Small per-post height jitter so the row doesn't look laser-cut uniform.
    const postHeight = RAILING_POST_HEIGHT + (random() - 0.5) * 0.05
    const x = Math.cos(angle) * RAILING_RADIUS
    const z = Math.sin(angle) * RAILING_RADIUS
    posts.push({ x, z, rotationY: angle })

    const post = new THREE.BoxGeometry(0.06, postHeight, 0.06)
    post.translate(x, postHeight / 2, z)
    postGeometries.push(post)
  }

  // Two horizontal rails (a simple scroll-suggestion, not true wrought-iron
  // curve extrusion) connecting each consecutive pair of posts, at two
  // heights -- reads as "post-and-rail fencing" at silhouette scale.
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i]
    const b = posts[i + 1]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.sqrt(dx * dx + dz * dz)
    const midX = (a.x + b.x) / 2
    const midZ = (a.z + b.z) / 2
    const angle = Math.atan2(dz, dx)

    for (const railHeight of [RAILING_RAIL_HEIGHT_TOP, RAILING_RAIL_HEIGHT_MID]) {
      const rail = new THREE.BoxGeometry(length, 0.03, 0.03)
      rail.rotateY(-angle)
      rail.translate(midX, railHeight, midZ)
      railSegments.push(rail)
    }
  }

  const merged = mergeGeometries([...postGeometries, ...railSegments])
  postGeometries.forEach((g) => g.dispose())
  railSegments.forEach((g) => g.dispose())

  return { posts, rails: merged }
}

/**
 * A stepped fountain basin (dark Deco-silhouette tint, matching
 * `DecoSkyline`'s treatment) with a cheap water-spray suggestion (a few thin
 * cones bobbing upward on a sine drift) and a short wrought-iron-style
 * post-and-rail silhouette nearby. All static geometry built once; only
 * material color (lerped from the beat palette) and the spray's per-frame
 * bob are animated -- no rigged/articulated motion, matching the project's
 * "no rigged characters" constraint (this isn't a character at all).
 */
export function DecoFountain({ lerpedRef }: DecoFountainProps) {
  const basinGeometry = useMemo(buildBasinGeometry, [])
  const sprayGeometry = useMemo(buildSprayGeometry, [])
  const sprayLayout = useMemo(buildSprayLayout, [])
  const railingLayout = useMemo(buildRailingLayout, [])

  // Basin: stone-ish -- high roughness (matte, non-reflective cut stone),
  // low metalness. Railing: metallic/brass wrought-iron-style look -- low
  // roughness, high metalness so it picks up real specular highlights from
  // the key light. Both were unlit `MeshBasicMaterial` before; the spray
  // jets stay `MeshBasicMaterial` since they're meant to read as a bright
  // glowing highlight (like a particle), not a physically-lit solid.
  const basinMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.85, metalness: 0.05, fog: true }),
    [],
  )
  const sprayMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffd166',
        transparent: true,
        opacity: 0.55,
        fog: true,
      }),
    [],
  )
  const railingMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.3, metalness: 0.85, fog: true }),
    [],
  )

  const sprayRefs = useRef<Array<THREE.Mesh | null>>([])

  useFrame(({ clock }) => {
    const lerped = lerpedRef.current
    if (!lerped) return

    // Dark silhouette tint blended from the two darkest palette tones, same
    // recipe DecoSkyline uses for its towers, so the fountain and railing
    // recede/relight in step with the skyline rather than looking like a
    // separately-lit object.
    const [fr, fg, fb] = hexToRgbNormalized(lerped.palette.fog)
    const [br, bg, bb] = hexToRgbNormalized(lerped.palette.background)
    const shade: [number, number, number] = [
      lerp(fr, br, 0.5) * 0.5,
      lerp(fg, bg, 0.5) * 0.5,
      lerp(fb, bb, 0.5) * 0.5,
    ]
    basinMaterial.color.setRGB(...shade)
    railingMaterial.color.setRGB(...shade)

    // Spray/highlight reads as the bright accent color, same as DecoSkyline's
    // window-lights, so it visually reads as "lit up" against the dark basin.
    const [ar, ag, ab] = hexToRgbNormalized(lerped.palette.accent)
    sprayMaterial.color.setRGB(ar, ag, ab)

    const elapsed = clock.elapsedTime
    sprayLayout.forEach((jet, index) => {
      const mesh = sprayRefs.current[index]
      if (!mesh) return
      const bob = Math.sin(elapsed * jet.speed + jet.phase) * 0.08
      mesh.position.set(FOUNTAIN_X + jet.x, jet.baseY + 0.45 + bob, FOUNTAIN_Z + jet.z)
    })
  })

  return (
    <group>
      <mesh
        geometry={basinGeometry}
        material={basinMaterial}
        position={[FOUNTAIN_X, 0, FOUNTAIN_Z]}
        frustumCulled={false}
        castShadow
        receiveShadow
      />
      {sprayLayout.map((jet, index) => (
        <mesh
          key={index}
          ref={(el) => {
            sprayRefs.current[index] = el
          }}
          geometry={sprayGeometry}
          material={sprayMaterial}
          position={[FOUNTAIN_X + jet.x, jet.baseY + 0.45, FOUNTAIN_Z + jet.z]}
          frustumCulled={false}
        />
      ))}
      <mesh
        geometry={railingLayout.rails}
        material={railingMaterial}
        frustumCulled={false}
        castShadow
        receiveShadow
      />
    </group>
  )
}
