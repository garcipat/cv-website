# Implementation Plan: Platformer Tile Module Registry

**Branch**: `R-015-platformer-tile-module-registry` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/R-015-platformer-tile-module-registry/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Give every shipped platformer tile kind one self-contained module under a new
`src/themes/platformer/tiles/` layer that owns its **appearance** (draw), its **behaviour rules**
(solid/climbable/standable/one-way/phase-aware solidity as context hooks), and its **declared
transient state** — and drive every rule and every draw through one exhaustive
`TILE_MODULES` registry (`satisfies Record<string, TileModule>`). `TileType` (and the terrain half of
`TileChar`/`TERRAIN_CHARS`) derive from the registry, so a new tile is one module plus one registry
line. This is a **pure restructuring** of already-shipped code: behaviour, tuning, art, level and
blueprint data, and editor behaviour are byte-for-byte preserved. `tiles/` is a peer folder beside
`entities/`; the pure grid readers stay in `level/` and are called by the module hooks (the accepted
`level/ ↔ tiles/` mutual edge, mirroring R-001's accepted `level/ ↔ entities/`). The feature owns the
static-tile registry half R-009 deferred (`STATIC_TILE_TYPES { key, draw }` — shipped here as
`TILE_MODULES` entries carrying `char` + `draw`) and closes the F-018
"terrain kinds still do not own their own rules" gap; R-008's rope-ladder art geometry and R-010's
palette read the contract rather than rebuilding it.

## Technical Context

**Language/Version**: TypeScript (strict, no `any`) on Node ≥ 24 / Vite 8 / React 19. Pure
DOM-free modules plus the existing canvas render path; no new runtime dependency.

**Primary Dependencies**: Vite, React 19, `@preact/signals-react`, Vitest + React Testing Library +
jsdom, `node:fs`/`node:path` (new, for the structural guard test only — a dev/test dependency already
present via `@types/node`). Consumes shipped R-001 `contracts/` (incl. `SpriteLookup`, `DrawContext`),
R-004 `shared/timedTile.ts` + `shared/math.ts`, and the R-008 deployable-item registry. No new
third-party package.

**Storage**: N/A — static site; level/blueprint data is typed JSON/grids under
`src/themes/platformer/level/`, unchanged by this feature.

**Testing**: Vitest (single run `npm test`), React Testing Library + jsdom for the existing component
tests; the new FR-014 guard test reads source files with `node:fs`. Per [`docs/TestingGuide.md`](../../docs/TestingGuide.md):
`{method}-{condition}-{expected-result}` kebab-case names, `// Arrange / Act / Assert` sections.
Constitution Principle II (TDD, tests before implementation; all tests pass) applies.

**Target Platform**: Static web build (Vite production bundle), browser canvas; unchanged.

**Project Type**: Single front-end web app; this feature is an internal source-layer restructure of
`src/themes/platformer/`.

**Performance Goals**: No regression. Registry lookups are O(1) object property reads replacing the
existing `switch`/`if` chains; `drawTerrain` remains a single per-cell loop; `isSolid` stays a
boolean field read. Constitution Principle V (< 1.5 s initial load, < 200 ms interaction) unaffected.

**Constraints**: Behaviour-preserving refactor (FR-010); no new tile kinds/gameplay/visuals/tuning/level
data/editor behaviour (FR-012); all existing tests migrate and pass, no test deleted/skipped/weakened
(FR-013); production build succeeds; R-001 layer invariants hold plus no `tiles/ → entities/` edge
(FR-011); no compatibility re-export/alias/second dispatch path (FR-018).

**Scale/Scope**: 19 shipped tile kinds → 19 modules + `registry.ts` + `TileModule.ts`; ~35 test files
migrate by home/import; two stateful kinds keep R-004's single lifecycle. Conventions are authoritative
in [`docs/Architecture.md`](../../docs/Architecture.md), [`docs/TestingGuide.md`](../../docs/TestingGuide.md),
[`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) (§3.5, §4.1, F7)
and [`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Outcome | Evidence / mitigation |
| --- | --- | --- |
| **I. Typed Data Architecture** | **PASS** | The registry, `TileModule`, rule/draw contexts and state descriptors are fully typed with no `any`; types are declared before the modules that implement them (`tiles/TileModule.ts` first). CV content lives in `src/data/` and is untouched. The platformer's authoritative conventions are the platformer docs referenced above. |
| **II. Testing (NON-NEGOTIABLE)** | **PASS** | TDD applies: each migrated behavioural test lands with its module move, and the FR-014 guard test is written first. Every existing test migrates (import-home only) and passes; none deleted/skipped/weakened. `npm test` + `npm run build` are acceptance gates (SC-005). |
| **III. Code Quality and Component Standards** | **PASS** | Tile modules use named exports and PascalCase types, camelCase functions; no default exports; no React props changed; `cn()` unaffected. No shadcn/UI involved. |
| **IV. No Feature Bloat** | **PASS** | A spec exists (`specs/R-015-.../spec.md`); the work is a pure restructure with no new gameplay/features; Out-of-Scope items (R-008/09/10/14, new tiles) are respected. The feature is already tracked as issue #111. |
| **V. Performance and Static Delivery** | **PASS** | No dependency added, no backend, static build preserved; registry dispatch is equal-or-cheaper than the current branches; bundle monitored via the production build. |

**Initial gate result: PASS — no violations, Complexity Tracking empty.**

**Post-design re-check (after Phase 1): PASS.** The design introduces one accepted mutual folder edge
(`level/ ↔ tiles/`), mirrors an already-accepted pattern (`level/ ↔ entities/` from R-001), and adds
no forbidden edge: `contracts/` stays a leaf, no `level/ → engine/`, no `engine/ → state/`, and the new
no-`tiles/ → entities/` / no-`tiles/ → engine/` rules are enforced by FR-014's guard. No constitution
exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/R-015-platformer-tile-module-registry/
├── plan.md                    # This file (/speckit.plan command output)
├── research.md                # Phase 0 output — decisions D1–D13
├── data-model.md              # Phase 1 output — TileModule / registry / state / move map
├── quickstart.md              # Phase 1 output — validation & behaviour-preservation guide
├── contracts/
│   ├── tile-module.md         # TileModule interface + registry dispatch contract
│   └── layer-invariants.md    # Dependency edges + FR-014 guard checks
└── tasks.md                   # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

New tile layer and the moves it performs (all under `src/themes/platformer/`):

```text
tiles/                          # NEW peer layer beside entities/ (imports contracts/, shared/, level/ only)
├── TileModule.ts               # NEW — the per-kind contract + rule/draw contexts
├── registry.ts                 # NEW — TILE_MODULES, TERRAIN_CHARS, TILE_FOG_EXEMPT, dispatch helpers
├── registry.test.ts            # NEW — FR-014 structural guard test
├── draw.ts                     # NEW — shared tile-draw primitives (moved drawRotatedTile)
├── groundGrass.ts              # NEW home of engine/GroundAtlas.ts tables (+ grass overlay)
├── groundRock.ts  wall.ts  bridge.ts
├── ladder.ts  chain.ts         # chain: StaticObjectsCatalog piece rects + chainRunPieces + wall gap
├── bush.ts  fence.ts  cobweb.ts  crystalCluster.ts
├── stalactite.ts  stalagmite.ts
├── torch.ts                    # from entities/Torch.ts (frame animation + authoring + light descriptor)
├── ladderBundle.ts  ropeLadder.ts   # rope art geometry (R-008 keeps the lifecycle draw)
├── bouncyMushroom.ts           # from entities/blocks/Mushroom.ts (squash state + cap art)
├── decorativeMushroom.ts       # from entities/blocks/Mushroom.ts (fixed art)
├── crumblingFloor.ts           # from engine/CrumblingFloor.ts (+ CRUMBLING_FLOOR_SOLID_HEIGHT + draw)
└── empty.ts

shared/
├── variants.ts                 # NEW — pickVariant (from engine/StaticObjectsCatalog.ts)
├── tileAtlas.ts                # NEW — TileAtlas vocabulary (from engine/TileAtlas.ts)

level/
├── LevelData.ts                # TileType = keyof typeof TILE_MODULES; fog table moves out
├── LevelParser.ts              # imports derived TERRAIN_CHARS; composes full TileChar
└── Terrain.ts                  # keeps pure grid readers; generic helpers become registry-backed;
                                # removed: isStandableLadderTop/isStandableLadderBundleTop/
                                #          isStandableMushroomCap (→ single isStandableTileAt)

engine/
├── Renderer.ts                 # drawTerrain = band-filtered drawTileAt loop; tileSource deleted
├── Physics.ts                  # bridge/crumbling literals replaced by registry hooks
├── Standable.ts                # ground-term union via registry
├── BackgroundDecorCatalog.ts   # pickVariant import retargets to shared/
├── BackgroundAtlas.ts          # TileAtlas import retargets to shared/
└── (deleted) GroundAtlas.ts, StaticObjectsCatalog.ts, CrumblingFloor.ts

entities/
├── Torch.ts                    # MOVED to tiles/torch.ts
├── blocks/Mushroom.ts          # SPLIT into tiles/bouncyMushroom.ts + tiles/decorativeMushroom.ts
├── Player.ts                   # imports held-torch frame dims from tiles/torch
├── deployableItems/RopeLadder.ts   # imports rope art from tiles/ropeLadder (lifecycle unchanged)
└── hazards/FallingStalactite.ts    # imports stalactite twin geometry from tiles/stalactite

PlatformerState.ts              # signal/tick/reset unchanged; imports retarget to tiles/
editor/                         # unchanged behaviour; import paths only where TileChar/helpers moved
docs/themes/platformer/Terrain.md, LevelFormat.md, docs/TransientEffectRecipe.md  # recipe/gap/docs
```

**Structure Decision**: Single-project front-end. The new `tiles/` layer is the tile-side mirror of
`entities/`'s one-folder-per-family pattern (analysis §4.1 / §3.5), placed beside `entities/`. The pure
grid readers stay in `level/` and are imported by tile modules; `level/` imports the registry to derive
`TileType`/`TERRAIN_CHARS` (accepted mutual edge). `tiles/` imports only `contracts/`, `shared/` and
`level/`, so `entities/`-owned art is delivered through `TileDrawContext.images` and R-008's
rope-ladder geometry is moved into `tiles/ropeLadder.ts` (R-008 imports it back — an allowed
`entities/ → tiles/` edge). Full decision record: [research.md](./research.md) D1–D13; contract:
[contracts/tile-module.md](./contracts/tile-module.md); invariants:
[contracts/layer-invariants.md](./contracts/layer-invariants.md).

## Implementation Approach (phase outline for `/speckit.tasks`)

This is a dependency-ordered restructure; each step keeps the suite green. No step introduces
behaviour change.

1. **Contract + registry skeleton** — add `tiles/TileModule.ts`, `tiles/registry.ts` with all 19
   entries stubbed to their *current* rules/art, and the FR-014 guard test (written first). Derive
   `TileType`, `TERRAIN_CHARS`, `TILE_FOG_EXEMPT` from the registry; wire `level/LevelData.ts` and
   `level/LevelParser.ts`. *(No behaviour change: the stubs still duplicate the old paths and the
   guard's "no branch" check is relaxed until step 4.)*
2. **Rule extraction** — move `isSolid`/`isSolidExcludingBridge`/`isClimbable` to registry dispatch;
   move the `isStandable*` predicates onto their modules and introduce `isStandableTileAt`; add
   `solidRegionAt`/`claimsDropThrough`. Rewire `level/Terrain.ts`, `engine/Physics.ts`,
   `engine/Standable.ts`, `entities/enemies/movement/patrol.ts`, `entities/deployableItems/Bomb.ts`.
   *(Physics/Standable/Terrain now branch-free; step 1's stubs are replaced.)*
3. **Art + draw extraction** — distribute `engine/StaticObjectsCatalog.ts`, `engine/GroundAtlas.ts`,
   `entities/Torch.ts`, `entities/blocks/Mushroom.ts`, and `engine/CrumblingFloor.ts` into the tile
   modules (with `shared/variants.ts`, `shared/tileAtlas.ts` for shared helpers). Rewire
   `engine/Renderer.ts`'s `drawTerrain`/`drawCrumblingFloors`, `entities/deployableItems/RopeLadder.ts`,
   `entities/hazards/FallingStalactite.ts`, `engine/BackgroundDecorCatalog.ts`,
   `engine/BackgroundAtlas.ts`. Delete `tileSource` and the per-kind branches.
4. **Stateful-kind wiring** — point `PlatformerState.ts` signals/ticks/reset at
   `tiles/bouncyMushroom` / `tiles/crumblingFloor`; confirm no new signal/tick/reset; confirm
   `neverDeclaresAMushroomSquashKind` and the effect registry are untouched.
5. **Test migration** — move each test with its module (home/import only, `isStandableTileAt` rename
   where applicable); no deletion/skip/weakening. Tighten the FR-014 guard to full strictness.
6. **Docs + verification** — collapse the "Adding a tile" recipe and close the F-018 gap in
   `docs/themes/platformer/Terrain.md`; update `LevelFormat.md` and the `TransientEffectRecipe.md`
   path; run `npm test`, `npm run build`, `npm run lint`, and the manual browser pass (quickstart §4).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. Complexity Tracking is intentionally empty.
