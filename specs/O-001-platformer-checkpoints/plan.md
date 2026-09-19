# Implementation Plan: Platformer Checkpoints

**Branch**: `O-001-platformer-checkpoints` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-001-platformer-checkpoints/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a hand-placed, non-solid **checkpoint** marker (uppercase `C`) to the
Platformer theme. Stepping onto it with solid ground below raises a grey flag
to gold, plays a one-shot particle burst and a short localized "Checkpoint"
label that fades in place, and makes that cell the active respawn point for
the rest of the run. A death then restarts the character on the active
checkpoint with full health and the camera already there, preserving every
collected fact, key, chest and block; Reset Game returns every flag to dormant.
The tile is authorable in the level editor (palette entry, paint/erase,
save/load round-trip) and is not placed in the shipped level.

Technical approach: one new entity marker (`ENTITY_CHARS` `C` → `'checkpoint'`)
flowing through the existing parser → mapper → signal pipeline, a new
`CheckpointState` signal alongside `chestStates`/`blockStates`, a pure
`resolveCheckpointContacts` tick resolver reusing `overlappingTriggers` and
`isSolid`, the existing `PuffEffect` for the burst, a new in-place
`FadeOutTextEffect`, a rendered glow pass for the active target, and a
parameterized spawn/respawn helper so `resetGame()` places the character on the
active checkpoint. Everything follows `docs/Architecture.md` (signals over
context, typed immutable state, typed JSON/no backend) and
`docs/TestingGuide.md` (TDD, Vitest + RTL + jsdom, `{method}-{condition}-{expected-result}`).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`), React 19, Vite 6+
**Primary Dependencies**: `@preact/signals-react` (run state), Tailwind CSS 4
+ shadcn/ui (editor palette UI only — no new shadcn components needed),
existing canvas renderer. No new dependency.
**Storage**: In-memory Preact signals only. Checkpoint memory is
session-scoped by design (survives death/respawn, cleared by Reset Game); no
`localStorage`, no backend, no API calls.
**Testing**: Vitest + React Testing Library + jsdom (`docs/TestingGuide.md`).
TDD is mandatory (constitution Principle II): failing tests first.
**Target Platform**: Browser — static Vite build, deployed as static assets
**Project Type**: Single-project static web app (`src/` + `specs/`)
**Performance Goals**: 60 fps game loop. Cost added per frame is O(checkpoints)
box tests, one sprite draw per checkpoint, one glow draw for the active one,
and the transient label pass — negligible at the spec's scale.
**Constraints**: Flat 2D pixel-art sprite (no 2.5D/3D shading), fixed 4-frame
16×24 strip; no audio (O-008 uncommitted); TypeScript strict; feature isolated
to the Platformer theme; the shipped `LEVEL_1_LAYOUT` must not gain a `C`.
**Scale/Scope**: A handful of checkpoints per level; one new marker character,
one entity module, one mapper, one logic module, one effect type, one camera
helper, plus editor palette/preview wiring and two locale strings.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Principle | Verdict | Notes |
| --- | --- | --- | --- |
| I | Typed Data Architecture | ✅ PASS | CV content still comes only from typed JSON; checkpoint state is typed immutable data in signals. No runtime parsing, no API, no `any`. Types declared in the owning module before use, matching `Entities.md`. |
| II | Testing (NON-NEGOTIABLE) | ✅ PASS | TDD: tests written before implementation. New pure modules get Vitest unit tests; loop behaviour gets `PlatformerPage.test.tsx` integration tests. Naming and `Arrange/Act/Assert` per `docs/TestingGuide.md`. Coverage targets apply to `src/lib/`/`src/components/`; engine modules follow the existing Platformer test convention. |
| III | Code Quality and Component Standards | ✅ PASS | New modules use named arrow exports, typed data, no default exports. The only UI touch is data rows in `paletteTiles.ts` and the auto-generated palette button — no hand-edited shadcn component, no copy-paste. `cn()` unaffected. |
| IV | No Feature Bloat | ✅ PASS | The work originates from `specs/O-001-platformer-checkpoints/spec.md`. It is a discrete unit with an ID in `docs/Features.md`. No exploratory changes; completion updates the feature list, status table and dependency diagram. |
| V | Performance and Static Delivery | ✅ PASS | No new dependency; one tiny sprite (464 B) already in `public/`; constant per-frame work. Static build unaffected. |
| TC | Technical Constraints | ✅ PASS | Vite/React/TS-strict/Tailwind/shadcn/npm/no backend — all respected. |
| WF | Workflow & Quality Gates | ✅ PASS | Constitution: "All changes via feature branches." The `O-001-platformer-checkpoints` branch is checked out (created 2026-09-19); `.specify/feature.json` points at this spec. No auto-commits. A manual browser check (quickstart.md) is required before review. |

**Gate result**: PASS. The former workflow action item (feature branch) is
resolved — `O-001-platformer-checkpoints` is checked out. No unjustified
exceptions; `Complexity Tracking` is empty.

_Post-Phase-1 re-check_: PASS — the design introduces no new dependency, no
backend, no untyped data, and no feature beyond the spec. The only structural
addition is one entity module + one mapper + one logic module, which matches
the established "adding a type is one module + one registry/marker line"
convention in `Entities.md`.

## Project Structure

### Documentation (this feature)

```text
specs/O-001-platformer-checkpoints/
├── spec.md              # Feature specification (done)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── level-marker.md      # The `C` character / editor / saved-file contract
│   └── checkpoint-api.md    # The new modules' public surface + invariants
├── checklists/
│   └── requirements.md  # Spec quality checklist (done)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── i18n/
│   └── locales/
│       ├── en.json                      # MODIFY: + platformer.checkpoint.label
│       └── de.json                      # MODIFY: + platformer.checkpoint.label
└── themes/platformer/
    ├── PlatformerPage.tsx               # MODIFY: load strip, draw passes, tick resolver, respawn camera/center
    ├── PlatformerState.ts               # MODIFY: checkpoint signals, respawn helpers, reset semantics
    ├── types.ts                         # (unchanged)
    ├── entities/
    │   ├── Checkpoint.ts                # NEW: state, frame logic, box, draw, glow, sheet
    │   └── Checkpoint.test.ts           # NEW
    ├── engine/
    │   ├── CheckpointLogic.ts           # NEW: solid-ground check + deterministic tick resolver
    │   ├── CheckpointLogic.test.ts      # NEW
    │   ├── CollectionEffects.ts         # MODIFY: + FadeOutTextEffect
    │   ├── CollectionEffects.test.ts    # MODIFY
    │   ├── Renderer.ts                  # MODIFY: + drawCheckpoints, drawFadeOutTexts
    │   ├── Renderer.test.ts             # MODIFY
    │   └── Camera.ts                    # MODIFY: + initialCameraX
    │   └── Camera.test.ts               # MODIFY
    ├── level/
    │   ├── LevelParser.ts               # MODIFY: EntityKind, ENTITY_CHARS, findCheckpointTiles, TileChar
    │   ├── LevelParser.test.ts          # MODIFY
    │   ├── level.ts                     # MODIFY: CHECKPOINT_TILES + marker inventory comment
    │   ├── level.test.ts                # MODIFY
    │   ├── CheckpointMapper.ts          # NEW
    │   └── CheckpointMapper.test.ts     # NEW
    └── editor/
        ├── paletteTiles.ts              # MODIFY: C sprite (raised frame), label, description
        ├── paletteTiles.test.ts         # MODIFY
        ├── gridRenderState.ts           # MODIFY: synthesizeCheckpointStates
        ├── gridRenderState.test.ts      # MODIFY
        ├── EditorCanvas.tsx             # MODIFY: load + draw checkpoint preview
        ├── EditorCanvas.test.tsx        # MODIFY
        └── LevelEditorPage.tsx          # MODIFY: add the strip to the editor's image list

