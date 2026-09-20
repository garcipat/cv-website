# Contract: rendering, editor preview and palette

This contract covers the sprite asset, the draw pass, the game-loop wiring and
the level-editor surface.

## Sprite sheet — `entities/sprites/sheets.ts`

```ts
export const ROPE_LADDER_SHEET: SpriteSheet = {
  src: '/sprites/rope_ladder.png',
  frameWidth: TILE_SIZE,   // 16 — loading-only registration
  frameHeight: TILE_SIZE,  // 16 — NOT used for addressing
  columns: 2,              // loading-only; the right half is four 16x8 pieces
};
```

- These fields exist only to register the image for loading, the same
  convention as `DECORATIONS_SHEET`/`TERRAIN_BACKGROUND_SHEET`. The sheet is
  addressed through `StaticObjectsCatalog.ts`'s own `sx`/`sy`/`width`/`height`
  rects, not by frame index, so `frameHeight`/`columns` do not describe the art.

- The asset is a hand-authored 32×32 flat 2D pixel sheet (already present at
  `public/sprites/rope_ladder.png`). Its regions are:

| Region | Size | Contents |
| --- | --- | --- |
| (0,0) | 16×16 | Rolled bundle |
| (16,0) | 16×8 | Top cap |
| (16,8) | 16×8 | Step (repeat unit) |
| (16,16) | 16×8 | Step (same unit) |
| (16,24) | 16×8 | Bottom cap |

- Load it in both `PlatformerPage.tsx` (a `ropeLadderRef`) and
  `LevelEditorPage.tsx` (an `EditorImages.ropeLadder` field added to
  `EMPTY_IMAGES` and `IMAGE_SOURCES`), the same dual-load convention
  `DECORATIONS_SHEET`/`TORCH_SHEET` already use.

## Sprite rects and piece plan — `engine/StaticObjectsCatalog.ts`

```ts
export const ROPE_BUNDLE: StaticObjectEntry;      // { sx: 0,  sy: 0,  width: 16, height: 16 }
export const ROPE_TOP_CAP: ChainPieceRect;        // { sx: 16, sy: 0,  width: 16, height: 8 }
export const ROPE_STEP: ChainPieceRect;           // { sx: 16, sy: 8,  width: 16, height: 8 }
export const ROPE_BOTTOM_CAP: ChainPieceRect;     // { sx: 16, sy: 24, width: 16, height: 8 }

/** Pieces for a COMPLETED shaft of `shaftCellCount` cells below the bundle. */
export function ropeLadderShaftPieces(shaftCellCount: number): ChainPieceRect[];
```

- `ropeLadderShaftPieces(n)` returns `[ROPE_TOP_CAP, ROPE_STEP]` followed by two
  `ROPE_STEP` per cell below, with the final piece replaced by
  `ROPE_BOTTOM_CAP`. For `n === 0` it returns `[ROPE_TOP_CAP, ROPE_BOTTOM_CAP]`
  (a lone rung cell: cap over cap).
- Reuses the existing `ChainPieceRect` shape; no new rect type.

## Renderer — `engine/Renderer.ts`

- `tileSource` gains `case 'ladderBundle'` and `case 'ropeLadder'`, both
  returning `null` with a comment pointing at `drawDeployableLadders` (the
  exhaustiveness check forces these cases).
- New pass:

```ts
export function drawDeployableLadders(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  states: readonly DeployableLadderState[],
  ropeSheet: HTMLImageElement | null,
  originX = 0,
  originY = 0,
): void;
```

Behaviour:

- Returns immediately when `ropeSheet` is `null` (same fallback convention as
  every other optional sheet).
- `rolled` / `deploying`: draw `ROPE_BUNDLE` scaled to `RENDERED_TILE_SIZE` at
  the bundle cell; then draw `revealedStepCount(state)` `ROPE_STEP` pieces
  downward, the first at the bundle cell's bottom edge (native y offset 16),
  each `LADDER_STEP_NATIVE_PX` tall, clamped so no piece passes the landing
  cell's bottom.
