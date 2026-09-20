# Contract: `engine/Blast.ts` (pure rounded 5×5 blast area and target selection)

A **pure, canvas-free, DOM-free** module: it decides *what* a detonation affects,
never *how* the effects are applied (that stays in `PlatformerPage.tsx`, reusing
the game's existing pipelines). Unit-testable with Vitest.

## Types

```ts
export interface BlastTile {
  col: number;
  row: number;
}
```

## Functions

### `blastTiles(col, row, width, height): BlastTile[]`

- Returns the rounded 5×5 block of cells centred on `(col, row)` — columns
  `col - 2 … col + 2`, rows `row - 2 … row + 2`, minus the four corner tiles
  (`(±2, ±2)`) — clipped to `0 <= c < width`, `0 <= r < height` (FR-018).
- Between 1 and 21 tiles; never empty; never out of bounds.
- Pure; no side effects.

### `blocksInBlast(blocks, tiles): BlockState[]`

- Returns every block in `blocks` whose tile (`Math.round(x / RENDERED_TILE_SIZE)`,
  `Math.round(y / RENDERED_TILE_SIZE)`) is in `tiles` **and** whose kind is
  destructible.
- Destructible = `BLOCK_TYPES[block.blockKind].removeWhenUsedUp === true`
  (crate, fragileRock, coinPot, potionPot, bombPot).
- Excludes already-used-up blocks (`isBlockUsedUp`) and question-mark blocks
  (which never leave the world) — a blast leaves them untouched (FR-022).
- The blast reaches through intervening blocks; no line-of-sight test (FR-024).

### `enemiesInBlast(enemies, tiles, tileSize): EnemyState[]`

- Returns every `alive` enemy whose `typeOf(enemy).box(enemy)` overlaps any blast
  tile's rect (`col * tileSize`, `row * tileSize`, `tileSize`, `tileSize`).
- Overlap is AABB intersection; an enemy straddling the boundary of the area
  counts if any part of its hitbox overlaps (FR-020).

### `playerInBlast(playerBox, tiles, tileSize): boolean`

- Whether the player's hitbox (the caller passes `playerHitbox(player)` from
  `Collision.ts`) overlaps any blast tile (FR-021).

## Applying the results (`PlatformerPage.tsx`)

The module only selects; the page applies, once, at detonation:

- **Blocks** — drive each block to its terminal hit (`applyBlockHit` until
  `isBlockUsedUp`), then run the shared terminal-outcome helper (facts revealed,
  pickups spawned, counter popups, puff) so the result is identical to a normal
  destruction (FR-019).
- **Enemies** — mark each as defeated (`hitPoints: 0`, `alive: false`) so the
  existing `justDefeated` pipeline pays its reward, drops its item and puffs it,
  exactly as a stomp does (FR-020).
- **Player** — if `playerInBlast` and `!isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)`,
  `takeDamage(player.hitPoints, 2)` then `beginHitReaction(player)`, plus a
  player hit splatter (FR-021, SC-007). At most one blast's damage lands per
  invincibility window even when two blasts overlap in one tick.
- **Explosion visual** — append an `ExplosionEffect` (FR-023).
- **Placed bombs** are never passed in, so a blast cannot detonate or remove
  another bomb (FR-025/FR-026).
- **Loose pickups** are never passed in, so coins/hearts/keys/fruits/bombs lying
  in the area are untouched (FR-033).

## Invariants (asserted by `Blast.test.ts`)

1. `blastTiles` always returns 1–21 in-bounds, distinct tiles, and the full 21
   when the centre is at least two tiles from every edge (the four corners are
   always cut).
2. `blocksInBlast` includes only live, `removeWhenUsedUp` blocks; a
   question-mark, terrain and a used-up block are excluded.
3. `enemiesInBlast` includes an enemy whose box overlaps any blast tile and
   excludes a dead enemy and one whose box is entirely outside.
4. `playerInBlast` is true for a hitbox overlapping any tile and false when it is
   entirely outside.
5. No function mutates its arguments.
