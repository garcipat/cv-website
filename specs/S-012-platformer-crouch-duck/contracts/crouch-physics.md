# Contract: `engine/Crouch.ts` + `stepPlayerPhysics` crouch integration

The crouch decision is a **pure, canvas-free, DOM-free module** — mirroring
`engine/Lighting.ts`, `engine/Torch.ts` and `level/Terrain.ts` — so it is fully
unit-testable with Vitest and no DOM (constitution Principle II;
[docs/TestingGuide.md](../../../docs/TestingGuide.md)). It imports only types,
the player geometry helpers, the tile predicates and the block-occupancy
lookup; never React, canvas or signals.

## Types

```ts
import type { LevelDef } from '../level/LevelData';
import type { BlockPlacement } from '../level/BlockMapper';
import type { PlayerState } from '../entities/Player';

export interface CrouchContext {
  /** Down/`S` is held this tick (`PlayerInput.dropThroughHeld`). */
  downHeld: boolean;
  /** The player was grounded at the start of the tick. */
  grounded: boolean;
  /** The player's `crouching` from the previous tick. */
  currentlyCrouching: boolean;
  /** Down is consumed by a higher-priority context (climbing, or grounded on a bridge). */
  downClaimed: boolean;
  /** `canStandUp(...)`: the full standing box fits in clear space. */
  canStand: boolean;
  /** The post-hit refractory window is open. */
  inHitReaction: boolean;
}
```

## Functions

### `canStandUp(level: LevelDef, blocks: readonly BlockPlacement[], player: PlayerState): boolean`

- Computes the **standing** box: top `player.y + playerHeadPaddingFor(false)`,
  height `playerBoxHeightFor(false)` (38), left/right from
  `PLAYER_SIDE_PADDING` and `PLAYER_RENDERED_SIZE`.
- Spans columns `floor((x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE)` …
  `floor((x + PLAYER_SIDE_PADDING + (PLAYER_RENDERED_SIZE - 2*PLAYER_SIDE_PADDING) - 1) / RENDERED_TILE_SIZE)`
  and rows `floor(top / RENDERED_TILE_SIZE)` …
  `floor((player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE)`.
- Returns `false` if any spanned cell satisfies
  `isSolid(tileAt(level, col, row))` or `isBlockOccupied(blocks, col, row)`.
- Returns `true` otherwise (including in open air).
- Never throws; out-of-bounds reads resolve to `'empty'` via `tileAt`.
- `bridge` counts as an obstruction (`isSolid`).

### `resolveCrouching(ctx: CrouchContext): boolean`

```
if (ctx.inHitReaction) return ctx.currentlyCrouching;         // FR-011 freeze
const requested =
  ctx.downHeld && (ctx.grounded || ctx.currentlyCrouching) && !ctx.downClaimed;
return requested || (!ctx.canStand && ctx.currentlyCrouching); // FR-001/005/006/010
```

- `!canStand` only *keeps* an existing crouch; it never starts one (a crouch is
  always entered via Down, FR-001).
- Pure; returns a boolean; never throws; no side effects.

## Crouched directional hits (`applyHitReactionWithoutKnockback`) — FR-011

A directional hit taken while crouched still deals damage, opens the
invulnerability window and shows the red reaction, but applies **no knockback**
(horizontal or vertical), and the one-tile box is kept for the whole reaction
(FR-011, SC-009). Damage itself is unchanged and still applied by the caller
(`takeDamage`); this helper only shapes the reaction state.

### `applyHitReactionWithoutKnockback(player: PlayerState): PlayerState` (`entities/Player.ts`)

```ts
return { ...player, hitTimer: 0, animState: 'hit', animFrame: 0, animTimer: 0 };
```

- Sets `hitTimer` to 0, which both opens the refractory window
  (`isInvulnerable` reads `hitTimer < PLAYER_HIT_REACTION_SECONDS`) and, through
  `resolveCrouching`'s `inHitReaction` freeze, keeps `crouching` true for the
  whole window.
- Sets `animState: 'hit'` so the sticky-hit derivation and
  `PlatformerPage.tsx`'s `playerVisible` rule still treat it as a visible red
  reaction. The *drawn* pose is the crouch pose, tinted — see
  [rendering-animation.md](./rendering-animation.md) and
  [crouched-hit-reaction.md](./crouched-hit-reaction.md).
- **Does not touch** `vx`, `direction`, `knockbackTimer`, `vy` or
  `bounceAscending` — no knockback of either axis, and no facing change.
- Pure; never throws; no side effects.

### Call sites (`PlatformerPage.tsx`)

Branch on `player.crouching`; the standing path is unchanged.

