# Phase 1 Data Model: Platformer Generic Speech Bubble (R-005)

**Feature**: `specs/R-005-platformer-generic-speech-bubble/` | **Date**: 2026-09-25

R-005 is a refactor: it introduces no persisted data and no new gameplay entities. The "data model"
below is the **runtime type model** the feature introduces or reshapes. Field-level interface
signatures live in [`contracts/`](./contracts/); this document states the entities, their
relationships, the invariants that must hold, and the before/after preservation contract.

> **Amended after spec clarification**: the mushroom squash is **not** an effect kind. It is a
> grid-cell-keyed timed tile owned by `entities/blocks/Mushroom.ts`; the effect registry gains only
> `speechBubble`.

---

## 1. Hint vocabulary (`level/HintCatalog.ts`)

The one home for the sign/bubble id vocabulary and the sign definition. It imports the app's
`Translation` type (type-only) to keep the ids compile-time-linked to the i18n JSON keys; it imports no
platformer module and no state.

| Export | Type | Notes |
| --- | --- | --- |
| `SignHintId` | `'bridgeDropThrough' \| 'ladderClimbUp' \| 'fragileRockBreaksFromBelow' \| 'chestNeedsKey' \| 'openAllChestsHaveFun' \| 'bomb'` | Derived from the `SIGN_HINT_IDS` `as const satisfies readonly PlatformerHintKey[]` tuple; the six hints a hand-authored sign may carry, in stable order (FR-007/FR-009). |
| `BubbleMessageId` | `keyof Translation['platformer']['hints']` | Every message a bubble may display — the six sign hints **plus** `noKeyForChest` and `noBombs` (FR-007). |
| `HINT_IDS` | `readonly SignHintId[]` | The ordered sign catalog; codes `1`–`6` (FR-009). Explicit, never derived from object key order. |
| `DEFAULT_HINT_ID` | `SignHintId` | `HINT_IDS[0]`; the unmarked `T`'s hint and the fresh-cell sign tool value. |
| `hintCode(id)` | `(id: SignHintId) => string` | `'1'`–`'6'`. |
| `nextHintId(id)` | `(id: SignHintId) => SignHintId` | Wrapping cycle for the sign tool. |
| `isSignHintId(value)` | `(value: unknown) => value is SignHintId` | Forgiving validation of a stored sign marker; rejects `noKeyForChest`/`noBombs` (the renamed `isHintId`). |
| `SignDef` | `{ id: string; hintId: SignHintId }` | The sign definition, **moved here** from the root `types.ts` (FR-008). |

**Relationships**
- `SignPlacement extends SignDef` (`level/SignMapper.ts`) — unchanged shape, new import home.
- `level/LevelData.ts`, `level/LevelParser.ts`, `engine/Collision.ts` type their sign fields as
  `SignHintId`.
- `PlatformerPage.tsx`'s `lockedChestHintId` is typed `BubbleMessageId | undefined` (it can be the
  UI-only `noKeyForChest`).
- The engine's `speechBubble.ts` types its payload's `messageId` as `BubbleMessageId` (type-only
  import) and carries the resolved localized `text` alongside it.

**Validation rules**
- `HINT_IDS` is exactly the six sign hints in the current order; `noKeyForChest`/`noBombs` are not sign
  hints (FR-009).
- A value of `SignHintId` is assignable to `BubbleMessageId`; a UI-only message is not assignable to
  `SignHintId` (FR-007).
- The root `types.ts` no longer declares `HintId` or `SignDef` and no longer imports `level/`, so
  `contracts/ → types.ts → level/` cannot form (FR-008/SC-007).

---

## 2. Derived hint-text signal (`state/hintText.ts`)

