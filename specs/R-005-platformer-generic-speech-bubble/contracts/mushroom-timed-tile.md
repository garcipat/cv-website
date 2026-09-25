# Contract: Mushroom Home & Grid-Cell-Keyed Squash Timed Tile

**Feature**: R-005 | **Module home**: `src/themes/platformer/entities/blocks/Mushroom.ts`

The bouncy-mushroom cap dip is a purely cosmetic, **grid-cell-keyed timed tile**, not an effect. It is
relocated from the standalone `engine/MushroomSquash.ts` into the mushroom's own home, together with
the mushroom-specific cap-role art helpers moved out of `engine/StaticObjectsCatalog.ts`. It is **not**
registered in the transient effect registry (see [`speech-bubble-kind.md`](./speech-bubble-kind.md)
for the one kind R-005 adds).

---

## Payload & constants

```ts
export interface MushroomSquashState {
  col: number;
  row: number;
  elapsed: number;   // seconds since the bounce
}

export const MUSHROOM_SQUASH_DURATION_SECONDS = 0.1;
export const MUSHROOM_SQUASH_DIP_PX = 2;
```

`elapsed` stays **inside** the state (it is a timed tile, not a `TransientEffect`): arm/advance/prune
delegate to `shared/timedTile.ts` with `keyOf = { col, row }`, `duration = 0.1`, `prune: true`,
`rearm: 'replace'`.

## API

```ts
export function startMushroomSquash(
  states: readonly MushroomSquashState[],
  col: number,
  row: number,
): MushroomSquashState[];
// an in-progress entry for the cell is restarted (replace), never queued

export function advanceMushroomSquashes(
  states: readonly MushroomSquashState[],
  dt: number,
): MushroomSquashState[];
// dt <= 0 leaves elapsed unchanged but still drops an already-expired entry;
// prune at elapsed >= duration

export function mushroomSquashDip(state: MushroomSquashState): number;
export function mushroomSquashDipAt(
  states: readonly MushroomSquashState[],
  col: number,
  row: number,
): number;
```

## Moved cap-role art helpers

```ts
/** The native-pixel crop of a mushroom art cell (structural, local type —
 *  the catalog's StaticObjectEntry lives in engine/ and is not imported here). */
export interface MushroomSprite {
  sx: number;
  sy: number;
}

export function mushroomEntry(role: VerticalRunRole): MushroomSprite;
export function mushroomHasCap(role: VerticalRunRole): boolean;
export const MUSHROOM_CAP_SOURCE_HEIGHT = 11;
export const MUSHROOM_DECORATIVE_ENTRY: MushroomSprite;
```

`VerticalRunRole` stays in `level/Terrain.ts` (the generic run classifier, shared with bushes) and is
imported here — `entities/ → level/` is an allowed direction. The generic
`verticalRunRole` function itself is **not** moved.

## Consumers (unchanged behaviour, retargeted imports)

| Consumer | Uses | Edge |
| --- | --- | --- |
| `PlatformerState.ts` | `advanceMushroomSquashes`, `MushroomSquashState` (keeps `mushroomSquashStates` + `tickMushroomSquashes`) | `state/ → entities/` (allowed) |
| `PlatformerPage.tsx` | `startMushroomSquash` at the cap-landing site | `app → entities/` (allowed) |
| `engine/Renderer.ts` | `mushroomSquashDipAt`, `MushroomSquashState`, `mushroomEntry`, `mushroomHasCap`, `MUSHROOM_CAP_SOURCE_HEIGHT`, `MUSHROOM_DECORATIVE_ENTRY` | `engine/ → entities/` (allowed) |

## Behavioural guarantees

1. **Independent per cell** — multiple caps squash at once; a re-bounce replaces only that cell's entry
   (FR-010/US3-3).
2. **Timing** — duration `0.1s`; prune at `elapsed >= duration` (not strictly greater); a
   zero-or-negative `dt` leaves `elapsed` unchanged but still drops an already-expired entry (FR-011).
3. **Dip** — `DIP * (1 - clamp01(elapsed / 0.1))`, max `2` rendered px (FR-011).
4. **Terrain consumption** — `drawTerrain` reads the dip through `mushroomSquashDipAt` from the same
   state array the state layer advances; no parallel store exists (FR-012/SC-002).
5. **Pixel identity** — the cap/stem split rendering is unchanged; the module invents no cap renderer
   (FR-012/SC-005).
6. **Advance** — through the existing `tickMushroomSquashes(dt)` call in the `playing` branch; no
   `advanceEffects` involvement (FR-010).
7. **Reset** — cleared by `resetGame()`'s existing `mushroomSquashStates.value = []` (FR-013); the
   effect reset scopes do not touch it.
8. **No registry involvement** — no `mushroomSquash` kind; the effect registry, `EffectKind`,
   `advanceEffects` and `drawEffects` are all untouched by this move (FR-010/FR-014/FR-015).

## Invariants

- `engine/MushroomSquash.ts`, `engine/MushroomSquash.test.ts`, and the old standalone module path are
  deleted with no alias or second path (FR-017/SC-002).
- `shared/timedTile.ts` and its other consumers (floor spike, crumbling floor, falling stalactite) are
  untouched; the squash keeps using it exactly as today.
- `engine/StaticObjectsCatalog.ts` keeps `StaticObjectEntry`, `pickVariant`, `bushOrTreeEntry`, the
  stalactite/stalagmite helpers, and the chain/rope helpers — only the four mushroom-specific helpers
  move.
- No new `entities/ → engine/` import is introduced: the moved helpers use the local structural
  `MushroomSprite` type.
- `entities/blocks/Mushroom.ts` is **not** added to `entities/blocks/index.ts`'s `BLOCK_TYPES` — the
  mushroom is not a hit-reactive `BlockType` and carries no `BlockState`.
