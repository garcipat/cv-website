# Implementation Plan: Platformer Bouncy Mushroom Blocks

**Branch**: `O-018-platformer-mushroom-blocks` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-018-platformer-mushroom-blocks/spec.md`

## Summary

A red **bouncy mushroom** is a new author-placeable terrain kind (`§`) built as
a vertical run of one tile: a lone cell is a complete mushroom, and cells
stacked below grow the stalk down (cap / connector / plain stem / foot), with
the art role derived from the run exactly like the bush/tree. It is **not a
wall** — walking and rising pass straight through it — but its top cap is
one-way ground, and a downward landing on that cap (only when the cell directly
above is not solid) launches the character with a fixed super-jump (~5.5 tiles,
`-650` px/s), every time, with a brief cosmetic cap dip. A second kind, the
small **decorative mushroom** (`s`), is pure non-solid dressing with no
behaviour. Both are drawn from the existing `public/sprites/mushroom.png`
tileset (red row only).

The technical approach is deliberately minimal and follows the established
one-way-terrain pattern: a single new predicate `isStandableMushroomCap` in
`level/Terrain.ts`, consulted by `Physics.ts`'s ground scan beside
`isStandableLadderTop`/`isStandableLadderBundleTop`. The spec's Open
Requirements leaves "special-case the existing predicates vs. start a
terrain-kind registry" to the plan; the special-case is chosen because a
registry would be a cross-cutting refactor for one tile and contradicts the
constitution's No-Feature-Bloat principle (see [research.md](./research.md)
D1). The bounce is detected **after** physics by a pure
`playerOnMushroomCap(level, player)` query (no `PlayerState` change), applied
through the existing `strongerBounce` aggregation so a same-tick pot landing
never stacks, and its only mutable state is a transient per-cap squash list
cleared on respawn. This follows
[docs/Architecture.md](../../docs/Architecture.md) (typed data, signals over
context, canvas rendering, no backend) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest unit tests for pure
modules, RTL tests for the editor palette).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`) + React 19
**Primary Dependencies**: Vite 6+, Preact Signals (`@preact/signals-react`), Canvas 2D API, Tailwind CSS 4 + shadcn/ui. **No new runtime dependency and no new image asset** — `public/sprites/mushroom.png` (64×64, a 4×4 grid of 16 px cells) already exists; only its loading registration is added.
**Storage**: N/A — static site. Mushrooms are stateless terrain values in `LevelDef.terrain`; the only new state is the transient cap-squash list in an in-memory signal. The level editor keeps persisting to localStorage / level JSON exactly as today. No new persistence, no migration.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). TDD is mandatory (constitution Principle II); the pure modules (`Terrain.ts`, `Physics.ts` query, `MushroomSquash.ts`) are unit-tested with no DOM.
**Target Platform**: Static web (browser), desktop + mobile, reached via `/platformer` and `/platformer/editor`.
**Project Type**: Single static web app — a canvas game theme (`src/themes/platformer/`) inside the CV site.
**Performance Goals**: 60 fps. The mushroom is drawn inside the existing single `drawTerrain` cell pass (no second full-grid pass); the squash list holds a handful of entries, so its per-cap lookup is effectively O(1) and the common case allocates nothing; no new per-frame signal churn.
**Constraints**: No backend/API/DB; no new dependencies; tiles MUST stay stateless values (the cap squash is transient, cosmetic and the only new state — spec FR-015); the cap is standable only when the cell above is not solid (FR-006); the launch is fixed and never scales with fall speed or jump-key state (FR-007); enemies pass through both kinds (FR-014); no CV facts, HUD counters or collection state (FR-001); only the red art variant is used; both characters MUST NOT collide with any existing terrain/entity/sign/hazard character.
**Scale/Scope**: One feature. Two new `TileType` members, one new pure engine module (+ test), one new sprite-sheet registration, one new `PHYSICS_CONFIG` constant, and edits to ~27 existing source/test files across `level/`, `engine/`, `editor/`, `PlatformerState.ts` and `PlatformerPage.tsx`, plus two theme docs (see the Source Code listing below for the exact set).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Status | Notes |
| --- | --- | --- | --- |
| I. Typed Data Architecture | Types declared before use; no `any`; typed data imported directly | ✅ PASS | Two new members added to the `TileType` union in `level/LevelData.ts`; `MushroomSquashState` declared in the new typed engine module before any consumer. The two characters are added to `TERRAIN_CHARS`/`TileChar`. No runtime parsing, no API, no `any`. |
| II. Testing (NON-NEGOTIABLE) | Tests written and reviewed before implementation; all tests pass; `{method}-{condition}-{expectedResult}` naming; Vitest + RTL + jsdom | ✅ PASS | `Terrain.test.ts` covers the cap predicate; `Physics.test.ts` covers the ground term and `playerOnMushroomCap`; `MushroomSquash.test.ts` covers the squash math; `LevelParser.test.ts`/`paletteTiles.test.ts` cover the characters/palette; `Renderer.test.ts` covers the draw branch; `PlatformerPage.test.tsx` covers the bounce and squash lifetime; `EnemyAI.test.ts` covers the FR-014 enemy pass-through; `importLayout.test.ts`/`exportLayout.test.ts` cover the save/reload round-trip. **Documented exception:** US2's run-semantics tests (T021–T023) and the FR-014/round-trip tests are verification-only (their behavior is implemented by US1's shared path or by omission), so they cannot be written failing-first; this is recorded explicitly in tasks.md. |
| III. Code Quality & Component Standards | Named arrow exports, typed props inline, `cn()` for conditional classes, CLI-managed shadcn/ui only, named exports | ✅ PASS | New modules export named functions/consts; no React component is added; `Palette.tsx`/`EditorCanvas.tsx` keep their existing patterns; no shadcn component is added or edited. |
| IV. No Feature Bloat | Feature originates from a spec in `specs/`; tracked in `docs/Features.md`; no roadmap step lists | ✅ PASS | O-018 is already registered in `docs/Features.md`'s dependency diagram (`O018 --> F015`). The change is deliberately one predicate plus one small pure module; a terrain-kind registry is explicitly rejected as bloat (research D1). |
| V. Performance & Static Delivery | No unjustified dependency; performance considered; assets optimized | ✅ PASS | Zero new dependencies and zero new assets (an existing 2.4 KB PNG is registered). The mushroom draws inside the existing terrain pass; the squash list is tiny and the common case allocates nothing. |

