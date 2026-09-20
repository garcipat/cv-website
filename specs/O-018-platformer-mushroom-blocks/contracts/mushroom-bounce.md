# Contract: mushroom bounce and cap squash

This contract covers the launch, the cap-contact query, the squash module and
the game-loop wiring. The bounce query and the squash module are pure,
canvas-free and DOM-free.

## `engine/PhysicsConfig.ts` — the launch constant

```ts
  /**
   * Upward velocity impulse applied to the player on a downward landing on a
   * bouncy mushroom's cap, in px/s (negative = up). A dedicated super-jump,
   * deliberately stronger than the player's own jump (`jumpVelocity`, -520)
   * so bouncing is always a genuine traversal gain over standing on the cap
   * and jumping off it: peak height ≈ 650²/(2*1200) ≈ 176px ≈ 5.5 tiles
   * (RENDERED_TILE_SIZE=32px), ~1.6x a normal jump's peak. Gated by
   * `PlayerState.bounceAscending` (see PlatformerPage.tsx) so the
   * variable-jump-height cut does not shear it down. Tunneling check:
   * Math.abs(-650) * (1/30) ≈ 21.7 < 32. ✓
   */
  mushroomBounceVelocity: -650,
```

## `engine/Physics.ts` — `playerOnMushroomCap`

```ts
/**
 * The standable bouncy-mushroom cap the player is resting on this tick, or
 * `null`. Only a grounded player counts: because the game loop launches them
 * the instant this returns a cell, `grounded` is true for exactly the contact
 * tick. Uses the player's CENTRE column so a sliver of the 24px hitbox clipping
 * an adjacent cap while the character stands on neighbouring solid ground does
 * not count as a landing.
 *
 * This CENTRE-column rule IS the spec's definition of "landing on a cap"
 * (FR-007): a contact whose centre column is not over the cap — including a
 * landing on the exact seam beside it — rests on the cap's corner without
 * bouncing. Standability itself remains per-column (mushroom-terrain.md).
 */
export function playerOnMushroomCap(
  level: LevelDef,
  player: PlayerState,
): { col: number; row: number } | null {
  if (!player.grounded) return null;
  const footRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING) / RENDERED_TILE_SIZE,
  );
  const centerCol = Math.floor((player.x + PLAYER_RENDERED_SIZE / 2) / RENDERED_TILE_SIZE);
  return isStandableMushroomCap(level, centerCol, footRow)
    ? { col: centerCol, row: footRow }
    : null;
}
```

- Reads the **effective** level the caller passes (so it agrees with the grid
  physics just ran against).
- Never throws; out-of-bounds cells resolve to `'empty'` via `isStandableMushroomCap`.

## `engine/MushroomSquash.ts` (new, pure)

```ts
export interface MushroomSquashState {
  col: number;
  row: number;
  elapsed: number; // seconds since the bounce
}

export const MUSHROOM_SQUASH_DURATION_SECONDS = 0.1;
export const MUSHROOM_SQUASH_DIP_PX = 2; // rendered px

/** Adds a squash for the cell, replacing any in-progress one for it. */
export function startMushroomSquash(
  states: readonly MushroomSquashState[],
  col: number,
  row: number,
): MushroomSquashState[];

/** Advances every entry by `dt` and drops those at/after the duration. */
export function advanceMushroomSquashes(
  states: readonly MushroomSquashState[],
  dt: number,
): MushroomSquashState[];

/** `DIP * (1 - clamp(elapsed / DURATION, 0, 1))`, in rendered px. */
export function mushroomSquashDip(state: MushroomSquashState): number;

/** The dip for `(col, row)`, or 0 when that cap is not squashing. */
export function mushroomSquashDipAt(
  states: readonly MushroomSquashState[],
  col: number,
  row: number,
): number;
```

Invariants (asserted by `MushroomSquash.test.ts`):

1. `startMushroomSquash` never mutates its input and never leaves two entries
   for the same cell.
2. `advanceMushroomSquashes` is monotonic in `elapsed`, returns `[]` for an
   empty input, and drops an entry exactly when `elapsed >= DURATION`.
3. `mushroomSquashDip` is `DIP` at `elapsed = 0`, `0` at/after `DURATION`, and
   never negative.
4. No function throws; `dt <= 0` leaves entries unchanged (but still prunes any
   already-expired ones).

## `PlatformerState.ts` — the signal and its lifetime

```ts
export const mushroomSquashStates = signal<MushroomSquashState[]>([]);

export function tickMushroomSquashes(dt: number): void {
  mushroomSquashStates.value = advanceMushroomSquashes(mushroomSquashStates.value, dt);
}
```

- `resetGame()` (death/respawn) sets `mushroomSquashStates.value = []` — an
  in-progress dip is cleared (FR-015, edge case "Death and respawn").
- `resetGameProgress()` inherits that clear via `resetGame()`.
- Mushrooms themselves have no state to reset: they were never destructible.

## `PlatformerPage.tsx` — tick wiring

1. In the `playing` branch, call `tickMushroomSquashes(dt)` alongside
   `tickDarkness(dt)`/`tickDeployableLadders(dt)` (freezes with the world
   during pause/death).
2. Hoist the block-bounce variable out of the `hitBlocks` block so the
   mushroom can join it:

```ts
let bounceVelocity: number | undefined; // declared before the block loop
// ...block loop sets bounceVelocity via strongerBounce(...)...

const cap = playerOnMushroomCap(activeLevel.value, next);
if (cap) {
  bounceVelocity = strongerBounce(bounceVelocity, PHYSICS_CONFIG.mushroomBounceVelocity);
}
if (bounceVelocity !== undefined) {
  next = { ...next, vy: bounceVelocity, bounceAscending: true };
}
if (cap) {
  mushroomSquashStates.value = startMushroomSquash(mushroomSquashStates.value, cap.col, cap.row);
}
```

- Applied to `next` (not `playerState.value`) before the pit-fall check and
  anim-state update, exactly where the pot bounce is applied today.
- `bounceAscending: true` protects the impulse from the next tick's
  variable-jump-height cut.
- A same-tick pot landing and mushroom landing resolve to one impulse — the
  more negative of the two — never a sum (FR-009).
- The squash is started whenever a cap is contacted, independent of the
  aggregation, so the cap always reacts to a real landing.

## Tests

- `engine/MushroomSquash.test.ts` — start/replace, advance/prune, dip curve,
  immutability, `dt <= 0`.
- `engine/Physics.test.ts` — `playerOnMushroomCap` returns the cell for a
  grounded player centred on an open-sky cap, `null` when airborne, off the
  cap's column, on a covered cap, or on a stem cell.
- `PlatformerPage.test.tsx` — falling onto a cap sets `vy` to
  `PHYSICS_CONFIG.mushroomBounceVelocity` with `bounceAscending: true` and
  starts a squash; walking through the side/stem and rising through the cap do
  neither; a second landing bounces identically; a death clears the squash;
  Reset Game clears it too.
