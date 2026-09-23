# Contract: the editor's tile meta layer

Covers the editor grid signals, painting, palette, canvas presentation and the hover
tooltip in `src/themes/platformer/editor/`. It implements FR-008–FR-013 and FR-028–FR-031.

## `editor/editorState.ts`

```ts
export type MarkerTool = 'patrolBoundary' | 'connectionPoint' | 'fallingStalactite';
export type EditorTool = TileChar | MarkerTool;

export const editorMarkerSignal = createDebouncedLocalStorageSignal<(MarkerEntry | null)[][]>(
  'platformer-editor-markers', [], EDITOR_STORAGE_DEBOUNCE_MS,
);
export const editorBlueprintMarkerSignal = createDebouncedLocalStorageSignal<(MarkerEntry | null)[][]>(
  'platformer-editor-blueprint-markers', [], EDITOR_STORAGE_DEBOUNCE_MS,
);

export const editorMarkerGridSignal: ReadonlySignal<(MarkerEntry | null)[][]>; // active canvas
export const editorSelectedToolSignal: Signal<EditorTool>;                     // widened type

export interface PlacementSnapshot {
  grid: TileChar[][];
  background: BackgroundChar[][];
  markers: (MarkerEntry | null)[][]; // NEW
}
```

- `null` is the empty cell, mirroring `BackgroundGrid`.
- `editorMarkerGridSignal` is the `isBlueprintMode ? blueprint : level` ternary, in the
  same block as `editorGridSignal`/`editorBackgroundGridSignal`.
- The persisted grids are validated by a forgiving shape guard on load (the one untyped
  boundary); a stale persisted terrain grid containing legacy `P`/`+`/digits is not
  migrated (spec Edge Case).

## `editor/paintMarkerCell.ts` (NEW)

```ts
export function paintMarkerCell(
  markers: (MarkerEntry | null)[][],
  col: number,
  row: number,
  marker: MarkerEntry,
): (MarkerEntry | null)[][];

export function eraseMarkerCell(
  markers: (MarkerEntry | null)[][],
  col: number,
  row: number,
): (MarkerEntry | null)[][];

/** The sign tool: default hint on a fresh cell, next hint on an existing sign. */
export function paintSignMarker(
  markers: (MarkerEntry | null)[][],
  col: number,
  row: number,
): (MarkerEntry | null)[][];
```

- `paintMarkerCell` writes exactly one cell and returns a new grid; it **never grows**
  (FR-010). An out-of-bounds `(col, row)` is a no-op returning the same grid.
- `eraseMarkerCell` clears a cell to `null`; a no-op for an already-empty or out-of-bounds
  cell.
- At most one marker per cell falls out of a single-cell write (FR-003).
- `paintSignMarker` writes `{kind:'sign', hintId: DEFAULT_HINT_ID}` when the cell is not a
  sign, else `{kind:'sign', hintId: nextHintId(existing.hintId)}` (FR-030).

## `editor/editorActions.ts`

```ts
export const selectTool = (tool: EditorTool): void;

export const applyMarkerPaint = (next: (MarkerEntry | null)[][]): void;

export const applyPaint = (result: PaintResult): GrowthShift; // also shifts markers
export const commitPlacement = (col: number, row: number): GrowthShift | null; // also stamps markers
export const undoLastPlacement = (): void; // restores markers too

export const loadLevel = (level: LevelEntry): void;      // migrates legacy chars + markers
export const loadBlueprint = (blueprint: Blueprint): void;
export const saveCurrentLevel = async (name: string): Promise<void>;
export const saveCurrentBlueprint = async (name: string): Promise<void>;
export const tryLayout = (): void;
```

- `applyMarkerPaint` writes the active canvas's marker signal, sets its dirty flag, and
  clears the save result and placement snapshot. It has no `GrowthShift` because marker
  paint never grows.
- `applyPaint` shifts the marker grid by the growth, exactly as it already shifts the
  background grid (D9).
- **Ordering invariant**: a sign/falling tool that grows the grid calls `applyPaint(result)`
  first (which shifts the marker grid), then writes the marker at `col + colShift`,
  `row + rowShift` via `applyMarkerPaint`, so the marker lands on the same cell the terrain
  did.
- `commitPlacement` snapshots the level marker grid into `PlacementSnapshot.markers`,
  shifts the level marker grid by the growth, then stamps the blueprint's markers at
  `(col + colShift, row + rowShift)`, overwriting (FR-018/FR-020). `blueprintFit` is
  unchanged and terrain-only (FR-019).
