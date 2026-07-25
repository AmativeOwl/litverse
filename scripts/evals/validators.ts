// Deterministic eval layer for compiler output (drafts AND shipped goldens).
// Plain property checks -- no LLM judging anywhere in this module. Each
// validator returns a list of issues (empty = pass) rather than throwing, so
// the regression harness can aggregate pass rates per check instead of dying
// on the first violation.

import type { SceneBeat } from '../../src/types'
import type { CardSpec, ScenePlateSet } from '../../src/types-plates'
import type { Passage } from '../../src/types'
import { COLOR_ROLES, FIGURE_POSES, MOTION_VERBS, OBJECT_NOUNS } from './lexicon'

export interface EvalIssue {
  /** Which check family flagged it -- the harness aggregates pass rates per check. */
  check:
    | 'schema'
    | 'lexicon'
    | 'palette'
    | 'cross-ref'
    | 'law-count'
    | 'law-negation'
    | 'law-stillness'
  detail: string
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const PARTICLE_TYPES = new Set(['bokeh', 'confetti', 'embers', 'dust', 'none'])
const CAMERA_BEHAVIORS = new Set(['slow-orbit', 'static-drift', 'push-in', 'pull-back'])

/** Relative luminance (sRGB, linearized) -- the world's fog/bloom needs dark grounds. */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

// NOTE: an earlier draft of this layer enforced a background/fog luminance
// ceiling ("dark enough for fog/bloom"). The golden gate disproved it:
// gatsby's approved daytime-leisure beat ships a sky-blue background
// (lum 0.253) and a pale daylight fog at lum 0.788 -- the hand-approved
// envelope spans nearly the whole axis, so darkness is NOT a real property
// of valid beats. The check was removed rather than loosened into
// meaninglessness; luminance() stays exported for analysis/reporting.

export function validateSceneBeats(value: unknown): EvalIssue[] {
  const issues: EvalIssue[] = []
  if (!Array.isArray(value) || value.length === 0) {
    return [{ check: 'schema', detail: 'beats: not a non-empty array' }]
  }
  const ids = new Set<string>()
  value.forEach((beat: Partial<SceneBeat>, i) => {
    const where = `beat[${i}]${beat?.id ? ` (${beat.id})` : ''}`
    if (!beat || typeof beat !== 'object') return issues.push({ check: 'schema', detail: `${where}: not an object` })
    if (typeof beat.id !== 'string' || !beat.id) issues.push({ check: 'schema', detail: `${where}: missing id` })
    else if (ids.has(beat.id)) issues.push({ check: 'schema', detail: `${where}: duplicate id` })
    else ids.add(beat.id)

    const palette = beat.palette
    if (!palette) issues.push({ check: 'schema', detail: `${where}: missing palette` })
    else {
      for (const key of ['background', 'primary', 'accent', 'fog'] as const) {
        const hex = palette[key]
        if (typeof hex !== 'string' || !HEX_RE.test(hex)) {
          issues.push({ check: 'palette', detail: `${where}: palette.${key} not a #rrggbb hex (${String(hex)})` })
        }
      }
    }

    const lighting = beat.lighting
    if (
      !lighting ||
      typeof lighting.ambientIntensity !== 'number' ||
      typeof lighting.keyLightIntensity !== 'number' ||
      typeof lighting.bloomStrength !== 'number' ||
      typeof lighting.keyLightColor !== 'string' ||
      !HEX_RE.test(lighting.keyLightColor)
    ) {
      issues.push({ check: 'schema', detail: `${where}: lighting incomplete/invalid` })
    }

    const particles = beat.particles
    if (!particles || !PARTICLE_TYPES.has(particles.type as string) || typeof particles.density !== 'number') {
      issues.push({ check: 'schema', detail: `${where}: particles incomplete or unknown type` })
    }
    const camera = beat.camera
    if (!camera || !CAMERA_BEHAVIORS.has(camera.behavior as string) || typeof camera.fov !== 'number') {
      issues.push({ check: 'schema', detail: `${where}: camera incomplete or unknown behavior` })
    }
    const ms = beat.transitionDurationMs
    if (typeof ms !== 'number' || ms < 400 || ms > 3000) {
      issues.push({ check: 'schema', detail: `${where}: transitionDurationMs ${String(ms)} outside [400, 3000]` })
    }
  })
  return issues
}

const NOUN_SET = new Set<string>(OBJECT_NOUNS)
const VERB_SET = new Set<string>(MOTION_VERBS)
const POSE_SET = new Set<string>(FIGURE_POSES)
const ROLE_SET = new Set<string>(COLOR_ROLES)

export function validateCardSpec(value: unknown, where = 'card'): EvalIssue[] {
  const issues: EvalIssue[] = []
  const spec = value as Partial<CardSpec> | null | undefined
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.elements)) {
    return [{ check: 'schema', detail: `${where}: not a CardSpec (missing elements array)` }]
  }
  if (spec.skyBands !== undefined && (!Number.isInteger(spec.skyBands) || spec.skyBands < 1 || spec.skyBands > 8)) {
    issues.push({ check: 'schema', detail: `${where}: skyBands ${String(spec.skyBands)} outside [1, 8]` })
  }
  if (spec.groundY !== undefined && (typeof spec.groundY !== 'number' || spec.groundY <= 0 || spec.groundY >= 1)) {
    issues.push({ check: 'schema', detail: `${where}: groundY ${String(spec.groundY)} outside (0, 1)` })
  }
  spec.elements.forEach((el, i) => {
    const ew = `${where}.elements[${i}]`
    if (!el || typeof el !== 'object') return issues.push({ check: 'schema', detail: `${ew}: not an object` })
    if (!NOUN_SET.has(el.noun as string)) {
      issues.push({ check: 'lexicon', detail: `${ew}: noun "${String(el.noun)}" not in the 19-noun closed lexicon` })
    }
    if (el.motion && !VERB_SET.has(el.motion.verb as string)) {
      issues.push({
        check: 'lexicon',
        detail: `${ew}: motion verb "${String(el.motion?.verb)}" not in the 17-verb closed lexicon`,
      })
    }
    if (el.pose !== undefined) {
      if (el.noun !== 'figure') issues.push({ check: 'lexicon', detail: `${ew}: pose on non-figure noun "${String(el.noun)}"` })
      else if (!POSE_SET.has(el.pose as string)) issues.push({ check: 'lexicon', detail: `${ew}: unknown pose "${String(el.pose)}"` })
    }
    if (el.colorRole !== undefined && !ROLE_SET.has(el.colorRole as string)) {
      issues.push({ check: 'lexicon', detail: `${ew}: unknown colorRole "${String(el.colorRole)}"` })
    }
    const at = el.at
    if (!Array.isArray(at) || at.length !== 2 || at.some((v) => typeof v !== 'number' || v < 0 || v > 1)) {
      issues.push({ check: 'schema', detail: `${ew}: at ${JSON.stringify(at)} not two fractions in [0, 1]` })
    }
    if (typeof el.size !== 'number' || el.size <= 0 || el.size > 1) {
      issues.push({ check: 'schema', detail: `${ew}: size ${String(el.size)} outside (0, 1]` })
    }
  })
  return issues
}

