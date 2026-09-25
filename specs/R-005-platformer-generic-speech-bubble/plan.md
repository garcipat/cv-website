# Implementation Plan: Platformer Generic Speech Bubble (R-005)

**Branch**: `R-005-platformer-generic-speech-bubble` | **Date**: 2026-09-25 | **Spec**: [`specs/R-005-platformer-generic-speech-bubble/spec.md`](./spec.md)

**Input**: Feature specification from `/specs/R-005-platformer-generic-speech-bubble/spec.md`
(GitHub issue #93)

> **Regenerated**: the spec was amended after the previous plan. The superseded design folded the
> mushroom squash into the effect registry as a `mushroomSquash` kind; this plan instead moves it into
> `entities/blocks/Mushroom.ts` as a grid-cell-keyed timed tile, and the effect registry gains **only**
> `speechBubble`.
>
> **Regenerated again**: the spec was amended a second time on the bubble-text plumbing. The superseded
> design gave `EffectRenderContext` a `bubbleText` lookup resolved at draw time; this plan instead
> stores the resolved localized text on the `speechBubble` effect's own state (in `activeEffects`),
> resolved from the derived `state/hintText.ts` signal at spawn and refreshed by the page only when the
> text differs on a language change. The render context carries no text lookup; its `playerAnchor` is
> restructured into named points (`centerX` / `centerY` / `headBottomY` / `width`), carrying the head
> edge alongside the heal aura's centre (no new top-level field).

## Summary

Generalise the sign-named, already-generic `HintTooltip` into one registered transient effect kind
`speechBubble`; split the mixed `HintId` into an honest `SignHintId` (sign hints only) and
`BubbleMessageId` (everything a bubble can show), landing the catalog, both id types and the sign
definition in one `level/HintCatalog.ts` home; relocate the standalone `MushroomSquash` (and the
mushroom-specific cap-role art helpers) into a new `entities/blocks/Mushroom.ts` as a grid-cell-keyed
timed tile beside the mushroom, **not** as an effect kind. The player-visible game must not change
(FR-019/US4): same wording (including live language switching), anchor, timing, draw depth, reset
scope, and dip.

**Primary technical approach** (all decisions recorded in [`research.md`](./research.md)):

- **Speech bubble** → new `engine/effects/speechBubble.ts`, kind `'speechBubble'`, one constant-keyed
  singleton slot through the existing `spawnEffect`/`upsertEffect` path, layer `worldEffects` and
  inserted at `EFFECT_REGISTRY[0]` (before `flyingText`) so it draws at its current depth (after the
  darkness/enemy-eye overlay, before the other world effects) through the existing `drawEffects` call —
  no new draw call in the page. `engine/HintTooltip.ts` and the `hintTooltipState` signal are deleted
  (FR-001/FR-017).
- **Hint vocabulary** → the whole vocabulary (`SignHintId`, `BubbleMessageId`, `HINT_IDS`,
  `DEFAULT_HINT_ID`, `hintCode`, `nextHintId`, `isSignHintId`, `SignDef`) lives in
  `level/HintCatalog.ts`; `SignDef` moves there from the root `types.ts` so `types.ts` (which
  `contracts/Outcome.ts` imports) never reaches into `level/` and `contracts/` stays a leaf
  (FR-008/SC-007).
- **Localized text** → a derived `hintText` signal in the app/state layer (`state/hintText.ts`)
  mirrors `currentUI.value.platformer.hints`. The page resolves the bubble's text from it when the
  bubble spawns and stores it on the effect's own state (`SpeechBubbleState.text`); on a language
  change the render loop re-resolves it and rewrites that one effect **only when the text differs**, so
  a live bubble updates with no steady-state collection write. The editor's hint-marker label reads the
  same signal. The effect subsystem never imports app/i18n state, and the render context carries no
  lookup (FR-005/FR-020).
- **Mushroom squash** → new `entities/blocks/Mushroom.ts` owns the grid-cell-keyed squash timer (its
  state shape, `0.1 s` duration, `2 px` dip, `startMushroomSquash`/`advanceMushroomSquashes`/
  `mushroomSquashDipAt`, still delegating arm/advance/prune to `shared/timedTile.ts`) **and** the
  mushroom cap-role art helpers moved out of `engine/StaticObjectsCatalog.ts` (`mushroomEntry`,
  `mushroomHasCap`, `MUSHROOM_CAP_SOURCE_HEIGHT`, `MUSHROOM_DECORATIVE_ENTRY`). `engine/MushroomSquash.ts`
  is deleted; the registry gains no `mushroomSquash` kind; `mushroomSquashStates`/`tickMushroomSquashes`
  remain the keyed-timer signal and tick in `PlatformerState.ts`; the generic `verticalRunRole` stays in
  `level/Terrain.ts` (FR-010/FR-011/FR-012).
- **No new dependencies, no data migration, no gameplay/visual change.** The only sanctioned changes
  are the bubble generalisation, the id split/relocation, the squash + cap-art relocation, the
  render-context addition, and the corresponding import/name/test updates.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`), React 19, Vite 6, Node/npm. Matches
[docs/Architecture.md](../../docs/Architecture.md) and [AGENTS.md](../../AGENTS.md).

**Primary Dependencies**: React 19, `@preact/signals-react` (state), Canvas 2D (rendering). Test stack:
Vitest + React Testing Library + jsdom per [docs/TestingGuide.md](../../docs/TestingGuide.md). **No new
runtime dependency is added** (constitution Principle V).

**Storage**: N/A — static site, no backend. The shipped level, markers, hint ids, editor codes and
translations are unchanged; no data migration (FR-009).

**Testing**: Vitest (unit) + RTL/jsdom (page/editor). Per constitution Principle II tests are
written/updated before implementation; existing tests migrate with **unchanged assertions** wherever
only a name, signature, or import path changed — never weakened, skipped, or deleted (FR-016). Named
`{method}-{condition}-{expected-result}`, Arrange/Act/Assert per the TestingGuide. The one legitimate
assertion change is `engine/effects/effectRegistry.test.ts`'s kind-set/keyed-slot/layer tables, because
R-005 genuinely extends the kind set (FR-014).

**Target Platform**: Browser (static site), Canvas 2D game loop, 60 fps.

**Project Type**: Single front-end project; theme modules under `src/themes/platformer/`; tests
co-located.

**Performance Goals**: No regression to the 60 fps loop. The bubble reuses the existing single advance
and single layer dispatch; the one new registry entry adds a constant per-layer scan over an
already-tiny collection. The squash stays on its existing keyed-tile tick and draw-time dip lookup. Net
module count is **+1** (two modules deleted: `engine/HintTooltip.ts`, `engine/MushroomSquash.ts`; three
modules added: `engine/effects/speechBubble.ts`, `entities/blocks/Mushroom.ts`, and the tiny derived
`state/hintText.ts`), so the bundle effect is negligible.

**Constraints**:
- R-001 dependency-layer invariants hold: `contracts/` stays a strict leaf; no new `level/ → engine/`;
  no new `engine/ → state/`; no new `contracts/ → level/` (FR-008/SC-007). Allowed directions used by
  the new modules: `engine/ → entities/` (Renderer → Mushroom), `engine/ → level/` (effects → hint
  types), `state/ → entities/` (state → Mushroom), `entities/ → level/` (Mushroom → `VerticalRunRole`),
  `entities/ → shared/` (Mushroom → timed tile).
- Behaviour is **byte-for-byte preserved**: wording, anchor, timing, opacity curves, draw depth, reset
  scope, and dip unchanged (FR-002/FR-004/FR-011/FR-019).
- No compatibility re-export, alias, or second code path for `HintTooltip`, `hintTooltipState`,
  `MushroomSquash`, `HintId`, or `drawSignBubble` (FR-017). `mushroomSquashStates` and
  `tickMushroomSquashes` remain (they are the keyed-timer signal and tick, not aliases).
- The `EffectKind` "closed set" wording was R-004-scoped; R-005 legitimately extends it with
  `speechBubble` **only** (FR-014).
- No auto-commits; no auto-advance to `/speckit.tasks` or implementation (constitution Workflow).

**Scale/Scope**: Platformer theme only. 1 effect kind added (`speechBubble`); 2 standalone engine
modules deleted (`engine/HintTooltip.ts`, `engine/MushroomSquash.ts`); 1 new entity module
(`entities/blocks/Mushroom.ts`); 1 hint vocabulary module extended (`level/HintCatalog.ts`); 1 derived
state signal added (`state/hintText.ts`); 1 restructured render-context anchor (no new top-level field); ~8 production consumers
retargeted; corresponding tests migrated.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Evidence / Mitigation |
| --- | --- | --- |
| **I. Typed Data Architecture** | PASS | No CV content or `src/data/` change. `SignHintId`/`BubbleMessageId`, `SpeechBubbleState` (with its stored `text`), `MushroomSquashState`, `MushroomSprite`, and the registry entry are fully typed with no `any`; types are declared in the owning module before use. |
| **II. Testing (NON-NEGOTIABLE)** | PASS | Tests migrate with unchanged assertions (only renamed symbols/import paths), with new coverage for the id split, the bubble singleton/lifecycle, and the squash boundary; the effect-registry kind/keyed-slot/layer tables are updated because the kind set genuinely changed (FR-014). No test is weakened/skipped/deleted (FR-016). Vitest + RTL + jsdom, kebab-case naming, Arrange/Act/Assert. |
| **III. Code Quality & Component Standards** | PASS | Named arrow-function exports, no default exports, PascalCase types / camelCase functions. No React component, Tailwind, or shadcn/ui surface is introduced, so those clauses are not triggered. |
| **IV. No Feature Bloat** | PASS | Work is a specified refactor (R-005) with a spec in `specs/`; it adds no gameplay/feature and only generalises/relocates/re-registers shipped code (FR-019). S-011 stays out of scope. `docs/Features.md` dependency-diagram update happens at completion, not planning. |
| **V. Performance & Static Delivery** | PASS | No new dependency; bundle effect negligible (two modules deleted, three added — net +1, including a tiny derived signal); behaviour-preserving reuse of the one advance, one layer dispatch, and the existing keyed-tile tick; static delivery unchanged. |
| **Workflow: layer invariants (R-001)** | PASS | `contracts/` remains a leaf: `SignDef` moves out of `types.ts` into `level/HintCatalog.ts` so `types.ts` (imported by `contracts/Outcome.ts`) no longer reaches `level/`. The new entity module imports only `level/` + `shared/` (no `entities/ → engine/`); the engine imports the entity module and the hint types down; the localized text is resolved onto the bubble's own state by the page, so the engine reads only effect state and gains no `engine/ → state/`. No forbidden edge is widened (detailed in `research.md` D6–D8/D10/D11). |
| **Workflow: manual browser check** | PASS (planned) | SC-005 requires a manual browser pass: a sign hint, a locked-chest bubble, the transient no-bombs bubble, a mid-bubble language switch, a mushroom cap dip, and a death/respawn — see [quickstart.md](./quickstart.md). |
| **Workflow: no auto-commit / no auto-advance** | PASS | Planning creates no commit and does not invoke `/speckit.tasks` or `/speckit.implement`. |

**Gate result: PASS.** No violations, so the Complexity Tracking table is intentionally empty.

**Post-design re-check (after Phase 1)**: PASS. The Phase 1 artifacts introduce no new dependency,
data, or component surface beyond what the table above assessed. Concretely:
[`data-model.md`](./data-model.md) adds only typed runtime shapes (`SpeechBubbleState` with its stored
`text`, `MushroomSquashState`, `MushroomSprite`, the restructured `playerAnchor` object) with no `any`;
[`contracts/`](./contracts/) confirms the render context adds no new top-level field (the `playerAnchor`
object carries the head-edge point), no effect
kind other than `speechBubble` is registered, and the hint-vocabulary module introduces no
`contracts/ → level/` edge;
the new `entities/blocks/Mushroom.ts` imports only `level/` + `shared/` (Principle I, R-001 edge
invariants hold). The test-migration strategy in [`research.md`](./research.md) D14 keeps every
existing assertion (except the genuinely-changed effect-registry kind tables) (Principle II). No new
dependency is added (Principle V). No exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/R-005-platformer-generic-speech-bubble/
├── plan.md              # This file
├── research.md          # Phase 0 — design decisions (bubble kind, hint home, mushroom home/timed tile, context fields)
├── data-model.md        # Phase 1 — entities, relationships, invariants
├── quickstart.md        # Phase 1 — runnable validation guide
├── contracts/           # Phase 1 — interface contracts
│   ├── speech-bubble-kind.md
│   ├── mushroom-timed-tile.md     # NEW — replaces the obsolete mushroom-squash-kind.md
│   ├── hint-vocabulary.md
│   └── effect-render-context.md
├── checklists/
│   └── requirements.md  # Existing (all items pass)
└── spec.md              # Existing (amended)
# tasks.md is NOT created by /speckit.plan
```

### Source Code (repository root — platformer theme)

```text
src/themes/platformer/
├── engine/
│   ├── effects/
│   │   ├── speechBubble.ts          # NEW — SpeechBubble kind: state (carries the resolved localized text), phase tick, derive, registered draw, canvas primitive drawSpeechBubble (moved from Renderer.ts)
│   │   ├── speechBubble.test.ts     # NEW — phase/lifecycle/derive tests + the migrated drawSpeechBubble primitive tests + text store/refresh tests
│   │   ├── effectRegistry.ts        # MODIFIED — EffectKind += speechBubble (declared first, worldEffects); no mushroomSquash
│   │   ├── transientEffect.ts       # MODIFIED — playerAnchor gains headBottomY; clearEffectsOfKind helper
│   │   ├── index.ts                 # MODIFIED — export the new per-kind module
│   │   └── testContext.ts           # MODIFIED — provide the playerAnchor points
│   ├── HintTooltip.ts               # DELETED (content generalised into engine/effects/speechBubble.ts)
│   ├── HintTooltip.test.ts          # DELETED (migrated into speechBubble.test.ts)
│   ├── MushroomSquash.ts            # DELETED (content + art helpers relocated to entities/blocks/Mushroom.ts)
│   ├── MushroomSquash.test.ts       # DELETED (migrated into entities/blocks/Mushroom.test.ts)
│   ├── StaticObjectsCatalog.ts      # MODIFIED — the four mushroom cap-role helpers (+ MUSHROOM_ROLE_ENTRIES) removed; every other entry stays
│   ├── StaticObjectsCatalog.test.ts # MODIFIED — the mushroom describe block moves to entities/blocks/Mushroom.test.ts
│   ├── Renderer.ts                  # MODIFIED — drawSignBubble + bubble constants removed; imports the moved mushroom dip + art helpers from entities/blocks/Mushroom
│   └── Renderer.test.ts             # MODIFIED — bubble-primitive describe block moved out; mushroom draw tests retarget imports
├── entities/
│   └── blocks/
│       ├── Mushroom.ts              # NEW — squash timer + art helpers + local MushroomSprite type (not a BlockType)
│       └── Mushroom.test.ts         # NEW — migrated squash + mushroom art-helper tests
├── level/
│   ├── HintCatalog.ts               # MODIFIED — owns SignHintId, BubbleMessageId, HINT_IDS, DEFAULT_HINT_ID, hintCode, nextHintId, isSignHintId, SignDef
│   ├── HintCatalog.test.ts          # MODIFIED — isHintId → isSignHintId; add id-split/type assertions
│   ├── LevelData.ts                 # MODIFIED — HintId → SignHintId
│   ├── LevelParser.ts               # MODIFIED — HintId → SignHintId; isHintId → isSignHintId
│   └── SignMapper.ts                # MODIFIED — SignDef/SignHintId now imported from HintCatalog
├── state/
│   └── hintText.ts                  # NEW — the derived localized-hint/message signal (from currentUI)
├── editor/
│   └── EditorCanvas.tsx             # MODIFIED — hover hint label reads the hintText signal
├── types.ts                         # MODIFIED — the mixed HintId union and SignDef removed (no more Translation/level reach)
├── PlatformerState.ts               # MODIFIED — hintTooltipState removed; refreshSpeechBubbleText helper added; mushroomSquashStates/tickMushroomSquashes kept, import retargeted to entities/blocks/Mushroom
├── PlatformerPage.tsx               # MODIFIED — bubble trigger logic drives the collection, resolving/refreshing the bubble's stored text from the hintText signal; squash trigger + drawTerrain import retargeted; death sites clear the bubble via clearEffectsOfKind
├── PlatformerState.test.ts          # MODIFIED — hint signal assertions become activeEffects assertions; text-refresh only-on-difference coverage; squash assertions unchanged
└── PlatformerPage.test.tsx          # MODIFIED — bubble assertions become activeEffects assertions; squash assertions unchanged
```

External interface touched: `engine/effects/transientEffect.ts`'s `EffectRenderContext` restructures
`playerAnchor` into named player points (`centerX` / `centerY` / `headBottomY` / `width`) — no new
top-level field; the bubble's localized text travels on `SpeechBubbleState` instead (its public surface
is documented in [`contracts/effect-render-context.md`](./contracts/effect-render-context.md)).

