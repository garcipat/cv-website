# Implementation Plan: Platformer Crouch/Duck

**Branch**: `S-012-platformer-crouch-duck` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/S-012-platformer-crouch-duck/spec.md`

## Summary

Add a hold-Down crouch to the platformer. While the character is grounded and
no higher-priority Down context applies (ladder descent, then bridge
drop-through), it shrinks to a one-tile collision box, crawls at ~120 px/s,
cannot jump, and stands back up only when its full standing box fits in clear
space. The crouch uses a dedicated four-frame duck row appended to the knight
sheet (drawn low/horizontal, held still while stationary, looping all four
frames while crawling) and is taught by the upfront key
legend, with the S-009 signpost as a fallback. Two requirements were added to
the spec after the first plan and this plan now covers them:

- **FR-011 / SC-009** — a directional hit taken while crouched still deals
  damage, opens the invulnerability window and shows the red reaction, but
  applies **no knockback** (horizontal or vertical) and keeps the one-tile box
  for the whole reaction, so a hit under a ceiling can never force the
  character to stand.
- **FR-016** — the crouched red reaction is a **reusable render-time tint**
  applied to the crouch pose; no new red-tinted crouch art is authored and the
  standing hit reaction's existing baked red frame is left unchanged.

The implementation is: a pure, DOM-free `engine/Crouch.ts` decision module; one
shared box-geometry helper pair on `entities/Player.ts` consumed by both
`Physics.ts` and `Collision.playerHitbox`; one pure no-knockback hit helper
(`applyHitReaction`) on `Player.ts`; and one reusable
`drawTintedSprite` helper on `engine/Renderer.ts` (offscreen canvas +
`source-atop` red fill) applied by `drawPlayer` when the player is crouched and
in the hit reaction. `Renderer.ts` therefore **does** need an edit (the earlier
plan's "no edit required" statement is superseded).

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode, no `any` — Vite 6+, React 19
**Primary Dependencies**: React 19, `@preact/signals-react` (game state), Tailwind CSS 4 (legend/UI overlay). **No new dependency.**
**Storage**: N/A — static site; no backend, no API calls, no database. Crouch is session-scoped in-memory `PlayerState` only (constitution Principle I; [docs/Architecture.md](../../docs/Architecture.md) "No backend" / Technical Constraints).
**Testing**: Vitest + React Testing Library + jsdom ([docs/TestingGuide.md](../../docs/TestingGuide.md)). Pure engine/entity helpers (`engine/Crouch.ts`, `applyHitReaction`, `drawTintedSprite`) are unit-tested DOM-free; `drawPlayer` is tested with a fake `CanvasRenderingContext2D` and a fake offscreen layer, exactly as `drawDarkness` is today.
**Target Platform**: Web browser, static Vite build; win32 dev environment, Linux/CI target.
**Project Type**: Single project — Vite + React static site. The platformer theme is self-contained under `src/themes/platformer/`.
**Performance Goals**: 60 fps game loop; initial static load < 1.5 s; interaction feedback < 200 ms (constitution Principle V). The crouched-hit tint reuses one 64×64 offscreen canvas owned by `PlatformerPage.tsx`; no per-frame allocation.
**Constraints**: No new sprite art; no new level tile or level-format change; no new input key; no new dependency; S-008 ladder and bridge Down behaviour byte-for-byte unchanged; S-010 standing hit frame unchanged.
**Scale/Scope**: One gameplay theme (`platformer`); ~13 touched source files plus co-located tests; no CV data or shared type changes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Result |
| --- | --- | --- |
| **I. Typed Data Architecture** | New state is the typed `PlayerState.crouching: boolean`; the tint is a typed config consumed by a typed helper; no `any`, no runtime parsing, no CV JSON touched | **PASS** |
| **II. Testing (NON-NEGOTIABLE)** | TDD; `resolveCrouching`/`canStandUp`, `applyHitReaction` and `drawTintedSprite` are pure and unit-testable with Vitest (the renderer via a caller-provided fake layer, no DOM); existing ladder/bridge assertions run unchanged | **PASS** |
| **III. Code Quality & Component Standards** | Named arrow-function exports, typed props destructured inline, `cn()` for conditional Tailwind, PascalCase/camelCase, no default exports; no shadcn change | **PASS** |
| **IV. No Feature Bloat** | Work originates from `specs/S-012-platformer-crouch-duck/spec.md`; FR-011/FR-016/SC-009 live inside that spec; no roadmap or numbered step list; `docs/Features.md` dependency diagram is updated only on completion | **PASS** |
| **V. Performance & Static Delivery** | One reused offscreen canvas (no per-frame allocation), no new asset or dependency, no measurable bundle increase | **PASS** |
| **Workflow — manual browser check** | [quickstart.md](./quickstart.md) defines a browser check for every visible behaviour: pose, crawl animation, render-time red tint, no-knockback/no-stand hit | **PASS** |
| **Workflow — no auto-commits** | This plan writes only spec artifacts; no commit is made | **PASS** |

No violations. **Complexity Tracking: none.**

> Note (documentation only, not a violation): `docs/Features.md` now holds only
> the dependency map, and constitution Principle IV's wording still refers to a
> "feature list". Reconciling that wording is a separate constitution
> amendment (per `AGENTS.md`), out of scope for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/S-012-platformer-crouch-duck/
├── plan.md                          # This file
├── research.md                      # Phase 0 output (D1–D14)
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   ├── crouch-physics.md            # engine/Crouch.ts + stepPlayerPhysics
│   ├── collision-box.md             # the one shared reduced box (unchanged, still authoritative)
│   ├── crouched-hit-reaction.md     # FR-011 / FR-016 / SC-009 (NEW)
│   ├── rendering-animation.md       # pose + render-time tint (UPDATED)
│   └── onboarding-level.md          # legend/sign + low corridor (unchanged)
├── checklists/requirements.md       # produced by /speckit.checklist
└── tasks.md                         # produced by /speckit.tasks — NOT created by /speckit.plan
```

