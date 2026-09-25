# Contract: Effect Render Context

**Feature**: R-005 | **Module home**: `src/themes/platformer/engine/effects/transientEffect.ts`

The render context passed to every registered effect `draw`. R-005 restructures the existing
`playerAnchor` into named player screen-space points (`centerX` / `centerY` / `headBottomY` / `width`) —
an additive member on the existing object, so `EffectRenderContext` gains **no new top-level field**
(FR-014). The heal aura keeps reading the centre; the speech bubble reads the head edge. Every other
existing field is unchanged, and every existing kind's rendering is byte-identical (the heal-aura field
rename is behaviour-preserving). The bubble's localized text is not a context field — it is stored on the
`speechBubble` effect's own state. The mushroom squash is a keyed timed tile, not an effect, so it adds
nothing here.

---

## Shape (after R-005)

```ts
export interface EffectRenderContext {
  ctx: CanvasRenderingContext2D;
  dc: DrawContext;
  canvasWidth: number;
  canvasHeight: number;
  /** Live player screen-space points: the visual centre (heal aura) and the
   *  visible-head bottom edge (speech bubble tail). Re-derived each frame. */
  playerAnchor: { centerX: number; centerY: number; headBottomY: number; width: number };
  /** Page-resolved popup icons, keyed by CounterPopupLabelKey. */
  popupIcons: PopupIconLookup;
  /** The live unified collection this frame. */
  effects: readonly TransientEffect<unknown>[];
}
```

The module keeps importing no state and no i18n; it gains no `bubbleText` field and no `level/` import
(the earlier draft's lookup was dropped — the text lives on the bubble effect). `speechBubble.ts` itself
still type-imports `BubbleMessageId` from `level/HintCatalog.ts` — an allowed, pre-existing
`engine/ → level/` direction (see `docs/TransientEffectRecipe.md`).

## Producer obligations (page)

- Builds one context per frame and passes it to each `drawEffects` layer invocation.
- Supplies `playerAnchor.centerX = playerState.x + PLAYER_RENDERED_SIZE / 2 + originX` and
  `playerAnchor.centerY = playerState.y + PLAYER_VISUAL_CENTER_Y_OFFSET + originY` (the heal aura's
  centre, numerically identical to the pre-R-005 `playerAnchor.x` / `.y`), plus `playerAnchor.width =
  PLAYER_RENDERED_SIZE`.
- Supplies `playerAnchor.headBottomY = playerState.y + PLAYER_HEAD_PADDING + originY` — exactly the value
  the pre-refactor render loop computed as `anchorBottomY`.
- Resolves the bubble's text separately: it reads the derived `state/hintText.ts` signal at spawn
  (`startSpeechBubble(messageId, hintText.value[messageId])`) and calls `refreshSpeechBubbleText()` at
  the top of the draw routine, so the stored text follows a language change. No `bubbleText` field is
  threaded through the context.

## Guarantees

1. `EffectRenderContext` gains no new top-level field; the heal aura reads `playerAnchor.centerX` /
   `playerAnchor.centerY` and draws byte-identically to before (FR-014).
2. The bubble reads its text only from its own `effect.state.text` (written by the page at spawn and
   refreshed on a language change) — never from state or i18n (no `engine/ → state/`, FR-005/SC-007).
3. The bubble reads its anchor only from `playerAnchor.centerX` / `playerAnchor.headBottomY` — it stores
   no position (FR-004).
4. `testContext.ts`'s `renderContext` helper supplies the object so the effect unit tests stay DOM-free.
5. Adding a new kind still requires no new render-context field for a non-visual rule change; the
   restructured `playerAnchor` is the complete surface change R-005 introduces (FR-014/FR-015).
