---
description: "Task list for R-005 Platformer Generic Speech Bubble"
---

# Tasks: Platformer Generic Speech Bubble (R-005)

**Input**: Design documents from `/specs/R-005-platformer-generic-speech-bubble/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **INCLUDED — non-negotiable here.** Constitution Principle II (TDD) requires the tests to be
written/updated **before** the implementation they cover. Existing tests MUST migrate with **unchanged
assertions** wherever only a name, signature, module location, or import path changed — never weakened,
skipped, or deleted (FR-016). The one legitimate assertion change is the
`engine/effects/effectRegistry.test.ts` kind list / keyed-slot / layer tables, because R-005 genuinely
extends the kind set by exactly one (`speechBubble`) (FR-014).

**Organization**: Tasks are grouped by user story so each story is independently implementable and
testable. Phases are ordered by **dependency**, not by the spec's story numbering: the hint-vocabulary
split (US2) is the type-level prerequisite for the generic bubble (US1), so US2 lands first. US3 (the
mushroom squash) has no logical dependency on US2/US1, but it edits the same files
(`PlatformerState.ts`, `PlatformerPage.tsx`, `Renderer.ts`), so schedule it after US1 or coordinate those
edits.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task names the exact file path it changes

## Path Conventions

Single front-end project. Platformer theme modules live under `src/themes/platformer/`; tests are
co-located beside their module. Docs live under `docs/`. All paths below are repository-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a green, behaviour-known baseline before a behaviour-preserving refactor begins.

- [ ] T001 Record the pre-refactor baseline by running `npm test` and `npm run build` and confirming both succeed (FR-016/SC-004); no code change.
- [ ] T002 [P] Confirm the feature adds **no** runtime dependency or build/config change: `package.json`, `tsconfig.json`, and `vite.config.ts` remain untouched (Constitution Principle V).
- [ ] T003 [P] Capture the baseline migration surface by running the quickstart §2 searches (`rg "HintTooltip|hintTooltipState|drawSignBubble|\bHintId\b" src`, `rg "engine/MushroomSquash" src`, `rg "currentUI\.value\.platformer\.hints" src`) and recording the hit list for SC-001/SC-002/SC-003.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The additive effect-subsystem surface and the derived localized-text signal that the bubble
(US1) and the editor label (US1/FR-020) both depend on. US3 (mushroom) does **not** depend on this phase.

**⚠️ CRITICAL**: US1 (including its editor-label task T037) must not begin until this phase is complete.

- [ ] T004 [P] Add failing unit tests for a new pure `clearEffectsOfKind(effects, kind)` helper in `src/themes/platformer/engine/effects/transientEffect.test.ts` (removes only the named kind, leaves others by reference) (FR-013).
- [ ] T005 [P] Add a failing unit test for the derived hint-text signal in `src/themes/platformer/state/hintText.test.ts`: it mirrors `currentUI.value.platformer.hints` and re-evaluates when the locale changes (FR-005/FR-020).
- [ ] T006 Restructure `EffectRenderContext.playerAnchor` to `{ centerX, centerY, headBottomY, width }` in `src/themes/platformer/engine/effects/transientEffect.ts` (updating the heal aura's read to `centerX`/`centerY`), and implement `clearEffectsOfKind` (FR-014).
- [ ] T007 Create `src/themes/platformer/state/hintText.ts`: `export const hintText = computed(() => currentUI.value.platformer.hints)` derived from `@/state/locale` (FR-005/FR-020).
- [ ] T008 Update `src/themes/platformer/engine/effects/testContext.ts`'s `renderContext()` to supply the combined `playerAnchor` points so the effect unit tests stay DOM-free (contracts/effect-render-context.md).

**Checkpoint**: The effect render context carries the head anchor; the one localized-text signal exists.

---

## Phase 3: User Story 2 - Sign hints and bubble messages are split and share one home (Priority: P1)

**Goal**: Replace the mixed `HintId` with `SignHintId` (sign hints only) and `BubbleMessageId` (everything
a bubble can show), and make `level/HintCatalog.ts` the single home of both id types, the ordered
catalog/helpers, and the sign definition (moved out of the root `types.ts`).

**Independent Test**: `isSignHintId('noKeyForChest')` is `false`; `HINT_IDS` still yields the same six
labels in the same order as codes `1`–`6`; a `BubbleMessageId` that is not a sign hint does not
type-check as a `SignHintId`; no `contracts/ → level/` edge forms.

### Tests for User Story 2 (write first — expect red) ⚠️

- [ ] T009 [P] [US2] Migrate `src/themes/platformer/level/HintCatalog.test.ts`: rename `isHintId` → `isSignHintId`, keep every existing assertion, and add the id-split assertions (`isSignHintId('noKeyForChest'/'noBombs') === false`, every `HINT_IDS` entry accepted; `SignHintId` assignable to `BubbleMessageId`, a UI-only message not assignable to `SignHintId`) using a `@ts-expect-error` guard (FR-007/FR-009/SC-003).
- [ ] T010 [P] [US2] Migrate `src/themes/platformer/level/LevelParser.test.ts`: `LEGACY_MARKER_CHARS['1'..'6']` and `findSignTiles` assertions stay byte-identical; only the `isHintId` import name changes (FR-009).
- [ ] T011 [P] [US2] Migrate `src/themes/platformer/level/SignMapper.test.ts`: import `SignDef`/`SignHintId` from `./HintCatalog` instead of `../types`; all `placeSigns` assertions unchanged (FR-008).
- [ ] T012 [P] [US2] Migrate `src/themes/platformer/editor/gridRenderState.test.ts` and `src/themes/platformer/editor/paintMarkerCell.test.ts`: assertions unchanged; hint ids typed as `SignHintId`.
- [ ] T013 [P] [US2] Migrate sign typing in `src/themes/platformer/engine/Collision.test.ts` (the `playerOverlappingSign-returnsItsHintId` assertion is unchanged) (FR-007).

### Implementation for User Story 2

- [ ] T014 [US2] Rewrite `src/themes/platformer/level/HintCatalog.ts` to own `SignHintId` (derived from a `SIGN_HINT_IDS` `as const satisfies readonly PlatformerHintKey[]` tuple), `BubbleMessageId = keyof Translation['platformer']['hints']`, `HINT_IDS`, `DEFAULT_HINT_ID`, `hintCode`, `nextHintId`, `isSignHintId`, and `SignDef`; import `Translation` type-only from `@/i18n/translations` (FR-007/FR-008/FR-009).
- [ ] T015 [US2] Remove the mixed `HintId` union and `SignDef` (and the now-unused `Translation` import) from `src/themes/platformer/types.ts` so `types.ts` no longer reaches into `level/` (FR-008/SC-007).
- [ ] T016 [P] [US2] Retarget `src/themes/platformer/level/LevelData.ts`: `HintId` → `SignHintId` imported from `./HintCatalog` (the `{ kind: 'sign'; hintId }` marker type) (FR-007).
- [ ] T017 [P] [US2] Retarget `src/themes/platformer/level/LevelParser.ts`: `HintId` → `SignHintId`, `isHintId` → `isSignHintId`, `DEFAULT_HINT_ID` still from `./HintCatalog` (FR-007/FR-009).
- [ ] T018 [P] [US2] Retarget `src/themes/platformer/level/SignMapper.ts`: import `SignDef`/`SignHintId` from `./HintCatalog` (drop the `../types` import) (FR-008).
- [ ] T019 [P] [US2] Retarget `src/themes/platformer/engine/Collision.ts`: `HintId` → `SignHintId` from `../level/HintCatalog` (the existing `engine/ → level/` direction) (FR-007).
- [ ] T020 [P] [US2] Confirm the editor consumers resolve the vocabulary from the one home: `src/themes/platformer/editor/gridRenderState.ts`, `src/themes/platformer/editor/paintMarkerCell.ts`, and `src/themes/platformer/editor/EditorCanvas.tsx` import from `../level/HintCatalog` with no behaviour change (FR-008).
- [ ] T021 [US2] Retarget `src/themes/platformer/PlatformerPage.tsx` sign typing: type `lockedChestHintId` as `BubbleMessageId | undefined` (it can be the UI-only `noKeyForChest`), importing the id types from `./level/HintCatalog` (FR-007). The trigger rewrite itself belongs to T034.
- [ ] T022 [US2] Verify the leaf invariant: `src/themes/platformer/contracts/Outcome.ts` still imports only the root `types.ts`, and `types.ts` no longer imports `level/` — so no `contracts/ → level/` edge exists (FR-008/SC-007).

**Checkpoint**: The mixed `HintId` is gone; `SignHintId`/`BubbleMessageId` and `SignDef` have one home; the sign/editor consumers resolve it there.

---

## Phase 4: User Story 1 - The sign tooltip becomes a reusable `SpeechBubble` effect (Priority: P1) 🎯 MVP

**Goal**: Replace the sign-named `HintTooltip` machine with one registered transient effect kind,
`speechBubble`, declared first at `worldEffects`; the sign, locked-chest, and no-bombs triggers all drive
it through the single `activeEffects` collection, and it carries its own resolved localized text.

**Independent Test**: `HintTooltip`, `hintTooltipState`, and `drawSignBubble` do not exist; exactly one
`speechBubble` registry entry drives all three triggers through the single collection; a live bubble
follows a language switch via its stored `state.text`; no `bubbleText` render-context lookup exists.

### Tests for User Story 1 (write first — expect red) ⚠️

- [ ] T023 [US1] Migrate `src/themes/platformer/engine/HintTooltip.test.ts` → `src/themes/platformer/engine/effects/speechBubble.test.ts`: rename `startHintTooltip` → `startSpeechBubble`, `beginHintTooltipExit` → `beginSpeechBubbleExit`, `tickHintTooltip` → `tickSpeechBubbleEffect`, `hintTooltipGrowthAndOpacity` → `speechBubbleGrowthAndOpacity`, and adapt the payload to the `TransientEffect<SpeechBubbleState>` shape (`phase`/`text`/`transient` in `state`, `elapsed` on the effect); **every** phase/duration/dwell/growth/opacity boundary assertion stays the same (FR-002/FR-016/D2). Delete the old `src/themes/platformer/engine/HintTooltip.test.ts`.
- [ ] T024 [US1] Move the `describe('drawSignBubble')` block out of `src/themes/platformer/engine/Renderer.test.ts` into `src/themes/platformer/engine/effects/speechBubble.test.ts` as `describe('drawSpeechBubble')`; rename only the imported symbol — the primitive's body/behaviour assertions are byte-identical (FR-006/D4).
- [ ] T025 [US1] Add new `speechBubble` coverage in `src/themes/platformer/engine/effects/speechBubble.test.ts`: the constant `keyOf` singleton slot, `activeSpeechBubble` kind-filtering, `withSpeechBubbleText` returning the same reference when the text matches and a copy when it differs, and `drawSpeechBubbleEffect` reading `effect.state.text` plus `rc.playerAnchor.centerX`/`rc.playerAnchor.headBottomY` (never a `rc.bubbleText`) (FR-003/FR-005/FR-014).
- [ ] T026 [P] [US1] Update `src/themes/platformer/engine/effects/effectRegistry.test.ts` — the only legitimate assertion change: the kind list gains `'speechBubble'` as `EFFECT_REGISTRY[0]` (before `flyingText`) and has nine entries; the set contains **no** `'mushroomSquash'`; the keyed-slot test now expects `counterPopup` **and** `speechBubble`; the layer/resetScope table gains `speechBubble` = `worldEffects`/`death` (FR-014).
- [ ] T027 [P] [US1] Update `src/themes/platformer/PlatformerState.test.ts` bubble assertions: replace every `hintTooltipState` read with a kind-filtered `activeEffects` (kind `'speechBubble'`) read; keep the phase/timing outcomes; add `refreshSpeechBubbleText` coverage that rewrites the collection only when the text actually differs (FR-005/FR-016).
- [ ] T028 [P] [US1] Update `src/themes/platformer/PlatformerPage.test.tsx` bubble assertions: the sign/locked-chest/no-bombs expectations become kind-filtered `activeEffects` expectations (`effectsOfKind(...)` helper at ~line 125), and the mid-bubble language-switch case asserts the on-screen `state.text` updates; the mushroom-squash assertions stay reading `mushroomSquashStates` (FR-003/FR-005/FR-016).

### Implementation for User Story 1

- [ ] T029 [US1] Create `src/themes/platformer/engine/effects/speechBubble.ts`: `SpeechBubbleState` (`messageId: BubbleMessageId`, `text: string`, `phase`, `transient?`), constants `SPEECH_BUBBLE_FADE_IN_SECONDS = 0.2`, `SPEECH_BUBBLE_FADE_OUT_SECONDS = 0.25`, `SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS = 1.5`, and `startSpeechBubble`/`beginSpeechBubbleExit`/`beginSpeechBubbleEnter`/`withSpeechBubbleText`/`tickSpeechBubbleEffect`/`speechBubbleGrowthAndOpacity`/`activeSpeechBubble`; move the canvas primitive here as `drawSpeechBubble(ctx, text, anchorX, anchorBottomY, growth?, opacity?)` and add the registered `drawSpeechBubbleEffect(effect, rc)` reading `effect.state.text` and `rc.playerAnchor.centerX`/`rc.playerAnchor.headBottomY` (contracts/speech-bubble-kind.md; FR-002/FR-004/FR-005/FR-006).
- [ ] T030 [US1] Remove `drawSignBubble`, its `BUBBLE_*` constants, and any bubble-only helper (`clampedCornerRadius`) from `src/themes/platformer/engine/Renderer.ts` so `Renderer.ts` no longer owns or exports the primitive (FR-006).
- [ ] T031 [US1] Extend `EffectKind` with `'speechBubble'` and register the kind at `EFFECT_REGISTRY[0]` (before `flyingText`) in `src/themes/platformer/engine/effects/effectRegistry.ts` (`create: startSpeechBubble`, `tick: tickSpeechBubbleEffect`, `draw: drawSpeechBubbleEffect`, `expired: () => false`, `layer: 'worldEffects'`, `resetScope: RESET_SCOPE_BY_KIND.speechBubble`, `keyOf: () => 'speechBubble'`) (FR-001/FR-014/FR-015/D1).
- [ ] T032 [US1] Add `speechBubble: 'death'` to `RESET_SCOPE_BY_KIND` in `src/themes/platformer/engine/effects/transientEffect.ts` (FR-013/D13).
- [ ] T033 [US1] Export the new per-kind module from `src/themes/platformer/engine/effects/index.ts` (one line, matching the other kinds) (FR-015).
- [ ] T034 [US1] Delete `src/themes/platformer/engine/HintTooltip.ts` outright — no compatibility alias (FR-001/FR-017).
- [ ] T035 [US1] Update `src/themes/platformer/PlatformerState.ts`: remove the `hintTooltipState` signal and its `HintTooltipState` import; add the `refreshSpeechBubbleText()` helper next to `spawnEffect` that re-resolves `hintText.value[messageId]` and rewrites the active bubble only via `withSpeechBubbleText` when the text differs; drop the explicit `hintTooltipState.value = null` line in `resetGame()` so the `'death'` reset scope clears the bubble (FR-005/FR-013/D6/D13).
- [ ] T036 [US1] Update `src/themes/platformer/PlatformerPage.tsx`: rewrite the trigger block to spawn through the collection (`spawnEffect(startSpeechBubble(messageId, hintText.value[messageId]))`, `beginSpeechBubbleEnter` on the restart rule, `beginSpeechBubbleExit` on trigger loss, no-op while `entering`/`shown`, sign-over-chest priority); remove the explicit `drawSignBubble` draw block; call `refreshSpeechBubbleText()` at the top of the per-frame draw routine; supply `playerAnchor = { centerX, centerY, headBottomY, width }` in the render context (with `centerX`/`centerY` the heal-aura centre and `headBottomY = playerState.y + PLAYER_HEAD_PADDING + originY`); call `activeEffects.value = clearEffectsOfKind(activeEffects.value, 'speechBubble')` at both death sites, replacing the old `hintTooltipState.value = null` (FR-003/FR-004/FR-005/FR-013/D3/D6).
- [ ] T037 [P] [US1] Update the editor's hint-marker hover label in `src/themes/platformer/editor/EditorCanvas.tsx` to read `hintText.value[marker.hintId]` from `../state/hintText` instead of indexing `currentUI.value.platformer.hints` directly, remove the now-unused `currentUI` import, and update the `MARKER_TOOLTIP_LABELS` doc comment to name `hintText` (`noUnusedLocals` would otherwise fail the build) (FR-020).

**Checkpoint**: One `speechBubble` kind drives the sign, locked-chest, and no-bombs bubbles; no sign-named vocabulary or explicit per-kind draw call remains.

---

## Phase 5: User Story 3 - Mushroom squash lives with the mushroom, not in the effect registry (Priority: P1)

**Goal**: Move the grid-cell-keyed squash timer and the mushroom-specific cap-role art helpers into a new
`entities/blocks/Mushroom.ts`; delete the standalone `engine/MushroomSquash.ts`; add no effect kind.

**Independent Test**: `engine/MushroomSquash` does not exist; `startMushroomSquash`/
`advanceMushroomSquashes`/`mushroomSquashDipAt` and `mushroomEntry`/`mushroomHasCap`/
`MUSHROOM_CAP_SOURCE_HEIGHT`/`MUSHROOM_DECORATIVE_ENTRY` all resolve from `entities/blocks/Mushroom.ts`;
the registry has no `mushroomSquash` kind; the dip boundary, per-cell replace, and reset clears are
unchanged. **This story has no logical dependency on US2/US1, but it shares `PlatformerState.ts` /
`PlatformerPage.tsx` / `Renderer.ts` with US1, so run it after US1 or coordinate those shared-file edits.**

### Tests for User Story 3 (write first — expect red) ⚠️

- [ ] T038 [US3] Create `src/themes/platformer/entities/blocks/Mushroom.test.ts`: migrate the whole `src/themes/platformer/engine/MushroomSquash.test.ts` (import path only — the squash API, state shape, and every boundary assertion are unchanged: `>= duration` prune, `dt <= 0` no-rewind, dip formula, per-cell replace, `mushroomSquashDipAt`), and move the `describe('mushroomEntry / mushroomHasCap')` block from `src/themes/platformer/engine/StaticObjectsCatalog.test.ts` into the same file with unchanged assertions (FR-010/FR-011/FR-016/D14).
- [ ] T039 [P] [US3] Update `src/themes/platformer/engine/Renderer.test.ts` mushroom draw tests (`activeSquash-shiftsOnlyTheCap` and the role/decorative blocks): retarget the imports of the dip/art helpers to `entities/blocks/Mushroom`; assertions and pixel expectations unchanged (FR-012).

### Implementation for User Story 3

- [ ] T040 [US3] Create `src/themes/platformer/entities/blocks/Mushroom.ts`: the squash timer (`MushroomSquashState { col; row; elapsed }`, `MUSHROOM_SQUASH_DURATION_SECONDS = 0.1`, `MUSHROOM_SQUASH_DIP_PX = 2`, `startMushroomSquash`, `advanceMushroomSquashes`, `mushroomSquashDip`, `mushroomSquashDipAt`, still delegating to `shared/timedTile.ts` with `rearm: 'replace'`/`prune: true`) **and** the moved cap-role art helpers (`MushroomSprite { sx; sy }` local structural type, `mushroomEntry`, `mushroomHasCap`, `MUSHROOM_CAP_SOURCE_HEIGHT = 11`, `MUSHROOM_DECORATIVE_ENTRY`) (contracts/mushroom-timed-tile.md; FR-010/FR-011/D10/D11).
- [ ] T041 [US3] Remove `mushroomEntry`, `mushroomHasCap`, `MUSHROOM_CAP_SOURCE_HEIGHT`, `MUSHROOM_DECORATIVE_ENTRY`, and their private `MUSHROOM_ROLE_ENTRIES` from `src/themes/platformer/engine/StaticObjectsCatalog.ts`; keep every other entry, `StaticObjectEntry`, `pickVariant`, and the bush/tree, stalactite/stalagmite, chain/rope helpers (FR-010/D11).
- [ ] T042 [US3] Delete `src/themes/platformer/engine/MushroomSquash.ts` and `src/themes/platformer/engine/MushroomSquash.test.ts` (no alias, no second path) (FR-017/SC-002).
- [ ] T043 [US3] Retarget `src/themes/platformer/engine/Renderer.ts` to import `mushroomSquashDipAt`/`MushroomSquashState`/`mushroomEntry`/`mushroomHasCap`/`MUSHROOM_CAP_SOURCE_HEIGHT`/`MUSHROOM_DECORATIVE_ENTRY` from `../entities/blocks/Mushroom`; the `drawTerrain` cap/stem split is untouched (FR-012). (Shares `Renderer.ts` with US1's T030 — sequence after it.)
- [ ] T044 [US3] Retarget the `advanceMushroomSquashes`/`MushroomSquashState` imports in `src/themes/platformer/PlatformerState.ts` to `./entities/blocks/Mushroom`, keeping `mushroomSquashStates` and `tickMushroomSquashes` as the keyed-timer signal and tick (FR-010/FR-017). (Shares `PlatformerState.ts` with US1's T035 — sequence after it.)
- [ ] T045 [US3] Retarget the `startMushroomSquash` import in `src/themes/platformer/PlatformerPage.tsx` to `./entities/blocks/Mushroom` (the cap-landing arm site is otherwise unchanged) (FR-010). (Shares `PlatformerPage.tsx` with US1's T036 — sequence after it.)
- [ ] T046 [P] [US3] Retarget the `MUSHROOM_SQUASH_DURATION_SECONDS` import in `src/themes/platformer/PlatformerState.test.ts` to `./entities/blocks/Mushroom`; the `mushroomSquashStates` assertions are unchanged (FR-016).
- [ ] T047 [US3] Confirm `src/themes/platformer/entities/blocks/index.ts` `BLOCK_TYPES` is unchanged (the mushroom is not a hit-reactive `BlockType`), and fix the now-stale `engine/MushroomSquash.ts` reference in the `src/themes/platformer/engine/CrumblingFloor.ts` doc comment (FR-010).

**Checkpoint**: The squash timer and cap-role art helpers have one home beside the mushroom; the registry is untouched by this story.

---

## Phase 6: User Story 4 - The migration is invisible in-game (Priority: P1)

**Goal**: Prove the refactor is byte-for-byte behaviour-preserving: same wording (including live language
switching), anchor, timing, draw depth, reset scope, and dip, with existing tests asserting the same
outcomes.

**Independent Test**: Full suite passes with unchanged assertions except renamed symbols/paths and the
effect-registry tables; the production build succeeds; the search-based acceptance greps are clean; the
manual browser pass matches the pre-refactor build.

- [ ] T048 [US4] Run the full suite (`npm test`) and confirm every test passes with assertions unchanged except renamed symbols/import paths and the `effectRegistry.test.ts` kind tables; no test was weakened, skipped, or deleted (FR-016/SC-004).
- [ ] T049 [US4] Run `npm run build` and confirm the production build succeeds (FR-016/SC-004).
- [ ] T050 [P] [US4] Run the search-based acceptance checks from quickstart §2: no `HintTooltip`/`hintTooltipState`/`drawSignBubble`/`\bHintId\b`, no `engine/MushroomSquash` module path or `mushroomSquash` kind, no `bubbleText` lookup, exactly one `speechBubble` registration, `currentUI.value.platformer.hints` read only by `state/hintText.ts` (+ its test), and the squash helpers resolving from `entities/blocks/Mushroom` (SC-001/SC-002/SC-003).
- [ ] T051 [US4] Perform the manual browser pass from quickstart §3: sign hint, locked chest (sign-over-chest priority), transient no-bombs, mid-bubble language switch, re-press-while-shown and restart-while-exiting, mushroom cap dip (pixel-identical, per-cell), death/respawn clear, and full reset (SC-005).

**Checkpoint**: The refactor is proven invisible; the shipped game is unchanged.

---

## Phase 7: User Story 5 - The contributor recipe names the new bubble kind (Priority: P3)

**Goal**: Bring the R-004 contributor recipe in line with the new shape.

**Independent Test**: The recipe names `speechBubble`, explains the single-slot bubble and its carried
resolved text (refreshed on language change), states the engine must not import app/i18n state, claims no
`mushroomSquash` kind, and identifies keyed timed tiles as a separate family.

- [ ] T052 [P] [US5] Update `docs/TransientEffectRecipe.md`: add `speechBubble` to the kind list/registry comment and to the `worldEffects` layer bullet, describe the single-slot bubble and how it carries its resolved localized text (refreshed when the language changes), note that the engine must not import app/i18n state, replace the "closed set" wording with an extensible set, update the reset-scope sentence (`Only fadeOutText is 'death'`) to include `speechBubble`, and document the keyed timed-tile family (e.g. the mushroom squash) as separate from the effect registry (FR-018).
- [ ] T053 [P] [US5] Confirm `src/themes/platformer/engine/effects/recipe.test.ts` still follows the recipe literally and passes; its throwaway-kind assertion is unaffected by adding `speechBubble`; reword the stale "`EffectKind` is the closed shipped set" comment to "extensible" (FR-018).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency work that spans the stories.

- [ ] T054 [P] Sweep and correct stale comments across `src/themes/platformer/` without changing behaviour: retired modules/symbols (`engine/MushroomSquash.ts`, `engine/HintTooltip.ts`, `drawSignBubble`), and the specific effect-subsystem comments R-005 falsifies — `effectRegistry.ts`'s "fixed set … no additions" note, its "only `counterPopup` declares `keyOf`" note (now `speechBubble` too), and its intra-layer order comment; `transientEffect.ts`'s `'death'`-scope note (now `speechBubble` too — leave the "six families"/`defaultTick` note, which stays true because `speechBubble` has a custom tick); and the `PlatformerPage.tsx` world-effects sequence comment.
- [ ] T055 [P] Confirm no compatibility re-export, alias, or second code path survives for `HintTooltip`, `hintTooltipState`, `HintId`, `drawSignBubble`, or the old `engine/MushroomSquash` path; `isHintId` is gone and `mushroomSquashStates`/`tickMushroomSquashes` remain (they are the keyed-timer signal/tick, not aliases) (FR-017/SC-001/SC-002).
- [ ] T056 [P] Update `docs/Features.md`'s dependency diagram for R005 (prefix the node label with `✅ ` and add `class R005 done` alongside its existing category class) — only after implementation and tests are fully done (AGENTS.md / Constitution Workflow).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — record the green baseline first.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS US1 (including T037, the editor-label task).
- **US2 (Phase 3)**: Depends on Setup only. It is the type-level prerequisite for US1.
- **US1 (Phase 4)**: Depends on Foundational + US2 (it needs `BubbleMessageId` and the one hint home).
- **US3 (Phase 5)**: Depends on Setup only, but shares `PlatformerState.ts`/`PlatformerPage.tsx`/`Renderer.ts` with US1 — sequence it after US1 (or coordinate the shared-file edits).
- **US4 (Phase 6)**: Depends on US1 + US2 + US3 completing (it verifies the whole migration).
- **US5 (Phase 7)**: Depends on US1 (the recipe documents the `speechBubble` kind).
- **Polish (Phase 8)**: Depends on US1–US5; T056 additionally depends on all tests passing.

### User Story Dependencies

- **US2 (P1)** — the vocabulary split/home; prerequisite for US1.
- **US1 (P1)** — the generic bubble; depends on US2; consumes the Foundational signal/context.
- **US3 (P1)** — the mushroom squash home; no dependency on any other story.
- **US4 (P1)** — behaviour-preservation verification; depends on US1/US2/US3.
- **US5 (P3)** — documentation; depends on US1.

### Within Each User Story

- Tests (T009–T013, T023–T028, T038–T039) MUST be written/updated and FAIL before the implementation tasks they cover.
- Models/types before services before call sites (e.g. `HintCatalog` before its consumers; `speechBubble.ts` before its registry line).
- Core implementation before integration (module before page wiring).
- US2 completes before US1 begins.

### Parallel Opportunities

- Setup: T002 and T003 run in parallel.
- Foundational: T004 and T005 (test files) run in parallel; then T006–T008.
- US2 tests: T009–T013 all touch different files and run in parallel. US2 consumer retargets T016–T020 run in parallel after T014/T015.
- US1 tests: T026, T027, T028 run in parallel (different files); T023–T025 are sequential (same target file).
- US3: T039 in parallel with T038; after T040–T042, T046 runs alone (T043–T045 share files with US1 and are sequenced after it).
- US2 and US3 touch disjoint files, but US3 and US1 share `PlatformerState.ts`/`PlatformerPage.tsx`/`Renderer.ts`; run US3 after US1 or coordinate the merge.

---

## Parallel Example: User Story 1

```bash
# Tests first, in parallel across files (T026–T028):
Task: "Update effectRegistry.test.ts — speechBubble first, no mushroomSquash"
Task: "Update PlatformerState.test.ts — bubble assertions read activeEffects"
Task: "Update PlatformerPage.test.tsx — bubble assertions read activeEffects"

