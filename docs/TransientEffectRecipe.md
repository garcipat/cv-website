# Adding a Transient Effect (R-004 recipe)

This is the one path for adding a new platformer transient visual effect (for
example the planned **O-026 Platformer Poison Gas**). Following it requires
**one new module plus one registry line** — no edit to `PlatformerState.ts`'s
effect collection, the game tick, the draw pass, or reset code (FR-002/FR-020).

## Where things live

| Piece | Home |
| --- | --- |
| `TransientEffect<S>` base, `EffectRenderContext`, `advanceEffects`, `clearEffectsByResetScope`, `effectCount`, `upsertEffect` | `src/themes/platformer/engine/effects/transientEffect.ts` |
| The kind → start/tick/draw/expiry registry | `src/themes/platformer/engine/effects/effectRegistry.ts` |
| The one layer-filtered draw dispatch | `src/themes/platformer/engine/effects/drawEffects.ts` |
| One module per kind (start/tick/derive/draw) | `src/themes/platformer/engine/effects/<kind>.ts` |
| The single collection + state-owned `spawnEffect` | `src/themes/platformer/PlatformerState.ts` |

The subsystem imports `contracts/`, `shared/`, `entities/`, and
`engine/textDraw` only — never state, never app/i18n state, and never `level/`
*state* (`RENDER_SCALE` from `level/Terrain` is an allowed, pre-existing
`engine/ → level/` constant import already used by `Renderer.ts`). A localized
effect like the speech bubble must carry its resolved text on its own `state`
(the page resolves it and refreshes it on a language change), so the engine
never reaches into the app's translation state.

## The shape of an effect

```ts
export interface TransientEffect<S = unknown> {
  readonly kind: EffectKind;   // which registry entry drives it
  readonly id: string;         // stable identity / keyed-slot key
  readonly duration: number;   // default expiry bound, in seconds
  elapsed: number;             // advanced by tick
  readonly state: S;           // the family's own payload
  tick(effect: TransientEffect<S>, dt: number): TransientEffect<S> | null;
  draw(effect: TransientEffect<S>, rc: EffectRenderContext): void;
  expired(effect: TransientEffect<S>): boolean;
}
```

- `tick` returns the next effect, the same reference for a no-op, or **`null`**
  to signal "drop now" (the counter popup's sentinel; the speech bubble returns
  it when its exit completes). Six families use
  `defaultTick` (`{ ...effect, elapsed: elapsed + dt }`).
- `expired` is the family's exact boundary. The default is strictly past the
  duration (`effect.elapsed > effect.duration`, never `>=`); `flyingText` overrides
  it with `phase === 'done'`, and `speechBubble` overrides it with `() => false`
  so only its own phase machine ends it.
- `draw` renders into the shared `EffectRenderContext` (`ctx`, `dc`,
  `canvasWidth`/`canvasHeight`, `playerAnchor`, `popupIcons`, and the live
  `effects` collection for sibling-dependent layouts).

### The speech bubble: a constant-keyed singleton

The `speechBubble` kind (`engine/effects/speechBubble.ts`) shows the generic
message bubble above the player's head. Two properties are worth copying when a
new effect needs them:

- **One slot, not many.** Its registry `keyOf` returns the constant
  `'speechBubble'`, so spawning a new bubble replaces the existing one in place
  instead of queueing a second. The trigger site still decides *whether* to
  spawn, restart, or no-op by comparing the current bubble's `messageId`/`phase`.
- **The effect carries its resolved localized text.** `SpeechBubbleState` holds
  both the `messageId` and the already-resolved `text` string. The page resolves
  it from the derived hint-text signal when the bubble spawns and, at the top of
  the render loop, rewrites that one effect's stored `text` **only when it
  differs** — so a live bubble follows a language switch with no steady-state
  collection write. The draw reads `effect.state.text`; the render context
  carries no text lookup.

## Step 1 — write the module

1. Add the effect's data and a `start`/`create` that builds a `TransientEffect<S>`
   with `kind`, `id`, `duration`, `elapsed: 0`, `state`, and its `tick`/`draw`/
   `expired` (defaults are available).
2. Write any pure derive helpers (particle lists, offsets) in the same module and
   keep the family's constants there.
3. Write the `draw` body in the same module. Import
   `fillTextWithOutline`/`RESTART_PROMPT_FONT_FAMILY` from `engine/textDraw` if it
   draws text.

## Step 2 — add one registry line

Append an entry to `EFFECT_REGISTRY` in `effectRegistry.ts`, **in declaration order**
(order fixes intra-layer draw order):

```ts
widen({
  kind: 'poisonGas',            // one of the extensible EffectKind set
  create: startPoisonGasEffect,
  tick: tickPoisonGasEffect,    // omit to use the default advance
  draw: drawPoisonGasEffect,
  expired: poisonGasExpired,    // omit to use elapsed > duration
  layer: 'worldEffects',        // midWorld | worldEffects | aboveWorld | hudLast
  resetScope: 'progress',       // 'death' = cleared by resetGame(); 'progress' = full reset only
  keyOf: (effect) => undefined, // optional: a keyed replace-in-place slot
}),
```

- **`layer`** picks the pipeline depth. `drawEffects` is invoked once per layer
  by `PlatformerPage.tsx`: `midWorld` (heal aura), `worldEffects` (speechBubble,
  flyingText, puff, debris, hitSplatter, fadeOutText), `aboveWorld` (explosion), `hudLast`
  (counter popups). Choose the depth the effect must render at.
- **`resetScope`** declares the per-kind reset policy. `'death'` kinds are
  cleared by `resetGame()` (death/respawn); `'progress'` kinds only by a full
  `resetGameProgress()`. `fadeOutText` and `speechBubble` are `'death'`.
- **`keyOf`** declares a keyed slot: `spawnEffect` replaces any existing effect
  with the same `(kind, key)` instead of appending (counter popups key by
  `labelKey`). Omit it for append-only kinds.

## Not every timed visual is an effect

Some platformer timers are **grid-cell-keyed timed tiles**, not transient
effects — the bouncy-mushroom cap squash is the reference example
(`entities/blocks/Mushroom.ts`). They share `shared/timedTile.ts`'s
arm/advance/prune scaffolding, but their state is a `{ col, row, elapsed }`
entry per cell (not a `TransientEffect` with an `id`/`kind`/`draw`) and they are
**never** registered in `EFFECT_REGISTRY`. They have no `EffectKind`, are not
advanced by `advanceEffects`, are not drawn by `drawEffects`, and are not
touched by the effect reset scopes; the terrain draw reads the dip from the same
state array the state layer advances. Use an effect only when the thing must be
drawn through the layer dispatch; use a keyed timed tile when a tile's own
renderer owns the visual and the state is purely per-cell.

## What you never touch

`advanceEffects` (`PlatformerState`'s tick), `drawEffects` (the four layer
invocations in `PlatformerPage.tsx`), the `activeEffects` collection, and the
reset code are all registry-driven. A new kind is picked up with no edit there.
`spawnEffect(startMyEffect(...))` at the trigger site is the only call needed.

## Verifying

`engine/effects/recipe.test.ts` follows this recipe literally (a throwaway kind
in one block plus one local registry entry) and asserts it starts, advances,
draws only at its declared layer, and expires — without touching state, the
tick, the draw pass, or reset code.
