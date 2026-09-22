# Contract: per-kind enemy animation (`entities/enemies/EnemyAnimation.ts`)

Every kind's frames come from **its own** `sprite.animations` table; a requested
state missing from that table falls back to the kind's `defaultAnimState`
(FR-007/FR-008/FR-009).

## Types

```ts
/** Widened from 'walk' | 'hit' to string: the SelfAnimated.animState
 *  capability is already string, and each kind names its own states. */
export type EnemyAnimState = string;

export type EnemyAnimations = SpriteDescriptor['animations'];
```

## Resolver

```ts
/** The animation a kind plays for `state`, or its resting state when the
 *  kind does not define `state`. Never returns undefined for a kind whose
 *  `defaultAnimState` exists in its table. */
export function resolveAnimation(
  sprite: SpriteDescriptor,
  state: string,
  fallbackState: string,
): { frames: number[]; frameDuration: number };

/** Sheet frame index for a state, resolved through the kind's own table. */
export function enemyFrameIndex(
  sprite: SpriteDescriptor,
  state: string,
  frame: number,
  fallbackState: string,
): number;
```

`enemyFrameIndex` returns `frames[frame % frames.length]` from the resolved
animation. Frames are indices into the sheet, so a loop crossing a row boundary
needs no special handling (unchanged).

## Call sites

- `drawSpriteSheetEntity(enemy, dc, sprite, fallbackState)` resolves the frame
  through `enemyFrameIndex(sprite, enemy.animState, enemy.animFrame, fallbackState)`.
  Each kind's `draw` passes its own `defaultAnimState` (slimes `'walk'`, bee
  `'fly'`).
- `advanceEnemyAnimation(enemy, dt)` (`entities/Enemy.ts`) reads
  `resolveAnimation(typeOf(enemy).sprite, enemy.animState, typeOf(enemy).defaultAnimState)`.
  Signature unchanged.
- `stepEnemyHitReaction(enemy, dt)` (`engine/EnemyAI.ts`) reverts to
  `typeOf(enemy).defaultAnimState` at frame 0 instead of the literal `'walk'`.
- `baseEnemyState`/`baseRevive` (`shared.ts`) seed `animState` to the kind's
  `defaultAnimState` and stagger `animFrame`/`animTimer` by that state's own
  frame count/duration ([bee.md](./bee.md), research D4).

## Invariants (asserted by tests)

1. A kind with a state in its table plays that state's frames.
2. A kind missing the requested state (e.g. the bee asked for `'hit'`) resolves
   to its `defaultAnimState` — no throw, no blank frame (FR-009).
3. `advanceEnemyAnimation` advances using the resolved animation's
   `frameDuration` and wraps at its frame count.
4. Slimes keep `walk` (`[3,4,5,6,7]`, 0.15s) and `hit` (`[8,9,10,11]`, 0.1s)
   unchanged (SC-001).
5. A hit enemy that survives returns to its own `defaultAnimState` — the bee
   resumes `fly`, the slimes resume `walk` (FR-008).

## Back-compat notes

- `ENEMY_ANIMATIONS` (`walk`/`hit`) remains exported and remains the slimes'
  table. `WALK_FRAME_DURATION` stays.
- `walkAnimFrameCount()` is removed: the stagger now derives its count from the
  kind's own resting state (research D4). Nothing else imported it.
- `Enemy.ts` re-exports `EnemyAnimState` and `WALK_FRAME_DURATION` as before.