- `deployed`: draw `ropeLadderShaftPieces(shaftCellCount(state))` starting at
  the bundle cell's top, each piece `piece.height * RENDER_SCALE` tall, in the
  bundle's column.
- Uses `imageSmoothingEnabled = false`, the same originX/originY convention as
  `drawTerrain`/`drawChain`, and never reads signals.

## Game wiring — `PlatformerPage.tsx`

- Call `tickDeployableLadders(dt)` in the `playing` branch, alongside
  `tickDarkness(dt)` (so it freezes with the world during pause/death).
- Deploy trigger: after `interactPressed` is computed and **before** the
  chest-open and hint-reveal blocks:

```ts
const bundle = ladderBundleForPlayer(currentLevel.value, deployableLadderStates.value, playerState.value);
let bundleDeployedThisTick = false;
if (interactPressed && bundle) {
  deployableLadderStates.value = deployableLadderStates.value.map((s) =>
    s.id === bundle.id ? beginDeploy(s) : s,
  );
  bundleDeployedThisTick = true;
}
```

  Both the chest-open block and the hint-reveal block then guard on
  `!bundleDeployedThisTick` so the press is consumed (FR-017). Holding Up still
  does nothing while rolled/deploying (the bundle is not climbable).
- Pass `activeLevel.value` (not `currentLevel.value`) to `stepPlayerPhysics`.
  Every other subsystem keeps reading `currentLevel.value`.
- Render: call `drawDeployableLadders` immediately after `drawTerrain` (before
  entities), passing `currentLevel.value`, `deployableLadderStates.value`, the
  loaded rope sheet, and the **same `originX`/`originY` that `drawTerrain`
  receives** (the camera origin) so bundles track the camera.

## Editor — `editor/`

### `gridRenderState.ts`

```ts
export function synthesizeLadderBundleStates(grid: TileChar[][]): DeployableLadderState[];
```

- Returns one `createDeployableLadderState(gridToLevelDef(grid), col, row)` per
  `@` cell, all `rolled` — the editor previews the bundle and its landing cell,
  never a deployed shaft.

### `EditorCanvas.tsx`

- `EditorImages` gains `ropeLadder: HTMLImageElement | null`.
- After `drawTerrain`, call `drawDeployableLadders(ctx, gridToLevelDef(grid),
  synthesizeLadderBundleStates(grid), images.ropeLadder, panOffset.x,
  panOffset.y)`.
- New editor-only `drawLadderBundleLandingMarkers(ctx, level, originX, originY)`:
  for every `ladderBundle` cell, draw a faint marker (a translucent fill and a
  dashed/soft outline, using the same `MARKER_HALO_*`-style legibility approach
  as `drawTileMarkers`) on `ladderLandingRow(level, col, row)`'s cell. This is
  called only from `EditorCanvas`; the game render path never imports it
  (FR-016).

### `paletteTiles.ts`

```ts
'@': {
  sheet: '/sprites/rope_ladder.png',
  sheetWidth: 32,
  sheetHeight: 32,
  sx: 0,
  sy: 0,
  frameWidth: 16,
  frameHeight: 16,
},
// PALETTE_TILE_LABELS['@']        = 'Rope Ladder Bundle'
// PALETTE_TILE_DESCRIPTIONS['@']  = 'Press Up while standing on it to unroll a
//                                     rope ladder down to the ground below'
```

- `ladderBundle` is ordinary terrain, so it appears in the palette's **Terrain**
  group with no `DECORATION_CHARS`/`toolKeys` change (FR-001).

## Tests

- `engine/StaticObjectsCatalog.test.ts` — `ropeLadderShaftPieces` composition
  for 0, 1 and many cells; top cap first, bottom cap last, two steps per cell.
- `engine/Renderer.test.ts` — `drawDeployableLadders` draws nothing without a
  sheet; draws the bundle while rolled; draws exactly `revealedStepCount` steps
  while deploying; draws the full shaft once deployed.
- `editor/EditorCanvas.test.tsx` — a `@` cell produces a landing marker on the
  expected cell, and a `@` over solid ground lands on its own cell.
- `editor/paletteTiles.test.ts` — the `@` sprite/label/description entries exist.
