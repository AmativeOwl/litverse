/**
 * Adaptive render resolution: a fixed PIXEL BUDGET instead of a fixed dpr.
 *
 * Every per-pixel cost in the world pane (composer buffers, bloom, texture
 * fills) scales with cssArea x dpr^2, so a dpr that ignores viewport size
 * makes cinema mode ~4x heavier than the half-pane reader at the same
 * setting -- the observed cinema-mode lag. Solving dpr from a constant
 * device-pixel budget keeps the frame cost roughly flat across pane sizes:
 * the half-pane still hits the 1.5 cap (sharpest), a 1080p fullscreen lands
 * near native 1.0, and larger screens scale down toward the floor -- which
 * exists so a 4K cinema never turns soft-blurry in the name of frame rate.
 *
 * Pure and exported for tests; WorldScene's AdaptiveResolution applies it
 * whenever the canvas size changes (entering/leaving cinema mode included).
 */

/** Device pixels the world canvas is allowed to render (~ a 1080p frame at native resolution). */
export const RENDER_PIXEL_BUDGET = 2_200_000
/** Never render below this dpr -- sharpness floor for very large screens. */
export const ADAPTIVE_DPR_FLOOR = 0.75
/** Never render above this dpr -- flat painted art gains nothing beyond it. */
export const ADAPTIVE_DPR_CAP = 1.5

export function computeAdaptiveDpr(cssWidth: number, cssHeight: number, nativeDpr: number): number {
  const area = Math.max(1, cssWidth * cssHeight)
  const budgetFit = Math.sqrt(RENDER_PIXEL_BUDGET / area)
  // never exceed the device's own ratio (upsampling is wasted work), nor the cap
  const ceiling = Math.min(Math.max(nativeDpr, ADAPTIVE_DPR_FLOOR), ADAPTIVE_DPR_CAP)
  return Math.min(ceiling, Math.max(ADAPTIVE_DPR_FLOOR, budgetFit))
}