| Concern | Rule |
| --- | --- |
| Shape | `export const hintText = computed(() => currentUI.value.platformer.hints);` — a `Signal<Translation['platformer']['hints']>`, i.e. a `BubbleMessageId → string` record. |
| Source | Derived from the translation signal (`currentUI` in `@/state/locale`); it stores no text of its own. |
| Consumers | The page's bubble spawn + language-change refresh and the editor's hint-marker hover label. Both stop indexing `currentUI.value.platformer.hints[id]` directly (FR-020). |
| Spawn resolution | The page reads `hintText.value[messageId]` once when it spawns the bubble and stores the result on `SpeechBubbleState.text`. |
| Refresh | `refreshSpeechBubbleText()` (state layer) re-resolves the active bubble's `text` each frame and rewrites that one effect only when the value differs — the steady state performs no collection write (spec Assumptions). |
| Live switch | Because it is `computed`, a locale change re-evaluates it; the render loop's refresh observes the difference on the next frame and updates the on-screen bubble in the same frame (US4-3/FR-005). |
| Layering | Lives in the app/state layer (`state/ → @/state/locale`); the effect subsystem never imports it (`engine/ → state/` forbidden). |

---

## 3. `SpeechBubbleState` and the `speechBubble` kind (`engine/effects/speechBubble.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `messageId` | `BubbleMessageId` | The message identity — kept for the trigger-site comparison and as the refresh's lookup key. |
| `text` | `string` | The resolved localized message, stored at spawn from the `hintText` signal and refreshed by the page on a language change; the draw reads this field. |
| `phase` | `'entering' \| 'shown' \| 'exiting'` | The animation phase. |
| `transient?` | `boolean` | When true, the bubble auto-begins its exit after the dwell (the no-bombs bubble). |

`elapsed` lives on the `TransientEffect`, not the payload.

**Constants**: `SPEECH_BUBBLE_FADE_IN_SECONDS = 0.2`, `SPEECH_BUBBLE_FADE_OUT_SECONDS = 0.25`,
`SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS = 1.5`.

