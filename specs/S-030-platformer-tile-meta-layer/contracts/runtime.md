# Contract: runtime marker consumption

Covers what the running game reads from the tile meta layer. It implements FR-005–FR-007,
FR-021, FR-022 and FR-032.

## Invisible and non-solid by construction

- A marker is not a `TileType`, so it is never in `LevelDef.terrain`: `tileAt` never returns
  a marker, `isSolid`/`isSolidExcludingBridge`/`isClimbable` never see one, and the
  neighbour masks/autotiling never count one.
- `Renderer.tileSource` no longer has a `patrol`/`blueprintConnectionPoint` case; markers
  are simply not in the grid the renderer walks, so nothing draws for them and nothing
  collides with them, whatever terrain is under them (FR-005).
- A `connectionPoint` is read by nothing in the running game (FR-007).

## Patrol reversal — `entities/enemies/movement/patrol.ts`

`stepHorizontal`'s `wallAhead` test changes one term:

```ts
const wallAhead = rows.some((r) => {
  const tile = tileAt(level, leadingCol, r);
  return (
    tileIsGroundFor(leadingCol, r, tile) ||
    markerAt(level, leadingCol, r)?.kind === 'patrolBoundary' || // was: tile === 'patrol'
    isBlockedTile(leadingCol, r)
  );
});
```

- The turn geometry (`leadingCol`, `snapX`, the reverse-and-check-narrow-lane logic) is
  untouched, so an enemy reverses at exactly the same cell as before (FR-006, SC-004).
- `tileIsGroundFor` is unchanged: a patrol boundary was never ground and still is not.
- `fly.ts` shares `stepHorizontal`, so a bee treats a patrol boundary identically with no
  change of its own.
- The `LevelDef` passed in is `currentLevel`, whose `markers` are populated by
  `parseLevel` — so an old level with `P` in its layout and a new level with a `markers`
  entry behave identically (FR-021/FR-022).

## Sign hints — `level/LevelParser.ts` → `SignMapper.ts`

- `SIGN_TILES` is `findSignTiles(currentLayout.value, currentLevel.value.markers)`: each
  `T` cell pairs with its `sign` marker's `hintId`, or `DEFAULT_HINT_ID` when the marker is
  absent (FR-027/FR-032).
- `signPlacements` (`PlatformerState.ts`) is unchanged — `placeSigns` already maps
  `{col,row,hintId}` to a `SignPlacement`, and the in-game bubble reads
  `currentUI.value.platformer.hints[hintId]` exactly as before. No runtime i18n change
  (FR-024/FR-032).

## Falling stalactite — `level/LevelParser.ts` → `HazardMapper.ts`

- `HAZARD_TILES` is `findHazardTiles(currentLayout.value, currentLevel.value.markers)` — a
  single call. The function combines the character-driven hazards (`^`/`v`/`<`/`>`/`¦`/`A`)
  with a `{col,row,hazardType:'fallingStalactite',facing:'down'}` entry for every cell whose
  marker is `fallingStalactite`, so a caller never has to know whether a hazard came from a
  character or from the layer (FR-032).
- `placeHazards` and `hazardPlacements` are unchanged, so the shake-and-drop behavior,
  its per-tick phase merge (`hazardPlacementsForTick`) and its editor tint are untouched.
- `HAZARD_TYPES` (`entities/hazards/index.ts`) **keeps** the `fallingStalactite` behavior
  module: that registry maps a `HazardKind` to its behavior, not a character to a hazard.
  Only the discovery path moved to the layer.

## The effective level

`PlatformerState.ts`'s `activeLevel` (`applyDeployedLadders(currentLevel, states)`) spreads
the raw `LevelDef`, so `markers` travel through the deployable-ladder override unchanged.
Enemy movement reads `currentLevel` directly, so it sees markers with or without a deployed
ladder.

## Tests

- `entities/enemies/movement/patrol.test.ts` / `engine/EnemyAI.test.ts` — the existing
  patrol-characterization fixtures move from `terrain` `'patrol'` cells to a `markers` grid
  carrying `{kind:'patrolBoundary'}`, with the same expected turn positions (SC-004).
- `engine/Renderer.test.ts` — a `LevelDef` with markers renders nothing for them; the `⊤`
  falling-stalactite art still draws from marker-derived placements.
- `PlatformerState.test.ts` — `activeLevel` preserves `markers`; `signPlacements` reads the
  layer; `hazardPlacements` includes the marker-derived falling stalactite.
- `PlatformerPage.test.tsx` — an enemy turns at a `patrolBoundary` marker; the player
  passes through it; the sign bubble shows the marker's hint text (FR-006/FR-032).
