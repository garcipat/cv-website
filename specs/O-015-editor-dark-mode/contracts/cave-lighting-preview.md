# Contract: Cave-lighting preview (`editor/caveLightingPreview.ts` + `EditorCanvas`)

The preview is a **view-only composition** of O-010's existing pure rules and
existing `Renderer.ts` draw passes. It adds no lighting math, no constant, no
sprite and no stored state (FR-010, FR-013, FR-016).

## Pure module (`editor/caveLightingPreview.ts`)

Canvas-free, DOM-free, React-free — unit-testable with Vitest. It imports only
types and pure helpers (`gridRenderState`, `Lighting`, `Renderer`,
`LevelParser`, `Terrain`).

```ts
import type { TileChar } from '../level/LevelParser';
import type { Point, TorchLight } from '../engine/Lighting';

/** Preview-only darkness (0.8), lighter than the game's MAX_DARKNESS. */
export const EDITOR_PREVIEW_DARKNESS: number;

/** The three inputs the engine draw passes need for the preview. */
export interface CaveLightingPreview {
  /** Always EDITOR_PREVIEW_DARKNESS while the preview is active (FR-013). */
  darknessLevel: number;
  /** One light per `torch` terrain tile in the grid, at its world centre. */
  torches: TorchLight[];
  /** The spawn player's carried light, or null when there is no spawn. */
  playerLight: Point | null;
}

/** One light per `torch` terrain tile, at `tileToPixel` + half a rendered tile. */
export function torchLightsFromGrid(grid: TileChar[][]): TorchLight[];

/** The preview inputs for the current grid. Pure; never throws. */
export function caveLightingPreview(grid: TileChar[][]): CaveLightingPreview;
```

### Behaviour

- `torchLightsFromGrid` scans every cell, keeps those whose
  `TERRAIN_CHARS[char] === 'torch'`, and maps each to
  `{ col, row, x: tileToPixel(col, row).x + RENDERED_TILE_SIZE / 2, y: … }` —
  the same conversion `PlatformerState.torchPositions` uses.
- `caveLightingPreview`:
  1. `player = synthesizePlayerState(grid)`.
  2. `darknessLevel = EDITOR_PREVIEW_DARKNESS` (0.8) unconditionally — dark
     mode always previews the cave look, independent of the spawn or the
     background, and lighter than play so the level stays visible (FR-009).
  3. `playerLight = player ? heldTorchLightPosition(player) : null`.
- The functions do not mutate their arguments.

## Canvas composition (`editor/EditorCanvas.tsx`)

`EditorCanvas` gains `appearance: EditorAppearance` and a reused offscreen
layer-canvas ref. Its single existing redraw effect gains `appearance` as a
dependency (alongside `grid`, `backgroundPlacements`, `activeLayer`,
`placement`), so the preview follows every edit without a reload (FR-009).

Preview is drawn iff `appearance === 'dark' && !isBlueprintMode`. It is placed
**inside** the existing foreground-alpha block, after `drawPlayer`, so the
background-layer dimming composes with it (FR-012):

```
if (preview.darknessLevel > 0) {
  // `player` is `PlayerState | null` (EditorCanvas.tsx:562); guard before the
  // held-torch pass — TypeScript strict rejects a possibly-null player.
  if (player !== null) {
    drawHeldTorch(ctx, player, images.torch, preview.darknessLevel, panOffset.x, panOffset.y, 0);
  }
  drawDarkness(ctx, layer, canvas.width, canvas.height, preview.darknessLevel,
               preview.torches, panOffset.x, panOffset.y, 0, preview.playerLight);
  drawEnemyEyes(ctx, synthesizeEnemyStates(grid), preview.darknessLevel,
                preview.torches, 0, panOffset.x, panOffset.y, preview.playerLight);
}
```

Then, when the preview is active only, the editor affordances are re-drawn at
full opacity above the overlay (FR-012): `drawGridLines`, `drawSignBadges`, and
the two `drawTileMarkers` passes. The pending placement preview stays last in
both appearances.

### Invariants

1. `appearance === 'light'` ⇒ the preview block is skipped entirely and the
   frame is the pre-feature frame (FR-007, SC-004).
2. `isBlueprintMode` ⇒ no preview, even when dark; the dark chrome and backdrop
   still apply (FR-011).
3. No spawn ⇒ `darknessLevel` is still `EDITOR_PREVIEW_DARKNESS` and the engine
   passes still run; only `playerLight` is `null`, so there is no carried glow
   (FR-009, SC-003, spec Edge Case "No spawn in the level").
4. Every engine pass is called with `worldElapsed = 0`, so the preview is static
   (FR-013).
5. The preview reads `grid` and `backgroundPlacements` only; it never writes
   them, so exports and saves are identical with dark mode on or off (FR-010,
   SC-005).
6. The preview's overlay work is O(visible torches) (the engine pass filters
   off-screen torches) and runs only on an edit/toggle, so paint feedback stays
   under 200 ms (FR-018, SC-006).
