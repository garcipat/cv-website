# Enemy Abstraction Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate every per-enemy-type parameter (render scale, hit points, patrol speed, sprite asset, hitbox padding, spike capability, held-item drop) into one config object per `spriteType`, so adding a third enemy type is "add one config entry + one sprite asset" instead of touching five files. Generalizes the purple-slime-specific "drops a key on defeat" mechanic (added in the 2026-08-31 key-mechanic plan, still fairly new) into a generic held-item mechanic any enemy type can opt into, dropping any item kind — not committing the codebase to "keys are special" a second time.

**Why now, why not now:** Raised mid-conversation while polishing the purple slime (2x scale, held-key shine-through, patrol turn-around exactness) — every one of those fixes had to reach into `Enemy.ts`, `EnemyAI.ts`, `Renderer.ts`, and `Collision.ts` separately because per-type behavior is scattered across independent `Record<spriteType, X>` lookups and a couple of raw ternaries, rather than one canonical place. That scattering is real and worth fixing, but there's no second held-item type today to validate the generalization against, and the constitution's "No Feature Bloat" principle wants a spec before implementation — hence this plan exists to be picked up later, not implemented opportunistically now.

**Architecture:**

Today, per-`spriteType` behavior lives in:
- `Enemy.ts`: `ENEMY_RENDER_SCALE`, `ENEMY_PATROL_SPEED_MULTIPLIER`, `ENEMY_HIT_POINTS` (three parallel `Record<spriteType, number>`s), plus `ENEMY_HITBOX_SIDE_PADDING_NATIVE`/`ENEMY_HITBOX_TOP_PADDING_NATIVE` (currently flat constants, NOT per-type, even though they're already scaled by `ENEMY_RENDER_SCALE[spriteType]` at the call site).
- `Renderer.ts`: a raw ternary (`enemy.spriteType === 'slimeGreen' ? slimeGreenSprite : slimePurpleSprite`) for sprite selection, `SPIKE_COLORS: Record<spriteType, {fill, outline}>` for the spike-tint palette, and purple-slime-hardcoded held-key drawing (`showsHeldKey = enemy.spriteType === 'slimePurple' && ...`).
- `PlatformerPage.tsx`: one `useRef<HTMLImageElement | null>` per sprite (`slimeGreenSpriteRef`, `slimePurpleSpriteRef`), each with its own `loadImage(...)` call, and a hardcoded `enemy.spriteType === 'slimePurple'` branch in the defeat handler to spawn a key.
- `entities/KeyPickup.ts` / `keyPickupStates` (`PlatformerState.ts`): key-specific pickup entity and signal.

Target shape — one `EnemyTypeConfig` per `spriteType`, one registry:

```typescript
// entities/Enemy.ts
export interface EnemyTypeConfig {
  renderScale: number;
  patrolSpeedMultiplier: number;
  hitPoints: number;
  hitboxSidePaddingNative: number; // native (pre-scale) px, same convention as today's flat constants
  hitboxTopPaddingNative: number;
  spikeColors: { fill: string; outline: string };
  /** What this enemy type drops on its finishing stomp, if anything. `null`
   *  for types that carry CV facts instead (matches slimeGreen today). */
  heldItem: ItemKind | null;
  spriteAssetPath: string; // e.g. '/sprites/slime_purple.png'
}

export const ENEMY_TYPE_CONFIG: Record<EnemyDef['spriteType'], EnemyTypeConfig> = {
  slimeGreen: { renderScale: 1, patrolSpeedMultiplier: 1, hitPoints: 1, ..., heldItem: null, spriteAssetPath: '/sprites/slime_green.png' },
  slimePurple: { renderScale: 2, patrolSpeedMultiplier: 0.7, hitPoints: 3, ..., heldItem: 'key', spriteAssetPath: '/sprites/slime_purple.png' },
};
```

`enemyRenderedSize`/`enemyTileOffsetX`/`enemyTileOffsetY`/`enemyHitboxSidePadding`/`enemyHitboxTopPadding` become thin wrappers reading from `ENEMY_TYPE_CONFIG[spriteType]` instead of separate `Record` lookups — their existing call sites in `Collision.ts`/`EnemyAI.ts`/`Renderer.ts` don't need to change at all, only their implementations move.

Held items generalize similarly:

```typescript
// entities/ItemPickup.ts (renamed/generalized from KeyPickup.ts)
export type ItemKind = 'key'; // union grows as new item kinds are added

export interface ItemPickupState {
  id: string; // reuses the source enemy's id, same dedup convention as today
  kind: ItemKind;
  x: number;
  y: number;
  collected: boolean;
}
```

`itemPickupStates` (renamed from `keyPickupStates`) holds every kind of dropped item; a `kind`-keyed sprite/collision-size lookup (mirroring `ENEMY_TYPE_CONFIG`'s shape) replaces the key-specific `KEY_FRAME_WIDTH`/`KEY_RENDERED_WIDTH` constants. `collectedKeys` stays its own signal (it's a gameplay currency tied to chests specifically, not a generic inventory) — only the pickup/drop machinery generalizes, not the "spend a key to open a chest" rule.

`Renderer.ts`'s sprite selection becomes a lookup into a `Record<spriteType, HTMLImageElement | null>` (populated by one generic loader loop in `PlatformerPage.tsx` iterating `ENEMY_TYPE_CONFIG`'s `spriteAssetPath`s) instead of a two-armed ternary and two separate refs — this is the one part of this refactor that meaningfully changes calling code shape in `PlatformerPage.tsx`, not just `Enemy.ts`'s internals.

