# Contract — Palette Descriptor & R-015 Consumption

**Feature**: `R-010-platformer-mapper-editor-unification`
**Requirements**: FR-007, FR-008; SC-003
**Consumers**: `editor/ops/paletteTiles.ts`, `editor/Palette.tsx`, `editor/PaletteTile.tsx`,
`tiles/registry.ts` (R-015, read-only)

---

## 1. One descriptor (FR-007)

```ts
export type PaletteGroup = 'terrain' | 'decoration' | 'entities' | 'hazards' | 'tools' | 'blueprints';

export interface PaletteTool {
  label: string;
  description: string;
  sprite: TileSpriteSpec | null;   // TileSpriteSpec unchanged (sheet/crop/overlay/tint/…)
  glyph?: string;                  // empty-square glyph when sprite is null
  group: PaletteGroup;
}

export const PALETTE_TOOLS: Record<EditorTool, PaletteTool>;
```

Rules:

- `PALETTE_TOOLS` is keyed by `EditorTool` and is the **single** source of each tool's label,
  description, sprite spec, glyph and grouping. Adding a tool is one descriptor entry.
- `PALETTE_TILE_SPRITES`, `PALETTE_TILE_GLYPHS`, `PALETTE_TILE_DESCRIPTIONS` and
  `PALETTE_TILE_LABELS` MUST NOT exist as parallel tables (guard-checked).
- `Palette.tsx` groups the buttons by `PaletteTool.group`; the local `DECORATION_CHARS` grouping
  array is removed.

## 2. R-015 consumption for terrain tools (FR-008)

```ts
export interface TerrainPaletteTool extends PaletteTool {
  tileType: TileType;        // key of TILE_MODULES
  char: string;              // module.char
  fogExempt: boolean;        // module.fogExempt
  drawBand: TileDrawBand;    // module.drawBand
}
export function terrainPaletteTools(): TerrainPaletteTool[];
```

Rules:

- Terrain tile membership and the rule/appearance flags (`char`, `fogExempt`, `drawBand`) are read
  from R-015's shipped `tiles/` registry (`TILE_MODULES` / `TERRAIN_CHARS`), not from a palette-local
  table. `terrainPaletteTools()` enumerates `TILE_MODULES` and joins each author-placeable module
  with its `PALETTE_TOOLS` descriptor entry.
- `terrainPaletteTools()` returns exactly the tile modules whose `PALETTE_TOOLS` entry has
  `group === 'terrain'` — it excludes `'.'` (the Eraser, group `'tools'`), every non-author-placeable
  kind (`ropeLadder`), and the decoration chars (group `'decoration'`). The Eraser MUST NOT be
  produced or duplicated by the enumeration.
- `Palette.tsx` derives each button's group from `PaletteTool.group`, reproducing today's split
  exactly: terrain = `TERRAIN_CHARS` minus `'.'` and the decoration chars; decoration = the eight
  decoration chars (`n N X c ⊤ ⊥ ¥ s`); entities = `ENTITY_CHARS`; hazards = `HAZARD_PALETTE_KEYS` +
  `fallingStalactite`; tools = sign + patrol (+ connection point on the blueprint canvas) + eraser.
- Non-terrain tools (entity characters, hazard characters, marker tools, the eraser, the blueprint)
  declare their own descriptor fields.
- Each tool's label/description/glyph/**icon sprite spec** stays in `PALETTE_TOOLS`; R-015 carries
  no palette icon metadata, so no palette icon is derived from the registry and R-015's contract is
  **not** extended.
- R-010 introduces no palette-local tile registry and no second tile-kind table.
- Derived helpers that are not one of the four tables stay: `HAZARD_PALETTE_KEYS`,
  `PATROL_GLYPH`, `CONNECTION_POINT_GLYPH`, `BLUEPRINT_GLYPH`, `TileSpriteSpec`.

## 3. Behavioural parity

Every tool's rendered label, tooltip description, sprite crop, glyph and group MUST be identical to
pre-refactor (`PALETTE_TOOLS` entries are the old four tables' values, merged). The
`editor-palette-tile-*` test handles and the palette test suite are preserved.