```text
docs/TransientEffectRecipe.md        # MODIFIED — names the speechBubble kind, the single-slot bubble,
                                     #   the bubble's carried text and its language-change refresh, and
                                     #   the keyed timed-tile family (mushroom squash) as separate from
                                     #   the effect registry
```

**Structure Decision**: Single project. The one new effect kind lives in the existing self-contained
`engine/effects/` directory (the R-004 home), so "adding an effect is one module plus one registry
line" stays true. The hint vocabulary lands in `level/HintCatalog.ts` with `SignDef` moving with it —
this keeps `contracts/` a leaf while letting both `level/` (parser, mapper, editor) and the engine
(collision, bubble) import the ids. The localized-text derivation lives in the app/state layer
(`state/hintText.ts`), not in the effect subsystem, so the engine gains no `engine/ → state/` edge; the
page resolves it at spawn and refreshes the bubble's stored text only when it changes, so the effect
reads its own state and the render context carries no lookup. The mushroom squash and its cap-role art
move to `entities/blocks/Mushroom.ts`, the
block-folder home the amended spec names, which keeps the keyed timed tile beside the mushroom it
serves and out of the effect registry; the moved helpers use a local structural `MushroomSprite` type
so no `entities/ → engine/` import is introduced.

## Key Design Decisions (resolved in planning)