## Global Constraints

- TypeScript strict mode, no `any`, no `@ts-ignore` (constitution Principle I).
- Test-first: write the failing test before the implementation for every step (constitution Principle II, NON-NEGOTIABLE). Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies.
- No behavior change intended anywhere in this plan — every existing test (patrol, hitbox, held-key shine-through, chest-key gating, spike colors) must still pass unmodified in outcome, even where the underlying lookup mechanism changes. Any test whose assertions were coupled to the OLD internal shape (e.g. importing `ENEMY_RENDER_SCALE` directly) gets updated to import from the new registry instead, not rewritten to test different behavior.
- Read the current state of `Enemy.ts`, `EnemyAI.ts`, `Renderer.ts`, `Collision.ts`, `PlatformerState.ts`, and `PlatformerPage.tsx` fresh before writing the actual implementation plan tasks below in detail — this document sketches the target shape, but exact line-level edits should be re-derived from the code as it exists when this is picked up, not copied blindly from this plan (the purple-slime-key-mechanic.md plan this is modeled on had the same caveat).

## Task outline (expand into full TDD tasks via `writing-plans` when this is picked up)

1. **`EnemyTypeConfig` + `ENEMY_TYPE_CONFIG` registry in `Enemy.ts`** — add the new interface/registry alongside the existing `Record`s (don't remove the old ones yet), with tests asserting the registry's values match today's existing per-type constants exactly (a pure data-shape change, zero behavior risk).
2. **Migrate `enemyRenderedSize`/`enemyTileOffsetX`/`enemyTileOffsetY`/`enemyHitboxSidePadding`/`enemyHitboxTopPadding` to read from the registry**, then delete the now-unused old `Record`s (`ENEMY_RENDER_SCALE`, `ENEMY_PATROL_SPEED_MULTIPLIER`, `ENEMY_HIT_POINTS`, the native hitbox padding constants) once nothing references them. Existing tests for these functions should pass unmodified — this task only changes their internals.
3. **Migrate `SPIKE_COLORS` into the registry** (`Renderer.ts`'s spike-drawing code reads `ENEMY_TYPE_CONFIG[spriteType].spikeColors` instead of its own separate `Record`).
4. **Generalize `KeyPickup.ts` → `ItemPickup.ts`** (rename module, add `ItemKind`/`kind` field, update `PlatformerState.ts`'s `keyPickupStates` → `itemPickupStates` — keep a re-exported `keyPickupStates` alias if anything external still expects that name, or do a clean rename with all call sites updated in the same task; decide based on how many call sites exist when this is picked up).
5. **Generic sprite registry** — replace `slimeGreenSpriteRef`/`slimePurpleSpriteRef` in `PlatformerPage.tsx` with one `useRef<Partial<Record<EnemyDef['spriteType'], HTMLImageElement>>>({})` populated by a loop over `ENEMY_TYPE_CONFIG`, and update `Renderer.ts`'s `drawEnemies` to take that lookup object instead of two positional sprite params.
6. **`heldItem` config drives the drop/render logic** — `drawEnemies`'s held-item shine-through effect reads `ENEMY_TYPE_CONFIG[spriteType].heldItem` instead of `enemy.spriteType === 'slimePurple'`; `PlatformerPage.tsx`'s defeat handler spawns whatever item kind the config specifies instead of hardcoding `spawnKeyPickup`.
7. **Full-suite regression pass + manual browser verification** — purple slime still looks/behaves identically (2x scale, held-key shine-through gated by `droppedKeyEnemyIds`, spike colors, patrol turn-around), green slime unaffected, chest key-gating unaffected. This task is the payoff check: if a hypothetical third enemy type were added at this point, it should require touching only `ENEMY_TYPE_CONFIG` + one sprite asset + (if it has a unique mechanic like spikes) whatever mechanic-specific code doesn't fit the generic shape — not a fan-out across five files.