| Site | Standing (unchanged) | Crouched (new) |
| --- | --- | --- |
| Enemy contact (~L1741) | `applyKnockback(...)`, then `awayAndUp` sets `vy` + `bounceAscending` | `applyHitReactionWithoutKnockback(...)`; **skip** the `awayAndUp` `vy` |
| Non-floor-spike hazard (~L1819) | `applyKnockback(...)` | `applyHitReactionWithoutKnockback(...)` |
| Bomb blast (~L2163) | `applyKnockback(...)` | `applyHitReactionWithoutKnockback(...)` |

- The floor-spike hazard keeps `beginHitReaction` in both cases: it is already
  knockback-free and blink-only (no red `hit` pose), and FR-014 forbids
  changing existing mechanics beyond the smaller box and the suppressed
  knockback of FR-011.
- `stepPlayerPhysics` still runs after the hit: with `knockbackTimer` left at 0,
  held crawl input drives `crouchSpeed` as usual; gravity and ground/ceiling
  collision continue, so the character is never displaced by the hit itself.

## `stepPlayerPhysics` integration

1. **Early (before horizontal collision)**, compute the pre-step `downClaimed`
   from the *existing* context checks against `player.x`/`player.y`:
   - `player.climbing`, **or** the feet row is climbable in any hitbox column,
     **or** `player.grounded` and the row below the feet is climbable in any
     hitbox column;
   - **or** `player.grounded` and the standing foot row holds a `bridge` under
     any hitbox column.
2. Call `canStandUp(activeLevel, blockPlacements, player)` and
   `isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)`, then
   `resolveCrouching(...)` to get this tick's `crouching`.
3. Use `crouching` for:
   - the horizontal scan's `topRow` (`player.y + playerHeadPaddingFor(crouching)`);
   - the ceiling check's `headY` (`player.y + playerHeadPaddingFor(crouching)`);
   - the input-driven horizontal speed
     (`crouching ? PHYSICS_CONFIG.crouchSpeed : PHYSICS_CONFIG.walkSpeed`);
   - the jump trigger (`&& !crouching`).
   The feet row, `bottomRow`, `HITBOX_WIDTH`, world bounds, ground collision,
   `prevFeetY`, `lastGroundedX/Y`, `isDroppingThroughBridge` and `bounceAscending`
   are **unchanged**.
4. Write `crouching` on the normal return, and force `crouching: false` on the
   climbing and climb-exit early returns (Down there is ladder descent, FR-009).
5. The existing ladder and bridge branches run **completely unchanged** after
   the crouch decision, so S-008 timing/priority is preserved (SC-003).

## `PHYSICS_CONFIG.crouchSpeed`

- New field, `120` px/s. Tunneling invariant:
  `crouchSpeed * MAX_DT = 120 * (1/30) = 4 < RENDERED_TILE_SIZE (32)`. ✓
- Knockback (`knockbackActive`) still overrides the input-driven speed.

## Invariants (asserted by `Crouch.test.ts` / `Physics.test.ts`)

1. `canStandUp` is `false` when the standing box (38 px) overlaps the ceiling of
   a one-tile-high corridor, and `true` when the character is in open air.
2. `canStandUp` is `false` when a live block overlaps the standing box.
3. `resolveCrouching` never returns `true` for a fresh airborne entry
   (`downHeld && !grounded && !currentlyCrouching && canStand`).
4. `resolveCrouching` returns `currentlyCrouching` unchanged while
   `inHitReaction` is true, for both `true` and `false` inputs.
5. `resolveCrouching` ignores a held Down when `downClaimed` is true, unless
   `!canStand` (a stuck crouch stays crouched).
6. `resolveCrouching` returns `true` while `!canStand` and `currentlyCrouching`
   (a stuck crouch persists with Down released), but never returns `true` for a
   non-crouched player (`currentlyCrouching: false`) even when `canStand` is
   false.
7. With Down held, no `jumpPressed` produces a jump while crouched.
8. Horizontal speed while crouched equals `PHYSICS_CONFIG.crouchSpeed` in both
   directions; while standing it equals `walkSpeed`.
9. Holding Down on a ladder/bridge tile leaves `crouching` false and produces
   the same ladder/bridge behaviour as before the feature.
10. Every `stepPlayerPhysics` return path sets `crouching` explicitly (no stale
    carry-over), and the climbing returns set it `false`.
11. `applyHitReactionWithoutKnockback` returns `hitTimer: 0`, `animState:
    'hit'`, `animFrame: 0`, `animTimer: 0`, and leaves `vx`, `direction`,
    `knockbackTimer`, `vy` and `bounceAscending` identical to the input
    (FR-011).
12. After a crouched directional hit, `isInvulnerable(result,
    PLAYER_HIT_REACTION_SECONDS)` is true and `resolveCrouching` returns the
    pre-hit `crouching` value, so the one-tile box is kept for the whole
    window.
13. A crouched `awayAndUp` enemy contact does not set `vy`/`bounceAscending`
    (no vertical knockback); a standing one still does (SC-009: the standing
    hit reaction is unchanged).
