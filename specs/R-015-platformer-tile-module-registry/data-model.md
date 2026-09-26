# Phase 1 Data Model: Platformer Tile Module Registry (R-015)

**Feature**: `R-015-platformer-tile-module-registry`
**Date**: 2026-09-27
**Spec**: [`spec.md`](./spec.md) · **Research**: [`research.md`](./research.md)

This is a **pure restructuring** of already-shipped code. No new runtime data, gameplay, tuning, art,
level/blueprint data or editor behaviour is introduced. The "entities" below are the structural
concepts the tile layer introduces; every value they carry is relocated byte-for-byte from existing
code. The single behavioural contract is the existing test suite plus the new FR-014 guard test.

---

## 1. Entity overview

```text
TileType (derived key union)
      │  keyed by
      ▼
TILE_MODULES : { …one per kind… } satisfies Record<string, TileModule>
      │  each module exposes
      ├── capability flags      (char?, fogExempt, solid?, oneWay?, climbable?, dropThrough?, drawBand)
      ├── context-dependent rules (solidRegionAt?, standableAt?)
      ├── appearance              (draw?)
      └── declared state          (state? — stateful kinds only)
      │
      ├── consumed by ──► level/Terrain.ts  (pure grid readers + registry-backed generic helpers)
      │                   level/LevelParser.ts (char table + parsing)
      │                   engine/Physics.ts, engine/Standable.ts (rules)
      │                   engine/Renderer.ts (draw dispatch)
      │                   PlatformerState.ts (state collection/tick/reset — R-004 lifecycle)
      └── consumed by ──► R-008 (rope-ladder art geometry), R-009 (draw registry), R-010 (palette contract)
```

---

## 2. `TileModule` — the per-kind contract

One module per shipped `TileType` under `src/themes/platformer/tiles/`.

| Field | Type | Present on | Meaning / origin |
| --- | --- | --- | --- |
| `char` | `string` (literal) \| absent | author-placeable kinds | The level char it is parsed from (`empty` declares `'.'`). Absent on registry-only kinds (`ropeLadder`). Source of `TERRAIN_CHARS`. |
| `fogExempt` | `boolean` | all | Relocated `TILE_FOG_EXEMPT[tile]`. Drives `isFogExempt`. |
| `solid` | `boolean` \| absent | `groundGrass`, `groundRock`, `wall`, `bridge` | Relocated `isSolid`. Plain "blocks movement". `crumblingFloor` deliberately omits it. |
| `oneWay` | `boolean` \| absent | `bridge` | Relocated `isSolidExcludingBridge` exception: passable from below and while dropping through. |
| `climbable` | `boolean` \| absent | `ladder`, `chain`, `ropeLadder` | Relocated `isClimbable`. |
| `dropThrough` | `boolean` \| absent | `bridge` | Relocated `=== 'bridge'` checks in `Physics.ts` (Down claims the drop). |
| `drawBand` | `'terrain' \| 'afterHazards' \| 'deployable'` | all | Which pipeline band draws this kind; preserves today's depth without a kind branch in `drawTerrain`. |
| `solidRegionAt` | hook | `crumblingFloor` | Phase- and inset-aware solidity (top-half region, non-solid when broken/reforming). |
| `standableAt` | hook | `ladder`, `chain`, `ropeLadder`, `ladderBundle`, `bouncyMushroom` | One-way ground terms (ladder shaft top, rolled bundle top, mushroom cap). |
| `draw` | hook | every kind drawn by the terrain/crumbling passes | Owns appearance (crop rects, run composition, autotile tables, frame selection). |
| `state` | descriptor | `bouncyMushroom`, `crumblingFloor` | Declares key shape, duration, prune/re-arm policy, phase/offset mapping; routed through `shared/timedTile.ts`. |

### 2.1 Rule-hook signatures

```ts
interface TileSolidRegion { top: number; bottom: number } // rendered px relative to the cell top

interface TileRuleContext {
  transient: TileTransientState;   // crumbling-floor timers, mushroom squashes
  excludeOneWay?: boolean;         // rising-from-below / active drop-through query
}

solidRegionAt?(level: LevelDef, col: number, row: number, ctx: TileRuleContext): TileSolidRegion | null
standableAt? (level: LevelDef, col: number, row: number, ctx: TileRuleContext): boolean
```