### Source Code (repository root)

```text
src/
├── i18n/locales/
│   ├── en.json                                   # + platformer.controlsOverlay.crouch
│   └── de.json                                   # + matching key (typed Translation)
└── themes/platformer/
    ├── PlatformerPage.tsx                         # Down wiring, crouched-hit call sites,
    │                                              #   reusable hit-tint layer ref
    ├── components/
    │   ├── ControlsOverlay.tsx                    # + crouch legend caption (sign is fallback)
    │   └── ControlsOverlay.test.tsx
    ├── editor/gridRenderState.ts                  # synthesizePlayerState seeds crouching: false
    ├── engine/
    │   ├── Crouch.ts                              # NEW pure module: canStandUp / resolveCrouching
    │   ├── Crouch.test.ts                         # NEW
    │   ├── Physics.ts                             # crouch integration + hit/no-knockback interplay
    │   ├── Physics.test.ts
    │   ├── PhysicsConfig.ts                       # + crouchSpeed: 120
    │   ├── Collision.ts                           # playerHitbox reads the shared box helpers
    │   ├── Collision.test.ts
    │   ├── Renderer.ts                            # drawTintedSprite + drawPlayer tint branch
    │   ├── Renderer.test.ts
    │   ├── DebugOverlay.ts                        # crouched head line
    │   └── DebugOverlay.test.ts
    ├── entities/
    │   ├── Player.ts                              # + crouching field, box helpers, 'crouch' anim,
    │   │                                          #   applyHitReaction
    │   └── Player.test.ts
    ├── level/
    │   ├── level.ts                               # + one-tile corridor (existing tiles only)
    │   ├── level.test.ts
    │   └── LevelParser.ts                         # only if the sign fallback is used
    └── PlatformerState.ts                         # playerStateAtTile seeds crouching: false
```

**Structure Decision**: Single project (Vite + React static site). The platformer
theme is a self-contained layout tree under `src/themes/platformer/` with
pure, DOM-free engine modules in `engine/`, each unit-tested by a co-located
`*.test.ts` — the structure [docs/Architecture.md](../../docs/Architecture.md)
describes under "Theme isolation" and "Typed data, presentational components",
and the "Unit — pure utility functions" row of
[docs/TestingGuide.md](../../docs/TestingGuide.md). No backend/web-service or
mobile structure applies. The feature adds exactly one engine module
(`engine/Crouch.ts`) and edits existing engine/entity files; it introduces no
new architectural layer, and the render-time tint follows the existing
caller-owned offscreen-canvas pattern (`drawDarkness`).

## Complexity Tracking

> No constitution violations. Nothing to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| _none_ | — | — |

## Post-Design Constitution Re-Check (after Phase 1)

Re-evaluated after producing `research.md`, `data-model.md`, `contracts/` and
`quickstart.md`: all seven gates above still **PASS**.

- The only stored state remains the single typed `PlayerState.crouching`; the
  tint is derived at render time and never persisted (Principle I).
- Every new behaviour has a named pure helper or a fake-layer-testable renderer
  path (Principle II).
- The offscreen tint layer is caller-owned and reused, adding no per-frame
  allocation and no dependency (Principle V).
- The standing hit frame, the ladder/bridge Down paths and every existing
  box consumer are explicitly left unchanged, and FR-014's "no other mechanic
  changes" is recorded in the contracts (Principles IV, V).
