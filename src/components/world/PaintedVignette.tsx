import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LerpedSceneBeat } from './beatMath'
import { vignetteVisibility } from './decoPlateKit'

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

// Relocated to the shared plate kit as part of the painted-world pivot;
// re-exported here so existing imports/tests keep working unchanged.
export { vignetteVisibility }

/**
 * Paints the bandstand vignette once: flat value-banded gouache -- sky bands,
 * a glowing Deco half-shell, musician silhouettes, string-light dots -- in
 * the orchestra-tuning beat's own palette so it sits naturally in the scene
 * even before per-beat tinting.
 */
export function paintOrchestraVignette(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
): void {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null
  if (!ctx) return
  const w = width
  const h = height

  // -- flat banded sky (posterized gouache, not a smooth gradient)
  const skyBands = ['#241338', '#2e1a44', '#3b2354', '#4a2c62']
  const bandH = (h * 0.72) / skyBands.length
  skyBands.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(0, i * bandH, w, bandH + 1)
  })
  // -- ground band
  ctx.fillStyle = '#57356b'
  ctx.fillRect(0, h * 0.72, w, h * 0.28)

  // -- distant flat towers, pure cutouts
  ctx.fillStyle = '#1b0f2e'
  const towerXs = [0.06, 0.16, 0.82, 0.93]
  for (const tx of towerXs) {
    const cx = tx * w
    const tw = w * 0.055
    const th = h * (0.2 + 0.12 * Math.abs(Math.sin(cx)))
    for (let s = 0; s < 3; s++) {
      const sw = tw * (1 - s * 0.25)
      ctx.fillRect(cx - sw / 2, h * 0.72 - th + (s * th) / 3, sw, th / 3 + 1)
    }
  }

  const cx = w * 0.5
  const baseY = h * 0.78
  const shellR = h * 0.34

  // -- bandstand platform
  ctx.fillStyle = '#20122f'
  ctx.beginPath()
  ctx.ellipse(cx, baseY + shellR * 0.12, shellR * 1.45, shellR * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()

  // -- glowing half-shell interior: three flat bands, light to dark
  const shellBands: Array<[string, number]> = [
    ['#ffdf9e', 0.45],
    ['#e8974a', 0.75],
    ['#8a4a3a', 1],
  ]
  for (let i = shellBands.length - 1; i >= 0; i--) {
    const entry = shellBands[i]
    if (!entry) continue
    ctx.fillStyle = entry[0]
    ctx.beginPath()
    ctx.arc(cx, baseY, shellR * entry[1], Math.PI, 0)
    ctx.closePath()
    ctx.fill()
  }
  // -- shell ribs
  ctx.strokeStyle = 'rgba(32,16,40,0.45)'
  ctx.lineWidth = Math.max(1, w * 0.002)
  for (let i = 1; i < 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI
    ctx.beginPath()
    ctx.moveTo(cx, baseY)
    ctx.lineTo(cx + Math.cos(a) * shellR, baseY + Math.sin(a) * shellR)
    ctx.stroke()
  }
  // -- shell rim + finial rays
  ctx.strokeStyle = '#ffd166'
  ctx.lineWidth = Math.max(2, w * 0.004)
  ctx.beginPath()
  ctx.arc(cx, baseY, shellR, Math.PI, 0)
  ctx.stroke()
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(cx, baseY - shellR)
    ctx.lineTo(cx + i * shellR * 0.12, baseY - shellR * 1.22)
    ctx.stroke()
  }

  // -- musician silhouettes: flat cutouts inside the glow
  ctx.fillStyle = '#241028'
  for (let i = 0; i < 7; i++) {
    const mx = cx + (i - 3) * shellR * 0.24
    const mh = shellR * (0.34 + (i % 2) * 0.08)
    const my = baseY
    ctx.beginPath()
    ctx.moveTo(mx - mh * 0.16, my)
    ctx.quadraticCurveTo(mx - mh * 0.2, my - mh * 0.6, mx, my - mh * 0.72)
    ctx.quadraticCurveTo(mx + mh * 0.2, my - mh * 0.6, mx + mh * 0.16, my)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.arc(mx, my - mh * 0.84, mh * 0.13, 0, Math.PI * 2)
    ctx.fill()
  }

  // -- strings of light dots swagged across the top
  ctx.fillStyle = '#ffe9b0'
  for (const sy of [0.14, 0.24]) {
    for (let i = 0; i <= 18; i++) {
      const t = i / 18
      const lx = t * w
      const ly = h * sy + Math.sin(Math.PI * t) * h * 0.05
      ctx.beginPath()
      ctx.arc(lx, ly, Math.max(1.5, w * 0.0035), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

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
