# Contract — Enemy defeat hook (`DefeatApi`) and the shared reward applier

Covers FR-001, FR-002, FR-003, FR-004, FR-010, FR-012 and SC-001/SC-002/SC-008.

## Goal

Each enemy kind owns its defeat consequences through an **optional** `onDefeat(enemy, defeat)` hook that
fires them via a supplied `defeat` API, and one shared reward applier owns the unconditional puff and
the `rewardGiven`/`deathEffectGiven` gating — so the page names no enemy or drop kind, and a new
dropping enemy ships as one module plus one registry line.

## `DefeatApi` — `contracts/Outcome.ts` (leaf)

```ts
export interface DefeatApi {
  /** Spawns a pickup of `kind` at the enemy's position (its `x`/`y` at the
   *  moment of defeat), routed through `PICKUP_TYPES[kind].spawn` + the
   *  generic pickup store — never a page-side `spawnKeyPickup` call. */
  spawnPickup(kind: PickupKind): void;
  /** Reveals one fact at the enemy's position. Per-fact. */
  revealFact(fact: CollectedFact, effectId: string): void;
  /** Requests a transient HUD counter popup for `key`. Deduped per key and
   *  flushed after the flag update, so several same-tick defeats bump once. */
  bumpCounter(key: CounterPopupLabelKey): void;
}
```

Leaf-safe: imports only `../types` (`CollectedFact`) and sibling `contracts/` types (`PickupKind`,
`CounterPopupLabelKey`).

## `EnemyType.onDefeat` — `entities/enemies/EnemyType.ts`

```ts
onDefeat?(enemy: S, defeat: DefeatApi): void;
```

- **Optional** — absent on the bee and any plain enemy (puff only).
- **Imperative, no return value** — a defeat may fire several consequences in one call (reveal several
  facts, or reveal facts and bump a counter), or none.
- The hook MUST fire consequences **only** through `defeat`; it never writes engine state directly.

## The shared applier — `state/enemyRewards.ts`

```ts
export interface EnemyDefeatContext {
  revealFact: (fact: CollectedFact, options: RevealOptions) => boolean; // this tick's trigger
  originX: number;
  originY: number;
}

export function applyEnemyDefeats(
  defeated: readonly EnemyState[],   // already !alive && !deathEffectGiven
  ctx: EnemyDefeatContext,
): void;
```

Semantics (byte-identical to the current page block):

1. For each enemy: stage the unconditional puff `startPuffEffect(enemy.id, anchor.x + originX,
   anchor.y + originY, anchor.scale)`; **only when `!enemy.rewardGiven`**, build a `DefeatApi` closing
   over the enemy and invoke `typeOf(enemy).onDefeat?.(enemy, api)`.
   - `spawnPickup(kind)` → `pickupStores[kind].append(PICKUP_TYPES[kind].spawn({ id: enemy.id,
     x: enemy.x, y: enemy.y, fact: enemy.fact }))`.
   - `revealFact(fact, effectId)` → `ctx.revealFact(fact, { x: enemy.x, y: enemy.y, effectId })`.
   - `bumpCounter(key)` → record `key` in a tick-local `Set`.
2. Set `rewardGiven: true` **and** `deathEffectGiven: true` on every defeated id.
3. Flush each recorded `key`: `spawnEffect(startCounterPopup(key, enemiesDefeated.value,
   levelTotals.value[key]))` — read **after** step 2 so this tick's defeats are in the numerator.
4. `spawnEffect` every staged puff.

## Per-kind `onDefeat` (the module table)

| Kind | `onDefeat` |
| --- | --- |
| `slimePurple` | `if (slimePurple.heldItem) defeat.spawnPickup(slimePurple.heldItem)` — the key drop fires from inside the kind, reading its own `heldItem`. |
| `slimeGreen` | reveal `[enemy.fact, ...(enemy.extraFacts ?? [])]` per-fact (effectId `${enemy.id}-${index}`), then `defeat.bumpCounter('enemies')`. |
| `bee` | *(absent)* — puff only, rewards/counts nothing. |

## Invariants

1. **No page kind/drop branch** — `PlatformerPage.tsx`'s defeat block has no `heldItem === 'key'`, no
   `enemy.type === 'slimeGreen'`, and no `spawnKeyPickup` import or call (FR-012/SC-002).
2. **One invocation per fresh defeat** — the applier invokes `onDefeat` exactly once, only when
   `!rewardGiven`; it never branches on `enemy.type`/`heldItem`/any kind name (FR-001).
3. **Gates preserved** — `rewardGiven` permanent (one payout ever, survives death/respawn);
   `deathEffectGiven` per-life (one puff per death, reset on revive); the puff is unconditional per
   death (FR-003).
4. **Counter attribution per-defeat, reveal per-fact** — the green slime bumps once per defeated slime
   (not per revealed fact), and a fact-less slime still counts toward `enemiesDefeated` (FR-004).
5. **No compatibility re-export** — `ItemKind` and the page's `spawnKeyPickup` import are gone, not
   aliased (FR-012).
6. **Layer invariants** — `contracts/` stays a leaf; `state/enemyRewards.ts` imports only downward/peer
   (`entities/`, `engine/`, `PlatformerState`) — no new `engine/ → state/` or `entities/ → state/` edge.
