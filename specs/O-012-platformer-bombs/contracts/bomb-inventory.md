# Contract: Bomb pickup, carry cap, HUD and placement input

Covers the carried-bomb inventory and the `B` place-bomb input.

## `entities/BombPickup.ts` (state + constants)

```ts
export const BOMB_PICKUP_RENDERED_SIZE = 24;                 // like the heart pickup
export const BOMB_PICKUP_TILE_OFFSET_X = (RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2;
export const BOMB_PICKUP_TILE_OFFSET_Y = (RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2;

export interface BombPickupState {
  id: string;
  x: number;
  y: number;
}

export function spawnBombPickup(id: string, x: number, y: number): BombPickupState;
```

## `entities/pickups/Bomb.ts` (the `PickupType` view)

```ts
export const bomb: PickupType<BombPickupState> = {
  key: 'bomb',
  sprite: { sheet: BOMB_SHEET, renderScale: 1, animations: {} },
  box: (p) => ({ x: p.x + BOMB_PICKUP_TILE_OFFSET_X, y: p.y + BOMB_PICKUP_TILE_OFFSET_Y,
                 width: BOMB_PICKUP_RENDERED_SIZE, height: BOMB_PICKUP_RENDERED_SIZE }),
  frameIndex: () => 0,                          // bomb.png frame 0 (unlit)
  bobOffset: (_p, elapsed) => coinBobOffset(elapsed),
  draw: (p, dc) => { /* blit BOMB_SHEET frame 0 at the box, offset by bob */ },
};
```

Register `bomb` in `PICKUP_TYPES`; `PickupKind` then includes `'bomb'`. The
sheet is discovered and loaded by the existing registry walk in
`PlatformerPage.tsx` — no separate load call is needed.

## `engine/Collision.ts`

```ts
export function checkBombPickupCollisions(
  player: PlayerState,
  bombs: readonly BombPickupState[],
  count: number,
  cap: number,
): string[];
```

- Returns the ids of bomb pickups overlapping `playerHitbox(player)`, **limited
  to `max(0, cap - count)`** ids in array order, so a tick that touches several
  pickups at once can never overfill the inventory (FR-008/FR-009).
- At the cap (`count >= cap`) returns `[]` — the pickups stay in the world.
- Uses the same `overlappingTriggers`/`aabbOverlap` helpers as the heart/key
  checks; `bobOffset` is a draw-only offset, so collision ignores it.

## `PlatformerState.ts`

```ts
export const MAX_BOMBS = 5;
export const carriedBombs = signal<number>(0);
export const bombPickupStates = signal<BombPickupState[]>([]);
export const placedBombs = signal<PlacedBombState[]>([]);
export const activeExplosions = signal<ExplosionEffect[]>([]);
```

## `engine/Input.ts`

`GAME_KEYS` gains `'KeyB'` so its browser default is suppressed. No other change.

## Placement rules (`PlatformerPage.tsx`, once per tick)

```ts
const placeBombPressed = input.consumePress('KeyB');
```

If pressed, compute the placement tile from the player's horizontal centre and
feet row, then:

| Condition | Effect |
| --- | --- |
| `carriedBombs === 0` | Nothing placed; start a transient `noBombs` bubble (FR-014). |
| A placed bomb already occupies the tile | Nothing placed; nothing consumed; no bubble (FR-014). |
| `carriedBombs >= 1` and tile free | Append a `PlacedBombState` at that tile; `carriedBombs -= 1` (FR-013). |

## HUD (`engine/Renderer.ts`)

```ts
export function drawBombCounter(
  ctx, bombSprite: HTMLImageElement, count: number, x: number, y: number,
): void;

export function bombCounterX(
  ctx, chestCollected: number, chestTotal: number, keyCount: number,
): number;
```

- `drawBombCounter` draws the `bomb.png` frame-0 icon plus `${count}`, styled like
  `drawKeyCounter` (no `/ total`).
- Called only when `carriedBombs.value > 0`; at 0 the group is hidden (FR-010).
- `bombCounterX` starts at `keyCounterX(...)` and adds the key counter's measured
  width plus `HUD_GROUP_GAP` **only when `keyCount > 0`** (the key counter is
  itself hidden at 0), so the HUD rhythm is exact in both states.

## Guarantees

- A bomb contributes no CV fact and no journal counter (FR-011).
- The controls overlay is unchanged — no bomb keycap/caption (FR-012).
- Placement is rejected (silently) on an occupied tile (FR-014, SC-003).

## Invariants

1. `carriedBombs` is always in `[0, MAX_BOMBS]`.
2. A pickup at the cap is never consumed.
3. Pressing `B` with an empty inventory consumes nothing and places nothing.
4. `bombCounterX` is strictly to the right of the key counter and separated by
   `HUD_GROUP_GAP` whether or not keys are shown.
