# Phase 0 Research: Platformer Generic Speech Bubble (R-005)

**Feature**: `specs/R-005-platformer-generic-speech-bubble/` | **Date**: 2026-09-25

This document was **regenerated** after the spec was amended (its Clarifications session resolved the
mushroom-squash question). The previous research assumed the squash would be folded into the effect
registry as a `mushroomSquash` kind; that design is superseded — see **D10–D12**.

It was **regenerated again** after a second amendment on the bubble-text plumbing: the render context no
longer carries a `bubbleText` lookup, and the bubble instead carries its own resolved localized text,
refreshed by the page when the language changes — see **D4/D6/D7** and the test note at the end of
**D14**.

The spec resolved every functional question up front (see its Clarifications), so no
`NEEDS CLARIFICATION` remains. This document records the technical decisions the plan rests on, each
with the alternatives considered and why they were rejected. Every decision is constrained by the
dominant requirement: **the shipped game must not change** (FR-019/US4), and **no R-001 forbidden
edge may be widened** (SC-007).

Verified against the current tree: `engine/HintTooltip.ts`, `engine/MushroomSquash.ts`,
`engine/StaticObjectsCatalog.ts`, `engine/effects/{effectRegistry,transientEffect,index}.ts`,
`level/{HintCatalog,Terrain,SignMapper,LevelParser,LevelData}.ts`, `types.ts`,
`entities/blocks/`, `entities/hazards/FallingStalactite.ts`, `PlatformerState.ts`,
`PlatformerPage.tsx`, `engine/Renderer.ts`.

---

## D1 — The bubble is one `speechBubble` registry kind, declared first at `worldEffects`

- **Decision**: Add `engine/effects/speechBubble.ts` with kind `'speechBubble'`. `EFFECT_REGISTRY`
  declares it first (`EFFECT_REGISTRY[0]`, before `flyingText`), with `layer: 'worldEffects'`. The page's existing
  `drawEffects(effectRenderContext, 'worldEffects', activeEffects.value)` invocation draws it; the
  explicit `drawSignBubble` block in the render loop is deleted.
- **Rationale**: The bubble's current depth is "after the darkness/enemy-eye overlay, before the
  world-effects layer" (`PlatformerPage.tsx` render order: darkness → enemy eyes → bubble →
  `drawEffects('worldEffects')`). `drawEffects`' one dispatch iterates the registry in declaration
  order (`drawEffects.ts`), so declaring `speechBubble` **first** among the `worldEffects` entries
  makes it draw before `flyingText`/`puff`/`debris`/`hitSplatter`/`fadeOutText` — the same relative
  order as today — with no new layer, no new dispatch call, and no change to any existing kind's
  declaration order (FR-015). The spec's Assumptions explicitly sanction "the first world-effects
  entry".
- **Alternatives rejected**:
  - *Introduce a new `EffectLayer` (`overlay`/`aboveDarkness`) and a fifth `drawEffects` call* — adds
    pipeline surface and a new page call for no behavioural gain; FR-015 prefers the existing dispatch.
  - *Place `speechBubble` last / keep the explicit draw* — placing it last would draw it after the
    world effects (wrong depth); keeping the explicit draw would leave a per-kind draw call, violating
    FR-001/FR-015.

## D2 — The bubble's phase machine mirrors `flyingText`; `tick` returns the `null` sentinel

- **Decision**: `SpeechBubbleState = { messageId: BubbleMessageId; text: string; phase: 'entering' | 'shown' | 'exiting'; transient?: boolean }`;
  `elapsed` lives on the `TransientEffect`, not in the state. `tickSpeechBubbleEffect(effect, dt)`
  reproduces the old `tickHintTooltip` exactly:
  - `entering`: `elapsed >= FADE_IN` → `{ phase: 'shown', elapsed: 0 }`, else accumulate.
  - `exiting`: `elapsed >= FADE_OUT` → `null` (drop sentinel), else accumulate.
  - `shown`: transient and `elapsed >= DWELL` → begin exit (reset elapsed 0); else accumulate.
  - `expired` overridden to `() => false` (the phase machine, not elapsed, ends the effect).
