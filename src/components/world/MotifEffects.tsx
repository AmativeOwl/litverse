import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useReadingStore } from '../../store/readingStore'
import { createSeededRandom, hashStringToSeed } from './seededRandom'
import motifsData from '../../data/motifs.json'
import type { Motif } from '../../types-motifs'

const MOTIFS: Record<string, Motif> = Object.fromEntries((motifsData as Motif[]).map((m) => [m.id, m]))

/** Fixed world-space point where one-shot motifs play -- inside the camera's typical framing, near the crowd. */
const STAGE_POSITION: [number, number, number] = [0, 2.4, -2]
const BURST_CAPACITY = 48
const BURST_MAX_RADIUS = 1.8

function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - (1 - c) ** 3
}

/**
 * Renders whichever one-shot Motif (src/data/motifs.json) is currently
 * playing, triggered by activeMotifId/activeMotifNonce -- a sparse,
 * beat-level-cardinality store field (fires a handful of times total per
 * passage, same category as activeSpeakerId), never per-frame/per-word
 * state. The animation itself (burst expansion/fade, light pulse curve,
 * glyph opacity) lives entirely in useFrame against refs, never React
 * state, per the project's per-frame-vs-React split.
 */
export function MotifEffects() {
  const activeMotifId = useReadingStore((s) => s.activeMotifId)
  const activeMotifNonce = useReadingStore((s) => s.activeMotifNonce)

  const [visibleMotif, setVisibleMotif] = useState<Motif | null>(null)
  const startRef = useRef(0)

  const burstDirections = useMemo(() => {
    const random = createSeededRandom(hashStringToSeed('litverse-motif-burst'))
    return Array.from({ length: BURST_CAPACITY }, () => {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      return new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi))
    })
  }, [])
  const burstPositions = useMemo(() => new Float32Array(BURST_CAPACITY * 3), [])

  const burstRef = useRef<THREE.Points>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const glyphRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!activeMotifId) return
    const motif = MOTIFS[activeMotifId]
    if (!motif) return
    startRef.current = performance.now()
    setVisibleMotif(motif)
    const timer = setTimeout(() => setVisibleMotif(null), motif.durationMs)
    return () => clearTimeout(timer)
    // Deliberately re-fires on nonce alone, even when activeMotifId is unchanged
    // -- see the store field's doc comment (two tagged words can share a motif id).
  }, [activeMotifId, activeMotifNonce])

  useFrame(() => {
    const motif = visibleMotif
    const progress = motif ? Math.min(1, (performance.now() - startRef.current) / motif.durationMs) : 1
    const active = motif !== null && progress < 1

    const burst = burstRef.current
    if (burst) {
      const show = active && motif.kind === 'particle-burst'
      burst.visible = show
      if (show) {
        const radius = BURST_MAX_RADIUS * easeOutCubic(progress) * motif.intensity
        const opacity = (1 - progress) * motif.intensity
        for (let i = 0; i < BURST_CAPACITY; i++) {
          const dir = burstDirections[i]
          if (!dir) continue
          burstPositions[i * 3] = STAGE_POSITION[0] + dir.x * radius
          burstPositions[i * 3 + 1] = STAGE_POSITION[1] + dir.y * radius
          burstPositions[i * 3 + 2] = STAGE_POSITION[2] + dir.z * radius
        }
        const position = burst.geometry.attributes.position as THREE.BufferAttribute | undefined
        if (position) position.needsUpdate = true
        const material = burst.material as THREE.PointsMaterial
        material.opacity = opacity
        material.color.set(motif.color)
      }
    }

    const light = lightRef.current
    if (light) {
      const show = active && motif.kind === 'glow-pulse'
      if (show) {
        // Rise then decay -- a pulse, not a linear fade.
        const curve = Math.sin(Math.PI * progress)
        light.intensity = curve * motif.intensity * 6
        light.color.set(motif.color)
      } else {
        light.intensity = 0
      }
    }

    const glyph = glyphRef.current
    if (glyph) {
      const show = active && motif.kind === 'floating-glyph'
      if (show) {
        const opacity = Math.sin(Math.PI * progress) * motif.intensity
        glyph.style.opacity = String(opacity)
        glyph.style.transform = `translateY(${-progress * 24}px)`
      } else {
        glyph.style.opacity = '0'
      }
    }
  })

  return (
    <>
      <points ref={burstRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={BURST_CAPACITY}
            array={burstPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.12} transparent depthWrite={false} sizeAttenuation />
      </points>
      <pointLight ref={lightRef} position={STAGE_POSITION} intensity={0} distance={12} />
      {visibleMotif?.kind === 'floating-glyph' && (
        <Html position={STAGE_POSITION} center>
          <span
            ref={glyphRef}
            style={{
              color: visibleMotif.color,
              fontFamily: 'Lora, serif',
              fontStyle: 'italic',
              fontSize: '1.1rem',
              opacity: 0,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              textShadow: `0 0 12px ${visibleMotif.color}`,
            }}
          >
            {visibleMotif.glyph}
          </span>
        </Html>
      )}
    </>
  )
}