**Post-Phase-1 re-check**: All five gates still pass. The design introduces no
new dependency, no backend, no `any`, no shadcn edits, and no new asset. See
[research.md](./research.md) for the decisions and rejected alternatives.

**Complexity Tracking**: No violations — the table is intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/O-018-platformer-mushroom-blocks/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── mushroom-terrain.md
│   ├── mushroom-bounce.md
│   └── rendering-editor.md
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── level/
│   ├── LevelData.ts                  # EDIT: add `bouncyMushroom` + `decorativeMushroom` to TileType
│   ├── LevelParser.ts                # EDIT: `§`/`s` in TERRAIN_CHARS + TileChar
│   ├── LevelParser.test.ts           # EDIT: character mapping + sync-test `tileChars` literal
│   ├── Terrain.ts                    # EDIT: `isStandableMushroomCap`
│   └── Terrain.test.ts               # EDIT: cap predicate cases
├── engine/
│   ├── PhysicsConfig.ts              # EDIT: `mushroomBounceVelocity: -650`
│   ├── Physics.ts                    # EDIT: cap ground term + `playerOnMushroomCap`
│   ├── Physics.test.ts               # EDIT: land/fall-through + bounce-query cases
│   ├── EnemyAI.test.ts               # EDIT: enemies treat both kinds as non-solid (FR-014)
│   ├── MushroomSquash.ts             # NEW: pure squash state, timing, dip curve
│   ├── MushroomSquash.test.ts        # NEW: unit tests (TDD, written first)
│   ├── StaticObjectsCatalog.ts       # EDIT: role entries, `mushroomHasCap`, cap height, decorative entry
│   ├── StaticObjectsCatalog.test.ts  # EDIT: role/entry coverage
│   ├── Renderer.ts                   # EDIT: `tileSource` null cases + mushroom draw branch + two params
│   └── Renderer.test.ts              # EDIT: role crops, squash shift, no-sheet fallback
├── entities/sprites/
│   └── sheets.ts                     # EDIT: MUSHROOM_SHEET registration
├── editor/
│   ├── paletteTiles.ts               # EDIT: `§`/`s` sprite/label/description
│   ├── paletteTiles.test.ts          # EDIT: `§`/`s` entries
│   ├── Palette.tsx                   # EDIT: `s` -> DECORATION_CHARS
│   ├── Palette.test.tsx              # EDIT: group membership
│   ├── EditorCanvas.tsx              # EDIT: EditorImages.mushroom + pass sheet to drawTerrain
│   ├── EditorCanvas.test.tsx         # EDIT: EMPTY_IMAGES fixture + exact-arg drawTerrain assertions
│   ├── EditorCanvasPane.tsx          # EDIT: EMPTY_IMAGES + IMAGE_SOURCES gain mushroom
│   ├── importLayout.test.ts          # EDIT: `§`/`s` save/reload round-trip
│   └── exportLayout.test.ts          # EDIT: `§`/`s` save/reload round-trip
├── PlatformerState.ts                # EDIT: mushroomSquashStates signal, tick, resetGame clear
├── PlatformerState.test.ts           # EDIT: squash signal + reset lifetime
├── PlatformerPage.tsx                # EDIT: bounce aggregation, squash start/tick, draw + load sheet
└── PlatformerPage.test.tsx           # EDIT: bounce/pass-through/repeat/squash integration

docs/themes/platformer/
├── Terrain.md                        # EDIT: TileType table, predicate, run helpers, squash state
└── LevelFormat.md                    # EDIT: `§`/`s` terrain characters
```

**Structure Decision**: Single static web app. All work lands inside the
existing `src/themes/platformer/` tree, following the established split of
concerns: pure math/predicates in `level/` and `engine/`, per-instance
transient state in `PlatformerState.ts`, orchestration + canvas ownership in
`PlatformerPage.tsx`, authoring in `editor/`. `isStandableMushroomCap` is a
canvas-free predicate in `Terrain.ts`, `playerOnMushroomCap` is a pure query in
`Physics.ts`, and `MushroomSquash.ts` is a canvas-free/DOM-free module, so all
three are unit-testable without a browser; `Renderer.ts` remains the only
module that maps world coordinates to canvas coordinates.

## Complexity Tracking

> No constitution violations — nothing to justify.

## Next Steps

- `/speckit.tasks` — break this plan into tasks
- `/speckit.checklist` — create a checklist for domain validation