- **Rationale**: This is the established convention (`flyingText.ts` keeps `phase` in `state`,
  `elapsed` on the effect; `counterPopup` uses the `null` drop sentinel). It keeps the animation math
  (`speechBubbleGrowthAndOpacity`) a pure function of phase + elapsed, so the existing `HintTooltip`
  tests migrate with unchanged assertions (FR-016).
- **Alternatives rejected**:
  - *Keep `elapsed` inside `state`* — diverges from every other effect and duplicates the base field.
  - *Use `expired: elapsed > duration` for the terminal boundary* — the `shown` phase has no fixed
    upper bound (it waits for the caller), so an `elapsed`-based expiry is wrong; the sentinel is exact.

## D3 — The bubble is a keyed singleton; the trigger-site rules stay in the page

- **Decision**: The registry entry declares `keyOf: () => 'speechBubble'` (a constant), so
  `spawnEffect` (via `upsertEffect`) replaces the single active bubble in place. The page's trigger
  block (the current `hintTooltipState` transition block at `PlatformerPage.tsx:1632–1669`) keeps the
  nuanced rules:
  - new message available → `spawnEffect(startSpeechBubble(messageId, hintText.value[messageId]))`;
  - same message, phase `exiting` → `spawnEffect(beginSpeechBubbleEnter(current))` (restart);
  - same message, phase `entering`/`shown` → no-op;
  - trigger lost and phase ≠ `exiting` → `spawnEffect(beginSpeechBubbleExit(current))`.
  A `activeSpeechBubble(effects)` helper (kind-filtered, typed) reads the current bubble for that
  comparison.
- **Rationale**: `upsertEffect`'s keyed replace is the R-004 mechanism for "at most one slot"; it is
  exactly what a singleton needs. The no-op/restart/replace distinctions depend on the *current phase*,
  which only the trigger site knows — they are trigger logic, not registry metadata (FR-003).
- **Alternatives rejected**:
  - *Move the transition rules into the registry `create`* — the create function has no view of the
    trigger or the message availability.
  - *Append (no `keyOf`) and filter manually* — would let two bubbles coexist for a frame, violating
    the singleton rule (FR-003/US4-1).

## D4 — The canvas primitive is `drawSpeechBubble`, owned by the effect module

- **Decision**: Move the bubble constants and `drawSignBubble` (currently `Renderer.ts:1514–~1610`,
  including `clampedCornerRadius`, the `BUBBLE_*` constants and the `RESTART_PROMPT_FONT_FAMILY` font
  use) into `engine/effects/speechBubble.ts`, renaming the export to
  `drawSpeechBubble(ctx, text, anchorX, anchorBottomY, growth, opacity)`. The registered draw is
  `drawSpeechBubbleEffect(effect, rc)`: it reads the bubble's own stored `effect.state.text`, reads
  `rc.playerAnchor.centerX` and `rc.playerAnchor.headBottomY`, computes growth/opacity, and calls the
  primitive.
  `Renderer.ts` no longer exports or owns it (FR-006).
- **Rationale**: FR-006 requires the primitive to live with the effect module and to be renamed; a
  module cannot export two `drawSpeechBubble` symbols, so the registered dispatch body takes the
  `…Effect` suffix (the `drawHealAuraEffect` precedent). The primitive's body is byte-identical
  (cream/dark border, tail, font, `\n` handling, corner-radius clamp), so the Renderer tests migrate
  unchanged.
- **Alternatives rejected**:
  - *Keep the primitive in `Renderer.ts` and import it into the effect module* — violates FR-006
    ("`Renderer.ts` MUST no longer export or own it") and creates an effect → god-renderer import.
  - *Name the registered draw `drawSpeechBubble` and the primitive something else* — contradicts the
    mandated `drawSignBubble → drawSpeechBubble` rename.

## D5 — The bubble re-anchors from a combined `playerAnchor` object

