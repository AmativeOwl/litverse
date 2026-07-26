import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
import { vignetteVisibility } from './decoPlateKit'
import { paintOrchestraVignette } from './paintOrchestraVignette'

interface PaintedVignetteProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * The 2D-paintings-on-a-3D-camera hybrid: a flat, gouache-style painted
 * backdrop hung in a beat's angular sector, which the azimuth-anchored
 * CameraRig turns to face when narration enters that beat. The 3D floor,
 * crowd, string lights and particles drift in front of it, so the scripted
 * camera moves give real parallax against a flat painting -- the multiplane-
 * camera trick of golden-age animated shorts, and the "painted backdrop"
 * identity the Deco skyline was always styled after.
 *
 * The painting is procedural (drawn once to a canvas, no fetched assets) and
 * beat-gated with DecoWaterfront's visibility pattern: fully present in its
 * own beats, cross-fading with the eased transition progress on the way in
 * and out, invisible everywhere else. That is what makes each sentence
 * "paint a new picture" -- other sectors' vignettes simply are not there.
 *
 * First vignette: the orchestra-tuning bandstand. The per-beat definitions
 * are structured so more vignettes (bar, buffet, waterfront...) are added as
 * data + a paint function, not new architecture.
 */

/** Beats this first vignette belongs to. */
const ORCHESTRA_BEAT_IDS = new Set(['orchestra-tuning', 'dancing-under-lights'])
/** Matches DecoOrchestra's sector so the camera anchor (80deg) faces it. */
const VIGNETTE_ANGLE_RAD = (80 * Math.PI) / 180
const VIGNETTE_RADIUS = 20
const VIGNETTE_WIDTH = 17
const VIGNETTE_HEIGHT = 9.5
const HIDDEN_OPACITY = 0

const workingColor = new THREE.Color()

export function PaintedVignette({ lerpedRef }: PaintedVignetteProps) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    paintOrchestraVignette(canvas, 1024, 576)
    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.colorSpace = THREE.SRGBColorSpace
    return canvasTexture
  }, [])

  // Fixed placement: hung in the orchestra sector, facing the scene origin.
  const placement = useMemo(() => {
    const x = Math.cos(VIGNETTE_ANGLE_RAD) * VIGNETTE_RADIUS
    const z = Math.sin(VIGNETTE_ANGLE_RAD) * VIGNETTE_RADIUS
    // rotate the plane's +z normal to point back at the origin
    const rotationY = Math.atan2(-x, -z)
    return { x, z, rotationY }
  }, [])

  useFrame(() => {
    const lerped = lerpedRef.current
    const material = materialRef.current
    if (!lerped || !material) return
    const visibility = vignetteVisibility(lerped.fromId, lerped.toId, lerped.t, ORCHESTRA_BEAT_IDS)
    material.opacity = HIDDEN_OPACITY + visibility
    // nudge the painting toward the live fog color so whichever of its two
    // beats is active, it sits in that beat's atmosphere
    workingColor.set(lerped.palette.fog)
    material.color.setRGB(1, 1, 1).lerp(workingColor, 0.18)
  })

  return (
    <mesh
      position={[placement.x, VIGNETTE_HEIGHT * 0.42, placement.z]}
      rotation={[0, placement.rotationY, 0]}
    >
      <planeGeometry args={[VIGNETTE_WIDTH, VIGNETTE_HEIGHT]} />
      {/* fog=false: the painting supplies its own atmosphere; scene fog at
          radius 20 would grey it out and defeat the backdrop-painting read */}
      <meshBasicMaterial ref={materialRef} map={texture} transparent fog={false} depthWrite={false} />
    </mesh>
  )
}
