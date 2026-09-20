# Phase 1 Data Model: Editor Dark Mode

This feature adds exactly **one** stored value — the editor's appearance — plus
one derived DOM attribute. Everything else the feature shows is **derived** from
existing editor state (the grid, the spawn marker, the torch tiles and the
enemy markers) and stores nothing of its own. That
matches the spec's Key Entities, which describe the preview as "derived entirely
… it stores no state of its own".

## Entity: `EditorAppearance` (stored)

The editor's own light/dark look, held as one persisted value and owned by the
editor rather than by the site-wide theme.

| Field | Type | Rules |
| --- | --- | --- |
| appearance | `'light' \| 'dark'` | Persisted under `platformer-editor-appearance`. Default `'light'` (FR-003, spec Assumption "Default: Light"). |

**Storage**: `localStorage['platformer-editor-appearance']`, JSON-encoded by
`createLocalStorageSignal`. A distinct key — the existing editor keys keep their
meaning, so no migration is needed and no in-progress author work is affected
(FR-003, spec Assumption "Storage identity").

**Validation**:
- The stored value MUST be `'light'` or `'dark'`; anything else (including a
  missing key, a JSON parse failure, or a JSON-valid wrong value such as
  `"blue"` or `42`) resolves to `'light'` (FR-003, spec Edge Case "Stored value
  missing or invalid").
- Enforced by the `isValid` predicate passed to `createLocalStorageSignal`
  (research D2), so the invalid value never enters the signal.

**State transitions**:

```
toggleEditorAppearance() : light -> dark -> light -> …
setEditorAppearance(next) : any -> 'light' | 'dark'
```

Both write `editorAppearanceSignal.value`; the signal's subscription persists
the new value immediately (no debounce — a single scalar, unlike the grid).

## Entity: `EditorAppearanceAttribute` (derived, DOM)

The DOM projection of `EditorAppearance`, applied while the editor is mounted.

| Field | Type | Rules |
| --- | --- | --- |
| `document.documentElement.dataset.editorAppearance` | `'light' \| 'dark'` | Set from the signal in an effect; **removed on unmount**. |

**Invariants**:
- While mounted, the attribute always equals `editorAppearanceSignal.value`.
- On unmount the attribute is removed so no other route inherits the editor's
  palette.
- The attribute, not `data-theme`, decides the editor's palette: the
  `[data-editor-appearance='…']` blocks in `editor.css` are imported after the
  per-theme files and therefore win the cascade (FR-004, SC-007).

## Entity: `CaveLightingPreview` (derived, no stored state)

The canvas rendering inputs for the game's cave lighting, recomputed on every
edit/toggle while the dark appearance is active on the level canvas.

| Field | Type | Rules |
| --- | --- | --- |
| darknessLevel | `number` | Always `EDITOR_PREVIEW_DARKNESS` (0.8) while the preview is active — a fixed target, not an eased value (FR-013). |
| torches | `TorchLight[]` | One per `torch` terrain tile in the grid, at its `tileToPixel` centre. |
| playerLight | `Point \| null` | `heldTorchLightPosition(player)` at the spawn, or `null` when there is no spawn. |

**Validation / invariants**:
- `darknessLevel === EDITOR_PREVIEW_DARKNESS` whenever the preview is active,
  independent of the spawn's position and of the background placements
  (FR-009, SC-003).
- The preview is computed only for the level canvas and only in the dark
  appearance; the blueprint canvas gets the dark chrome/backdrop but never a
  preview (FR-011).
- The preview is read-only: it derives from the grid and never writes to it, so
  an export or a save is identical with dark mode on or off (FR-010, FR-016,
  SC-005).

## Entity: `CarriedLight` (derived)

The spawn player's held-light position, which supplies the preview's player
glow. It no longer decides whether the scene darkens.

| Field | Type | Rules |
| --- | --- | --- |
| point | `Point \| null` | `heldTorchLightPosition(synthesizePlayerState(grid))`, or `null` when the grid has no `S`. |

**Invariants**:
- No `S` marker in the grid → no player → `playerLight = null` (spec Edge Case
  "No spawn in the level").
- Reuses the engine's `heldTorchLightPosition` verbatim, so the glow matches the
  game (FR-008).

## Entity: `TorchLightSource` (derived)

One per `torch` terrain tile in the editor grid.

| Field | Type | Rules |
| --- | --- | --- |
| col / row | `number` | Grid cell of the `torch` tile. |
| x / y | `number` | World-space centre: `tileToPixel(col, row)` + `RENDERED_TILE_SIZE / 2`. |

**Invariants**:
- Discovery is a pure scan of `TileChar[][]` using `TERRAIN_CHARS[char] ===
  'torch'` (research D6).
- Zero torches is valid: a cave with none still darkens, and the player's own
  glow keeps the spawn discernible (spec Edge Case "No torches in the cave").

## Entity: `EnemyEyeMarker` (derived, no stored state)

Reused unchanged from O-010 — the editor already synthesizes `EnemyState[]` via
`synthesizeEnemyStates(grid)` for its normal draw pass, and the same list is fed
to `drawEnemyEyes`. No new field, no new state.

## Relationships

```
editorAppearanceSignal (stored, localStorage)
        │
        ├──▶ document.documentElement[data-editor-appearance] ──▶ editor.css tokens
        │
        └──▶ (dark only) caveLightingPreview(grid)
                        │
        EDITOR_PREVIEW_DARKNESS ───────────────────────────────────────────────▶ darknessLevel
        torchLightsFromGrid(grid) ─────────────────────────────────────────────▶ torches
        synthesizePlayerState(grid) ──▶ heldTorchLightPosition ───────────────▶ playerLight
                        │
                        └──▶ drawDarkness + drawEnemyEyes + drawHeldTorch (existing engine passes)
```

## Constants (single source of truth — reused, not re-declared)

| Constant | Source | Meaning |
| --- | --- | --- |
| `EDITOR_PREVIEW_DARKNESS` | `editor/caveLightingPreview.ts` | The preview's own darkness (0.8), lighter than the game's `MAX_DARKNESS` (FR-008/FR-009). |
| `RENDERED_TILE_SIZE` | `level/Terrain.ts` | Torch-centre conversion. |
| `TERRAIN_CHARS` | `level/LevelParser.ts` | Identifies `torch` tiles. |
| `TORCH_LIGHT_RADIUS_PX`, `PLAYER_LIGHT_RADIUS_PX`, `TORCH_GLOW_COLOR`, `PLAYER_GLOW_COLOR`, `ENEMY_EYE_*` | `engine/Lighting.ts` | Reused as-is by the engine draw passes (FR-016 — no new in-game lighting constants). |

The only constant this feature adds is `EDITOR_PREVIEW_DARKNESS`, a
preview-only value that is not an in-game lighting rule (FR-016). The editor
stylesheet adds only CSS custom properties, which are palette values rather than
lighting rules.