- **Decision**: Restructure `EffectRenderContext.playerAnchor` into named player screen-space points —
  `{ centerX, centerY, headBottomY, width }` — replacing the old `{ x, y, width }` and the separate
  `playerHeadBottomY`. `centerX`/`centerY` are the visual centre the heal aura reads (numerically
  identical to the old `.x`/`.y`); `headBottomY` is the bubble's tail anchor, computed as
  `playerState.y + PLAYER_HEAD_PADDING + originY` (exactly today's `anchorBottomY`).
- **Rationale**: Both values are live player anchors, so one object keeps them together and gives each a
  precise name. The bubble re-anchors to the *live* player's visible head every frame (FR-004); the heal
  aura anchors at the visual centre, a different y (`PLAYER_VISUAL_CENTER_Y_OFFSET` vs
  `PLAYER_HEAD_PADDING`). Passing both explicitly keeps the draws from re-deriving offsets from
  `entities/Player` constants and keeps the bubble position-less.
- **Alternatives rejected**:
  - *Keep `{ x, y, width }` and add a separate top-level `playerHeadBottomY`* — the superseded two-field
    shape; the spec review preferred one named player-points object.
  - *Reuse the centre y for the bubble* — wrong y; the bubble would float/sink relative to today.
  - *Re-derive the head from the centre y inside the effect* — couples the bubble to
    `PLAYER_VISUAL_CENTER_Y_OFFSET`/`PLAYER_HEAD_PADDING` and re-computes a value the page already has.

## D6 — Localized text lives on the bubble effect, resolved at spawn and refreshed by the page

- **Decision**: Add `src/themes/platformer/state/hintText.ts`:
  ```ts
  import { computed } from '@preact/signals-react';
  import { currentUI } from '@/state/locale';
  export const hintText = computed(() => currentUI.value.platformer.hints);
  ```
  `SpeechBubbleState` gains `text: string`; `startSpeechBubble(messageId, text, options?)` stores it at
  spawn and the page passes `hintText.value[messageId]`. A pure `withSpeechBubbleText(effect, text)`
  returns the same effect when the text already matches, otherwise a copy with the new `state.text`;
  the state layer's `refreshSpeechBubbleText()` finds the active bubble, compares
  `hintText.value[bubble.state.messageId]` to `bubble.state.text`, and rewrites that one effect only on
  a difference. `PlatformerPage.tsx` calls `refreshSpeechBubbleText()` at the top of its per-frame draw
  routine, before it assembles the effect render context and dispatches the layers, so a live bubble's
  text follows a language switch in the same frame. The editor's hover label reads
  `hintText.value[marker.hintId]`. The effect reads only `effect.state.text` and never imports state or
  i18n; `EffectRenderContext` carries no lookup.
- **Rationale**: The spec Assumptions require the message text to live in the bubble effect (refreshed
  by the page), and US4-3/FR-005 require a live language switch to update the bubble in the same frame.
  Storing the text on the effect keeps the engine's draw a pure function of its own state (no
  `engine/ → state/` edge) while the page — which owns both the signal and the collection — performs the
  resolution. The refresh sits in the render loop rather than the physics tick so it still fires if the
  loop keeps drawing while the tick is paused. The `withSpeechBubbleText` identity check means the
  steady state performs **no** effect-collection write (spec Assumptions), only a cheap per-frame string
  comparison. The signal is derived from `currentUI`, so both consumers stop indexing
  `currentUI.value.platformer.hints[id]` directly (FR-020).
- **Alternatives rejected**:
  - *Pass a `bubbleText: (id) => string` lookup through the render context* (the superseded prior
    design) — the amended spec deliberately removed it; it would put i18n resolution in the draw and
    bloat the effect subsystem's public surface with data the effect can own.
  - *Store text at spawn and never refresh* — freezes the old language (US4-3/FR-005).
  - *Have the effect read `currentUI` directly* — creates an `engine/ → state/` (and i18n) edge,
    violating R-001/SC-007.
  - *A `@preact/signals-react` `effect()` subscription watching `hintText`* — needs a React
    lifecycle/cleanup and a second collection-write path, whereas the render loop already re-runs each
    frame with the bubble in scope and the identity check makes it a no-op in the steady state.
  - *Put the signal in `level/HintCatalog.ts`* — makes a pure vocabulary module depend on the global
    locale state.
  - *Put the signal in `PlatformerState.ts`* — it is a pure derivation of the app-level `currentUI`, so
    the platformer `state/` folder (which already holds `levelSession.ts`/`rewards.ts`) is its natural
    home, and the editor can import it without depending on the game's orchestration module. (The
    `refreshSpeechBubbleText()` helper **does** live in `PlatformerState.ts`, next to `spawnEffect`,
    because it mutates `activeEffects`.)

