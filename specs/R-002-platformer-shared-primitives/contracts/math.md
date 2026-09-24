# Contract — `shared/math.ts`

**Layer**: `shared/` (pure leaf, sibling of `contracts/`). **Imports**: nothing.

This module is the single home for the scalar/position math primitives duplicated across the
platformer theme. Every former inline re-implementation MUST import here (spec FR-003).

## Exports

| Function | Signature | Returns | Must hold |
| --- | --- | --- | --- |
| `clamp01` | `(x: number) => number` | `x` clamped to `[0, 1]` | `clamp01(x) === Math.max(0, Math.min(1, x))` |
| `smoothstep` | `(t: number) => number` | `t*t*(3-2*t)` | byte-equal to the former inline formula |
| `lerp` | `(a: number, b: number, t: number) => number` | `a + (b-a)*clamp01(t)` | `lerp(a,b,0)=a`, `lerp(a,b,1)=b` |
| `hash2D` | `(col: number, row: number, salt?: number) => number` | uint32 in `[0, 2^32)` | `(Math.imul(col+salt*92821, 374761393) ^ Math.imul(row+salt*68917, 668265263)) >>> 0` |
| `pulse` | `(phase: number) => number` | `sin(phase * 2π)`, range `[-1, 1]` | `pulse(0)=0`, `pulse(0.25)=1`, `pulse(0.5)=0` (within FP tolerance) |
| `shakeOffsetX` | `(elapsed: number, amplitude: number) => number` | `sin(elapsed * 40) * amplitude` | byte-equal at `amplitude` 1 (crumbling floor) and 1.5 (stalactite) |

## Invariants

1. **Byte-for-byte preservation** — moving a formula into this module must not change any output
   (spec edge cases). Callers may keep their own normalization around the primitive (e.g. `hash2D(…)
   % n`, `hash2D(…)/0xffffffff`) but not a copy of the primitive's body.
2. **Pure & total** — no I/O, no React, no signals, no `Math.random`. Every function is a pure
   function of its arguments and never throws for finite numeric input.
3. **No higher-layer imports** — this module imports nothing from `engine/`, `entities/`, `level/`,
   editor, or state (FR-002).
4. **Exactly one home** — no compatibility re-export that preserves a duplicated path (FR-023).

## Call-site mapping (authoritative)

| Primitive | Former sites now importing it |
| --- | --- |
| `smoothstep` | `Lighting.fogPeekStrengthAt`, `torchGlowStrengthAt`, `playerGlowStrengthAt`, `enemyEyeOpacity` |
| `clamp01` | `Lighting.enemyEyeOpacity`, `CrumblingFloor.crackRatioAt`/`reformRatioAt`, `BlockAI`, `DeployableLadder.revealedStepCount`, `MushroomSquash`, `CollectionEffects`, `hazards/FloorSpike`, `Fruit` (the bonus-fruit rise clamp, post-rename) |
| `lerp` | `CollectionEffects.flightEffectPosition` (two sites), `GameLifecycle` (post-merge, replaces `lerpRadius`) |
| `hash2D` | `Torch.torchPhase`, `StaticObjectsCatalog.pickVariant`, `BackgroundDecorCatalog.pickVariant`, `Lighting.cellHash01` (salted) |
| `pulse` | `Lighting.torchPulseScale`, `Lighting.fogPuffAt`, `Lighting.enemyEyeBobOffset`, `Renderer` (two `(sin+1)/2` waves) |
| `shakeOffsetX` | `CrumblingFloor.crumblingFloorShakeOffsetXAt`, `FallingStalactite.fallingStalactiteShakeOffsetXAt` |
