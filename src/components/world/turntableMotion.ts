/**
 * Per-frame angular speed of the zoetrope drum (rad/s), written by
 * WorldTurntable every frame and read by PaintedPlates -- module-level
 * mutable per the established per-frame-ref idiom, never React state. The
 * living-painting repaint loop pauses while the drum is visibly turning: a
 * 12fps canvas repaint means a GPU texture upload, and those uploads read as
 * hitches ("ticks") exactly when the eye is tracking smooth rotation. Frozen
 * card animation during a ~6s slide is imperceptible; the hitches were not.
 *
 * Lives in its own module (not WorldTurntable.tsx) so component files export
 * only components -- the react-refresh/fast-refresh contract.
 */
export const turntableMotion = { radPerSec: 0 }