/** Cross-references between a plate registry, its beats, and its passage. */
export function validatePlateSetRefs(plateSet: ScenePlateSet, beats: readonly SceneBeat[], passage: Passage): EvalIssue[] {
  const issues: EvalIssue[] = []
  const beatIds = new Set(beats.map((b) => b.id))
  const sentenceIds = new Set(passage.paragraphs.flatMap((p) => p.sentences.map((s) => s.id)))

  for (const beatId of Object.keys(plateSet.cameraAzimuthDeg)) {
    if (!beatIds.has(beatId)) issues.push({ check: 'cross-ref', detail: `cameraAzimuthDeg key "${beatId}" is not a beat` })
  }
  for (const beat of beats) {
    if (!(beat.id in plateSet.cameraAzimuthDeg)) {
      issues.push({ check: 'cross-ref', detail: `beat "${beat.id}" has no camera azimuth` })
    }
  }
  for (const plate of plateSet.plates) {
    for (const beatId of plate.memberBeatIds) {
      if (!beatIds.has(beatId)) issues.push({ check: 'cross-ref', detail: `plate ${plate.id}: unknown beat "${beatId}"` })
    }
  }
  for (const window of plateSet.windows ?? []) {
    for (const sentenceId of window.sentenceIds) {
      if (!sentenceIds.has(sentenceId)) {
        issues.push({ check: 'cross-ref', detail: `window ${window.id}: unknown sentence "${sentenceId}"` })
      }
    }
  }
  const used = new Set(passage.paragraphs.flatMap((p) => p.sentences.map((s) => s.sceneBeatId)))
  for (const beat of beats) {
    if (!used.has(beat.id)) issues.push({ check: 'cross-ref', detail: `beat "${beat.id}" never assigned to a sentence` })
  }
  for (const id of used) {
    if (!beatIds.has(id)) issues.push({ check: 'cross-ref', detail: `sentence beat "${id}" not defined` })
  }
  return issues
}

