import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useReadingStore } from '../../store/readingStore'
import { createSeededRandom, hashStringToSeed } from './seededRandom'
import motifsData from '../../data/motifs.json'
import type { Motif } from '../../types-motifs'

const MOTIFS: Record<string, Motif> = Object.fromEntries((motifsData as Motif[]).map((m) => [m.id, m]))

/** Fixed world-space point where a one-shot motif plays if it doesn't specify its own `position`. */
const STAGE_POSITION: [number, number, number] = [0, 2.4, -2]
const BURST_CAPACITY = 48
const BURST_MAX_RADIUS = 1.8

/**
 * How many motifs can be visibly playing at once. With the imagery-motifs-v2
 * catalog's much denser tagging, two tags landing within a few hundred ms of
 * each other (e.g. the gypsy-dance sequence in p6-s1) is routine rather than
 * an edge case -- a single shared slot would just clobber/strobe between
 * them. A small fixed pool lets nearby triggers visibly overlap instead.
 */
const POOL_SIZE = 3

function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - (1 - c) ** 3
}

interface SlotAssignment {
  motif: Motif | null
  /** Bumped every time this slot is (re)assigned, even to the same motif id -- forces the slot's own effect to re-fire, same rationale as the store's activeMotifNonce. */
  token: number
}

function createEmptySlots(): SlotAssignment[] {
  return Array.from({ length: POOL_SIZE }, () => ({ motif: null, token: 0 }))
}

/**
 * Renders whichever one-shot Motif (src/data/motifs.json) is currently
 * assigned to this pool slot -- one independent instance of the animation
 * logic that used to be the whole of MotifEffects before the multi-slot
 * pool, parameterized by a seed (so overlapping bursts don't scatter in
 * identical directions) and by the assigned motif's own `position` (falling
 * back to STAGE_POSITION). The animation itself (burst expansion/fade, light
 * pulse curve, glyph opacity) lives entirely in useFrame against refs, never
 * React state, per the project's per-frame-vs-React split.
 */
function MotifSlot({ assignment, seed }: { assignment: SlotAssignment; seed: string }) {
  const { motif, token } = assignment

  const [visibleMotif, setVisibleMotif] = useState<Motif | null>(null)
  const startRef = useRef(0)

  const burstDirections = useMemo(() => {
    const random = createSeededRandom(hashStringToSeed(seed))
    return Array.from({ length: BURST_CAPACITY }, () => {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      return new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed is a per-slot constant, not reactive
  }, [])
  const burstPositions = useMemo(() => new Float32Array(BURST_CAPACITY * 3), [])

  const burstRef = useRef<THREE.Points>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const glyphRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!motif) return
    startRef.current = performance.now()
    setVisibleMotif(motif)
    const timer = setTimeout(() => setVisibleMotif(null), motif.durationMs)
    return () => clearTimeout(timer)
    // Deliberately re-fires on token alone, even when the assigned motif is
    // unchanged -- two triggers can land the same motif id on the same slot.
  }, [motif, token])

  useFrame(() => {
    const activeMotif = visibleMotif
    const progress = activeMotif ? Math.min(1, (performance.now() - startRef.current) / activeMotif.durationMs) : 1
    const active = activeMotif !== null && progress < 1
    const position = activeMotif?.position ?? STAGE_POSITION

    const burst = burstRef.current
    if (burst) {
      const show = active && activeMotif.kind === 'particle-burst'
      burst.visible = show
      if (show) {
        const radius = BURST_MAX_RADIUS * easeOutCubic(progress) * activeMotif.intensity
        const opacity = (1 - progress) * activeMotif.intensity
        for (let i = 0; i < BURST_CAPACITY; i++) {
          const dir = burstDirections[i]
          if (!dir) continue
          burstPositions[i * 3] = position[0] + dir.x * radius
          burstPositions[i * 3 + 1] = position[1] + dir.y * radius
          burstPositions[i * 3 + 2] = position[2] + dir.z * radius
        }
        const positionAttr = burst.geometry.attributes.position as THREE.BufferAttribute | undefined
        if (positionAttr) positionAttr.needsUpdate = true
        const material = burst.material as THREE.PointsMaterial
        material.opacity = opacity
        material.color.set(activeMotif.color)
      }
    }

    const light = lightRef.current
    if (light) {
      const show = active && activeMotif.kind === 'glow-pulse'
      light.position.set(position[0], position[1], position[2])
      if (show) {
        // Rise then decay -- a pulse, not a linear fade.
        const curve = Math.sin(Math.PI * progress)
        light.intensity = curve * activeMotif.intensity * 6
        light.color.set(activeMotif.color)
      } else {
        light.intensity = 0
      }
    }

    const glyph = glyphRef.current
    if (glyph) {
      const show = active && activeMotif.kind === 'floating-glyph'
      if (show) {
        const opacity = Math.sin(Math.PI * progress) * activeMotif.intensity
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
      <pointLight ref={lightRef} position={visibleMotif?.position ?? STAGE_POSITION} intensity={0} distance={12} />
      {visibleMotif?.kind === 'floating-glyph' && (
        <Html position={visibleMotif.position ?? STAGE_POSITION} center>
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

/**
 * Owns the fixed-size pool of MotifSlots and assigns each newly-triggered
 * motif (activeMotifId/activeMotifNonce -- a sparse, beat-level-cardinality
 * store field, same category as activeSpeakerId, never per-frame/per-word
 * state) to one of them: a free slot (its previous motif already finished)
 * if one exists, otherwise the slot that's been occupied the longest
 * (round-robin), so a burst of nearby triggers overlaps visibly instead of
 * clobbering a single shared slot.
 */
export function MotifEffects() {
  const activeMotifId = useReadingStore((s) => s.activeMotifId)
  const activeMotifNonce = useReadingStore((s) => s.activeMotifNonce)

  const [slots, setSlots] = useState<SlotAssignment[]>(createEmptySlots)
  const lastHandledNonceRef = useRef(0)
  // Per-slot bookkeeping, kept out of React state since it's write-only
  // scratch data read back on the next trigger, not something that drives a render.
  const slotMetaRef = useRef<Array<{ startedAt: number; durationMs: number }>>(
    Array.from({ length: POOL_SIZE }, () => ({ startedAt: 0, durationMs: 0 })),
  )

  useEffect(() => {
    if (!activeMotifId) return
    if (activeMotifNonce === lastHandledNonceRef.current) return
    lastHandledNonceRef.current = activeMotifNonce
    const motif = MOTIFS[activeMotifId]
    if (!motif) return

    const now = performance.now()
    const meta = slotMetaRef.current

    let targetIndex = meta.findIndex((m) => now - m.startedAt >= m.durationMs)
    if (targetIndex === -1) {
      // All slots busy -- round-robin the one that's been running longest.
      targetIndex = 0
      for (let i = 1; i < meta.length; i++) {
        const candidate = meta[i]
        const oldest = meta[targetIndex]
        if (candidate && oldest && candidate.startedAt < oldest.startedAt) targetIndex = i
      }
    }

    meta[targetIndex] = { startedAt: now, durationMs: motif.durationMs }
    setSlots((prev) => {
      const next = [...prev]
      const previousSlot = next[targetIndex]
      next[targetIndex] = { motif, token: (previousSlot?.token ?? 0) + 1 }
      return next
    })
  }, [activeMotifId, activeMotifNonce])

  return (
    <>
      {slots.map((assignment, i) => (
        <MotifSlot key={i} assignment={assignment} seed={`litverse-motif-burst-${i}`} />
      ))}
    </>
  )
}
