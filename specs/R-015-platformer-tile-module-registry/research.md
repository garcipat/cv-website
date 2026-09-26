# Phase 0 Research: Platformer Tile Module Registry (R-015)

**Feature**: `R-015-platformer-tile-module-registry`
**Spec**: [`spec.md`](./spec.md)
**Date**: 2026-09-27
**Authoritative project conventions**: [`docs/Architecture.md`](../../docs/Architecture.md) and
[`docs/TestingGuide.md`](../../docs/TestingGuide.md), plus the platformer-specific
[`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) (§3.5, §4.1, F7)
and [`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md). The constitution
(`.specify/memory/constitution.md`) is the highest-priority policy.

This document resolves the technical unknowns of the plan. No `NEEDS CLARIFICATION` remains. The five
spec `## Clarifications` decisions are treated as fixed inputs and are not re-litigated here.

---

## Context discovered during research

- The shipped code has **19 `TileType` members**: `groundGrass`, `groundRock`, `wall`, `bridge`,
  `ladder`, `chain`, `bush`, `fence`, `cobweb`, `crystalCluster`, `stalactite`, `stalagmite`, `torch`,
  `ladderBundle`, `ropeLadder`, `bouncyMushroom`, `decorativeMushroom`, `crumblingFloor`, `empty`.
- **R-008 has already shipped** (marked ✅ in `docs/Features.md`) under the names
  `DeployableItemType` / `WorldInteractableType` / `DEPLOYABLE_ITEM_TYPES` (not the spec's older
  `WorldItemType` wording). The rope-ladder's lifecycle **and its draw**
  (`entities/deployableItems/RopeLadder.ts`) own the `ladderBundle` / `ropeLadder` appearance today.
  R-015 must move the tile *art geometry* into the tile module but leave the *lifecycle draw* in R-008.
- **R-009 is unmerged** (branch `R-009-platformer-renderer-split`, `d5c60114`). It relocates
  `tileSource`/`drawTerrain` into `engine/render/SceneRenderer.ts` unchanged and is written to consume
  R-015's registry. R-015 is planned against the current `main` tree (`engine/Renderer.ts` still
  exists) and treats R-009 as a downstream consumer.
- `engine/Renderer.ts`'s terrain path is exactly two dispatch points: the `tileSource` `switch`
  (`Renderer.ts:124-195`, with a `never` exhaustiveness guard) and the per-tile `if`-chain inside
  `drawTerrain` (`Renderer.ts:598-827`). `drawCrumblingFloors` (`Renderer.ts:869-928`) is a third,
  depth-separated pass. `engine/GroundAtlas.ts` and `engine/StaticObjectsCatalog.ts` hold the sprite
  tables.
- Behaviour special cases are spread across `level/Terrain.ts` (`isSolid`, `isSolidExcludingBridge`,
  `isClimbable`, `isStandableLadderTop`, `isStandableLadderBundleTop`, `isStandableMushroomCap`,
  `isTopExposed`, `CRUMBLING_FLOOR_SOLID_HEIGHT`), `engine/Physics.ts` (bridge drop-through,
  crumbling-floor half-height ceiling + wall inset), and `engine/Standable.ts` (the ground-term union).
  A second crumbling-floor special case lives in `entities/enemies/movement/patrol.ts:98` and
  `entities/deployableItems/Bomb.ts:106`.