Full rationale and alternatives are in [`research.md`](./research.md); the durable interfaces are in
[`contracts/`](./contracts/).

1. **`speechBubble` is a constant-keyed singleton worldEffects entry declared first.** Its `keyOf`
   returns a constant slot key, so `spawnEffect` replaces it in place; it is declared before
   `flyingText` and drawn by the existing `drawEffects(..., 'worldEffects', ...)` invocation, which
   preserves its current depth (after darkness/enemy-eye, before the other world effects) with no new
   draw call (FR-004/FR-015).
2. **The bubble's phase/elapsed split follows `flyingText`.** `phase` lives in `state`, `elapsed` on the
   effect; `tick` returns the `null` drop sentinel at exit completion; `expired` is overridden
   (`() => false`) so only the phase machine ends it (FR-002).
3. **The bubble's no-op/restart/replace rules stay at the trigger site.** `spawnEffect` replaces the
   singleton; the page compares the current bubble's `messageId`/`phase` and either no-ops, spawns a
   fresh `entering` effect, or spawns an `exiting` one — exactly today's `HintTooltip` transition block
   (FR-003).
4. **The canvas primitive is `drawSpeechBubble`, moved into the effect module.** `drawSignBubble` + its
   constants leave `Renderer.ts`; the registered `drawSpeechBubbleEffect(effect, rc)` reads the
   bubble's own stored `effect.state.text`, takes its anchor from `rc.playerAnchor.centerX` /
   `rc.playerAnchor.headBottomY`, then calls the primitive (FR-006).
