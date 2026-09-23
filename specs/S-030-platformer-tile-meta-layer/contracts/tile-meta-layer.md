# Contract: the tile meta layer types and predicates

Covers the marker vocabulary, the hint catalog and the runtime layer in
`src/themes/platformer/level/`. It must be reflected in
[docs/themes/platformer/LevelFormat.md](../../../docs/themes/platformer/LevelFormat.md)
and [docs/themes/platformer/Terrain.md](../../../docs/themes/platformer/Terrain.md).

## `level/LevelData.ts`

```ts
// REMOVED from TileType and TILE_FOG_EXEMPT:
//   'patrol', 'blueprintConnectionPoint'

export type MarkerEntry =
  | { kind: 'patrolBoundary' }
  | { kind: 'connectionPoint' }
  | { kind: 'fallingStalactite' }
  | { kind: 'sign'; hintId: HintId };

export type MarkerGrid = (MarkerEntry | null)[][]; // row-major, [row][col]

export interface MarkerPlacement {
  col: number;
  row: number;
  marker: MarkerEntry;
}

export interface LevelDef {
  terrain: TileMap;
  width: number;
  height: number;
  background?: BackgroundGrid;
  markers?: MarkerGrid; // NEW — absent when the level has no markers
}
```

- `patrol`/`blueprintConnectionPoint` are gone from `TileType`; `Renderer.tileSource`'s
  exhaustive switch and `TILE_FOG_EXEMPT` must drop their cases (the build enforces this).
- `MarkerGrid` mirrors `BackgroundGrid`; `null` is empty. `MarkerEntry` is the only marker
  value shape — no `any`, no free-form JSON (FR-023).

## `level/HintCatalog.ts` (NEW)

```ts
export const HINT_IDS: readonly HintId[];        // order = old SIGN_CHARS digits 1..6
export const DEFAULT_HINT_ID: HintId;            // HINT_IDS[0]
export function hintCode(hintId: HintId): string;   // '1'..'6'
export function nextHintId(hintId: HintId): HintId; // wraps
export function isHintId(value: unknown): value is HintId;
```

- `HINT_IDS` order is the badge-code order (FR-028), the sign cycle order (FR-030) and the
  source of `DEFAULT_HINT_ID` (FR-027).

## `level/LevelParser.ts`

```ts
export const SIGN_CHAR = 'T'; // replaces the six-key SIGN_CHARS
// REMOVED from TERRAIN_CHARS: P, +.  REMOVED from TileChar: 'P', '+'.
// REMOVED from HAZARD_CHARS: T.

export const LEGACY_MARKER_CHARS: Record<string, MarkerEntry | undefined> = {
  P: { kind: 'patrolBoundary' },
  '+': { kind: 'connectionPoint' },
  '1': { kind: 'sign', hintId: 'bridgeDropThrough' },
  '2': { kind: 'sign', hintId: 'ladderClimbUp' },
  '3': { kind: 'sign', hintId: 'fragileRockBreaksFromBelow' },
  '4': { kind: 'sign', hintId: 'chestNeedsKey' },
  '5': { kind: 'sign', hintId: 'openAllChestsHaveFun' },
  '6': { kind: 'sign', hintId: 'bomb' },
};

export function parseMarkers(
  layout: readonly string[],
  storedMarkers: readonly MarkerPlacement[] | undefined,
  width: number,
  height: number,
): MarkerGrid;

export function parseLevel(
  layout: readonly string[],
  storedMarkers?: readonly MarkerPlacement[],
): LevelDef;

export function findSignTiles(
  layout: readonly string[],
  markers?: MarkerGrid,
): { col: number; row: number; hintId: HintId }[];

export function findHazardTiles(
  layout: readonly string[],
  markers?: MarkerGrid,
): { col: number; row: number; hazardType: HazardKind; facing: HazardFacing }[];
```

- `parseMarkers` builds a `width × height` grid: it first lifts every legacy marker
  character out of `layout` (FR-015), then applies `storedMarkers` on top. An unrecognised
  `marker.kind` or an out-of-bounds `(col, row)` is ignored (FR-016).
