# Phase 1 Data Model: Platformer Bombs

This feature adds **three new stored values** (a carried count, a list of placed
bombs, a list of dropped bomb pickups) plus one new transient visual effect list
and one new pot kind. Everything else — the blast area, the target sets, the
current fuse frame — is **derived** each tick from those values plus the existing
level/block/enemy/player state.

## Entity: Bomb pot (`BlockKind = 'bombPot'`)

The blue bottle pot — the third pot kind. A value in `BLOCK_TYPES`, a solid
tile-aligned block, never a stored instance beyond `BlockState`.

| Field | Type | Rules |
| --- | --- | --- |
| key | `'bombPot'` | Must equal its `BLOCK_TYPES` slot. |
| sprite | `WORLD_TILESET_SHEET`, renderScale 1 | Fixed blue bottle, `world_tileset.png` frame 128 (row 8, col 0). |
| drop | `'bomb'` | A `PickupKind` (`PICKUP_TYPES.bomb`). |
| dropPolicy | `'everyBreak'` | Drops a bomb on every break, including after a respawn (FR-003). |
| restoredOnRespawn | `true` | A death/respawn rebuilds it intact (FR-029). |
| maxHits | `1` | Inherited from `createPotType`; land-on-top trigger, shared bounce/puff. |
| triggerSides | `['top']` | Inherited. |
| marker | `b` | `ENTITY_CHARS['b'] = 'bombPot'`; also in `TileChar`. |

**Validation**:
- `bombPot` MUST be registered in `BLOCK_TYPES`; the existing `index.test.ts`
  key/slot check covers it.
- `b` MUST appear in `ENTITY_CHARS` and `TileChar`; the map/`TileChar` sync test
  covers the latter.
- `b` MUST NOT collide with any `TERRAIN_CHARS`/`SIGN_CHARS`/`HAZARD_CHARS` key
  (the module-load guard would throw).
- A `bombPot` carries no `fact` (`BlockDef.fact` absent), like coinPot/potionPot.

## Entity: Bomb pickup (`PickupKind = 'bomb'`)

A collectible dropped by a broken bomb pot. No CV fact, no journal counter
(FR-011).

```ts
export interface BombPickupState {
  id: string;   // the source pot's block id (cleared on respawn, so reuse is safe)
  x: number;    // world px, the pot's tile top-left at break time
  y: number;
}
```

| Field | Type | Rules |
| --- | --- | --- |
| sprite | `BOMB_SHEET` (`bomb.png`), frame 0 | The unlit bomb; also the HUD icon (FR-004). |
| rendered size | `BOMB_PICKUP_RENDERED_SIZE` | Smaller than a tile, centred in its tile (heart convention). |
| bob | `coinBobOffset(elapsed)` | Bobs exactly like the heart/coin; collision ignores the bob (FR-009). |
| collection | count `< MAX_BOMBS` | At the cap the pickup is left in the world, still bobbing. |

**Validation**:
- `PickupKind` gains `'bomb'` automatically by registering `bomb` in
  `PICKUP_TYPES`; the registry sync test covers it.
- A bomb pickup MUST NOT be added to `allCollectiblePlacements` or any
  fact-bearing array.

## Value: Carried bomb count

```ts
export const MAX_BOMBS = 5;
export const carriedBombs = signal<number>(0);
```

| Rule | Source |
| --- | --- |
| Collecting increments by one while `< MAX_BOMBS`. | FR-007 |
| Never exceeds `MAX_BOMBS`; a pickup at the cap stays in the world. | FR-008/FR-009 |
| Placing consumes exactly one; a no-op consumes none. | FR-013/FR-014 |
| Death/respawn resets to `0`. | FR-028 |
| HUD group hidden at `0`, shown at `>= 1`. | FR-010 |

## Entity: Placed bomb

```ts
export interface PlacedBombState {
  id: string;                 // unique per placement, e.g. `bomb-${col}-${row}-${seq}`
  x: number;                  // world px, tile top-left
  y: number;                  // world px, current (falls under gravity)
  vy: number;                 // px/s, positive down
  col: number;                // placement tile column (fixed)
  row: number;                // placement tile row (fixed; fuse/rest reference)
  landingRow: number | null;  // resting row, or null when the column has no floor
  fuseElapsed: number;        // seconds; always advances, even while falling
  landed: boolean;
}
```

**Validation / rules**:
- Non-solid: never written into `blockPlacements`; the player never collides with
  it (FR-015).
- Does not bob (FR-015).
- `landingRow` is computed once at placement from the current level + live blocks;
  a `bridge` is a floor, a `ladder` is not (FR-015).