- A module with `solid: true` and no `solidRegionAt` resolves to the full-cell region
  `{ top: 0, bottom: RENDERED_TILE_SIZE }`; when `ctx.excludeOneWay` and `oneWay` are true it resolves
  to `null`.
- `crumblingFloor` returns `{ top: 0, bottom: CRUMBLING_FLOOR_SOLID_HEIGHT }` while
  `atRest`/`cracking`, and `null` while `broken`/`reforming`. `CRUMBLING_FLOOR_SOLID_HEIGHT` moves
  into this module.

### 2.2 Draw-hook signature

```ts
interface TileDrawContext {
  ctx: CanvasRenderingContext2D;
  level: LevelDef;
  col: number; row: number;
  destX: number; destY: number;   // tileToPixel(col,row) + originX/originY
  originX: number; originY: number;
  worldElapsed: number;
  images: TerrainImages;          // resolved <img>s (tileset, groundAtlas, staticObjects,
                                  // decorations, torch, mushroom, crumblingLedge, crumblingCracks)
  transient: TileTransientState;
}
```

`TileDrawContext` is the delivery mechanism that lets a tile module own its art **without** importing
`entities/sprites/` (the no-`tiles/ → entities/` rule). The caller resolves sheet images; the module
owns crop rects, run composition, autotile tables and frame selection.

---

## 3. `TILE_MODULES` — the registry

| Aspect | Rule |
| --- | --- |
| Location | `src/themes/platformer/tiles/registry.ts` |
| Shape | `TILE_MODULES satisfies Record<string, TileModule>`, one literal key per shipped kind |
| Derivation | `TileType = keyof typeof TILE_MODULES` (in `level/LevelData.ts`, type-only import) |
| Char table | `TERRAIN_CHARS` built from each module's `char`; `TerrainChar` extracted from the literal |
| Fog table | `TILE_FOG_EXEMPT` / `isFogExempt` derived from `fogExempt` |
| Exhaustiveness | Compile time via `satisfies Record<string, TileModule>`; runtime via the FR-014 guard pinned to the **frozen 19 shipped kind names** (derivation alone would make the check vacuous) |
| Single dispatch | Rules (`isSolid`, `isSolidExcludingBridge`, `isClimbable`, `isStandableTileAt`, `tileSolidRegionAt`, `claimsDropThrough`) and draw (`drawTileAt`) all consult `TILE_MODULES` |

**State transitions:** a tile kind's registry entry is immutable; membership never changes at runtime.
Runtime phase transitions belong to the stateful kinds' declared state, not the registry.

---

## 4. Shared grid readers (stay in `level/`, imported by tile modules)

| Symbol | Notes |
| --- | --- |
| `TILE_SIZE`, `RENDER_SCALE`, `RENDERED_TILE_SIZE` | geometry constants |
| `tileAt`, `tileToPixel`, `backgroundAt`, `markerAt` | pure cell reads |
| `neighbourMask` + `NEIGHBOUR_*` | autotile continuity (uses `isSolidExcludingBridge`) |
| `horizontalRunPosition`, `bridgeRunPosition`, `verticalRunRole`, `chainAttachment`, `chainRunLength`, `cobwebOrientation` | run/orientation classifiers (`RunPosition`, `VerticalRunRole`, `ChainAttachment`) |
| `isTopExposed`, `backgroundNeighbourMask` | cell-context reads |

`CRUMBLING_FLOOR_SOLID_HEIGHT` moves out of `LevelData`/`Terrain` into `tiles/crumblingFloor.ts`.

---

## 5. Transient-state model (declared by the kind, owned by R-004)

| Kind | Key shape | Duration / policy | Phase/offset mapping | Home after R-015 | Lifecycle owner |
| --- | --- | --- | --- | --- | --- |
| `bouncyMushroom` (cap squash) | `{ col, row }` | `0.1 s`, prune, `replace` | `mushroomSquashDip` | `tiles/bouncyMushroom.ts` | `shared/timedTile.ts` core; `PlatformerState.mushroomSquashStates` signal/tick/reset unchanged |
| `crumblingFloor` | `{ col, row }` | `2.8 s` cycle, prune, `noop` | `crumblingFloorPhaseAt` / crack / reform ratios | `tiles/crumblingFloor.ts` | `shared/timedTile.ts` core; `PlatformerState.crumblingFloorTimerStates` signal/tick/reset unchanged |