- The mushroom state lives in `entities/blocks/Mushroom.ts` (squash timer + cap art); the crumbling
  floor state machine lives in `engine/CrumblingFloor.ts`; both already route through
  `shared/timedTile.ts`. `PlatformerState.ts` owns the signals/tick/reset (R-004's lifecycle).
- `engine/StaticObjectsCatalog.ts` is imported by `engine/Renderer.ts`, `engine/BackgroundDecorCatalog.ts`
  (`pickVariant`), `entities/deployableItems/RopeLadder.ts` (`ROPE_*`, `ropeLadderShaftPieces`), and
  `entities/hazards/FallingStalactite.ts` (`isStalactiteTwin`, `stalactiteEntry`, `TWIN_*`). It has no
  test import of `Terrain`-free helpers beyond its own `StaticObjectsCatalog.test.ts`.
- `entities/Torch.ts` is the whole torch module (frame animation **and** light/authoring), imported by
  `level/LevelData.ts` (type), `level/LevelParser.ts`, `PlatformerState.ts`, `entities/Player.ts`,
  `editor/caveLightingPreview.ts`, `editor/paintMarkerCell.ts`, `engine/Renderer.ts`.
- There is **no existing automated layer-boundary test** (R-001 verified its invariants with a one-time
  manual inspection; R-014's lint guard is explicitly out of scope). FR-014's guard test is new.
- `frameSource`/`SpriteSheet`/sheet registrations live in `entities/sprites/`; a `tiles/` module may
  not import them (the no-`tiles/ → entities/` rule), so art must be delivered to the tile module
  through the render context, not by importing sheet descriptors.

---

## Decisions

### D1 — `tiles/` is a peer layer beside `entities/`, importing only `contracts/`, `shared/` and `level/`

**Decision.** Create `src/themes/platformer/tiles/` with one module per tile kind plus
`tiles/registry.ts` and `tiles/TileModule.ts` (the contract). The dependency direction is:

```
contracts/   shared/        (leaves)
        ▲        ▲
        │        │
      tiles/ ──► level/      (accepted mutual edge: level/ imports the registry to derive
        │                     TileType/TileChar; tiles/ imports the pure grid readers)
        ▲
        │
   engine/  entities/  editor/  state/  PlatformerPage
```

**Rationale.** Matches the spec clarification (peer folder, pure grid readers stay in `level/`) and the
analysis §4.1 "one folder per family" idiom. Mirrors the accepted `level/ ↔ entities/` relationship
(R-001) with an accepted `level/ ↔ tiles/` relationship.

**Consequence — two new hard invariants enforced by the guard test.** `tiles/` imports **no**
`entities/` (FR-011) and **no** `engine/`. The second is not literally named in R-001 but is required
to keep `level/ → tiles/ → engine/` from becoming a transitive `level/ → engine/` path; the spec's
intent ("`tiles/` MUST NOT introduce a `level/ → engine/` edge") covers it.

**Alternatives considered.** (a) A `tiles/` subfolder of `level/` — rejected: the spec's clarification
chose a peer folder and the tile modules need draw (a runtime concern). (b) Folding the grid readers
into `tiles/` — rejected: they are shared pure primitives reused by renderer/physics/editor, and the
spec keeps them in `level/`.

### D2 — One module per kind + one registry; `TileType` derived from the registry

**Decision.** `tiles/registry.ts` exports `TILE_MODULES` as the single source of tile-kind membership:

```ts
export const TILE_MODULES = { groundGrass: groundGrassModule, /* …one line per kind… */ }
  satisfies Record<string, TileModule>;
```

- `level/LevelData.ts` declares `export type TileType = keyof typeof TILE_MODULES` via a **type-only**
  import of `TILE_MODULES` (no runtime edge from `LevelData` to `tiles/`; `keyof typeof` is a type-level
  operation).
- `TERRAIN_CHARS` is derived in `tiles/registry.ts` from each module's declared `char` literal, and the
  terrain half of `TileChar` is derived from those literals with a mapped type. `LevelParser.ts` keeps
  the entity/sign/hazard characters and composes the full `TileChar` union (terrain ∪ entity ∪ sign ∪
  hazard), so the editor grid type is unchanged.
- `TILE_FOG_EXEMPT` / `isFogExempt` move to `tiles/registry.ts`, derived from each module's
  `fogExempt` (spec Edge Case: fog exemption stays exhaustive).
- Registry-only kinds (`ropeLadder`) declare no `char`, so they are covered by rules/draw but never
  parse- or palette-exposed (spec Edge Case).

**Rationale.** FR-002 and the spec's clarifications ask for derivation from the registry; a malformed entry is
caught by `satisfies Record<string, TileModule>`, and a missing shipped kind is caught by the FR-014 guard's
assertion against the **frozen shipped-kind list** (derivation alone would make the check vacuous). This mirrors `EnemyTypeKey = keyof typeof ENEMY_TYPES` / `BlockKind = keyof typeof BLOCK_TYPES` (M5) — the house pattern.

**Alternatives considered.** Keeping `TileType` a hand-written union that the registry must cover —
rejected by the clarification. Deriving `TERRAIN_CHARS` from `keyof` directly — impossible because the
existing maps are `Record<string, … | undefined>` and widen to `string` (documented in `LevelParser.ts`);
the `char` literal on each module is what gives a non-widened union.

### D3 — The `TileModule` contract: capability flags + context-dependent hooks

**Decision.** Each module implements `tiles/TileModule.ts`:

```ts
interface TileSolidRegion { top: number; bottom: number } // rendered px, relative to cell top
interface TileRuleContext { transient: TileTransientState; excludeOneWay?: boolean }
interface TileDrawContext { ctx; level; col; row; destX; destY; originX; originY;
                            worldElapsed; images: TerrainImages; transient: TileTransientState }

interface TileModule {
  char?: string;                 // author-placeable level char; absent for registry-only kinds
  fogExempt: boolean;
  solid?: boolean;               // plain "blocks movement"; crumblingFloor deliberately omits it
  oneWay?: boolean;              // bridge: excluded from rising-from-below / drop-through
  climbable?: boolean;           // ladder / chain / ropeLadder
  dropThrough?: boolean;         // bridge: claims Down while standing on it
  drawBand: 'terrain' | 'afterHazards' | 'deployable';
  solidRegionAt?(level, col, row, ctx): TileSolidRegion | null; // phase/inset-aware solidity
  standableAt?(level, col, row, ctx): boolean;                  // one-way ground term
  draw?(rc: TileDrawContext): void;
  state?: TileStateDescriptor;   // stateful kinds only; routed through shared/timedTile
}
```

**Rationale.** FR-005 requires hooks over `(level, col, row, context)`, not a bare `(tile)`. The
capability flags (`solid`/`oneWay`/`climbable`/`dropThrough`) keep the hot static lookups O(1) and
preserve the existing pure signatures (`isSolid(tile)`), while the hooks express the genuinely
context-dependent rules (ladder-top standability, mushroom cap, bridge drop-through, crumbling-floor
phase/inset). The shape mirrors the shipped `BlockType`/`EnemyType`/`DeployableItemType` style.

**Alternatives considered.** A single generic `rules: { solid?, climbable?, standable?, … }` bag —
rejected as over-abstraction; explicit named members read like the rest of the registry family.

### D4 — `level/Terrain.ts` keeps the pure grid readers and gains registry-backed generic helpers

**Decision.** `level/Terrain.ts` keeps the pure primitives (`tileAt`, `tileToPixel`, `TILE_SIZE`,
`RENDER_SCALE`, `RENDERED_TILE_SIZE`, `backgroundAt`, `markerAt`, `backgroundNeighbourMask`,
`neighbourMask` and its bit constants, `horizontalRunPosition`, `bridgeRunPosition`, `verticalRunRole`,
`chainAttachment`, `chainRunLength`, `cobwebOrientation`, `isTopExposed`). The per-kind predicates are
re-expressed as registry dispatch:

- `isSolid(tile)` → `TILE_MODULES[tile].solid === true`
- `isSolidExcludingBridge(tile)` → `isSolid(tile) && !TILE_MODULES[tile].oneWay`
- `isClimbable(tile)` → `TILE_MODULES[tile].climbable === true`
- `isStandableLadderTop` / `isStandableLadderBundleTop` / `isStandableMushroomCap` are **removed** and
  replaced by one dispatcher `isStandableTileAt(level, col, row, ctx)` that calls the cell module's
  `standableAt`.
- New `tileSolidRegionAt(level, col, row, ctx)` dispatches to `solidRegionAt` (falling back to a
  full-cell region when `solid` is set), and `claimsDropThrough(level, col, row)` dispatches to the
  module flag. `CRUMBLING_FLOOR_SOLID_HEIGHT` moves to the `crumblingFloor` module.

**Rationale.** FR-004 says `Terrain.ts`/`Physics.ts`/`Standable.ts` consume the registry rather than
compare `TileType` values. Keeping the generic helpers (which contain no per-kind literal) preserves
the ~40 existing `isSolid`/`isClimbable` call sites (entities, editor, engine) with import-path-only
churn, while the *rule* itself is declared by the module. `isSolid('crumblingFloor')` stays `false`
and `isTopExposed`'s "bridge counts solid" semantics stay identical.

**Alternatives considered.** Deleting `isSolid`/`isClimbable` entirely and inlining a registry lookup
at every call site — rejected: high churn for no behavioural gain, and the helper is still registry
dispatch, not a per-kind branch.

### D5 — Appearance dispatch: `drawTerrain` iterates cells and calls the module's `draw`

**Decision.** `engine/Renderer.ts`'s `drawTerrain` becomes a thin loop:

```ts
for row, for col:
  const module = TILE_MODULES[tileAt(level, col, row)];
  if (module.drawBand === 'terrain') module.draw?.(buildTileDrawContext(...));
```

The `tileSource` switch and every per-tile `if` branch are deleted (FR-018). `drawRotatedTile`,
`isGrassSurface` and the chain helpers move into the owning module (shared geometry helpers into
`tiles/draw.ts`). `drawCrumblingFloors` stays as a **depth-preserving pass** but its body becomes one
dispatch to the `crumblingFloor` module's `draw` for the cells it owns (band `afterHazards`), matching
R-004's "one dispatch invoked per layer" precedent. `ladderBundle`/`ropeLadder` keep `drawBand:
'deployable'` — no `drawTerrain` draw; R-008's `drawDeployableItems` remains their renderer.

**Rationale.** FR-006 and US4 require the renderer to dispatch, not branch. The band field keeps the
existing pixel-identical pipeline order
(`drawTerrain → ladder band → blocks → hazards → crumblingFloors → chest band → …`) without
`drawTerrain` naming a kind. R-009 can move this dispatch wholesale into `SceneRenderer`.

**Art delivery without a `tiles/ → entities/` edge.** Tile modules never import
`entities/sprites/sheets.ts`. `TileDrawContext.images` carries the resolved `HTMLImageElement`s the
terrain path already holds (tileset, ground atlas, static objects, decorations, torch, mushroom) plus
the crumbling ledge/crack images, resolved by the caller from `dc.sprites`. Tile-owned crop rects /
frame geometry / run composition live in the module; the sheet `src` stays only in the caller. Frame
geometry the module needs that mirrors a sheet frame size is declared as a module constant and pinned
by a consistency assertion (the codebase's existing "declare locally + test agreement" convention,
e.g. `sheets.ts` ↔ pickup/chest modules).

**Alternatives considered.** Passing the sheet descriptors into the module — rejected (`tiles/ →
entities/` import). Building a second tile/palette table in `tiles/` — explicitly forbidden (FR-009,
SC-008).

### D6 — Stateful tiles declare state through their module; R-004 keeps the lifecycle

**Decision.**
- `engine/CrumblingFloor.ts` moves to `tiles/crumblingFloor.ts` (state type, durations, phase/offset
  helpers, and now its `draw`). It already routes through `shared/timedTile.ts`; that is unchanged.
- `entities/blocks/Mushroom.ts` is **split and removed**: the bouncy-mushroom squash timer + cap art
  move to `tiles/bouncyMushroom.ts`; the small mushroom's fixed art moves to
  `tiles/decorativeMushroom.ts`.
- `PlatformerState.ts`'s signals (`mushroomSquashStates`, `crumblingFloorTimerStates`), their ticks and
  their `resetGame()` entries are **untouched** except for import retargeting. No new signal, tick or
  reset list is introduced (SC-004).
- The effect registry is untouched. `neverDeclaresAMushroomSquashKind` and
  `docs/TransientEffectRecipe.md` remain valid; only the referenced `entities/blocks/Mushroom.ts` path
  in that doc is updated to `tiles/bouncyMushroom.ts` (the note that it is *not* an effect is
  unchanged).

**Rationale.** FR-007 and the spec clarification: the kind declares state, R-004 owns the lifecycle.
`shared/timedTile.ts` already provides arm/advance/elapsed/shake; the modules keep only durations, key
shape, phase/offset mapping and (new) their draw.

### D7 — The torch module relocates whole into `tiles/torch.ts`

**Decision.** Move `entities/Torch.ts` → `tiles/torch.ts` (it is the `torch` tile kind's frame
animation, authoring vocabulary, and light descriptor). All importers retarget: `level/LevelData.ts`
and `level/LevelParser.ts` (type/value), `PlatformerState.ts`, `entities/Player.ts` (held-torch frame
dims), `editor/caveLightingPreview.ts`, `editor/paintMarkerCell.ts`, `engine/Renderer.ts`. The tile's
`draw` lives in the moved module, which imports only `shared/math`, `contracts/lighting` and
`level/Terrain`.

**Rationale.** FR-001/FR-006: the flame art is the torch tile's appearance and must live with the
kind; a `tiles/` module cannot import `entities/Torch.ts`. R-001 kept the module whole in `entities/`
only because `level/` could reach it there without an `engine/` edge; R-015's accepted `level/ ↔ tiles/`
edge supersedes that placement. Nothing in `entities/` other than `Player.ts` (frame dims) retains a
torch dependency, and that is an allowed `entities/ → tiles/` edge.

**Alternatives considered.** Splitting only the flame math out, leaving the light half in `entities/` —
rejected as a half-move that keeps `entities/Torch.ts` as a second home for a tile kind.

### D8 — Per-kind sprite tables move into their modules; shared helpers go to `shared/`

**Decision.** Distribute `engine/StaticObjectsCatalog.ts`'s per-kind tables to their owners:
`tiles/bush.ts` (`BUSH_OR_TREE_VARIANTS`, `bushOrTreeEntry`), `tiles/fence.ts`, `tiles/crystalCluster.ts`,
`tiles/cobweb.ts` (`COBWEB_*`), `tiles/stalactite.ts` (`STALACTITE_VARIANTS`, `stalactiteEntry`,
`isStalactiteTwin`, `TWIN_*`), `tiles/stalagmite.ts`, `tiles/chain.ts` (chain piece rects,
`chainRunPieces`, `CHAIN_WALL_GAP`, `chainPieceDestX`), `tiles/ropeLadder.ts` (`ROPE_*`,
`ropeLadderShaftPieces`). `GroundAtlas.ts`'s `GROUND_ATLAS`/`GRASS_CELLS`/`groundTileKind`/`grassCell`/
`GRASS_SOURCE_HEIGHT` move to `tiles/groundGrass.ts`. `engine/StaticObjectsCatalog.ts` and
`engine/GroundAtlas.ts` are deleted (no compatibility re-export, FR-018).

Genuinely shared, entity-free helpers move to a leaf so both `engine/` and `tiles/` can use them:
`pickVariant` → `shared/` (`shared/variants.ts`, delegating to `shared/math.hash2D`), and the
`TileAtlas` vocabulary → `shared/` (`shared/tileAtlas.ts`). `engine/BackgroundDecorCatalog.ts` and
`engine/BackgroundAtlas.ts` retarget. Downstream consumers that need a moved constant
(`entities/deployableItems/RopeLadder.ts` for `ROPE_*`/`ropeLadderShaftPieces`;
`entities/hazards/FallingStalactite.ts` and its test for the stalactite twin geometry) import it from
the tile module — an allowed `entities/ → tiles/` edge, no new forbidden edge.

**Rationale.** FR-006 ("the per-kind sprite tables MUST live with … the owning module") and the
spec's Edge Case that `tiles/` must not build a second palette/tile table. Shared helpers stay leaves so
no `tiles/ → engine/` edge is introduced.

**Alternatives considered.** Keeping the catalog in `engine/` and having tile modules reach it —
rejected (`tiles/ → engine/`, and it defeats the "one-module edit" goal). Duplicating tables —
rejected (a second table, forbidden by SC-008).

### D9 — R-008 ladder coupling: art to the module, lifecycle stays in R-008

**Decision.** `ropeLadderDeployableItem` (`entities/deployableItems/RopeLadder.ts`) keeps its state,
phase machine, deploy trigger, effective-terrain contribution and its lifecycle-driven draw. Only the
static art geometry (`ROPE_BUNDLE`/`ROPE_TOP_CAP`/`ROPE_STEP`/`ROPE_BOTTOM_CAP` and
`ropeLadderShaftPieces`) moves into `tiles/ropeLadder.ts` and is imported back. The tile modules for
`ladderBundle` and `ropeLadder` declare their rules (`standableAt` unconditional for the bundle;
`climbable` + `standableAt` ladder-shaft-top for the deployed rung) and `drawBand: 'deployable'`.

**Rationale.** Spec Edge Case: the deployment lifecycle MUST NOT be folded into a tile module; R-015
only exposes the tile-kind side (standable bundle, climbable `ropeLadder`). Behaviour is preserved.

### D10 — Guard test (FR-014) is a source-reading structural test

**Decision.** Add `tiles/registry.test.ts` (runs under the existing Vitest config, `node:fs` allowed)
asserting:

1. **One module per kind / exhaustive registry** — `Object.entries(TILE_MODULES)` has a distinct
   module object per `TileType`; `Object.keys(TILE_MODULES)` equals the derived `TileType` set; no
   duplicate module objects.
2. **Char coverage** — `TERRAIN_CHARS` maps every author-placeable kind exactly once; registry-only
   kinds (`ropeLadder`) and marker-only concerns never appear; `tileAt` never returns a marker.
3. **Layer invariants** (import-graph scan of `src/themes/platformer/**/*.ts(x)`): no `tiles/` file
   imports `entities/` or `engine/`; no `level/` file imports `engine/`; no `engine/` file imports
   `state/`; `contracts/` files import nothing from `engine|entities|level|tiles|state`.
4. **No scattered rule branches** — a source scan of `engine/Physics.ts`, `engine/Standable.ts`,
   `level/Terrain.ts` finds no `=== 'tileType'` / `!== 'tileType'` comparison against a known
   `TileType` literal outside the registry-dispatch helpers (string comparisons against non-tile
   literals such as phase names are allowed).

**Rationale.** FR-014; R-014's lint guard is out of scope, so the invariant rides on a Vitest test.
The regex is scoped to the three named files and to the known tile-literal set, so it is deterministic
and does not trip on unrelated code.

**Alternatives considered.** ESLint rule — R-014's scope. Manual inspection — no automated regression
guard, contrary to FR-014.

### D11 — Test migration is home/import moves only

**Decision.** Every existing behavioural test keeps its assertions. Test homes follow their modules:
`GroundAtlas.test.ts` → `tiles/groundGrass.test.ts`; the per-kind halves of
`StaticObjectsCatalog.test.ts` → `tiles/<kind>.test.ts`; `Mushroom.test.ts` → `tiles/bouncyMushroom.test.ts`
(+ decorative art assertions → `tiles/decorativeMushroom.test.ts`); `CrumblingFloor.test.ts` →
`tiles/crumblingFloor.test.ts`; `Torch.test.ts` → `tiles/torch.test.ts`. `Terrain.test.ts` keeps its
`isSolid`/`isClimbable` assertions and repoints the removed `isStandableLadderTop`/`isStandableMushroomCap`
describes to `isStandableTileAt`. `Renderer.test.ts`'s `drawTerrain` assertions stay (the entry
signature is preserved and output is byte-identical). No test is deleted, skipped or weakened.

### D12 — Docs: recipe collapses and the F-018 gap closes

**Decision.** Update `docs/themes/platformer/Terrain.md`: the "Adding a tile" recipe becomes one new
module + one registry line, and the "Open gap" note ("terrain kinds still do not own their own rules")
is recorded as closed by R-015. Update `docs/themes/platformer/LevelFormat.md`'s pointer to the
terrain char table's home. Update the `entities/blocks/Mushroom.ts` path reference in
`docs/TransientEffectRecipe.md` to `tiles/bouncyMushroom.ts` (the note stays valid).

### D13 — Layer invariants that hold (unchanged)

`contracts/` stays a strict leaf; no `level/ → engine/` edge; no `engine/ → state/` edge; plus the new
no-`tiles/ → entities/` and no-`tiles/ → engine/` rules. `level/ ↔ tiles/` is the accepted mutual edge,
mirroring R-001's accepted `level/ ↔ entities/`.

---

## Open questions

None. All spec clarifications are resolved and every `NEEDS CLARIFICATION` item is answered above.

## Unresolved dependencies / flags for the plan

1. **R-009 is unmerged** — R-015 delivers the registry contract against `main`'s `engine/Renderer.ts`;
   the plan calls out the `drawTerrain` entry signature it must keep stable for R-009's clean move.
2. **R-008 shipped under different names than the spec expected** — `DeployableItemType` /
   `WorldInteractableType` (not `WorldItemType`); the plan targets the shipped shape.
3. **`entities/Torch.ts` relocation** is broader than the spec's named mushroom example; it is required
   by the no-`tiles/ → entities/` rule and the one-module-per-kind goal, and is flagged as a decision.
4. **`docs/TransientEffectRecipe.md` path reference** must be updated so the note stays valid.
5. **R-010's draft spec is untracked and out of scope** — left untouched; R-015 only exposes the
   consumable contract.