- **`T` generation rule**: when `storedMarkers === undefined` (no `markers` field) the
  layout is pre-feature and `T` lifts to `{kind:'fallingStalactite'}` with a `⊤` terrain
  cell (FR-015); when `storedMarkers` is present, `T` is a sign whose `hintId` is the cell's
  `sign` marker or `DEFAULT_HINT_ID` (FR-025/FR-027). An explicit `sign` marker at a `T`
  cell always wins.
- `parseLevel` returns `markers` only when the grid has at least one marker; otherwise the
  field is omitted, so `currentLevel` matches a marker-free `LevelDef`.
- The shared-key guard is updated: `SIGN_CHAR` is the sign owner; `P`/`+`, the digits
  `'1'`–`'6'`, and `T` are no longer terrain/hazard keys, and all leave the hand-maintained
  `TileChar` union except `'T'`, which stays as the sign character. No shared-key throw.
  `parseLevel`'s unknown-character warning MUST NOT fire for a recognised legacy marker
  character.
- `findSignTiles` scans the layout for `SIGN_CHAR` and pairs each cell with a `sign` marker
  at that cell, else `DEFAULT_HINT_ID` (FR-027).
- `findHazardTiles(layout, markers?)` is the single hazard-discovery entry point: it scans
  the layout for the character hazards (`^`/`v`/`<`/`>`/`¦`/`A`) and the marker grid for
  `{kind:'fallingStalactite'}` entries, returning one combined list in reading order for the
  existing `placeHazards` pipeline (FR-032). Which source a hazard came from is an internal
  detail — a caller asks for "the level's hazards", not for each source separately.

## `level/Terrain.ts`

```ts
export function markerAt(level: LevelDef, col: number, row: number): MarkerEntry | null;
```

- Returns `null` for an out-of-bounds coordinate, a missing `markers` field, or an empty
  cell — the exact contract `backgroundAt` has.
- No solidity/climbability predicate changes: a marker was never solid or climbable, and it
  is now not terrain at all.

## `level/level.ts`

```ts
export const currentMarkers = signal<readonly MarkerPlacement[] | undefined>(undefined);

export const currentLevel = computed<LevelDef>(() => {
  const terrain = parseLevel(currentLayout.value, currentMarkers.value);
  return { ...terrain, background: parseBackgroundLayout(...) };
});

export const SIGN_TILES = computed(() =>
  findSignTiles(currentLayout.value, currentLevel.value.markers),
);
export const HAZARD_TILES = computed(() =>
  findHazardTiles(currentLayout.value, currentLevel.value.markers),
);
```

- `currentMarkers` is deliberately `undefined` for a pre-feature level (the `T` generation
  rule) and an array for a new-format one; it is in-memory only, exactly like
  `currentLayout`/`currentBackgroundLayout`.
- `LEVEL_1_LAYOUT` is updated to the new shape and `LEVEL_1_MARKERS` is added, so the
  shipped level is new-format.
- The editor's `tryLayout()` writes all three signals.

## Tests

- `level/LevelParser.test.ts` — `P`/`+` are no longer `TERRAIN_CHARS`/`TileChar` keys;
  `T` is no longer a `HAZARD_CHARS` key; `SIGN_CHAR` is `T`; `LEGACY_MARKER_CHARS` maps the
  legacy chars; `parseLevel` lifts legacy chars to markers and empties the terrain (`⊤` for
  a legacy `T`); `storedMarkers` are applied and invalid entries ignored; the `T` generation
  rule; `findSignTiles`; `findHazardTiles` returns the character hazards and the
  marker-derived falling stalactites in one list.
- `level/HintCatalog.test.ts` — order, default, code, cycle, guard.
- `level/Terrain.test.ts` — `markerAt` for present/absent/out-of-bounds; `patrol` and
  `blueprintConnectionPoint` are no longer `TileType` members (compile-time).
- `level/level.test.ts` — `currentLevel` merges `currentMarkers`; `SIGN_TILES`/
  `HAZARD_TILES` read the layer.
