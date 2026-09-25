/**
 * The shared particle-list producer (R-004 US3/FR-010): the count/emission
 * loop and `{ dx, dy, opacity }` assembly that `sparkleParticles`,
 * `hitSplatterDroplets`, and `debrisPieces` each used to hand-roll. Each
 * family keeps its own count, layout closure, and fade curve; the arithmetic
 * that determines bytes stays in the caller's closures, so no float-op order
 * changes.
 */

export interface Particle {
  dx: number;
  dy: number;
  opacity: number;
}

/**
 * Emit `count` particles. `offsetAt(index)` supplies each particle's layout
 * offset; `opacityAt()` supplies the shared fade value. The producer owns the
 * loop and the result shape only — it introduces no randomness.
 */
export function particleList(
  count: number,
  offsetAt: (index: number) => { dx: number; dy: number },
  opacityAt: () => number,
): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const { dx, dy } = offsetAt(index);
    return { dx, dy, opacity: opacityAt() };
  });
}