5. **`SignHintId` is derived from an `as const satisfies readonly PlatformerHintKey[]` tuple;
   `BubbleMessageId = keyof Translation['platformer']['hints']`.** This keeps the six sign hints
   explicit and ordered, keeps the compile-time link to the i18n keys, and makes a UI-only message fail
   to type-check as a sign hint (FR-007/FR-009).
6. **`SignDef` moves into `level/HintCatalog.ts`.** `contracts/Outcome.ts` imports the root `types.ts`;
   leaving `SignDef` (which now carries a `SignHintId`) in `types.ts` would create a
   `contracts/ → types.ts → level/` edge, so the sign definition moves with its vocabulary
   (FR-008/SC-007).
7. **Localized text is a derived app/state signal resolved onto the bubble effect, not a render-context
   lookup.** `state/hintText.ts` mirrors `currentUI.value.platformer.hints`; the page resolves
   `hintText.value[messageId]` at spawn and stores it on `SpeechBubbleState.text`, and the render loop
   refreshes that stored text only when it differs (the pure `withSpeechBubbleText` helper plus the
   `refreshSpeechBubbleText` state helper it backs), so a live bubble follows a language switch with no
   steady-state collection write and no `bubbleText` context field (FR-005/FR-014/FR-020).
8. **The squash is a grid-cell-keyed timed tile owned by `entities/blocks/Mushroom.ts`, not an effect
   kind.** State stays `{ col, row, elapsed }`; arm/advance/prune delegate to `shared/timedTile.ts`
   (`rearm: 'replace'`, `prune: true`), so the `>= duration` prune and `dt <= 0` no-rewind are
   preserved; `mushroomSquashStates` + `tickMushroomSquashes` stay in `PlatformerState.ts` and
   `drawTerrain` reads the dip from the same array via `mushroomSquashDipAt` — no registry, no parallel
   store (FR-010/FR-011/FR-012).