# After the module + registry land, independent call sites (T037) in parallel:
Task: "Retarget EditorCanvas.tsx hint label to hintText signal"
```

## Parallel Example: User Story 3

```bash
# After Mushroom.ts + StaticObjectsCatalog.ts are done, retarget consumers (T046 can run in
# parallel; T043–T045 share Renderer.ts / PlatformerState.ts / PlatformerPage.tsx with US1, so
# sequence them after US1):
Task: "Retarget PlatformerState.test.ts duration import"
Task: "Retarget Renderer.ts mushroom imports to entities/blocks/Mushroom"
Task: "Retarget PlatformerState.ts squash imports"
Task: "Retarget PlatformerPage.tsx startMushroomSquash import"
```

---

## Implementation Strategy

### MVP First (US2 + US1)

Because US2 is the type-level prerequisite for the generic bubble, the MVP is **US2 → US1** (on top of
Setup + Foundational):

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US2): split the ids and land the hint home.
3. Complete Phase 4 (US1): the `speechBubble` kind and the three triggers.
4. **STOP and VALIDATE**: run T023–T028 and T048/T050 for the bubble; confirm SC-001 by search.
5. This is the reusable bubble S-011 can later consume.

### Incremental Delivery

1. Setup + Foundational → baseline and the additive effect surface are ready.
2. US2 → the id split lands (no visible change).
3. US1 → one `speechBubble` kind replaces `HintTooltip` (no visible change).
4. US3 (after US1, or coordinated on the shared files) → the squash relocates beside the mushroom (no visible change).
5. US4 → full-suite/build/grep/manual verification proves nothing changed.
6. US5 + Polish → the recipe, comments, alias sweep, and `docs/Features.md` are current.

### Parallel Team Strategy

With two developers after Setup + Foundational:

- Developer A: US2 → US1 (bubble workstream).
- Developer B: US3 (mushroom workstream — coordinate the shared `PlatformerState.ts`/`PlatformerPage.tsx`/`Renderer.ts` edits with Developer A), then US4's verification prep.
- US4 (verification) and US5/Polish are shared once the workstreams land.

---

## Notes

- [P] tasks touch different files and can run concurrently; tasks sharing a file are sequenced.
- The only sanctioned assertion change is `effectRegistry.test.ts` (the kind set genuinely grew by one). Every other migrated test keeps its assertions and changes only names/import paths/signatures.
- Behaviour is byte-for-byte preserved (FR-019): if a task tempts a wording/timing/anchor/depth/dip change, it is out of scope.
- No commit is created by this workflow; the optional git hooks are report-only.
- Stop at each checkpoint to validate the story independently before moving on.
