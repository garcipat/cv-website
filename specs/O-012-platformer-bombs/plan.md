# Implementation Plan: Platformer Bombs

**Branch**: `O-012-platformer-bombs` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-012-platformer-bombs/spec.md`

## Summary

The platformer gains a **third pot kind — the blue bomb pot** — plus everything
downstream of it: a **bomb pickup**, a **carried count (cap 5) shown in the HUD**,
a **`B` place-bomb input**, a **ticking placed bomb that falls under gravity and
detonates after ~2 s**, and a **3×3 blast** that destroys destructible blocks,
defeats enemies and deals one full heart (2 hitpoints) to a character caught in
it — with **no chain reactions**.

The pot itself is deliberately cheap: it is one more `createPotType` kind
(`dropPolicy: 'everyBreak'`, `restoredOnRespawn: true`, fixed sprite
`world_tileset.png` frame 128) that merges into a bunch with coin and potion pots
through the existing kind-agnostic render plan, with no new merge code. The real
work is a small set of new pure engine modules — **`engine/PlacedBomb.ts`** (fuse,
fall, animation), **`engine/Blast.ts`** (clipped 3×3 area and target selection) —
and the orchestration that reuses the game's *existing* block-destruction,
enemy-defeat and player-damage pipelines rather than duplicating them.

The design follows [docs/Architecture.md](../../docs/Architecture.md) (typed
data, signals over context, canvas rendering, no backend) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest unit tests for pure
`engine/` modules, RTL/jsdom for the editor and page). All three new assets
(`bomb.png`, `explosion1.png`, `explosion2.png`) are already authored and present
under `public/sprites/`; the blue pot needs no new art.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`) + React 19
**Primary Dependencies**: Vite 6+, Preact Signals (`@preact/signals-react`), Canvas 2D API, Tailwind CSS 4 + shadcn/ui. **No new runtime dependency.**
**Storage**: N/A — static site. All new state is in-memory Preact signals (`placedBombs`, `carriedBombs`, `bombPickupStates`); the level editor's localStorage/JSON persistence is unchanged. No migration.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). TDD is mandatory (constitution Principle II); the pure `engine/PlacedBomb.ts` and `engine/Blast.ts` modules are unit-tested with no DOM, and the block/enemy/player outcome paths are covered through `PlatformerPage.test.tsx`.
**Target Platform**: Static web (browser), desktop + mobile, reached via `/platformer` and `/platformer/editor`.
**Project Type**: Single static web app — a canvas game theme (`src/themes/platformer/`) inside the CV site.
**Performance Goals**: 60 fps. Per-tick cost is O(live placed bombs) for the fuse/fall step (each capped at 9 blast tiles on detonation) plus one `computePotRenderPlan` already run today. No new per-frame allocation beyond the tiny state arrays already replaced each tick.
**Constraints**: No backend/API/DB; no new dependencies; strict TypeScript. A placed bomb is **non-solid** and is never part of `blockPlacements`/physics collision. A blast affects **only** destructible blocks, enemies and the player — never terrain, static objects, loose pickups, or another placed bomb. A **`bridge`** is a solid landing surface for a falling bomb; a **`ladder`** tile is open air. The controls overlay MUST NOT advertise the bomb key.
**Scale/Scope**: One feature. Three new entity/pickup modules + two new pure engine modules (+ their tests), two new sprite-sheet registrations, one new level marker letter and one new sign digit, and edits to ~20 existing files across `level/`, `engine/`, `entities/`, `editor/`, `i18n/`, `PlatformerState.ts` and `PlatformerPage.tsx`.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Status | Notes |
| --- | --- | --- | --- |
| I. Typed Data Architecture | Types declared before use; no `any`; typed data imported directly | ✅ PASS | New types (`PlacedBombState`, `ExplosionEffect`, `BombPickupState`, `BombKind`) are declared in their own modules before consumers. `bombPot` is added to the `BlockKind`/`BlockDef.blockKind` unions; `bomb` to the derived `PickupKind`. No runtime parsing, no API, no `any`. |
| II. Testing (NON-NEGOTIABLE) | Tests written and reviewed before implementation; all pass; `{method}-{condition}-{expectedResult}` naming; Vitest + RTL + jsdom | ✅ PASS | `engine/PlacedBomb.test.ts` and `engine/Blast.test.ts` cover fuse/fall/animation and area/target selection first; `entities/blocks/BombPot.test.ts`, `entities/BombPickup.test.ts` cover the pot and pickup; `LevelParser.test.ts`/`BlockMapper.test.ts`/`paletteTiles.test.ts`/`gridRenderState.test.ts` cover the new marker; `PlatformerState.test.ts` covers reset lifetime; `PlatformerPage.test.tsx` covers placement, cap, detonation, blast effects and onboarding. |
| III. Code Quality & Component Standards | Named arrow exports, typed props inline, `cn()` for conditional classes, CLI-managed shadcn/ui only, named exports | ✅ PASS | New modules export named functions/consts/types. No shadcn component is added, edited, or copy-pasted. Existing `Palette.tsx`/`EditorCanvas.tsx` patterns are extended, not restructured. |
| IV. No Feature Bloat | Feature originates from a spec in `specs/`; tracked in `docs/Features.md`; no roadmap step lists | ✅ PASS | O-012 is already registered in `docs/Features.md` (its node is marked done on completion, per the completion-tracking convention). Scope is fixed by the spec's Out of Scope (no throwing, no chaining, no new bomb types, no bomb-specific facts). |
| V. Performance & Static Delivery | No unjustified dependency; performance considered; assets optimized | ✅ PASS | Zero new dependencies. The three new PNGs are tiny pixel-art strips and are loaded lazily through the existing registry-driven loader (bomb/explosion sheets). Blast resolution is bounded to 9 tiles. |

