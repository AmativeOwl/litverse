// Additive, non-frozen types for the "imagery motifs" feature -- kept out of
// types.ts (the frozen Word/Sentence/Paragraph/Passage/SceneBeat contract)
// deliberately: Motif data is a separate, independently-evolvable authoring
// layer keyed by existing Word ids, not a change to the core content shape.
// See CLAUDE.md § "Imagery motifs" for the full spec.

/**
 * A single one-shot visual accent the 3D world can play when narration
 * reaches a word tagged with it. Distinct from `SceneBeat`: a beat describes
 * the ambient mood for a whole stretch of text and is lerped continuously;
 * a Motif is a brief, transient flourish layered on top, triggered once and
 * self-reverting.
 */
export interface Motif {
  id: string
  kind: 'particle-burst' | 'glow-pulse' | 'floating-glyph'
  color: string
  durationMs: number
  /** 0..1 -- scales burst size / glow strength / glyph opacity. */
  intensity: number
  /** Required for `floating-glyph`, ignored otherwise: the short text that fades up near camera. */
  glyph?: string
}

/** Word.id -> Motif.id. Hand-authored (optionally offline-script-assisted), never inferred at runtime -- see scripts/tag-motif-words.ts. */
export type MotifTriggers = Record<string, string>