## D7 — `EffectRenderContext` carries the combined player anchor

- **Decision**: Restructure `EffectRenderContext.playerAnchor` to `{ centerX, centerY, headBottomY,
  width }` (no new top-level field) and update `engine/effects/testContext.ts` to supply it. The heal
  aura's read is a behaviour-preserving rename (`x`/`y` → `centerX`/`centerY`); all existing kinds render
  byte-identically, and the transient-effect base gains no `bubbleText` field and no `level/` import (the
  amended spec keeps the text on the bubble effect, so the base acquires neither).
- **Rationale**: FR-014 permits the subsystem's public surface to change additively. The combined object
  groups the two player-derived anchors (the heal aura's centre and the bubble's head edge) under one
  name; both are page-owned data each draw needs each frame (FR-004). The text needs no context field
  because the effect already holds it.
- **Alternatives rejected**:
  - *An optional `headBottomY`* — every production draw would need a fallback; the page always supplies
    it, so required is simpler and safer under strict TS.
  - *Keep `{ x, y, width }` + a separate top-level `playerHeadBottomY`* — the superseded two-field shape;
    the spec review preferred one named player-points object.
  - *Keep a `bubbleText` lookup for consistency with `popupIcons`* — removed by the amended spec; the
    bubble owns its text (D6), so the context would carry unused surface.

## D8 — Hint vocabulary home: `level/HintCatalog.ts`, with `SignDef` moving in

- **Decision**: `level/HintCatalog.ts` owns `SignHintId`, `BubbleMessageId`, `HINT_IDS`,
  `DEFAULT_HINT_ID`, `hintCode`, `nextHintId`, `isSignHintId`, and `SignDef`. The root `types.ts` drops
  the `HintId` union and `SignDef` (and its now-unused `Translation` import). `SignMapper.ts` imports
  `SignDef`/`SignHintId` from `HintCatalog`; `LevelData.ts`, `LevelParser.ts`, `engine/Collision.ts`
  and `PlatformerPage.tsx` retarget `HintId → SignHintId`/`BubbleMessageId`.
- **Rationale**: `contracts/Outcome.ts` imports `CollectedFact` from `../types`; if `types.ts` imported
  `level/HintCatalog` (needed once `SignDef.hintId` is a `SignHintId`), the transitive edge
  `contracts/ → types.ts → level/` would break the leaf invariant (SC-007). Moving `SignDef` with its
  vocabulary removes that reach entirely (FR-008).
- **Alternatives rejected**:
  - *Leave `SignDef` in `types.ts` and have `HintCatalog` import from `types.ts`* — recreates the
    `contracts/ → level/` edge.
  - *Put the vocabulary in a new `contracts/`-safe module* — the spec Assumptions name
    `level/HintCatalog.ts`; `contracts/` is a leaf and must not grow feature vocabulary.

## D9 — `SignHintId` from an `as const satisfies` tuple; `BubbleMessageId` from the translation keys

- **Decision**:
  ```ts
  import type { Translation } from '@/i18n/translations';
  type PlatformerHintKey = keyof Translation['platformer']['hints'];
  const SIGN_HINT_IDS = [
    'bridgeDropThrough', 'ladderClimbUp', 'fragileRockBreaksFromBelow',
    'chestNeedsKey', 'openAllChestsHaveFun', 'bomb',
  ] as const satisfies readonly PlatformerHintKey[];
  export type SignHintId = (typeof SIGN_HINT_IDS)[number];
  export const HINT_IDS: readonly SignHintId[] = SIGN_HINT_IDS;
  export type BubbleMessageId = PlatformerHintKey; // includes noKeyForChest / noBombs
  ```
  `HintCatalog.ts` imports `Translation` **type-only** from `@/i18n/translations` (the same app-level
  i18n type `types.ts` imports today). This is a new direct origin for a type-only edge, not a new
  dependency direction: i18n is a lower-level shared app module, the import is erased at build time,
  and it is required to keep the ids compile-time-linked to the real JSON keys.