9. **The mushroom cap-role art helpers move with the squash, using a local structural type.**
   `mushroomEntry`/`mushroomHasCap`/`MUSHROOM_CAP_SOURCE_HEIGHT`/`MUSHROOM_DECORATIVE_ENTRY` leave
   `engine/StaticObjectsCatalog.ts` for `entities/blocks/Mushroom.ts`; the moved helpers declare a local
   `MushroomSprite { sx, sy }` instead of importing the catalog's `StaticObjectEntry` (avoiding a new
   `entities/ → engine/` edge). `verticalRunRole` stays in `level/Terrain.ts` (FR-010).
10. **The bubble is `'death'`-reset-scoped and cleared immediately at the death instant.** `resetGame()`
    drops its explicit `hintTooltipState.value = null` (the `'death'` scope clears it); both death sites
    call the new pure `clearEffectsOfKind(activeEffects.value, 'speechBubble')` so it never freezes
    through the death animation. The squash keeps its existing `resetGame()` clear
    (`mushroomSquashStates.value = []`) — it is not an effect (FR-013).
11. **No aliases survive.** `engine/HintTooltip.ts`, `engine/MushroomSquash.ts`, and the `HintId` union
    are deleted outright; `isHintId` is renamed `isSignHintId`; the old array-based squash API keeps its
    public names (`startMushroomSquash`/`advanceMushroomSquashes`/`mushroomSquashDipAt`) but is reached
    only through the new module path (FR-017).

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.