// ---------------------------------------------------------------------------
// Compiler laws -- table-driven assertions over CardSpec data
// ---------------------------------------------------------------------------

export type CompilerLaw =
  | { kind: 'exact-count'; noun: string; n: number }
  | { kind: 'min-count'; noun: string; n: number }
  | { kind: 'forbidden-count'; noun: string; n: number } // negation: never render the denied count
  | { kind: 'absent'; noun: string } // negation: the denied image never appears
  | { kind: 'all-still'; noun: string } // the text-sanctioned statue exception

export function countNoun(spec: CardSpec, noun: string): number {
  // mirror = the element plus its twin
  return spec.elements.reduce((acc, el) => (el.noun === noun ? acc + (el.mirror ? 2 : 1) : acc), 0)
}

export function applyLaw(law: CompilerLaw, spec: CardSpec, where: string): EvalIssue[] {
  const n = countNoun(spec, law.noun)
  switch (law.kind) {
    case 'exact-count':
      return n === law.n
        ? []
        : [{ check: 'law-count', detail: `${where}: expected exactly ${law.n} ${law.noun}, found ${n}` }]
    case 'min-count':
      return n >= law.n
        ? []
        : [{ check: 'law-count', detail: `${where}: expected >= ${law.n} ${law.noun}, found ${n}` }]
    case 'forbidden-count':
      return n !== law.n
        ? []
        : [{ check: 'law-negation', detail: `${where}: renders the DENIED count (${law.n} ${law.noun})` }]
    case 'absent':
      return n === 0
        ? []
        : [{ check: 'law-negation', detail: `${where}: renders the denied image (${n} ${law.noun})` }]
    case 'all-still': {
      const moving = spec.elements.filter(
        (el) => el.noun === law.noun && el.motion !== undefined && el.motion.verb !== 'still',
      )
      return moving.length === 0
        ? []
        : [{ check: 'law-stillness', detail: `${where}: ${moving.length} ${law.noun}(s) move where the text freezes them` }]
    }
  }
}

/** Locate a sentence id by text content -- laws self-bind to prose, not to brittle hand-copied ids. */
export function findSentenceIdByText(passage: Passage, pattern: RegExp): string | null {
  for (const paragraph of passage.paragraphs) {
    for (const sentence of paragraph.sentences) {
      const text = sentence.words.map((w) => w.text).join(' ')
      if (pattern.test(text)) return sentence.id
    }
  }
  return null
}