- `landingRow === null` → the bomb falls out of the level and is removed without
  exploding (FR-015).
- Detonates when `fuseElapsed >= BOMB_FUSE_SECONDS` (~2 s, FR-016), regardless of
  whether it is still falling.
- A blast never detonates, removes or otherwise affects another placed bomb
  (FR-025/FR-026).

**Derived**: `bombFuseFrame(fuseElapsed)` → `{ frame, scale }` over the fixed
sequence `[1,2,3,4,5,4,5,4,5]`, `scale = 1.25` on frame 5 (FR-017). Frame 0 is
never drawn on a placed bomb.

## Entity: Explosion effect (transient visual)

```ts
export interface ExplosionEffect {
  id: string;      // the detonated bomb's id
  x: number;       // world px, bomb tile centre
  y: number;
  elapsed: number; // seconds since detonation
}
```

| Rule | Source |
| --- | --- |
| Frames play once, in order, then the effect is dropped. | FR-023 |
| Purely cosmetic — it is never a hazard and has no collision. | FR-023 |
| Drawn from `EXPLOSION_SHEET` at `renderScale 2` (48 px × 2 = 96 px = 3 tiles). | Visual Assets |
| Cleared on `resetGameProgress()`. | FR-027 analog |

## Derived: Blast area and targets

```ts
export interface BlastTile { col: number; row: number; }

blastTiles(col, row, width, height): BlastTile[]          // 3x3 clipped to bounds (FR-018)
blocksInBlast(blocks, tiles): BlockState[]                 // live + removeWhenUsedUp (FR-019)
enemiesInBlast(enemies, tiles, tileSize): EnemyState[]     // live + box overlap (FR-020)
playerInBlast(playerBox, tiles, tileSize): boolean         // hitbox overlap (FR-021)
```

**Excluded by construction**: terrain, static objects (FR-022), loose pickups
(FR-033), and every placed bomb (FR-025) — none are ever enumerated.

## State transitions

### Placement (FR-012/FR-013/FR-014)

```
B pressed
├─ carriedBombs == 0            → nothing placed; show "no bombs" bubble
├─ tile already holds a bomb    → nothing placed; nothing consumed
└─ carriedBombs >= 1, tile free → append PlacedBombState; carriedBombs -= 1
```

### Placed bomb lifecycle (FR-015/FR-016/FR-023)

```
placed (fuseElapsed = 0)
  │  each tick: fuseElapsed += dt; fall toward landingRow (or fall out)
  ├─ fuseElapsed >= BOMB_FUSE_SECONDS  → DETONATE:
  │      • resolve blast once (blocks destroyed, enemies defeated, player damaged)
  │      • append ExplosionEffect; remove the PlacedBombState
  │      • never affect another placed bomb
  └─ y past level bottom (landingRow == null) → remove, no explosion
```

### Death / respawn (`resetGame`) (FR-027/FR-028/FR-029)

```
placedBombs      := []
carriedBombs     := 0
bombPickupStates := []
bomb pots        := rebuilt intact by the existing restoredOnRespawn path
```

`resetGameProgress()` additionally clears `activeExplosions` (inherits the rest
via `resetGame()`).

## Marker and i18n additions

| Addition | Location | Value |
| --- | --- | --- |
| Entity marker | `ENTITY_CHARS`, `EntityKind`, `TileChar` | `b` → `bombPot` |
| Sign digit | `SIGN_CHARS`, `TileChar` | `6` → `bomb` |
| Sign sprite | `paletteTiles.ts` | `world_tileset.png` row 3 col 8 (sx 128 / sy 48) |
| Hint string | `en.json`/`de.json` `platformer.hints.bomb` | names the `B` key |
| Bubble string | `en.json`/`de.json` `platformer.hints.noBombs` | "no bombs" bubble |
| Palette entry | `paletteTiles.ts` | `b` "Bomb Pot" (blue bottle) |
| Sprite sheets | `entities/sprites/sheets.ts` | `BOMB_SHEET`, `EXPLOSION_SHEET` |

## Invariants

1. `carriedBombs` is always an integer in `[0, MAX_BOMBS]`.
2. `placedBombs` and `activeExplosions` are empty after a death/respawn.
3. `blastTiles` always contains between 1 and 9 cells, all in bounds.
4. A blast never mutates `placedBombs`.
5. A placed bomb is never present in `blockPlacements` and never blocks physics.
6. `bombFuseFrame(0).frame === 1` and the last segment's frame is `5`.