- **Rationale**: The sign hints are a stable, hand-authored order with editor codes `1`–`6` (FR-009),
  so they must be explicit, not derived from object key order. `as const satisfies` gives both the
  literal tuple and a compile-time guarantee that every sign hint is a real translation key.
  `BubbleMessageId = keyof Translation[...]` keeps the UI-only messages typed and lets a UI-only
  message fail as a `SignHintId` (FR-007).
- **Alternatives rejected**:
  - *Explicit union type + separate `HINT_IDS`* — duplicates the six ids and can drift.
  - *Derive `SignHintId` by subtracting the UI-only keys from the translation keys* — hides the sign
    set behind an exclusion and loses the authored order/codes; the tuple is the single source of order.
  - *Hand-write `BubbleMessageId` without the i18n link* — loses the compile-time guarantee that a
    bubble message is a real translation key (the whole point of US2/M9).

## D10 — The mushroom squash moves to `entities/blocks/Mushroom.ts` as a grid-cell-keyed timed tile

- **Decision**: Move `engine/MushroomSquash.ts` into a new `entities/blocks/Mushroom.ts`. The module
  keeps the existing squash API **and shape** unchanged: `MushroomSquashState { col; row; elapsed }`,
  `MUSHROOM_SQUASH_DURATION_SECONDS = 0.1`, `MUSHROOM_SQUASH_DIP_PX = 2`, `startMushroomSquash`,
  `advanceMushroomSquashes`, `mushroomSquashDip`, `mushroomSquashDipAt`, all still delegating
  arm/advance/lookup to `shared/timedTile.ts` (`armTimedTile`/`advanceTimedTiles`/`timedTileStateFor`,
  `rearm: 'replace'`, `prune: true`). `engine/MushroomSquash.ts` is deleted. The effect registry gains
  **no** `mushroomSquash` kind.
