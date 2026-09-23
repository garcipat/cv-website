# Contract: the player's one reduced collision box

SC-008 requires that while crouched **every** check that reads the player's box
sees the one-tile height, and that the standing height is never used. This
contract fixes the single source of truth for that box and enumerates every
consumer so the guarantee is verifiable by grep, not by convention.

## Source of truth (`entities/Player.ts`)

```ts
export const PLAYER_CROUCH_BOX_HEIGHT = RENDERED_TILE_SIZE; // 32

/** Box top offset from the render slot's `y`. */
export function playerHeadPaddingFor(crouching: boolean): number {
  return crouching
    ? PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - PLAYER_CROUCH_BOX_HEIGHT // 24
    : PLAYER_HEAD_PADDING;                                                 // 18
}

/** Box height. */
export function playerBoxHeightFor(crouching: boolean): number {
  return crouching
    ? PLAYER_CROUCH_BOX_HEIGHT                                             // 32
    : PLAYER_RENDERED_SIZE - PLAYER_HEAD_PADDING - PLAYER_FOOT_PADDING;    // 38
}
```

The feet line `player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING` is
**unchanged** by crouch and stays a plain expression everywhere (spec
Assumption: the feet do not move).

## `Collision.playerHitbox`

```ts
export function playerHitbox(player: PlayerState): Box {
  return {
    x: player.x + PLAYER_SIDE_PADDING,
    y: player.y + playerHeadPaddingFor(player.crouching),
    width: PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING,
    height: playerBoxHeightFor(player.crouching),
  };
}
```

`Physics.ts` computes its horizontal `topRow`, its ceiling `headY` and its
horizontal-scan span from the same two helpers (using the tick's *resolved*
`crouching`), and leaves its feet/`bottomRow`/`HITBOX_WIDTH` expressions as
they are. `DebugOverlay.ts` draws its head line at
`playerHeadPaddingFor(player.crouching)`.

## Consumers that MUST see the crouched height

All of these already funnel through `playerHitbox` (directly or via
`overlappingTriggers`/`resolveEnemyContacts`/`resolveHazardContacts`), so the
single edit covers them; this list is the review checklist.

| Consumer | Entry point | File |
| --- | --- | --- |
| Terrain horizontal/ceiling/ground collision | `stepPlayerPhysics` (own box arithmetic) | `engine/Physics.ts` |
| Collectible / coin / fruit overlap | `checkCollectibleCollisions` → `overlappingTriggers` | `engine/Collision.ts` |
| Bonus fruit overlap | `checkBonusFruitCollisions` | `engine/Collision.ts` |
| Chest stand-on | `chestPlayerIsStandingOn` | `engine/Collision.ts` |
| Sign overlap | `checkSignOverlap` | `engine/Collision.ts` |
| Key / heart / bomb pickup overlap | `checkKeyPickupCollisions`, `checkHeartPickupCollisions`, `checkBombPickupCollisions` | `engine/Collision.ts` |
| Enemy contact + stomp detection | `resolveEnemyContacts` (`playerBox`, `landsOnUpperHalf`) | `engine/Collision.ts` |
| Hazard contact | `resolveHazardContacts` (`playerBox`, `isContact`) | `engine/Collision.ts` |
| Floor-spike arm trigger | `checkFloorSpikeTriggers` → `overlappingTriggers` | `engine/Collision.ts` |
| Bomb blast | `playerInBlast(playerHitbox(next), …)` | `PlatformerPage.tsx` / `engine/Blast.ts` |
| Debug hitbox overlay | head line / box | `engine/DebugOverlay.ts` |

Not a consumer: `Camera.ts` frames the player with `PLAYER_RENDERED_SIZE`
(the full render slot), deliberately unchanged (spec Out of Scope: no camera
change). `movementCtx.player` in `PlatformerPage.tsx` also passes
`PLAYER_RENDERED_SIZE` to enemy proximity strategies — deliberately unchanged
(enemy behavior is out of scope, FR-014).

## Invariants (asserted by `Collision.test.ts` / `Physics.test.ts`)

1. `playerHitbox` height is 38 and top is `y + 18` for `crouching: false`; it is
   32 and top is `y + 24` for `crouching: true`; `x`/`width` are identical in
   both.
2. The crouched box's feet line equals the standing box's feet line for the same
   `y`.
3. A trigger/pickup that the standing box overlaps and the crouched box does not
   (e.g. a coin in the head band) is collected standing and missed crouched —
   proving `overlappingTriggers` reads the crouched box.
4. `resolveEnemyContacts` uses the crouched box for `landsOnUpperHalf`/stomp
   geometry.
5. `resolveHazardContacts` uses the crouched box for its broad phase.
6. `playerInBlast(playerHitbox(crouchedPlayer), …)` is false where the standing
   box would be true (a blast tile reachable only by the taller box).
7. No consumer listed above still reads `PLAYER_HEAD_PADDING` directly for the
   player's box (grep-level check; `PlatformerPage.tsx`'s hint-bubble anchor
   and the spear feet burst are render/effect anchors, not collision boxes, and
   may stay on the render constants).