docs/
├── Features.md                          # MODIFY on completion: check O-001, status table, diagram
└── themes/platformer/
    ├── LevelFormat.md                   # MODIFY: Entity characters table + TileChar count
    └── LevelDesign.md                   # MODIFY: element table `C` row
```

**Structure Decision**: Single project, feature confined to
`src/themes/platformer/`. The new code is split exactly the way the existing
Platformer code is (`Entities.md`): a **state/type module**
(`entities/Checkpoint.ts`), a **marker→placement mapper**
(`level/CheckpointMapper.ts`), and **pure logic** (`engine/CheckpointLogic.ts`),
with rendering folded into the shared `engine/Renderer.ts` and loop wiring in
`PlatformerPage.tsx`/`PlatformerState.ts`. This keeps the "one module per
type" convention and avoids a new dispatcher, since a checkpoint is a single
type, not a registry family.

## Phase 0: Outline & Research

Output: [research.md](./research.md). All Technical Context unknowns resolved.
Key decisions: marker as an entity character (R1); `checkpointStates` signal +
single `activeCheckpointId` (R2); reuse `overlappingTriggers` + `isSolid` with
reading-order determinism (R3); reuse `PuffEffect`, add an in-place
`FadeOutTextEffect`, derive the flag frame from a write-once `activatedAt`
against the shared world clock (R4);
rendered glow pass, not a sprite frame (R5); parameterized spawn maths +
`resetGame` respawn + `initialCameraX` (R6); the existing
`checkpoint-flag-strip.png` as the single art source, palette crops frame 3
(R7); `platformer.checkpoint.label` in both locales (R8); update the level
docs + `docs/Features.md` (R9); TDD per `docs/TestingGuide.md` (R10).

## Phase 1: Design & Contracts

- [data-model.md](./data-model.md) — marker contract, `CheckpointPlacement`,
  `CheckpointState`, the active-target rule, the activation effects, respawn
  position, the signal inventory with per-reset behaviour, and the camera
  helper.
- [contracts/level-marker.md](./contracts/level-marker.md) — the author-facing
  `C` contract: registration, reading order, editor round-trip, saved files,
  shipped-level exclusion, backward compatibility.
- [contracts/checkpoint-api.md](./contracts/checkpoint-api.md) — the public
  surface and invariants of the new/modified modules.
- [quickstart.md](./quickstart.md) — run + manual verification script.

**Agent context update**: `.github/copilot-instructions.md` does not exist in
this repository and there is no agent-context script under `.specify/scripts/`
(only `setup-plan`, `common`, `check-prerequisites`, `create-new-feature`), so
there is nothing to update. No action taken.

## Implementation Approach

Ordered so tests precede implementation (TDD), and so each step is
independently verifiable.

1. **Level marker** (`LevelParser.ts`, `level.ts`): add `'checkpoint'` to
   `EntityKind`, `C` to `ENTITY_CHARS`, `'C'` to `TileChar`, and
   `findCheckpointTiles`; add the `CHECKPOINT_TILES` computed. Tests: the
   overlap guard still passes; `C` parses to `'empty'`; the finder returns
   reading order; the shipped layout contains no `C`.
2. **Mapper** (`CheckpointMapper.ts`): `placeCheckpoints` with ids
   `checkpoint-${col}-${row}` and `tileToPixel`. Tests for order, id and
   coordinates.
3. **Entity module** (`Checkpoint.ts`): `CheckpointState`, `toCheckpointState`,
   `checkpointBox`, `checkpointFrameIndex` (takes `worldElapsed`),
   `activateCheckpoint` (stamps `activatedAt`), `checkpointEffectAnchor`,
   `drawCheckpoint`, `drawCheckpointGlow`, and `CHECKPOINT_FLAG_SHEET`
   (16×24, 4 columns). Tests for frame progression/hold against the clock,
   dormant frame, box geometry, sheet metadata.
4. **Effects** (`CollectionEffects.ts`): generic in-place fading text —
   `FadeOutTextEffect` (carries its own `text`) + start/tick/opacity. Tests for
   the fade curve and expiry.
5. **Logic** (`CheckpointLogic.ts`): `hasSolidGroundBelow` and
   `resolveCheckpointContacts`. Tests for ground gating, dormant-wins tie,
   reading-order determinism, re-touch no-replay, and purity.
6. **Camera** (`Camera.ts`): `initialCameraX`. Tests for centring and clamping.
7. **State** (`PlatformerState.ts`): signals `checkpointStates`,
   `activeCheckpointId`, `activeFadeOutTexts`; **computed** signals
   `checkpointPlacements`, `activeRespawnPlacement`, `respawnPlayerState`,
   `respawnCenter`; the pure helper `playerStateAtTile`; update `resetGame`
   (respawn at `respawnPlayerState.value`, do not touch checkpoint state) and
   `resetGameProgress` (clear checkpoint state before `resetGame`). Tests for
   the reset semantics and the derived signals.
8. **Renderer** (`Renderer.ts`): `drawCheckpoints` (glow before flag, frame
   from state, bottom-anchored/centred) and `drawFadeOutTexts` (localized,
   in place). Tests via the existing fake-context helpers.
9. **Loop wiring** (`PlatformerPage.tsx`): load the strip; draw checkpoints and
   labels; resolve contacts each live tick, stamping `activatedAt` and starting
   the puff and label once per `activatedIds` entry and updating
   `activeCheckpointId`; rename `snapCameraYToSpawn` → `snapCameraToRespawn`
   (X + Y) and use `respawnCenter.value` for the restart/debug/Reset Game paths;
   advance the `activeFadeOutTexts` timers (the flag raise derives from the
   shared world clock, so it needs no per-frame tick). Integration tests in
   `PlatformerPage.test.tsx`.
10. **Editor** (`paletteTiles.ts`, `gridRenderState.ts`, `EditorCanvas.tsx`,
    `LevelEditorPage.tsx`): `C` palette entry with raised-frame crop, label and
    description; `synthesizeCheckpointStates`; draw the preview; register the
    strip with the editor's image loader. Tests for the palette entry and the
    synthesized preview.
11. **Localization** (`en.json`, `de.json`): `platformer.checkpoint.label`.
12. **Docs** (`LevelFormat.md`, `LevelDesign.md`, `level.ts` comment); on
    completion, `docs/Features.md` (feature list, status table, dependency
    diagram, `class O001 done`).

**Cross-cutting constraints**
- No `any`; strict TypeScript.
- All new state is immutable, plain data held in signals (`Entities.md`).
- Tests written first, per `docs/TestingGuide.md`; existing suites must stay
  green.
- No auto-commit; a manual browser check (quickstart.md) is required before
  review.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The design reuses existing patterns (entity marker, signal
state, effect vocabulary, mapper, registry-free single type) and adds no new
dependency, abstraction layer, or shared interface.

## Next Steps

- The `O-001-platformer-checkpoints` feature branch is checked out (created
  2026-09-19).
- Tasks are generated in [tasks.md](./tasks.md); run `/speckit.implement` to
  execute them.
- Run `/speckit.checklist` for a domain-validation checklist if desired.
