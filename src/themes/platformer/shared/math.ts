/**
 * The pure scalar/position math primitives duplicated across the platformer
 * theme (R-002 FR-001). A pure leaf: it imports nothing from `engine/`,
 * `entities/`, `level/`, `editor/`, or state, and holds no state of its own —
 * every function is a total, pure function of its arguments (FR-002).
 *
 * Retargeting the former inline re-implementations here must not change any
 * output (FR-003/FR-004/FR-006): each body below is byte-identical to the
 * formula it replaces, and callers keep their own normalizations (e.g.
 * `hash2D(…) % n`).
 */

/** Clamp `x` to `[0, 1]`. */
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Smoothstep (Hermite) on `[0, 1]`: `t*t*(3-2*t)`. */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Linear interpolation `a → b` at `t`, clamped to `[0, 1]`: `a + (b-a)*clamp01(t)`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

/**
 * Deterministic 32-bit position hash in `[0, 2^32)`. `salt` defaults to `0`.
 *
 * The salted formula is used unconditionally: with `salt = 0` it reduces to the
 * unsalted hash the torch/decor catalogs use, and with `salt = 1|2|3` it
 * reproduces `Lighting`'s per-cell jitter/pulse values — byte-equivalent at
 * every call site. Callers normalize the raw uint32 themselves.
 */
export function hash2D(col: number, row: number, salt = 0): number {
  return (
    (Math.imul(col + salt * 92821, 374761393) ^ Math.imul(row + salt * 68917, 668265263)) >>> 0
  );
}

/** Sine pulse for a normalized phase: `sin(phase * 2π)`, range `[-1, 1]`. */
export function pulse(phase: number): number {
  return Math.sin(phase * Math.PI * 2);
}

/** Deterministic horizontal shake jitter: `sin(elapsed * 40) * amplitude`. */
export function shakeOffsetX(elapsed: number, amplitude: number): number {
  return Math.sin(elapsed * 40) * amplitude;
}