**Post-Phase-1 re-check**: All five gates still pass. The design introduces no new
dependency, no backend, no `any`, and no shadcn edits. See
[research.md](./research.md) for the decisions and rejected alternatives.

**Complexity Tracking**: No violations — the table is intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/O-012-platformer-bombs/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── bomb-pot.md
│   ├── bomb-inventory.md
│   ├── placed-bomb.md
│   ├── blast.md
│   └── rendering-editor-onboarding.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── entities/
│   ├── blocks/
│   │   ├── BombPot.ts                 # NEW: createPotType bomb kind (drop 'bomb', everyBreak, restored)
│   │   ├── BombPot.test.ts            # NEW: kind contract + frame + registration
│   │   └── index.ts                   # EDIT: register bombPot
│   ├── pickups/
│   │   ├── Bomb.ts                    # NEW: PickupType view of a dropped bomb (bomb.png frame 0)
│   │   └── index.ts                   # EDIT: register bomb -> PickupKind gains 'bomb'
│   ├── BombPickup.ts                  # NEW: BombPickupState + spawn + size/offset constants
│   ├── BombPickup.test.ts             # NEW: spawn/box/centering
│   ├── Block.ts                       # EDIT: BlockKind += 'bombPot'
│   ├── sprites/sheets.ts              # EDIT: BOMB_SHEET + EXPLOSION_SHEET registrations
│   └── Health.ts                      # (unchanged; bomb damage reuses takeDamage)
├── engine/
│   ├── PlacedBomb.ts                  # NEW: pure fuse/fall/animation state machine
│   ├── PlacedBomb.test.ts             # NEW: landing scan, gravity, fuse timeline, frame sequence
│   ├── Blast.ts                       # NEW: pure 3x3 area + block/enemy/player target selection
│   ├── Blast.test.ts                  # NEW: clipping, block/enemy/player membership, exclusions
│   ├── CollectionEffects.ts           # EDIT: ExplosionEffect (transient visual, tick/frame)
│   ├── CollectionEffects.test.ts      # EDIT: explosion effect coverage
│   ├── Renderer.ts                    # EDIT: drawBombPickups, drawPlacedBombs, drawExplosions, drawBombCounter
│   ├── Renderer.test.ts               # EDIT: new draw passes + HUD counter
│   ├── Collision.ts                   # EDIT: checkBombPickupCollisions (cap-aware)
│   ├── Collision.test.ts              # EDIT: bomb pickup collision cases
│   └── Input.ts                       # EDIT: GAME_KEYS += 'KeyB'
├── level/
│   ├── LevelParser.ts                 # EDIT: ENTITY_CHARS 'b' -> bombPot; SIGN_CHARS '6' -> bomb; TileChar; findBombPotTiles
│   ├── LevelParser.test.ts            # EDIT: char mapping + finder + TileChar sync
│   ├── BlockMapper.ts                 # EDIT: BlockMarkerPositions.bombPot + placeBlocks
│   ├── BlockMapper.test.ts            # EDIT: bombPot placement
│   └── level.ts                       # EDIT: BOMB_POT_TILES; shipped layout gains a `b` + `6`
├── editor/
│   ├── paletteTiles.ts                # EDIT: 'b' (blue bottle) + '6' sign entries
│   ├── paletteTiles.test.ts           # EDIT: new entries
│   ├── gridRenderState.ts             # EDIT: synthesize bombPot from 'b'
│   └── gridRenderState.test.ts        # EDIT: bombPot synthesis
├── components/
│   └── ControlsOverlay.tsx            # (unchanged — deliberately no bomb keycap, FR-012)
├── types.ts                           # EDIT: BlockDef.blockKind += 'bombPot'
├── PlatformerState.ts                 # EDIT: blockPlacements bombPot; bombPickupStates; placedBombs; carriedBombs; MAX_BOMBS; reset wiring
├── PlatformerState.test.ts            # EDIT: seeding + reset lifetime
├── PlatformerPage.tsx                 # EDIT: KeyB placement, pickup collision, bomb tick, detonation + blast, draw + sheet loads
└── PlatformerPage.test.tsx            # EDIT: placement/cap/blast/onboarding integration

src/i18n/locales/en.json               # EDIT: platformer.hints.bomb + .noBombs
src/i18n/locales/de.json               # EDIT: platformer.hints.bomb + .noBombs
```

**Structure Decision**: Single static web app. All work lands inside the existing
`src/themes/platformer/` tree, following the established split of concerns: pure
math/state in `engine/` and `level/`, per-kind declarations in `entities/`,
per-instance session state in `PlatformerState.ts`, orchestration + canvas
ownership in `PlatformerPage.tsx`, authoring in `editor/`, and strings in
`src/i18n/`. The bomb pot is a drop-in `createPotType` kind (the O-017 extension
point), and the placed bomb / blast are pure canvas-free modules so they are
unit-testable without a browser. `Renderer.ts` remains the only module that maps
world coordinates to canvas coordinates.

## Complexity Tracking

> No constitution violations — nothing to justify.