- `undoLastPlacement` restores terrain, background **and** markers.
- `loadLevel`/`loadBlueprint` populate the marker grid from the file's `markers` field plus
  any legacy characters in `layout` (FR-015); the editor grid shows `T` for a migrated sign
  and `⊤` for a migrated falling stalactite.
- `saveCurrentLevel`/`saveCurrentBlueprint`/`tryLayout` pass `cropped.markers` through.

## `editor/paletteTiles.ts` and `editor/Palette.tsx`

- `PALETTE_TILE_SPRITES`, `PALETTE_TILE_LABELS`, `PALETTE_TILE_DESCRIPTIONS` and
  `PALETTE_TILE_GLYPHS` widen from `Record<TileChar, …>` to `Record<EditorTool, …>`; the
  marker tools carry their own glyph/label/description.
- The Tools group keeps the sign (`T`), the patrol boundary (always), the connection point
  (blueprint canvas only, FR-007/FR-010) and the two stalactite tools: the decorative `⊤`
  (terrain, paints `⊤` alone) and the falling-stalactite tool (paints `⊤` + marker), per
  FR-031. No marker tool is offered on a canvas where it does not apply.
- The falling-stalactite tool owns the existing red tint (`PALETTE_TILE_SPRITES['T'].tint`),
  moved off the removed `T` hazard key.
- `HAZARD_PALETTE_KEYS` (derived from `HAZARD_CHARS`) no longer yields a falling-stalactite
  hazard button; the spike/spear/floor-spike buttons are unchanged.
- Selecting a marker tool calls `selectTool`, disarming any armed blueprint (unchanged).

## `editor/EditorCanvas.tsx` and `EditorCanvasPane.tsx`

- `EditorCanvas` gains `markerGrid: (MarkerEntry | null)[][]` and `onPaintMarker:
  (next: (MarkerEntry | null)[][]) => void`.
- In the foreground branch of `handleMouseDown`/`handleMouseMove`:
  - a **pure marker tool** (`patrolBoundary`/`connectionPoint`) calls `paintMarkerCell`
    (left) or `eraseMarkerCell` (right) and dispatches `onPaintMarker` — it never calls
    `paintCell` and never grows the grid (FR-010), whatever the active layer is (FR-009).
  - the **sign tool** (`T`) calls `paintCell(grid, …, 'T')` and `paintSignMarker` at the
    post-growth coordinates (FR-030).
  - the **falling-stalactite tool** calls `paintCell(grid, …, '⊤')` and
    `paintMarkerCell(…, {kind:'fallingStalactite'})` (FR-031).
  - the decorative `⊤` tool calls `paintCell` only.
- `drawTileMarkers` is re-pointed from scanning `grid` for `P`/`+` to scanning `markerGrid`
  for `patrolBoundary`/`connectionPoint`, so markers draw over the terrain and are
  independent of the active layer (FR-008/FR-011). Both the normal and the dark-preview
  redraw passes draw them.
- `drawSignBadges` scans `markerGrid` for `sign` entries and draws `hintCode(hintId)`
  (`1`–`6`) in the tile's top-left corner (FR-028).
- `drawTileTint` scans `markerGrid` for `fallingStalactite` and washes the `⊤` cell's art
  with the existing red tint; the decorative `⊤` stays untinted (FR-028).
- A hover tooltip names the marker and its value; for a sign it shows
  `currentUI.value.platformer.hints[hintId]` (FR-029). It is a plain absolutely-positioned
  `<div>` inside the canvas pane (like the placement preview), updated on mouse move.
- The placement preview includes the blueprint's marker cells (via `blueprintMarkers`) so a
  connection point is visible before committing.

## Tests

- `editor/paintMarkerCell.test.ts` — write, overwrite, erase, no-grow, out-of-bounds no-op,
  sign default/cycle.
- `editor/editorState.test.ts` — the derived active-canvas marker grid; persisted-grid
  validation.
- `editor/editorActions.test.ts` — marker paint sets dirty and clears the snapshot; growth
  shifts markers; sign/falling tool ordering; placement stamps/overwrites markers; undo
  restores them.
- `editor/Palette.test.tsx` — sign + patrol on both canvases, connection point on the
  blueprint canvas only, decorative vs falling stalactite tools.
- `editor/EditorCanvas.test.tsx` — a marker tool click paints the marker grid, not terrain;
  a terrain tool click leaves the marker grid alone; markers render regardless of layer; the
  sign badge, the falling tint and the hover tooltip.
- `editor/EditorToolbar.test.tsx` — the Export block includes the markers.
