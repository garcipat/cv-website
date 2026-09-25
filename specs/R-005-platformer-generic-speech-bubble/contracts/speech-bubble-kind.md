# Contract: `speechBubble` Effect Kind

**Feature**: R-005 | **Module home**: `src/themes/platformer/engine/effects/speechBubble.ts`

The one reusable player-overhead speech bubble, registered as a transient effect kind. Consumers are
the sign-hint trigger, the locked-chest trigger, and the transient no-bombs trigger in
`PlatformerPage.tsx`. It is the **only** effect kind R-005 adds to the registry.

---

## Payload & constants

```ts
export type SpeechBubblePhase = 'entering' | 'shown' | 'exiting';

export interface SpeechBubbleState {
  messageId: BubbleMessageId;
  /** The resolved localized message, stored at spawn from the page's
   *  `hintText` signal and refreshed by the page on a language change. The
   *  registered draw reads this field — never state or i18n. */
  text: string;
  phase: SpeechBubblePhase;
  /** When true, the bubble auto-begins its exit after the transient dwell
   *  (the keypress-triggered no-bombs bubble). */
  transient?: boolean;
}

export const SPEECH_BUBBLE_FADE_IN_SECONDS = 0.2;
export const SPEECH_BUBBLE_FADE_OUT_SECONDS = 0.25;
export const SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS = 1.5;
```

`BubbleMessageId` is a **type-only** import from `level/HintCatalog.ts` (`engine/ → level/` is an
allowed, pre-existing direction; the module imports no state and no i18n).

## API

```ts
export function startSpeechBubble(
  messageId: BubbleMessageId,
  text: string,
  options?: { transient?: boolean },
): TransientEffect<SpeechBubbleState>;
// { kind:'speechBubble', id:'speechBubble', duration: FADE_IN + FADE_OUT,
//   elapsed: 0, state: { messageId, text, phase:'entering', transient } }

export function withSpeechBubbleText(
  effect: TransientEffect<SpeechBubbleState>,
  text: string,
): TransientEffect<SpeechBubbleState>;
// same reference when state.text already equals `text`, else a copy with the
// new text — the page's language-change refresh (writes only on difference)

export function beginSpeechBubbleExit(
  effect: TransientEffect<SpeechBubbleState>,
): TransientEffect<SpeechBubbleState>;   // phase 'exiting', elapsed 0

export function beginSpeechBubbleEnter(
  effect: TransientEffect<SpeechBubbleState>,
): TransientEffect<SpeechBubbleState>;   // phase 'entering', elapsed 0 (restart)

export function tickSpeechBubbleEffect(
  effect: TransientEffect<SpeechBubbleState>,
  dt: number,
): TransientEffect<SpeechBubbleState> | null;   // null = drop sentinel at exit completion

export function speechBubbleGrowthAndOpacity(
  effect: TransientEffect<SpeechBubbleState>,
): { growth: number; opacity: number };

/** The canvas primitive (renamed from Renderer.drawSignBubble). */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchorX: number,
  anchorBottomY: number,
  growth?: number,
  opacity?: number,
): void;

/** The registered draw. */
export function drawSpeechBubbleEffect(
  effect: TransientEffect<SpeechBubbleState>,
  rc: EffectRenderContext,
): void;

/** The single live bubble, for the trigger-site phase/message comparison. */
export function activeSpeechBubble(
  effects: readonly TransientEffect<unknown>[],
): TransientEffect<SpeechBubbleState> | undefined;
```

## Registry entry

```ts
widen({
  kind: 'speechBubble',            // declared FIRST in EFFECT_REGISTRY
  create: startSpeechBubble,
  tick: tickSpeechBubbleEffect,
  draw: drawSpeechBubbleEffect,
  expired: () => false,            // the phase machine's null sentinel ends it
  layer: 'worldEffects',           // drawn after darkness/enemy-eye, before other world effects
  resetScope: 'death',
  keyOf: () => 'speechBubble',     // constant → one replace-in-place singleton slot
})
```

## Behavioural guarantees

1. **Lifecycle** — `entering` becomes `shown` at `elapsed >= 0.2s` (elapsed reset); `shown` is retained
   indefinitely unless transient; `exiting` drops (`null`) at `elapsed >= 0.25s`. Growth/opacity are
   `0→1` / `1` / `1→0`, clamped `[0,1]`; the box grows upward from a fixed bottom edge (FR-002).
2. **Singleton** — at most one bubble; `spawnEffect` replaces it by its constant key. A reveal for a
   different message replaces; a same-message press while `entering`/`shown` is a no-op; while
   `exiting` it restarts; losing the trigger begins the exit unless already exiting (FR-003).
3. **Transient** — a `transient` bubble auto-begins its exit after `1.5s` of `shown`; a
   sign/locked-chest bubble waits to be told (FR-002).
4. **Anchor** — always re-derived from `rc.playerAnchor.centerX` / `rc.playerAnchor.headBottomY`; no
   stored position (FR-004).
5. **Text** — the resolved localized string is stored on `state.text` at spawn (the page passes
   `hintText.value[messageId]`) and refreshed by the page on a language change, only when it differs
   (via `withSpeechBubbleText` / `refreshSpeechBubbleText`); the draw reads `effect.state.text` and
   never state or i18n (FR-005/FR-014/FR-020).
6. **Depth** — drawn by the existing `worldEffects` dispatch, before the other world effects and after
   the darkness/enemy-eye overlay (FR-004/FR-015).
7. **Reset** — `'death'`-scoped: cleared by `resetGame()`; also removed immediately at both death sites
   via `clearEffectsOfKind(…, 'speechBubble')`; cleared by a full reset (FR-013).
8. **Primitive** — `drawSpeechBubble` keeps the cream/dark border, tail, font family, `\n` handling, and
   corner-radius clamp; `Renderer.ts` no longer owns or exports it (FR-006).

## Invariants

- No `HintTooltip`, `hintTooltipState`, `drawSignBubble`, or `HintId` survives as an alias or second
  path (FR-017/SC-001).
- No `mushroomSquash` kind is added by this feature; the squash is a keyed timed tile owned by
  `entities/blocks/Mushroom.ts` (see [`mushroom-timed-tile.md`](./mushroom-timed-tile.md)).
- The module imports only `level/HintCatalog` types, `engine/textDraw`, and effect/contracts types —
  never state and never i18n (FR-005/SC-007).
- The bubble's text lives on its own `state.text`; `EffectRenderContext` gains no `bubbleText` lookup,
  and its `playerAnchor` carries the head edge as `headBottomY` alongside the heal aura's centre
  (FR-014).
- No new `level/ → engine/`, `engine/ → state/`, or `contracts/ → level/` edge is created
  (SC-007).
