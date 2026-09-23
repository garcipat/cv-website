# Implementation Plan: Platformer Falling Stalactite

**Branch**: `O-027-platformer-falling-stalactite` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-027-platformer-falling-stalactite/spec.md`

## Summary

Add a new hand-placed hazard kind, the **falling stalactite**, whose marker character `T` sits
under a ceiling and renders exactly like the decorative `⊤` stalactite (same large/twin art, no
in-game tint). When the player's hitbox enters a bounded detection zone below it (the three columns
directly beneath, reaching down to the first standable cell in its own column or 10 tiles, clipped
per column by standable cells), the stalactite shakes for a short fixed telegraph, then falls
straight down its column. It is hazardous only while falling — the same half-heart, shared
invincibility, no-knockback contact as a spike (O-005/F-016) — and shatters on the first cell the
player can stand on (or despawns off the level bottom) using the crumbling floor's falling-debris
effect (O-023), which is extracted/generalized so both hazards share one implementation. A shattered
stalactite stays gone for the attempt and returns on death/respawn or Reset Game. The tile is
authorable from the editor's hazard palette and its painted cell is tinted reddish in the editor
only.

The implementation follows [docs/Architecture.md](../../docs/Architecture.md) (typed data,
signals, static build) and [docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest + RTL + jsdom,
TDD, `{method}-{condition}-{expected}` naming).

## Technical Context

**Language/Version**: TypeScript (strict mode), React 19, Vite 6+
**Primary Dependencies**: Preact Signals (`@preact/signals-react`) for game state, HTML5 Canvas 2D for
rendering, Tailwind CSS 4 + shadcn/ui for the editor chrome only. No new dependencies.
**Storage**: N/A — static site; level layouts are TypeScript `string[]` layouts parsed to typed grids.
No backend, no API, no database.
**Testing**: Vitest + React Testing Library + jsdom (`npm test`). New engine/hazard modules are pure
functions with full unit coverage; integration behavior covered in `PlatformerPage.test.tsx`;
editor palette tint covered by component tests.
**Target Platform**: Browser (static build served from `dist/`).
**Project Type**: Single static frontend web app (React game + level editor under
`src/themes/platformer/`).
**Performance Goals**: Maintain the 60 fps game loop. Detection and landing scans are bounded
(≤3 columns × ≤10 rows) per hazard per tick; no per-tick allocation regressions beyond the existing
`hazardPlacementsForTick()` map. No new sprite sheets (the stalactite art already ships in
`decorations.png`).
**Constraints**: No `any` (constitution I). TDD, all tests green before merge (constitution II).
Visible behavior additionally verified by a manual browser check (constitution workflow).
**Scale/Scope**: 1 new `HazardKind` + marker char, 2 new engine modules
(`FallingStalactite.ts`, shared `Standable.ts`), 1 new hazard module, 1 generalized debris effect,
edits to the hazard registry, level parser/mapper, physics/collision, game state/page, and the editor
palette/canvas. No new assets.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Assessment | Notes |
| --------- | ---------- | ----- |
| **I. Typed Data Architecture** | **PASS** | All new state is typed (`FallingStalactiteTimerState`, `DebrisEffect`/`DebrisLayer`, extended `HazardPlacement`); no runtime parsing, no `any`. Level content stays hand-authored `string[]` layouts. |
| **II. Testing (NON-NEGOTIABLE)** | **PASS** | TDD: `engine/FallingStalactite.test.ts`, `engine/Standable.test.ts`, `entities/hazards/FallingStalactite.test.ts`, extended `CollectionEffects.test.ts`/`Renderer.test.ts`/`Collision.test.ts`/`PlatformerState.test.ts`/`PlatformerPage.test.tsx`, and editor palette/canvas tests are written first. Naming follows `{method}-{condition}-{expected}`. |
| **III. Code Quality and Component Standards** | **PASS** | Named arrow-function exports, typed props, `cn()` for the palette tint overlay. No shadcn/ui component changes. |
| **IV. No Feature Bloat** | **PASS** | Backed by this spec (O-027); no roadmap/step list introduced. `docs/Features.md` dependency diagram updated only when implementation + tests are fully done. |
| **V. Performance and Static Delivery** | **PASS** | No new dependency or asset; bounded scans; reuses the existing transient-effects signal. |

**Post-Phase 1 re-check**: PASS — the design adds no dependency, no server, and no untyped state; the
debris-effect generalization reduces duplication rather than adding a parallel implementation.

## Project Structure

### Documentation (this feature)

```text
specs/O-027-platformer-falling-stalactite/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── hazard-and-effects.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── engine/
│   ├── FallingStalactite.ts        # NEW: phase machine, timers, detection zone, landing resolution
│   ├── FallingStalactite.test.ts   # NEW
│   ├── Standable.ts                # NEW: shared "cell the player can stand on" predicate
│   ├── Standable.test.ts           # NEW
│   ├── StaticObjectsCatalog.ts     # EDIT: isStalactiteTwin + TWIN_LEFT_RECT/TWIN_RIGHT_RECT
│   ├── StaticObjectsCatalog.test.ts # EDIT
│   ├── CollectionEffects.ts        # EDIT: generalize CrumbleDebrisEffect -> DebrisEffect (art layers)
│   ├── CollectionEffects.test.ts   # EDIT
│   ├── Renderer.ts                 # EDIT: drawCrumbleDebrisEffects -> drawDebrisEffects (layered source)
│   ├── Renderer.test.ts            # EDIT
│   ├── Physics.ts                  # EDIT: ground branch delegates to engine/Standable.ts
│   ├── Collision.ts                # EDIT: checkFallingStalactiteTriggers
│   └── Collision.test.ts           # EDIT
├── entities/hazards/
│   ├── FallingStalactite.ts        # NEW: HazardType module (box/isContact/draw, twin parity)
│   ├── FallingStalactite.test.ts   # NEW
│   └── index.ts                    # EDIT: register fallingStalactite in HAZARD_TYPES
├── level/
│   ├── LevelParser.ts              # EDIT: 'T' marker, HazardKind, TileChar
│   ├── LevelParser.test.ts         # EDIT
│   ├── HazardMapper.ts             # EDIT: HazardPlacement col/row + merged phase fields
│   ├── LevelData.ts                # (no change; marker resolves to 'empty' terrain)
│   └── Terrain.ts                  # (no change to tile union; standability stays where it is)
├── editor/
│   ├── paletteTiles.ts             # EDIT: 'T' sprite/label/description + tint field
│   ├── paletteTiles.test.ts        # EDIT
│   ├── PaletteTile.tsx             # EDIT: render the reddish tint overlay
│   ├── PaletteTile.test.tsx        # EDIT
│   ├── Palette.tsx                 # (no change; hazard keys derived from HAZARD_CHARS)
│   ├── EditorCanvas.tsx            # EDIT: editor-only reddish tint pass over 'T' cells
│   ├── EditorCanvas.test.tsx       # EDIT
│   └── gridRenderState.ts          # EDIT: synthesizeHazardPlacements emits col/row
├── PlatformerState.ts              # EDIT: signal, arm/tick/reset, hazardPlacementsForTick merge
├── PlatformerState.test.ts         # EDIT
├── PlatformerPage.tsx              # EDIT: tick, trigger arming, shatter spawn, decorations sheet
├── PlatformerPage.test.tsx         # EDIT
└── entities/sprites/sheets.ts      # (no change; DECORATIONS_SHEET already registered)

docs/themes/platformer/
├── LevelFormat.md                  # EDIT: document the 'T' hazard marker
└── Terrain.md                      # EDIT (if it documents decorative stalactite behavior)
```

**Structure Decision**: Single-project static frontend. The feature follows the established
"one file + one registry line" hazard extension point (`entities/hazards/index.ts` + `HAZARD_CHARS`),
the "elapsed-driven pure phase machine keyed by placement id" pattern of
`engine/FloorSpike.ts`, the "shared transient effect list" pattern of
`engine/CollectionEffects.ts`, and the "shared standable predicate" that `engine/Physics.ts`
already computes inline. No new architectural layer is introduced.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
