import { useRef, type Ref, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import type { BloomEffect } from 'postprocessing'
import type { LerpedSceneBeat } from './beatMath'

// @react-three/postprocessing's `wrapEffect` types the forwarded ref as
// `RefAttributes<typeof BloomEffect>` (the constructor) instead of
// `RefAttributes<InstanceType<typeof BloomEffect>>` (an upstream typing bug
// -- the runtime ref is genuinely a `BloomEffect` instance, as confirmed by
// `wrapEffect`'s implementation forwarding straight to the constructed
// three.js/postprocessing object). Cast at the JSX boundary so the rest of
// this file can use the correct, useful instance type.
type BloomRef = Ref<typeof BloomEffect>

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
 *
 * The `DecoPaint` posterize/grain/ornament pass that used to be chained
 * after Bloom here has been removed as part of the PBR-materials pivot away
 * from the flat "painted/toon" look -- see `DecoPaintEffect.ts`, which is
 * left in place (unused) in case the look is wanted again later.
 */
export function PostProcessing({ lerpedRef }: PostProcessingProps) {
  const bloomRef = useRef<BloomEffect>(null)

  useFrame(() => {
    const lerped = lerpedRef.current
    if (!lerped) return

    if (bloomRef.current) {
      bloomRef.current.intensity = lerped.lighting.bloomStrength
    }
  })

  return (
    // multisampling 2, not the library's silent WebGL2 default of 8: the
    // composer's MSAA buffer scales with viewport x dpr, and 8x at cinema
    // mode's fullscreen size was a large share of the frame budget. The art
    // is soft flat color fields -- 2x covers the few hard geometry edges,
    // and Bloom's mipmap blur hides the rest.
    <EffectComposer multisampling={2}>
      <Bloom
        ref={bloomRef as unknown as BloomRef}
        mipmapBlur
        luminanceThreshold={0.2}
        luminanceSmoothing={0.25}
        intensity={1}
      />
    </EffectComposer>
  )
}
