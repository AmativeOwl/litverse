// Runtime mirrors of the card grammar's CLOSED lexicons (compile-time unions
// in src/types-plates.ts). The `Record<Union, true>` exhaustiveness guards
// mean the TypeScript language service flags this file the moment the union
// grows or shrinks without this list following -- the eval layer can never
// silently drift from the grammar it polices. (esbuild/vitest strip types
// without checking, so golden.test.ts ALSO probes composeCard with every
// entry at runtime -- belt and braces.)

import type { ElementSpec, MotionVerb, ObjectNoun } from '../../src/types-plates'

export const OBJECT_NOUNS: readonly ObjectNoun[] = [
  'figure',
  'car',
  'boat',
  'crate',
  'door',
  'fruit-pyramid',
  'juice-machine',
  'ham',
  'turkey',
  'pastry-row',
  'lights-strand',
  'ziggurat',
  'sun',
  'waves',
  'stars',
  'spray',
  'gothic-arch',
  'brazier',
  'clock',
]

export const MOTION_VERBS: readonly MotionVerb[] = [
  'still',
  'sway',
  'bob',
  'weave',
  'cross',
  'pace',
  'scrub',
  'dive',
  'rise',
  'fall',
  'twinkle',
  'breathe',
  'flutter',
  'orbit',
  'burst',
  'glide',
  'bounce',
]

export const FIGURE_POSES: readonly NonNullable<ElementSpec['pose']>[] = ['stand', 'dance', 'serve', 'mop', 'horn']

export const COLOR_ROLES: readonly NonNullable<ElementSpec['colorRole']>[] = [
  'accent',
  'accent-light',
  'primary',
  'primary-light',
  'shadow',
]

// -- exhaustiveness guards (compile-time only; see header) ------------------
const _nounGuard: Record<ObjectNoun, true> = Object.fromEntries(OBJECT_NOUNS.map((n) => [n, true])) as Record<
  ObjectNoun,
  true
>
const _verbGuard: Record<MotionVerb, true> = Object.fromEntries(MOTION_VERBS.map((v) => [v, true])) as Record<
  MotionVerb,
  true
>
void _nounGuard
void _verbGuard