- **Rationale**: The squash is a purely cosmetic, grid-cell-keyed timer that owns no drawing (its dip
  is applied inside `drawTerrain`'s mushroom branch by splitting the cap sprite), so an effect kind
  could only register a forced no-op `draw`. The amended spec (Clarifications Q4/Q5, US3, FR-010/FR-012)
  deliberately reinterprets analysis finding E3 as "re-home it beside the mushroom": co-locating the
  timer with the mushroom it belongs to keeps the effect registry for reusable, self-drawing transient
  effects, and keeps the squash beside the other keyed timed tiles (floor spike, crumbling floor,
  falling stalactite). The current state shape already carries `elapsed`, so the timed-tile core is
  used exactly as today.
- **Alternatives rejected**:
  - *Fold it into the effect registry as a `mushroomSquash` kind* (the superseded prior design) — needs
    a no-op `draw`, puts a non-effect in the effect family, and contradicts the amended spec.
  - *Keep `engine/MushroomSquash.ts` and merely re-import it from `entities/`* — does not give the
    mushroom its own home (FR-010) and leaves a reverse-direction re-export.
  - *Make the terrain pass own the squash state directly* — breaks the "one state signal in
    `PlatformerState`" convention and would require moving the tick out of the game loop.

## D11 — The mushroom cap-role art helpers move too, with a dependency-safe sprite type

- **Decision**: Move `mushroomEntry`, `mushroomHasCap`, `MUSHROOM_CAP_SOURCE_HEIGHT` and
  `MUSHROOM_DECORATIVE_ENTRY` (and their private `MUSHROOM_ROLE_ENTRIES`) out of
  `engine/StaticObjectsCatalog.ts` into `entities/blocks/Mushroom.ts`. Because the catalog's
  `StaticObjectEntry` type lives in `engine/` and `entities/ → engine/` is outside the R-001 allowed
  directions, the moved helpers declare their own local, structural rect type
  (`MushroomSprite { sx: number; sy: number }`); `Renderer.ts` reads `.sx`/`.sy` structurally, so no
  type assertion or shared type move is needed. `engine/StaticObjectsCatalog.ts` keeps every other
  entry, `StaticObjectEntry`, `pickVariant`, `bushOrTreeEntry`, the stalactite/stalagmite helpers, and
  the chain/rope helpers. The generic `verticalRunRole` stays in `level/Terrain.ts`.
- **Rationale**: FR-010 requires the mushroom-specific helpers to move with their module and
  `verticalRunRole` to stay put; the edge cases require the catalog not to be fragmented. Introducing
  an `entities/ → engine/` import purely for a 4-field type would widen a direction the R-001 table does
  not list as allowed; a local structural type is smaller, keeps the layer direction clean, and is
  exactly how `entities/hazards/FallingStalactite.ts` already declares its own private `SpriteRect`.
  `entities/ → level/` (for `VerticalRunRole`) is a heavily-used, allowed direction.
- **Alternatives rejected**:
  - *Import `StaticObjectEntry` from `engine/StaticObjectsCatalog` into the entity module* — adds an
    `entities/ → engine/` edge; while `FallingStalactite.ts` carries pre-existing `entities/ → engine/`
    imports, the spec's SC-007 asks R-005 not to widen forbidden/fragile directions, and this one is
    trivially avoidable.
  - *Move `StaticObjectEntry` to `level/Terrain.ts` (or `shared/`)* — a broader refactor than the spec
    authorises; the spec moves only the four mushroom helpers, and other catalog entries would need
    their type import retargeted too.
  - *Leave the art helpers in the catalog and have `entities/blocks/Mushroom.ts` import them back* —
    leaves the mushroom-specific art in the generic catalog (FR-010) and creates the same reverse edge.

## D12 — The squash signal and tick stay in the state layer; the terrain pass reads the mushroom timer

- **Decision**: `PlatformerState.ts` keeps `mushroomSquashStates = signal<MushroomSquashState[]>([])` and
  `tickMushroomSquashes(dt)`, retargeting their imports to `./entities/blocks/Mushroom`
  (`state/ → entities/`). The game loop's `tickMushroomSquashes(dt)` call in the `playing` branch is
  unchanged. `PlatformerPage.tsx`'s landing branch keeps
  `mushroomSquashStates.value = startMushroomSquash(mushroomSquashStates.value, cap.col, cap.row)`,
  only retargeting the import to `./entities/blocks/Mushroom`. `Renderer.drawTerrain`'s
  `mushroomSquashes` parameter and its `mushroomSquashDipAt` lookup are unchanged except for the import
  path (`engine/ → entities/`); the cap/stem split draw is untouched. `resetGame()` keeps its existing
  `mushroomSquashStates.value = []` line.
- **Rationale**: FR-010/FR-011/FR-012 require the squash to remain a keyed timed tile advanced through
  the same path as today (`mushroomSquashStates` + `tickMushroomSquashes`), with the terrain pass
  obtaining the dip from the mushroom module's timer and no duplicate cap renderer. Because the timer
  is not an effect, none of the R-004 collection mechanics (advance/draw/reset) apply to it, and the
  move is a pure import-path relocation for its three consumers.
- **Alternatives rejected**:
  - *Route the squash through `advanceEffects`* — impossible without making it an effect kind
    (D10) and would change its reset/advance semantics.
  - *Add a second squash store for the terrain pass* — forbidden by FR-012 ("no parallel squash
    store").

## D13 — Reset scopes: the bubble is `'death'`-scoped and cleared immediately at death; the squash keeps its existing clears

- **Decision**: `RESET_SCOPE_BY_KIND.speechBubble = 'death'`; `resetGame()` drops its explicit
  `hintTooltipState.value = null` line and relies on its existing
  `clearEffectsByResetScope(activeEffects.value, 'death')` call to clear the bubble. Because the
  `dying` branch only advances hit splatters, both death sites (`handleDebugKill` and the physics
  death check) call `activeEffects.value = clearEffectsOfKind(activeEffects.value, 'speechBubble')` to
  remove the bubble at the death instant (replacing today's immediate `hintTooltipState = null`). The
  squash keeps its **existing** `resetGame()` clear (`mushroomSquashStates.value = []`) — it is a timed
  tile, not an effect, so it is untouched by the effect reset scopes. A new pure helper
  `clearEffectsOfKind(effects, kind)` is added to `engine/effects/transientEffect.ts`.
- **Rationale**: The bubble currently vanishes the moment the player dies; leaving it in the frozen
  collection would draw it through the death animation and flash at respawn (the exact bug the existing
  comments document). Clearing *only* the bubble keeps the squash's and fade-out labels' existing clear
  timing (FR-013/SC-008). The squash move does not alter any reset behaviour (US3-5, FR-011).
- **Alternatives rejected**:
  - *Call `clearEffectsByResetScope('death')` at the death instant* — would also clear the fade-out
    labels earlier than today, a subtle behaviour change.
  - *Rely on `resetGame()` alone* — the bubble would freeze through `dying`/`awaitingRestart` (FR-013
    explicitly forbids lingering).
  - *Route the squash through the effect reset scopes* — not an effect (D10); its existing clear is
    already correct.

## D14 — Test migration strategy (FR-016)

- **Decision**:
  - `engine/HintTooltip.test.ts` → `engine/effects/speechBubble.test.ts` with renamed symbols and the
    state payload adapted to the effect shape, assertions otherwise unchanged; the
    `describe('drawSignBubble')` block moves from `Renderer.test.ts` to `speechBubble.test.ts` as
    `describe('drawSpeechBubble')`, assertions unchanged.
  - `engine/MushroomSquash.test.ts` → `entities/blocks/Mushroom.test.ts` (import path only; the squash
    API, state shape, and every boundary assertion are unchanged); the
    `describe('mushroomEntry / mushroomHasCap')` block moves from `StaticObjectsCatalog.test.ts` into the
    same file, assertions unchanged.
  - `Renderer.test.ts`: the bubble-primitive describe block is removed (moved); the mushroom draw tests
    (`activeSquash-shiftsOnlyTheCap` and the role/decorative blocks) only retarget imports / pass the
    same `{ col, row, elapsed }` arrays to `drawTerrain` — assertions unchanged.
  - `PlatformerState.test.ts` and `PlatformerPage.test.tsx`: the deleted-signal assertions become
    kind-filtered `activeEffects` assertions for the bubble (using the existing `effectsOfKind` helper at
    `PlatformerPage.test.tsx:125`), while the mushroom-squash assertions keep reading
    `mushroomSquashStates.value` unchanged. The behavioural assertions (phases, timing, dips, reset
    scope) are unchanged.
  - `engine/effects/effectRegistry.test.ts` is updated because the kind set genuinely changed: the
    "exactly the eight shipped kinds" list gains `speechBubble` **first** and must not contain
    `mushroomSquash`; the keyed-slot test now expects `counterPopup` **and** `speechBubble`; the
    layer/resetScope table gains `speechBubble`.
  - `HintCatalog.test.ts`, `LevelParser.test.ts`, `gridRenderState.test.ts`, `paintMarkerCell.test.ts`
    retarget `isHintId → isSignHintId` and new assertions cover the type split and the `BubbleMessageId`
    superset.
  - `engine/effects/testContext.ts` supplies the combined `playerAnchor` points (including
    `headBottomY`). New coverage asserts `startSpeechBubble` stores the resolved `text`,
    `drawSpeechBubbleEffect` reads `state.text` (not `rc`), and
    `refreshSpeechBubbleText`/`withSpeechBubbleText` leave the collection reference unchanged when the
    text matches but replace exactly the bubble when it differs.
- **Rationale**: FR-016 permits test edits only for renamed symbols/import paths/signatures and forbids
  weakening/skipping/deleting. Co-locating the migrated bubble-primitive tests with the module that now
  owns the primitive, and the migrated squash/art tests with the module that now owns them, keeps the
  "one module owns its behaviour and its tests" shape.
- **Alternatives rejected**:
  - *Delete the moved tests and rely on page-level coverage* — forbidden by FR-016 and would drop the
    byte-identity guarantees.
  - *Keep the bubble-primitive tests in `Renderer.test.ts` by importing the primitive from the effect
    module* — splits a module's tests across files and leaves a stale `Renderer`-owned describe.
  - *Leave `effectRegistry.test.ts` asserting eight kinds* — it would fail; the kind set is the one
    thing R-005 is *supposed* to extend (FR-014).

---

## Research summary — unresolved items

None. All functional questions were resolved in the spec's Clarifications; all technical unknowns
above have a recorded decision with alternatives. The plan can proceed to Phase 1 design.
