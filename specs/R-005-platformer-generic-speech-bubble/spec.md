# Feature Specification: Platformer Generic Speech Bubble

**Feature Branch**: `R-005-platformer-generic-speech-bubble`

**Created**: 2026-09-25

**Status**: Draft

**Input**: GitHub issue #93 — "R-005: Platformer Generic Speech Bubble". Generalise the sign-named `HintTooltip` into a reusable speech-bubble effect, split `SignHintId` from `BubbleMessageId`, land the hint catalog and id types in one home, and give the standalone `MushroomSquash` a proper home beside the mushroom instead of the effect registry.

**Depends on**: [R-004 Platformer Transient Effect Registry](../R-004-platformer-transient-effect-registry/spec.md) (shipped: the `TransientEffect<S>` base, the kind registry, the single `activeEffects` collection, the layer-filtered `drawEffects` dispatch, the shared `shared/timedTile.ts` keyed-tile core, and the documented "one module plus one registry line" recipe), [O-018 Platformer Bouncy Mushroom Blocks](../O-018-platformer-mushroom-blocks/spec.md) (shipped: the transient cap-squash whose cosmetic dip must be preserved), [S-009 Platformer Onboarding](../S-009-platformer-onboarding/spec.md) (shipped: the sign hint speech bubble), and [S-007 Platformer Chests](../S-007-platformer-chests/spec.md) (shipped: the locked-chest bubble).

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 2, findings **E2** (`HintTooltip` is sign-named but already generic — the missing speech bubble), **M9** (hint/type conflation feeds E2), **E3** (`MushroomSquash` is a standalone file that belongs to the effect family — **deliberately reinterpreted here**: the squash is relocated to the mushroom's own home as a keyed timed tile, not folded into the effect registry), and **F10** (the hint concept is split across `level/`, `engine/`, and `types.ts`).

## Clarifications

### Session 2026-09-25

- Q: Should R-005 treat S-011 (Interact Hint Overlay) purely as a future consumer — shipping only the reusable speech bubble and building none of S-011's first-time interact overlay? → A: S-011 is a consumer only; R-005 ships the generic bubble and no first-time interact overlay.
- Q: The hint ids derive from the `Translation` type and the hint text lives in the `currentUI` signal, so should the sign hints become a signal too — and if so, what changes? → A: Keep `HINT_IDS` and its stable order/editor codes explicit (FR-009); add an app/state-layer hint-text signal derived from the translation signal so callers stop indexing `currentUI.value.platformer.hints[id]` directly.
- Q: How should the speech bubble obtain its localized text once the hint text is a derived signal? → A: The bubble effect carries its resolved text in its own state (in `activeEffects`); the page resolves it from the derived hint-text signal when the bubble spawns and refreshes the active bubble's text when the language changes. No `bubbleText` field is added to the effect render context, the engine never imports state/i18n, and a live bubble still follows a language switch.
- Q: Should R-005 fold `MushroomSquash` into the transient effect registry as a registered `mushroomSquash` kind (issue #93 / analysis E3), or keep it a grid-cell-keyed timed tile? → A: Keep it a keyed timed tile; it is purely cosmetic and owns no drawing, so it does not belong in the effect registry (a registered kind would need a forced no-op `draw`).
- Q: Where should the squash and the mushroom-specific cap-role art helpers live? → A: `entities/blocks/Mushroom.ts` owns the squash timer (still delegating arm/advance/prune to `shared/timedTile.ts`) and the mushroom-specific cap-role art helpers moved out of `engine/StaticObjectsCatalog.ts`; `engine/MushroomSquash.ts` is removed, and `Renderer`/`PlatformerState`/`PlatformerPage` import from the new module.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The sign tooltip becomes a reusable `SpeechBubble` effect (Priority: P1)

The sign-hint overlay is a generic comic speech bubble in substance — it already rises out of the player's head, shows a short localized line, grows/fades in and out on its own timer, and is already reused for two non-sign messages: the locked-chest "I need a key" bubble and the keypress-triggered "I have no bombs" bubble. Yet it is named and typed around signs (`HintTooltip`, `hintTooltipState`, `drawSignBubble`, `HintId`), so it reads as sign-specific and its two extra consumers look like undocumented special cases. After this feature there is one registered transient effect kind, `speechBubble`, which every consumer drives the same way — a sign hint, a locked chest, or a UI message — and the sign-specific naming and the standalone optional signal are gone.

**Why this priority**: This is the central abstraction the issue names (E2). It removes the last sign-specific transient-effect machine, makes the two existing non-sign consumers first-class, and delivers the reusable bubble that a future contextual interact overlay (S-011) is expected to consume.

**Independent Test**: Search the theme for `HintTooltip`, `hintTooltipState`, `drawSignBubble`, and `HintId` — none remains. Confirm exactly one `speechBubble` registry kind is registered, that the sign, locked-chest and no-bombs triggers all spawn it through the unified collection, and that the bubble still appears above the character's head with the same timing, wording and animation as before.

**Acceptance Scenarios**:

1. **Given** the platformer transient-effect subsystem, **When** its registry is inspected, **Then** it contains one `speechBubble` kind whose entry supplies the bubble's create/tick/expiry/draw, and no `HintTooltip`, `hintTooltipState` signal, or standalone bubble tick remains.
2. **Given** the player stands on a hint sign and presses the interact key, **When** the tick runs, **Then** a `speechBubble` effect is present in the single `activeEffects` collection showing that sign's hint, and it leaves when the player walks off — exactly as today.
3. **Given** the player stands on a closed chest holding no keys and presses the interact key, **Then** the same `speechBubble` kind shows the locked-chest message; **Given** the player presses the place-bomb key with no bombs, **Then** the same kind shows the transient no-bombs message.
4. **Given** the render loop, **When** the bubble is drawn, **Then** the draw is supplied by the `speechBubble` registry entry (invoked by the single layer-filtered dispatch) and no per-kind `drawSignBubble` call remains in the page's render loop.
5. **Given** a new kind of bubble message is wanted later, **When** it is added, **Then** it needs no new signal, no new tick call, and no new draw call — only a message id and a trigger site.

---

### User Story 2 - Sign hints and bubble messages are split and share one home (Priority: P1)

`HintId` is `keyof Translation['platformer']['hints']`, so it merges two different things: the six hand-authored sign hints (which have a stable order, an editor badge code `1`–`6`, and marker validation) and two UI-only messages (`noKeyForChest`, `noBombs`) that `HintCatalog.ts` itself documents as *not* sign hints. The id union sits in `types.ts`, the ordered catalog sits in `level/HintCatalog.ts`, and the sign definition sits in `types.ts` — one concept under three names and three ownerships. After this feature there are two honest types — a `SignHintId` that a sign can carry and a `BubbleMessageId` that a bubble can show — and the catalog plus both id types live in one module, so a bubble can be handed any message without pretending it is a sign.

**Why this priority**: It is the type-level half of E2/M9 and the prerequisite for the generic effect: the bubble must be able to carry a message that no sign can show. It is independent enough to land first, and it is what stops a typo or a stale id from silently resolving to `undefined`.

**Independent Test**: Add a bubble message that is not a sign hint and pass it to the bubble start helper — it type-checks; try to pass it to a sign's `hintId` — it does not. Confirm `HINT_IDS` still yields the same six labels in the same order and codes `1`–`6`, and that the mixed `HintId` is gone.

**Acceptance Scenarios**:

1. **Given** the hint home module, **When** its exports are inspected, **Then** it owns `SignHintId` (the sign-hint subset), `BubbleMessageId` (every message a bubble can display, sign hints included), the ordered `HINT_IDS` catalog, `DEFAULT_HINT_ID`, `hintCode`, `nextHintId`, `isSignHintId`, and the sign definition that carries a `SignHintId`.
2. **Given** the sign-hint catalog, **When** its order, labels, editor codes and marker validation are checked, **Then** they are byte-identical to today (`bridgeDropThrough` … `bomb` = codes `1`–`6`; `noKeyForChest`/`noBombs` are not sign hints).
3. **Given** a `SignDef`/sign placement, **When** its `hintId` is typed, **Then** it is a `SignHintId` and cannot be a UI-only bubble message; **Given** a bubble, **When** its message is typed, **Then** it is a `BubbleMessageId` and accepts both sign hints and UI-only messages.
4. **Given** the platformer root `types.ts` and the `contracts/` layer, **When** their imports are inspected, **Then** the mixed `HintId` is gone, the root `types.ts` no longer declares the hint vocabulary, and `contracts/` still imports nothing from `level/` (the vocabulary does not create a `contracts/ → level/` edge).
5. **Given** the editor, the level parser and the sign mapper, **When** they import the hint vocabulary, **Then** they all resolve it from the one hint home and behaviour is unchanged.

---

### User Story 3 - Mushroom squash lives with the mushroom, not in the effect registry (Priority: P1)

The bouncy-mushroom cap dip is a cosmetic, grid-cell-keyed timer: one `{col,row,elapsed}` entry per recently-bounced cap, a fixed duration, and a pure dip formula. It is not a reusable effect and owns no drawing — its dip is applied inside `drawTerrain`'s mushroom branch. Its timer nevertheless lives in a standalone `engine/MushroomSquash.ts`, while its cap-role art helpers sit in `engine/StaticObjectsCatalog.ts`. After this feature one `entities/blocks/Mushroom.ts` owns both the squash timer (still delegating arm/advance/prune to `shared/timedTile.ts`) and the mushroom-specific cap-role art helpers; `engine/MushroomSquash.ts` is gone; the effect registry gains no `mushroomSquash` kind; and the terrain pass and game tick read the squash from the mushroom module exactly as before.

**Why this priority**: It is the E3 half of the issue — the last standalone mushroom-owned machine — but the fix is cohesion with the mushroom it belongs to, not the effect registry. Keeping it a keyed timed tile (beside crumbling floor, floor spike and falling stalactite) keeps the effect registry for reusable, self-drawing transient effects and avoids a registered kind whose `draw` could only be a forced no-op.

**Independent Test**: Search for `engine/MushroomSquash` — it is gone; `startMushroomSquash`/`advanceMushroomSquashes`/`mushroomSquashDipAt` and the mushroom entry helpers (`mushroomEntry`, `mushroomHasCap`, `MUSHROOM_CAP_SOURCE_HEIGHT`, `MUSHROOM_DECORATIVE_ENTRY`) all resolve from `entities/blocks/Mushroom.ts`; the effect registry contains no `mushroomSquash` kind. Bounce a cap and confirm the same two-pixel dip over the same tenth of a second, that several caps can squash at once, that a re-bounce restarts only that cell, and that a death/respawn clears every dip.

**Acceptance Scenarios**:

1. **Given** the theme's modules, **When** they are inspected, **Then** `engine/MushroomSquash.ts` no longer exists and `entities/blocks/Mushroom.ts` owns the squash state/constants/arm/advance/dip and the mushroom-specific cap-role art helpers; the effect registry is unchanged (it contains no `mushroomSquash` kind).
2. **Given** a mushroom bounce, **When** the tick runs, **Then** the squash is armed/advanced through the same keyed-timer path as today (`mushroomSquashStates` + `tickMushroomSquashes`), and the mushroom module is the single home of that logic.
3. **Given** two caps bouncing in the same instant, **When** the timer is inspected, **Then** both caps have independent entries; **Given** a cap that is already mid-squash, **When** it is landed on again, **Then** that cell's entry is restarted (replace) rather than queued a second time.
4. **Given** a squash entry, **When** it is advanced, **Then** the dip is `DIP * (1 - clamp01(elapsed / 0.1))` and the entry is pruned once `elapsed` reaches the 0.1 s duration; a zero-or-negative step leaves `elapsed` unchanged but still drops an already-expired entry.
5. **Given** a death/respawn or a full Reset Game, **When** it runs, **Then** every in-progress squash is cleared, exactly as today.
6. **Given** the terrain pass, **When** it draws a bouncy-mushroom cap, **Then** it reads the dip from the mushroom module's timer and no duplicate cap renderer exists; the rendered cap is pixel-identical.

---

### User Story 4 - The migration is invisible in-game (Priority: P1)

The bubble and the squash are not interchangeable with the other effects: the bubble is a single-slot overlay anchored to the moving player's head, drawn above the darkness/eye overlay and before the world effects, with a right-to-dismiss lifecycle (a sign waits for the player to leave; a keypress bubble dismisses itself); the squash is a per-cell cosmetic modifier consumed by the terrain pass. After this feature both behave exactly as before — same wording (including live language switching), same anchor and timing, same draw depth, same reset scope, same dip — so the refactor cannot be seen or felt, and the existing tests keep asserting the same outcomes.

**Why this priority**: It is the acceptance bar for a refactor: nothing about the player-visible game may change. A naive "just move it into the collection" loses the singleton semantics, the player-anchored redraw, the transient dwell, or the `elapsed >= duration` prune.

**Independent Test**: Walk a level, reveal a sign hint, stand on a locked chest, press place-bomb with no bombs, switch language while a bubble is up, bounce on a mushroom cap, then die and restart — compare against the pre-refactor build. Separately unit-test the singleton/replace/restart rules, the transient dwell, the draw-time language resolution, and the dip boundary.

**Acceptance Scenarios**:

1. **Given** a sign hint bubble is fully shown, **When** the player presses interact again for the same sign, **Then** nothing restarts (no-op); **Given** the bubble is already exiting, **When** interact is pressed again, **Then** its entrance restarts; **Given** a different message becomes available, **Then** the current bubble is replaced.
2. **Given** a transient bubble (no bombs), **When** it has been shown for its dwell, **Then** it begins its own exit and disappears without a leave-overlap event; a sign/locked-chest bubble still waits for the player to leave.
3. **Given** a bubble is on screen, **When** the language is switched, **Then** the on-screen text updates to the new language in the same frame, exactly as today.
4. **Given** the render pipeline, **When** the bubble is drawn, **Then** it sits above the darkness/enemy-eye overlay and at its previous depth relative to the world effects, terrain, entities and HUD.
5. **Given** a death/respawn, **When** it happens, **Then** the bubble is cleared immediately (no lingering, no flash at the new spawn) and the same effect kinds still survive that survive today; **Given** a full reset, **Then** the bubble and all effects are cleared.
6. **Given** the existing bubble and squash tests, **When** they are run after the move, **Then** their assertions are unchanged except for the renamed symbols/import paths, and they pass.

---

### User Story 5 - The contributor recipe names the new bubble kind (Priority: P3)

R-004 shipped a recipe (`docs/TransientEffectRecipe.md`) for adding a transient effect. After this feature the recipe's kind list and "closed set" wording still name only the original eight effects, so an author adding a bubble finds stale guidance. The recipe must describe the added `speechBubble` kind and how the bubble carries its resolved text, and must make clear that keyed timed tiles (such as the mushroom squash) are a separate family, not effects.

**Why this priority**: Documentation only, no runtime risk; it keeps the abstraction's promised "one module plus one registry line" true for the new shape.

**Independent Test**: Read the recipe and confirm it names the new `speechBubble` kind, explains the single-slot bubble, and explains that the bubble carries its resolved text (refreshed on a language change); confirm it does not claim a `mushroomSquash` effect kind.

**Acceptance Scenarios**:

1. **Given** the recipe, **When** it is read, **Then** its kind list and the registry comment include `speechBubble`, it is clear the kind set is extensible, and no `mushroomSquash` effect kind is claimed.
2. **Given** the recipe, **When** it describes how the bubble gets its text, **Then** it explains that the bubble carries its resolved localized text (refreshed when the language changes) and notes that the engine must not import app/i18n state directly.
3. **Given** the recipe, **When** it discusses non-effect transient visuals, **Then** it identifies the keyed timed-tile family (e.g. the mushroom squash) as separate from the effect registry.

---

### Edge Cases

- ✅ **The bubble is a singleton, not an append list.** At most one bubble is visible; the unified collection must preserve replace-in-place for a new message and the same-message no-op/restart rules. Resolved by US1/US4, FR-003.
- ✅ **Sign overlap wins over a locked chest.** When a sign tile and a closed chest overlap, the sign's hint is shown; the locked-chest message is only a fallback. Resolved by FR-003.
- ✅ **A transient bubble dismisses itself.** The no-bombs bubble has no sign overlap to leave, so it auto-begins its exit after its dwell; the sign/locked-chest bubbles omit that. Resolved by FR-002.
- ✅ **The bubble has no stored position.** It re-anchors to the moving player's visible head every frame, so its draw must take the live player anchor rather than a captured `x`/`y`. Resolved by FR-004.
- ✅ **A language switch must update a live bubble.** The bubble's stored text is refreshed when the language changes, so it does not freeze on the old language. Resolved by FR-005.
- ✅ **The bubble's text and font are shared assets.** The bubble keeps the existing cream/dark border, tail, multi-line `\n` handling, corner-radius clamp and font family; only its name and home change. Resolved by FR-006.
- ✅ **The bubble must not add an `engine/ → state` or `engine/ → i18n` edge.** It needs localized text, but the effect subsystem must not import `currentUI`; the page resolves the text and stores it on the bubble effect, so the engine reads only the effect's own state. Resolved by FR-005/FR-014.
- ✅ **Squash is keyed by cell, not a single slot.** Multiple caps may squash independently; a re-bounce replaces only that cell's entry. Resolved by US3/FR-010.
- ✅ **The squash prune boundary is `elapsed >= duration`.** The squash's arm/advance/prune come from `shared/timedTile.ts`; the at-or-after boundary and the zero-step prune must be preserved exactly. Resolved by FR-011.
- ✅ **The squash owns no drawing.** Its dip is applied inside the terrain pass (the cap sprite is split into stem and cap sub-rects), so it stays a keyed timed tile beside the mushroom rather than an effect kind with a no-op draw; the relocation must not invent a duplicate cap renderer. Resolved by FR-012.
- ✅ **Reset scopes differ.** The bubble is cleared on death/respawn (it would otherwise freeze through the death animation and flash at the new spawn) and on a full reset; the squash is likewise cleared on both (through the existing timed-tile clears). The R-004 effect kinds keep their existing scopes. Resolved by FR-013.
- ✅ **The root `types.ts` must stay below `contracts/`.** Moving the hint vocabulary into `level/` while `SignDef` still lived in `types.ts` would create a `contracts/ → types.ts → level/` edge; the sign definition must move with the vocabulary. Resolved by FR-008.
- ✅ **No compatibility aliases.** `HintTooltip`, `hintTooltipState`, `HintId`, `drawSignBubble`, and the old `engine/MushroomSquash` module path must not survive as thin aliases or second code paths. Resolved by FR-017.
- ✅ **The R-004 kind set is extended, not reordered.** Existing kinds keep their declaration order and layers; only `speechBubble` is added, without changing any existing intra-layer order or depth. Resolved by FR-014/FR-015.
- ✅ **The mushroom move must not fragment the shared static-object catalog.** Only the mushroom-specific entry helpers leave `engine/StaticObjectsCatalog.ts`; the generic `verticalRunRole` stays in `level/Terrain.ts`, and the catalog keeps its other static-object entries. Resolved by FR-010/FR-012.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: There MUST be one registered transient effect kind `speechBubble` that owns the platformer speech bubble — its create, phase tick, expiry and draw — and it MUST replace the sign-named `HintTooltip` machine. `engine/HintTooltip.ts` and the `hintTooltipState` signal MUST be removed; the bubble MUST live in the single `activeEffects` collection and be advanced and drawn through the unified registry (no per-kind tick or draw call in the page).
- **FR-002**: The bubble's lifecycle MUST be preserved exactly: an `entering` phase that becomes `shown` after `0.2 s`, a waiting `shown` phase, and an `exiting` phase that disappears after `0.25 s`; a transient bubble MUST auto-begin its exit after `1.5 s` of `shown`, while a sign/locked-chest bubble MUST wait to be told to exit. Growth and opacity MUST reproduce the current formulas (growth/opacity `0→1` on enter, `1` when shown, `1→0` on exit, clamped to `[0,1]`), and the box MUST grow upward from a fixed bottom edge.
- **FR-003**: The bubble MUST remain a single-slot overlay: at most one is active; a reveal for a different message MUST replace the current one; an interact press for the same message while it is `entering`/`shown` MUST be a no-op; while it is `exiting` it MUST restart its entrance; losing the trigger (leaving the sign overlap, or the locked-chest condition) MUST begin its exit unless it is already exiting. A sign overlap MUST take priority over a locked chest.
- **FR-004**: The bubble MUST stay anchored to the live player (horizontal centre at the player's centre, bottom at the player's visible head) and MUST be drawn at its current pipeline depth — above the darkness/enemy-eye overlay and before the world-effects layer — so a moving player keeps the bubble overhead and the draw order is unchanged.
- **FR-005**: The bubble MUST carry its localized message text so that switching language updates an on-screen bubble. The app/state layer MUST expose the localized hint strings through a hint-text signal derived from the translation signal (`currentUI`). The bubble effect MUST hold its resolved text in its own state within the `activeEffects` collection: the page MUST resolve it from that signal when the bubble is spawned and MUST refresh the active bubble's text when the language changes, so a live bubble updates. Because the effect subsystem MUST NOT import app/i18n state, the bubble itself MUST NOT read the signal.
- **FR-006**: The bubble's canvas primitive MUST be renamed from `drawSignBubble` to `drawSpeechBubble` and MUST live with the `speechBubble` effect module (not `Renderer.ts`), keeping the existing cream/dark border, tail, font family, multi-line `\n` handling and corner-radius clamp. `Renderer.ts` MUST no longer export or own it.
- **FR-007**: The mixed `HintId` union MUST be split into `SignHintId` (the hints a hand-authored sign may carry) and `BubbleMessageId` (every message a bubble may display — the sign hints plus the UI-only messages). A sign's `hintId` MUST be a `SignHintId`; a bubble's message MUST be a `BubbleMessageId`.
- **FR-008**: The hint catalog and both id types MUST live in one home — `level/HintCatalog.ts` (or an equivalent dependency-safe module) — owning `SignHintId`, `BubbleMessageId`, `HINT_IDS`, `DEFAULT_HINT_ID`, `hintCode`, `nextHintId`, `isSignHintId`, and the sign definition that carries a `SignHintId`. The platformer root `types.ts` MUST no longer declare the mixed hint union, and the move MUST NOT create a `contracts/ → level/` edge (the sign definition moves with the vocabulary, or the vocabulary lands in a module `types.ts` may legally import).
- **FR-009**: The sign-hint catalog's order, labels, editor codes and marker validation MUST be unchanged (the six sign hints in their current order as codes `1`–`6`; `noKeyForChest`/`noBombs` remain non-sign messages), and the shipped level, markers, and translations MUST NOT change.
- **FR-010**: `MushroomSquash` MUST move into `entities/blocks/Mushroom.ts`, which owns the grid-cell-keyed squash timer — its state shape, duration, maximum dip, arm/advance/prune (still delegating to `shared/timedTile.ts`) and dip lookup — and the mushroom-specific cap-role art helpers moved out of `engine/StaticObjectsCatalog.ts` (`mushroomEntry`, `mushroomHasCap`, `MUSHROOM_CAP_SOURCE_HEIGHT`, `MUSHROOM_DECORATIVE_ENTRY`). `engine/MushroomSquash.ts` MUST be removed, and the effect registry MUST NOT gain a `mushroomSquash` kind. `mushroomSquashStates` and `tickMushroomSquashes` remain the keyed-timer signal and tick in the state layer, and the generic `verticalRunRole` stays in `level/Terrain.ts`.
- **FR-011**: The squash's timing MUST be preserved exactly: a `0.1 s` duration; prune at `elapsed >= duration` (not strictly greater); a dip of `DIP * (1 - clamp01(elapsed / duration))` with the same maximum dip; a zero-or-negative step that leaves `elapsed` unchanged but still drops an already-expired entry; and clearing on death/respawn and on a full reset.
- **FR-012**: The terrain pass MUST keep obtaining each cap's squash dip from the mushroom module's keyed timer (no parallel squash store, no duplicate cap renderer), and the rendered cap MUST be pixel-identical. The squash MUST NOT be registered as an effect kind, and the move MUST NOT change the split of the cap sprite into stem and cap sub-rects.
- **FR-013**: Reset behaviour MUST be preserved: a death/respawn MUST clear the bubble (immediately, and through the death/respawn reset) and every squash (through the existing timed-tile clears), and a full Reset Game MUST clear both. The R-004 effect kinds MUST keep their existing reset scopes.
- **FR-014**: The `EffectKind` set MUST be extended with `speechBubble` only; the effect subsystem's public surface MAY change additively (the render context's `playerAnchor` gains the bubble's head-edge point alongside the heal aura's centre, and the bubble carries its own effect-state text), but the existing kinds' kinds, layers, reset scopes and behaviour MUST be unchanged.
- **FR-015**: Adding the bubble MUST NOT require new page plumbing: no new signal, no new per-kind tick call, and no new per-kind draw call. The bubble MUST render at its current depth via the existing layer dispatch (e.g. as the first world-effects entry or through an equivalent preserved depth). The squash keeps its existing keyed-tile tick and draw-time dip lookup, with no registry involvement.
- **FR-016**: All existing tests MUST migrate with unchanged assertions wherever only a name, signature, module location, or import path changed — never weakened, skipped or deleted — and MUST pass, and the production build MUST succeed.
- **FR-017**: No compatibility re-export, alias, or second code path MAY preserve `HintTooltip`, `hintTooltipState`, `HintId`, `drawSignBubble`, or the old `engine/MushroomSquash` module path. `mushroomSquashStates` and `tickMushroomSquashes` remain (they are the keyed-timer signal and tick, not aliases).
- **FR-018**: The contributor recipe (`docs/TransientEffectRecipe.md`) MUST name the added `speechBubble` kind and document how the bubble carries its resolved localized text (refreshed on a language change); it MUST NOT claim a `mushroomSquash` effect kind, and MUST make clear that keyed timed tiles (e.g. the mushroom squash) are a separate family.
- **FR-019**: There MUST be no gameplay, visual, tuning, level-data, or translation change — this feature only generalises, relocates, and re-registers what already ships.
- **FR-020**: The derived hint-text signal MUST be the one lookup for localized hint/message strings: the page's bubble spawn/refresh (in the render loop) and the editor's hint-marker label MUST resolve their text through it rather than indexing `currentUI.value.platformer.hints[id]` directly. The `HINT_IDS` catalog, its order and its editor codes MUST remain explicit and unchanged (FR-009).

### Key Entities

- **`SpeechBubble` effect** (`speechBubble` kind): the one reusable player-overhead bubble — message id, resolved localized text, phase (`entering`/`shown`/`exiting`), elapsed, optional transient flag, and the growth/opacity derivation. Consumers: sign hints, the locked-chest message, and the transient no-bombs message.
- **`SignHintId`**: the subset of messages a hand-authored sign may carry (the six hints with a stable order and editor codes).
- **`BubbleMessageId`**: every message the speech bubble may display — the sign hints plus the UI-only messages.
- **Hint home** (`level/HintCatalog.ts` or equivalent): the one module owning `SignHintId`, `BubbleMessageId`, the ordered catalog, the editor code/cycle/validation helpers, and the sign definition.
- **Mushroom home** (`entities/blocks/Mushroom.ts`): owns the grid-cell-keyed squash timer — `{col,row,elapsed}`, `0.1 s`, the dip formula, arm/advance/prune via `shared/timedTile.ts`, and the dip lookup — plus the mushroom-specific cap-role art helpers (`mushroomEntry`, `mushroomHasCap`, `MUSHROOM_CAP_SOURCE_HEIGHT`, `MUSHROOM_DECORATIVE_ENTRY`). Consumed by `Renderer.ts` (dip + art), `PlatformerState.ts` (advance) and `PlatformerPage.tsx` (arm).
- **Bubble text refresh (page)**: the page-side update that re-resolves the active bubble's stored text from the hint-text signal when the language changes, so the bubble (which reads only its own effect state) stays live without a render-context lookup.
- **Hint-text signal** (app/state layer): the one signal, derived from the translation signal (`currentUI`), that maps a hint/message id to its localized string for the render loop's bubble (at spawn and on a language change) and the editor's hint-marker label.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A search of the theme finds zero occurrences of `HintTooltip`, `hintTooltipState`, `drawSignBubble`, or `HintId` as a whole word (`\bHintId\b`; the new `SignHintId` is retained), and exactly one registered `speechBubble` kind; the sign, locked-chest and no-bombs triggers all drive it through the single collection.
- **SC-002**: A search finds no `engine/MushroomSquash` module and no `mushroomSquash` effect kind; the squash timer and the mushroom cap-role art helpers all resolve from `entities/blocks/Mushroom.ts`, and the squash's arm/advance/prune still go through `shared/timedTile.ts`.
- **SC-003**: `SignHintId` and `BubbleMessageId` are distinct, the hint vocabulary has one home outside the root `types.ts`, and the catalog's order/labels/codes are unchanged.
- **SC-004**: The full test suite passes (assertions unchanged except for renames/import paths) and the production build succeeds.
- **SC-005**: A manual browser pass shows no visible or behavioural difference: a sign hint, a locked-chest bubble, the transient no-bombs bubble, a mid-bubble language switch, a mushroom cap dip, and a death/respawn.
- **SC-006**: Adding or consuming a bubble message, or a future self-drawing effect, requires no new signal, tick call, or draw call in the page — only a message id/trigger site or one module plus one registry line.
- **SC-007**: No R-001 forbidden edges are widened: no new `level/ → engine/`, no new `engine/ → state/`, no new `contracts/ → level/`, and `contracts/` remains a leaf (the new `entities/blocks/Mushroom.ts` is reached only through allowed `engine/ → entities/` and `state/ → entities/` directions).
- **SC-008**: Reset scope is preserved: death/respawn clears the bubble and every squash; a full reset clears the whole collection; the other effect kinds' survival is unchanged.

## Assumptions

- **The squash is deliberately NOT folded into the effect registry.** Issue #93 / analysis E3 originally framed `MushroomSquash` as an effect-family member; this feature instead reinterprets E3 as "re-home it beside the mushroom". The squash is a purely cosmetic, grid-cell-keyed timer that owns no drawing (its dip is applied in `drawTerrain`), so an effect kind could only register a forced no-op `draw`. It stays in the keyed timed-tile family alongside crumbling floor, floor spike and falling stalactite. R-004's spec/research/plan notes that deferred the re-home to R-005 remain historically accurate and are not edited by this feature.
- **The bubble is the only new effect kind.** R-005 extends the `EffectKind` set with `speechBubble` only; the recipe's "closed set" wording (R-004-scoped) is updated to an extensible set and the keyed timed-tile family is documented as separate (FR-018).
- **The bubble is a keyed single slot; the squash is keyed by cell.** The bubble uses a fixed identity so a new message replaces it in place; the squash uses the grid cell as its key so multiple caps squash at once. The plan may choose the exact key representation.
- **The message text lives in the bubble effect, refreshed by the page.** The app/state layer exposes a hint-text signal derived from the translation signal (`currentUI`); the page resolves the bubble's text from it when the bubble spawns and refreshes the active bubble's stored text when the language changes, so a live bubble follows a language switch without the engine importing app/i18n state or a render-context lookup. The refresh MUST update the effect only when the resolved text differs, so the steady state performs no effect-collection write.
- **The hint vocabulary's home is `level/HintCatalog.ts`.** The target tree keeps `HintCatalog.ts` under `level/`, and both `level/` (parser, mappers, editor) and `engine/` (the bubble/collision) may import it. Because the root `types.ts` sits below `contracts/`, the sign definition that carries a `SignHintId` moves with the vocabulary. The plan may choose an equivalent dependency-safe home if it preserves FR-008's no-`contracts/ → level/` invariant.
- **The mushroom home is `entities/blocks/Mushroom.ts`.** The bouncy mushroom is a block/grid tile and `entities/blocks/` already owns the block kind modules; `engine/ → entities/` and `state/ → entities/` are allowed directions. Only the mushroom-specific entry helpers leave `engine/StaticObjectsCatalog.ts`; its other static-object entries and the generic `verticalRunRole` (in `level/Terrain.ts`, shared with bushes) are untouched.
- **The mushroom's rendering and bounce/collision stay where they are.** `drawTerrain` keeps its bouncy-mushroom draw branch (it imports the moved art helpers), the bounce/cap detection stays in the page's physics tick, and `isStandableMushroomCap` stays in `level/Terrain.ts`. Extracting a full mushroom renderer/actor module is not part of this feature.
- **"One draw pass" still means one dispatch invoked per depth.** The bubble keeps its current depth between the darkness/enemy-eye overlay and the world effects; if it is placed as the first world-effects entry, the relative order of every effect is unchanged. Adding it does not collapse any depth.
- **R-004's actual effect home is `engine/effects/`.** R-004 landed the base, registry, dispatch and per-kind modules under `engine/effects/` (not the analysis's future `features/effects/`); R-005 adds only `speechBubble` there, and the `features/`/`render/` split remains R-009's work.
- **Behaviour is byte-for-byte preserved.** The only sanctioned changes are the bubble generalisation, the id split, the hint relocation, the squash relocation with the mushroom, the render-context head-anchor addition, and the corresponding import/name updates — never a change to wording, timing, anchor, depth, dip, or reset scope.
- **No data migration.** The shipped level, markers, hint ids, editor codes and translations are unchanged; only TypeScript types and module homes move.
- **S-011 is a consumer, not part of this feature.** The issue lists S-011 (Interact Hint Overlay) among R-005's dependencies, but S-011 has no spec yet and the sign/locked-chest/no-bombs consumers already ship. R-005 generalises the bubble so S-011 can reuse it; it does not implement S-011's first-time interact overlay. The dependency map's exact sequencing is settled at planning time.
- **Layer invariants continue to hold.** `contracts/` stays a leaf; `engine/` and `entities/` depend down on it; `level/` never imports `engine/` state; `engine/` never imports state (R-001). The engine reads the bubble's text only from the bubble effect's own state; the page resolves it from the hint-text signal.

## Out of Scope

- The S-011 first-time interact hint overlay (the checkpoint/chest/deployable-ladder prompt) — **S-011**; R-005 only exposes the reusable bubble it would consume.
- Folding any timed tile (mushroom squash, floor spike, crumbling floor, falling stalactite) into the effect registry — the squash is relocated beside the mushroom, and the other three are unchanged.
- Extracting a full mushroom renderer/actor module, or moving `drawTerrain`'s mushroom draw branch and `isStandableMushroomCap` — the mushroom's rendering stays in `Renderer.ts` (R-009) and its standability stays in `level/Terrain.ts`.
- Pickup unification and the `kind` discriminator — **R-006**; registry-dispatch completion — **R-007**; placeable-world-item unification — **R-008**.
- The `Renderer.ts` decomposition and `SceneRenderer`/`HudRenderer` split — **R-009**; the tile-module registry — **R-015**.
- Mapper/editor unification and the `level.ts` split — **R-010**; per-domain state stores and the state/page decomposition — **R-011/R-012**; sprite asset organisation — **R-013**; the layer-boundary lint guard — **R-014**.
- New hints, new bubble messages, new effects, or any change to the mushroom's bounce/standability behaviour.
- Any change to gameplay, balance, visuals, level data, or translations.
