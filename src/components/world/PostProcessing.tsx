import { useRef, type Ref, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, wrapEffect } from '@react-three/postprocessing'
import type { BloomEffect } from 'postprocessing'
import type { LerpedSceneBeat } from './beatMath'
import { hexToRgbNormalized } from './beatMath'
import { DecoPaintEffect } from './DecoPaintEffect'

// @react-three/postprocessing's `wrapEffect` types the forwarded ref as
// `RefAttributes<typeof BloomEffect>` (the constructor) instead of
// `RefAttributes<InstanceType<typeof BloomEffect>>` (an upstream typing bug
// -- the runtime ref is genuinely a `BloomEffect` instance, as confirmed by
// `wrapEffect`'s implementation forwarding straight to the constructed
// three.js/postprocessing object). Cast at the JSX boundary so the rest of
// this file can use the correct, useful instance type.
type BloomRef = Ref<typeof BloomEffect>

// `DecoPaintEffect` isn't one of @react-three/postprocessing's built-in
// wrapped components, so it's wrapped here with the library's own
// `wrapEffect` helper -- the same function that produces `Bloom` internally
// -- which is exactly why the same ref-typing workaround above is needed for
// it too.
const DecoPaint = wrapEffect(DecoPaintEffect)
type DecoPaintRef = Ref<typeof DecoPaintEffect>

interface PostProcessingProps {
  lerpedRef: RefObject<LerpedSceneBeat>
}

/**
 * Wraps drei's/postprocessing's `<Bloom>` for the glow called for in the
 * lighting spec. `intensity` is mutated directly on the underlying
 * `BloomEffect` instance every frame via a ref, rather than passed as a
 * changing prop: `@react-three/postprocessing` rebuilds the effect (and its
 * passes) whenever any prop's identity changes, which would mean recreating
 * the whole post-processing pass on every animation frame during a beat
 * transition. Mutating the instance in place is the same
 * imperative-in-useFrame pattern used everywhere else in this module.
 */
export function PostProcessing({ lerpedRef }: PostProcessingProps) {
  const bloomRef = useRef<BloomEffect>(null)
  const decoPaintRef = useRef<DecoPaintEffect>(null)

  useFrame(({ clock }) => {
    const lerped = lerpedRef.current
    if (!lerped) return

    if (bloomRef.current) {
      bloomRef.current.intensity = lerped.lighting.bloomStrength
    }

    if (decoPaintRef.current) {
      // Ornament tint follows the beat's palette accent, so the sunburst
      // rays/scalloped vignette re-tint along with everything else during a
      // beat transition instead of staying a fixed color.
      decoPaintRef.current.ornamentColor = hexToRgbNormalized(lerped.palette.accent)
      // Grain time is its own slowly-incrementing uniform (not the
      // composer's built-in `time`) so its speed is independent of and
      // decoupled from any other time-driven uniform -- driven here, once
      // per frame, like every other per-frame value in this codebase.
      decoPaintRef.current.grainTime = clock.elapsedTime * 0.15
    }
  })

  return (
    <EffectComposer>
      <Bloom
        ref={bloomRef as unknown as BloomRef}
        mipmapBlur
        luminanceThreshold={0.2}
        luminanceSmoothing={0.25}
        intensity={1}
      />
      {/* Placed after Bloom so the paint grain/ornament overlay reads at
          full crispness instead of getting softened away by Bloom's
          mipmapBlur. */}
      <DecoPaint ref={decoPaintRef as unknown as DecoPaintRef} />
    </EffectComposer>
  )
}
