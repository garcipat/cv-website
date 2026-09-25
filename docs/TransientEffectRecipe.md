# Adding a Transient Effect (R-004 recipe)

This is the one path for adding a new platformer transient visual effect (for
example the planned **O-026 Platformer Poison Gas**). Following it requires
**one new module plus one registry line** — no edit to `PlatformerState.ts`'s
effect collection, the game tick, the draw pass, or reset code (FR-002/FR-020).

## Where things live

| Piece | Home |
| --- | --- |
| `TransientEffect<S>` base, `EffectRenderContext`, `advanceEffects`, `clearEffectsByResetScope`, `effectCount`, `upsertEffect` | `src/themes/platformer/engine/effects/transientEffect.ts` |
| The kind → start/tick/draw/expiry registry | `src/themes/platformer/engine/effects/registry.ts` |
| The one layer-filtered draw dispatch | `src/themes/platformer/engine/effects/drawEffects.ts` |
| One module per kind (start/tick/derive/draw) | `src/themes/platformer/engine/effects/<kind>.ts` |
| The single collection + state-owned `spawnEffect` | `src/themes/platformer/PlatformerState.ts` |

The subsystem imports `contracts/`, `shared/`, `entities/`, and
`engine/textDraw` only — never state, and never `level/` *state* (`RENDER_SCALE`
from `level/Terrain` is an allowed, pre-existing `engine/ → level/` constant
import already used by `Renderer.ts`).

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
  to signal "drop now" (the counter popup's sentinel). Six families use
  `defaultTick` (`{ ...effect, elapsed: elapsed + dt }`).
- `expired` is the family's exact boundary. The default is strictly past the
  duration (`effect.elapsed > effect.duration`, never `>=`); `flight` overrides
  it with `phase === 'done'`.
- `draw` renders into the shared `EffectRenderContext` (`ctx`, `dc`,
  `canvasWidth`/`canvasHeight`, `playerAnchor`, `popupIcons`, and the live
  `effects` collection for sibling-dependent layouts).

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

Append an entry to `EFFECT_REGISTRY` in `registry.ts`, **in declaration order**
(order fixes intra-layer draw order):

```ts
widen({
  kind: 'poisonGas',            // one of the closed EffectKind set
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
  by `PlatformerPage.tsx`: `midWorld` (heal aura), `worldEffects` (flight, puff,
  debris, hitSplatter, fadeOutText), `aboveWorld` (explosion), `hudLast`
  (counter popups). Choose the depth the effect must render at.
- **`resetScope`** declares the per-kind reset policy. `'death'` kinds are
  cleared by `resetGame()` (death/respawn); `'progress'` kinds only by a full
  `resetGameProgress()`. Only `fadeOutText` is `'death'`.
- **`keyOf`** declares a keyed slot: `spawnEffect` replaces any existing effect
  with the same `(kind, key)` instead of appending (counter popups key by
  `labelKey`). Omit it for append-only kinds.

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
