# Contract: Transient Effect Registry

**Feature**: R-004 | **Module home**: `src/themes/platformer/engine/effects/`

This is the internal public API of the unified effect subsystem. All signatures are TypeScript (strict, no `any`). Consumers are `PlatformerState.ts`, `PlatformerPage.tsx`, `state/rewards.ts`, the hazard modules, and the tests.

---

## Base type

```ts
export interface TransientEffect<S = unknown> {
  readonly kind: EffectKind;
  readonly id: string;
  readonly duration: number;
  elapsed: number;
  readonly state: S;
  tick(effect: TransientEffect<S>, dt: number): TransientEffect<S> | null;
  draw(effect: TransientEffect<S>, rc: EffectRenderContext): void;
  expired(effect: TransientEffect<S>): boolean;
}
```

- `kind` is the effect's registry kind. It is the extra metadata the unified
  collection needs (grouping for the draw dispatch, `effectCount`, and the
  keyed-slot lookup in `spawnEffect`); the family-specific data lives in `state`.

- `tick` returns the next effect, the same reference (no-op), or `null` to signal "drop now" (counter-popup sentinel). The six default-advance families return `{ ...effect, elapsed: effect.elapsed + dt }`.
- `expired` default is `effect.elapsed > effect.duration`; `flyingText` returns `state.phase === 'done'`.

## Render context

```ts
export interface EffectRenderContext {
  ctx: CanvasRenderingContext2D;
  dc: DrawContext;
  canvasWidth: number;
  canvasHeight: number;
  /** Live player anchor for the position-less heal aura. */
  playerAnchor: { x: number; y: number; width: number };
  /** Page-resolved popup icons, keyed by CounterPopupLabelKey. */
  popupIcons: PopupIconLookup;
  /** The live unified collection this frame, so a kind whose layout depends on
   *  its siblings (the counter-popup row) can compute its own slot. */
  effects: readonly TransientEffect<unknown>[];
}
```

`PopupIconLookup` is `Partial<Record<CounterPopupLabelKey, { icon: HTMLImageElement; iconFrame: { sx: number; sy: number; size: number }; iconYOffset?: number }>>`.

## Registry entry

```ts
export type EffectKind =
  | 'flyingText' | 'counterPopup' | 'puff' | 'healAura'
  | 'hitSplatter' | 'fadeOutText' | 'explosion' | 'debris';

export type EffectLayer = 'midWorld' | 'worldEffects' | 'aboveWorld' | 'hudLast';
export type EffectResetScope = 'death' | 'progress';

export interface EffectRegistryEntry<S = unknown> {
  readonly kind: EffectKind;
  readonly create: (...args: never[]) => TransientEffect<S>;
  readonly tick?: (effect: TransientEffect<S>, dt: number) => TransientEffect<S> | null;
  readonly draw: (effect: TransientEffect<S>, rc: EffectRenderContext) => void;
  readonly expired?: (effect: TransientEffect<S>) => boolean;
  readonly layer: EffectLayer;
  readonly resetScope: EffectResetScope;
  readonly keyOf?: (effect: TransientEffect<S>) => string;
}
```

**Registry ordering is part of the contract:** declaration order fixes the intra-layer draw order (`flyingText` → `puff` → `debris` → `hitSplatter` → `fadeOutText`).

## Collection operations

```ts
/** Advance the whole collection (or only the filtered kinds) and drop null/expired. */
export function advanceEffects(
  effects: TransientEffect<unknown>[],
  dt: number,
  options?: { kinds?: readonly EffectKind[] },
): TransientEffect<unknown>[];

/** Remove effects whose kind's resetScope matches (or all when scope omitted). */
export function clearEffectsByResetScope(
  effects: TransientEffect<unknown>[],
  scope?: EffectResetScope,
): TransientEffect<unknown>[];

/** The single draw dispatch, invoked once per pipeline layer. */
export function drawEffects(
  ctx: EffectRenderContext,
  layer: EffectLayer,
  effects: readonly TransientEffect<unknown>[],
): void;

/** Live count of one kind (e.g. flying-text effects seed the slot allocator). */
export function effectCount(effects: readonly TransientEffect<unknown>[], kind: EffectKind): number;
```

`spawnEffect` (append; replace-in-place for a keyed kind) is owned by `PlatformerState.ts`, which mutates the `activeEffects` signal — it is not exported from `engine/effects`, so the subsystem keeps no `engine/ → state/` import. The exact helper signatures may be adjusted to the state module's signal idiom, but the semantics above are fixed.

## Behavioural guarantees (must not regress)

1. Exactly one collection, one advance, one draw dispatch (FR-003/FR-004/FR-005).
2. Adding a kind edits only `engine/effects/<kind>.ts` + one registry line (FR-002/US6).
3. Per-kind expiry boundaries, keyed refresh-in-place, player-anchored aura, dying-lead-in filtered tick, and per-kind reset scope are exactly as specified in [data-model.md §5](../data-model.md).
4. No per-kind signal, tick, or draw entry point survives as an alias or second path (FR-018).
5. The dispatch preserves every family's depth and intra-layer order (US5-4).

## Invariants

- The subsystem imports `contracts/`, `shared/`, `entities/`, and
  `engine/textDraw`; it never imports a state module (no `engine/ → state/`)
  and never `level/` *state*. The two per-kind draw modules that need the
  render scale (`debris.ts`, `explosion.ts`) import `RENDER_SCALE` from
  `level/Terrain` — an allowed, pre-existing `engine/ → level/` constant import
  already used by `Renderer.ts`; `hitSplatter.ts` type-imports `EnemyTypeKey`
  from `entities/enemies`, preserving its pre-existing surface.
- `engine/CollectionEffects.ts` is deleted; this barrel is the only effect home.
