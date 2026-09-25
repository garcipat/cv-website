# Contract: Shared Particle-List Producer

**Feature**: R-004 | **Module home**: `src/themes/platformer/engine/effects/particles.ts`

One producer owns the count/emission loop and the `{ dx, dy, opacity }` assembly shared by the sparkle burst, the hit splatter, and the debris burst (FR-010).

---

## Interface

```ts
export interface Particle {
  dx: number;
  dy: number;
  opacity: number;
}

/**
 * Emit `count` particles. `offsetAt(index)` supplies each particle's layout
 * offset; `opacityAt()` supplies the shared fade value. The producer owns the
 * loop and the result shape only.
 */
export function particleList(
  count: number,
  offsetAt: (index: number) => { dx: number; dy: number },
  opacityAt: () => number,
): Particle[];
```

The exact closure shape may vary; the contract is that the emission loop exists once and each caller supplies its own count, layout, and fade curve.

## Guarantees

1. All three producers (`sparkleParticles`, `hitSplatterDroplets`, `debrisPieces`) route through the one producer (FR-010/US3-1).
2. Each family's constants (sparkle count/radius, splatter counts/spreads/gravity, debris kicks/gravity) stay in the owning effect module (US3-2).
3. At the same elapsed time every emitted offset and opacity is byte-identical to the pre-refactor output; the arithmetic that determines bytes stays in the caller's closures so no float-op order changes (US3-3/SC-005).

## Invariants

- No dependency on state, `level/`, or React.
- The producer itself introduces no randomness; all layout is a pure function of the caller's index/formula.