**Functions (public API)**
| Function | Contract |
| --- | --- |
| `startSpeechBubble(messageId, text, options?)` | Builds an `entering` effect at `elapsed: 0` carrying the resolved `text`; `{ transient: true }` marks a self-dismissing bubble. |
| `beginSpeechBubbleExit(effect)` | Returns the same effect in `exiting` at `elapsed: 0`. |
| `beginSpeechBubbleEnter(effect)` | Returns the same effect in `entering` at `elapsed: 0` (the restart-on-exit rule). |
| `withSpeechBubbleText(effect, text)` | Pure: returns the same effect when `state.text === text`, else a copy with the new `text` (backs the page's refresh). |
| `tickSpeechBubbleEffect(effect, dt)` | `entering → shown` at `>= 0.2s` (elapsed reset); `exiting` → `null` at `>= 0.25s`; transient `shown` begins its own exit at `>= 1.5s`; otherwise accumulates. |
| `speechBubbleGrowthAndOpacity(effect)` | Pure `{ growth, opacity }`: `0→1` on enter, `1` on shown, `1→0` on exit, clamped `[0,1]`. |
| `drawSpeechBubble(ctx, text, anchorX, anchorBottomY, growth?, opacity?)` | The canvas primitive (renamed from `drawSignBubble`); byte-identical body. |
| `drawSpeechBubbleEffect(effect, rc)` | The registered draw: reads `effect.state.text` and anchors at `rc.playerAnchor.centerX` / `rc.playerAnchor.headBottomY`, then calls the primitive. |
| `activeSpeechBubble(effects)` | Returns the single live bubble (kind-filtered) or `undefined`, for the trigger-site comparison. |

**Registry entry**: `{ kind: 'speechBubble', create: startSpeechBubble, tick: tickSpeechBubbleEffect, draw: drawSpeechBubbleEffect, expired: () => false, layer: 'worldEffects', resetScope: 'death', keyOf: () => 'speechBubble' }` — declared first in `EFFECT_REGISTRY` (`EFFECT_REGISTRY[0]`, before `flyingText`).

**Invariants**
- At most one bubble exists; `spawnEffect` replaces the singleton by its constant key (FR-003).
- Same message while `entering`/`shown` is a no-op; while `exiting` it restarts; a different message
  replaces (FR-003).
- The text is resolved by the page (at spawn and on a language change), stored on the effect, and read by the draw from `state.text`; the engine never re-resolves from i18n and the render context carries no lookup (FR-005/FR-020).
- The refresh writes the effect collection only when the resolved text differs — a steady-state frame performs no collection write (spec Assumptions).
- The bubble re-anchors to the live player every frame (FR-004).
- `growth <= 0` draws nothing; growth scales height upward from a fixed bottom edge (FR-002).

---

## 4. Mushroom squash timed tile (`entities/blocks/Mushroom.ts`) — **NOT an effect kind**

| Field | Type | Notes |
| --- | --- | --- |
| `col` | `number` | Grid column of the bounced cap. |
| `row` | `number` | Grid row of the bounced cap. |
| `elapsed` | `number` | Seconds since the bounce (kept in the state, advanced/pruned by `shared/timedTile.ts`). |

**Constants**: `MUSHROOM_SQUASH_DURATION_SECONDS = 0.1`, `MUSHROOM_SQUASH_DIP_PX = 2`.

**Functions (public API)**
| Function | Contract |
| --- | --- |
| `startMushroomSquash(states, col, row)` | Arms the cell via `armTimedTile` with `rearm: 'replace'`; an in-progress entry for the cell is restarted, not queued. |
| `advanceMushroomSquashes(states, dt)` | Advances every entry by `dt` via `advanceTimedTiles`; `dt <= 0` leaves `elapsed` unchanged but still drops an already-expired entry; prune at `elapsed >= 0.1`. |
| `mushroomSquashDip(state)` | `DIP * (1 - clamp01(elapsed / 0.1))`. |
| `mushroomSquashDipAt(states, col, row)` | Reads the dip for a cap from the state array, or `0`. |
| `mushroomEntry(role)` | The `{ sx, sy }` sprite crop for a `VerticalRunRole`. |
| `mushroomHasCap(role)` | `true` for `'only'`/`'top'` (needs the cap/stem split the dip animates). |
| `MUSHROOM_CAP_SOURCE_HEIGHT` | `11` — the cap sub-rect height shared by the renderer and the squash split. |
| `MUSHROOM_DECORATIVE_ENTRY` | The small decorative mushroom's fixed `{ sx: 32, sy: 0 }` crop. |

**Invariants**
- Keyed by cell: multiple caps squash independently; a re-bounce replaces only that cell
  (FR-010/US3-3).
- Prune at `elapsed >= duration` (not strictly greater); a zero/negative step still drops an
  already-expired entry (FR-011).
- The module owns **no drawing**; `drawTerrain` applies the dip by splitting the cap sprite — no cap
  renderer is invented (FR-012).
- The module is not registered anywhere as an effect; `EffectKind` never gains `mushroomSquash`
  (FR-010/FR-014).
- The rendered cap is pixel-identical (FR-012/SC-005).

---

## 5. `EffectRenderContext` additions

| Field | Type | Purpose |
| --- | --- | --- |
| `playerAnchor.headBottomY` | `number` | The live player's visible-head bottom edge in screen space; the bubble's tail anchor. `playerAnchor.centerX`/`centerY` are the heal aura's centre. |

**Invariants**
- Existing fields and every existing kind's rendering are untouched (FR-014).
- The field is supplied by the page each frame; `testContext.ts` supplies it for unit tests.
- The bubble's text is **not** a context field — it rides on `SpeechBubbleState.text`; the context grows by exactly this one anchor number (FR-014).
- The bubble keeps its depth via the `worldEffects` dispatch (D1). The squash adds no field — it is not
  an effect.

---

## 6. Unified collection + squash signal (`PlatformerState.ts`)

| Concern | Rule |
| --- | --- |
| Effect collection | Still exactly one `activeEffects` collection, now holding 9 kinds; no second signal for the bubble. |
| Removed signal/call | `hintTooltipState` and the `tickHintTooltip` page call are deleted. |
| Kept signal/call | `mushroomSquashStates` and `tickMushroomSquashes` remain (they are the keyed-timer signal and tick, FR-010/FR-017); their type/function import retargets to `./entities/blocks/Mushroom`. |
| Spawn | `spawnEffect` (constant keyed replace for the bubble singleton) is the only insertion path for effects; the page passes the bubble's resolved `text` from the `hintText` signal. |
| Text refresh | The render loop calls `refreshSpeechBubbleText()` before assembling the render context; it rewrites the active bubble's `state.text` only when it differs from `hintText.value[messageId]`. |
| Advance | The single `advanceEffects(activeEffects.value, dt)` in the `playing` branch advances every effect; `tickMushroomSquashes(dt)` advances the squash timer in the same branch (unchanged). The filtered `kinds: ['hitSplatter']` advance in the `dying` branch leaves both frozen. |
| Reset | `resetGame()` clears the bubble through `clearEffectsByResetScope('death')` (plus the fade-out labels) and the squash through its existing `mushroomSquashStates.value = []`; `resetGameProgress()` empties the whole effect collection and the squash timer. |
| Immediate death clear | Both death sites call `activeEffects.value = clearEffectsOfKind(activeEffects.value, 'speechBubble')`, so the bubble never freezes through `dying`/`awaitingRestart` (FR-013). The squash is cleared later, by `resetGame()`, exactly as today. |
| Helper | `clearEffectsOfKind(effects, kind)` is a new pure function in `engine/effects/transientEffect.ts`. |

---

## 7. Preservation contract (before → after)

| Concept | Before | After | Must be identical |
| --- | --- | --- | --- |
| Sign tooltip machine | `engine/HintTooltip.ts`, `hintTooltipState` signal, `tickHintTooltip` call | `speechBubble` kind in `activeEffects`, advanced by `advanceEffects` | phases, durations, dwell, growth/opacity curves, trigger rules |
| Bubble draw | `Renderer.drawSignBubble`, explicit page call | `drawSpeechBubble` primitive in the effect module, `worldEffects` dispatch | text layout, colours, tail, font, depth |
| Bubble anchor | page-computed `anchorX`/`anchorBottomY` | `rc.playerAnchor.centerX` / `rc.playerAnchor.headBottomY` | same screen coordinates |
| Bubble text | `currentUI.value.platformer.hints[id]` at draw time | `hintText` signal → stored on `SpeechBubbleState.text` at spawn, refreshed on a language change, read by the draw | live language switching; refresh only when the text differs |
| Bubble reset | `hintTooltipState = null` at death and reset | `clearEffectsOfKind` at death; `'death'` scope on reset | no lingering, no flash |
| Mushroom squash timer | `engine/MushroomSquash.ts` (standalone) | `entities/blocks/Mushroom.ts` (with the mushroom) | state shape, 0.1 s, `>=` prune, `dt <= 0` no-rewind, `startMushroomSquash`/`advanceMushroomSquashes`/`mushroomSquashDipAt`, per-cell independence |
| Mushroom cap art helpers | `engine/StaticObjectsCatalog.ts` | `entities/blocks/Mushroom.ts` | the same `{ sx, sy }` crops, `MUSHROOM_CAP_SOURCE_HEIGHT = 11`, decorative `(32,0)` |
| Terrain cap draw | `drawTerrain` reads the standalone timer | `drawTerrain` reads the mushroom module's timer | cap/stem sub-rects, pixel identity |
| Hint vocabulary | `HintId` mixed union + `SignDef` in `types.ts`; catalog in `level/HintCatalog.ts` | `SignHintId`/`BubbleMessageId`/`SignDef` in `level/HintCatalog.ts` | catalog order, labels, codes, marker validation, translations |

**No row's value, wording, timing, depth, or scope may change** (FR-019/US4/SC-005).

---

## 8. Non-goals (explicitly not modelled)

- No S-011 first-time interact overlay (S-011 is a consumer only).
- No new bubble message, hint, effect, tile, or gameplay state (FR-019).
- No `mushroomSquash` effect kind; no folding of any other keyed timed tile into the effect registry
  (squash, floor spike, crumbling floor, falling stalactite).
- No change to the other R-004 kinds' kinds, layers, reset scopes, or behaviour (FR-014).
- No change to the mushroom's bounce strength or standability; no extracted mushroom renderer/actor
  module.
- No change to the shipped level, markers, editor codes, or translations (FR-009).