**Invariant:** the modules keep only durations, key shape and phase/offset mapping; no module contains
its own arm/advance/prune loop (R-004 already extracted it). R-015 adds **no** signal, tick call or
reset list, and does **not** register either kind in `EFFECT_REGISTRY`.

`TileStateDescriptor` mirrors `shared/timedTile.ts`'s `TimedTileConfig`:

```ts
interface TileStateDescriptor {
  keyOf(state: GridTimerState): { col: number; row: number };
  duration: number;
  prune: boolean;
  rearm: 'replace' | 'noop';
  phaseOf?(elapsed: number): number | string;   // mushroomSquashDip / crumblingFloorPhaseAt
}
```

---

## 6. Where each shipped concern moves

| Today | After R-015 |
| --- | --- |
| `level/LevelData.ts` `TileType` union | `TileType = keyof typeof TILE_MODULES` (registry) |
| `level/LevelData.ts` `TILE_FOG_EXEMPT` / `isFogExempt` | `tiles/registry.ts` (derived) |
| `level/LevelParser.ts` `TERRAIN_CHARS` / terrain `TileChar` | derived in `tiles/registry.ts`; `LevelParser` composes the full editor `TileChar` |
| `level/Terrain.ts` `isSolid` / `isSolidExcludingBridge` / `isClimbable` | registry-backed generic helpers (same signatures) |
| `level/Terrain.ts` `isStandableLadderTop` / `isStandableLadderBundleTop` / `isStandableMushroomCap` | removed; one `isStandableTileAt` dispatcher calling module `standableAt` |
| `engine/Physics.ts` bridge/crumbling special cases | `claimsDropThrough` flag + `tileSolidRegionAt` hook |
| `engine/Standable.ts` ground-term union | registry-backed `isStandableCell` |
| `engine/Renderer.ts` `tileSource` + `drawTerrain` branches | `drawTileAt` dispatch to module `draw` (band-filtered) |
| `engine/GroundAtlas.ts` | `tiles/groundGrass.ts` (+ `shared/tileAtlas.ts` vocabulary) |
| `engine/StaticObjectsCatalog.ts` | per-kind tables into `tiles/<kind>.ts`; `pickVariant` → `shared/variants.ts` |
| `entities/blocks/Mushroom.ts` | `tiles/bouncyMushroom.ts` + `tiles/decorativeMushroom.ts` (deleted) |
| `engine/CrumblingFloor.ts` | `tiles/crumblingFloor.ts` |
| `entities/Torch.ts` | `tiles/torch.ts` |
| `CRUMBLING_FLOOR_SOLID_HEIGHT` | `tiles/crumblingFloor.ts` |

---

## 7. Validation rules

1. **Exhaustive registry** — every `TileType` has exactly one module and one entry; no duplicates
   (compile time via `satisfies Record<string, TileModule>`, runtime via FR-014 pinned to the frozen
   19 shipped kind names).
2. **Author-placeable chars** — every module with a `char` maps to a unique level character;
   `ropeLadder` has none; the parser never resolves a char to a registry-only kind.
3. **Markers never tiles** — `tileAt` still returns only `TileType`; `MarkerEntry`/`MarkerGrid` are
   untouched and never enter `TILE_MODULES`.
4. **Fog exhaustiveness** — `TILE_FOG_EXEMPT` has a boolean for every `TileType`.
5. **Layer edges** — `tiles/` imports only `contracts/`, `shared/`, `level/`; `level/` imports no
   `engine/`; `engine/` imports no `state/`; `contracts/` is a leaf.
6. **Behaviour preservation** — collision planes, standability, one-way behaviour, run sprites,
   autotiling, bounce, crumbling timing, fog and editor preview are byte-for-byte unchanged.
7. **Single lifecycle** — the two stateful kinds still flow through R-004's collection/tick/reset; no
   new signal/tick/reset.
