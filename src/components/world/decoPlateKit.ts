/**
 * The generic Art-Deco drawing kit for painted plates (see CLAUDE.md,
 * "Painted-world pivot"). Scene-agnostic by design: Gatsby-specific
 * compositions live in `src/data/plates/<sceneId>.ts`, which composes these
 * helpers -- a future text reuses the kit, not the compositions.
 *
 * Two tiers:
 * - Pure, canvas-free helpers (color math, layout geometry) -- unit-tested.
 * - Thin ctx-drawing wrappers over those helpers -- exercised visually, not
 *   unit-tested (pixel output isn't meaningfully assertable in jsdom).
 *
 * Style contract (from the user's Art-Deco poster references): flat color
 * fields, mirrored symmetry, sunburst/fan ornament, stepped ziggurats, flat
 * silhouette figures, ruled gold linework. No gradients except the banded
 * approximations these helpers draw explicitly.
 *
 * This module is the kit's single import surface; the implementation lives
 * in `./plateKit/` (pure math, scenery, figures, buffet props, gothic
 * props), split by subject so no one file outgrows a read.
 */

export * from './plateKit/pure'
export * from './plateKit/scenery'
export * from './plateKit/figures'
export * from './plateKit/props'
export * from './plateKit/gothicProps'
