import { typeOf } from '../entities/enemies';
import { enemyEffectAnchor } from '../entities/Enemy';
import { PICKUP_TYPES } from '../entities/pickups';
import { startCounterPopup, startPuffEffect } from '../engine/effects';
import {
  enemiesDefeated,
  enemyStates,
  levelTotals,
  pickupStores,
  spawnEffect,
} from '../PlatformerState';
import type { EnemyState } from '../entities/enemies';
import type { DefeatApi } from '../contracts/Outcome';
import type { CounterPopupLabelKey } from '../contracts/counters';
import type { CollectedFact } from '../types';
import type { RevealOptions } from './rewards';

/** The tick-scoped inputs a defeat application needs from the page. */
export interface EnemyDefeatContext {
  /** This tick's fact-reveal trigger (`createRewardReveal`), already bound to
   *  the tick's origin/canvas/journal/slot allocator. */
  revealFact: (fact: CollectedFact, options: RevealOptions) => boolean;
  /** Camera origin for the world-event puff (world → screen). */
  originX: number;
  originY: number;
}

/**
 * THE single consumer of a defeated enemy (R-007 D2): it owns the
 * unconditional per-death puff, the `rewardGiven`/`deathEffectGiven` gating,
 * and the invocation of the kind's own `EnemyType.onDefeat` hook through the
 * narrow `DefeatApi`. The page no longer names any enemy or drop kind.
 *
 * Byte-identical to the pre-refactor inline page block:
 *
 * 1. Every defeated enemy stages its world-event puff (unconditional per
 *    death, whether or not a reward is still owed).
 * 2. A fresh defeat (`!rewardGiven`) builds the `DefeatApi` and invokes the
 *    kind's hook exactly once.
 * 3. `rewardGiven` and `deathEffectGiven` are set on every defeated id.
 * 4. Staged counter bumps flush AFTER that update, reading
 *    `enemiesDefeated.value` so this tick's own defeats are in the numerator.
 * 5. The staged puffs are spawned.
 */
export function applyEnemyDefeats(
  defeated: readonly EnemyState[],
  ctx: EnemyDefeatContext,
): void {
  const puffs: ReturnType<typeof startPuffEffect>[] = [];
  // Deduped per key: several same-tick defeats bump a counter once.
  const bumps = new Set<CounterPopupLabelKey>();

  for (const enemy of defeated) {
    const anchor = enemyEffectAnchor(enemy);
    puffs.push(startPuffEffect(enemy.id, anchor.x + ctx.originX, anchor.y + ctx.originY, anchor.scale));

    // Only a fresh defeat earns a payout; a revived-and-redefeated enemy
    // still puffs (above) but pays out nothing further.
    if (enemy.rewardGiven) continue;

    const defeat: DefeatApi = {
      spawnPickup: (kind) => {
        pickupStores[kind].append(
          PICKUP_TYPES[kind].spawn({
            id: enemy.id,
            x: enemy.x,
            y: enemy.y,
            fact: enemy.fact,
          }),
        );
      },
      revealFact: (fact, effectId) => {
        ctx.revealFact(fact, { x: enemy.x, y: enemy.y, effectId });
      },
      bumpCounter: (key) => {
        bumps.add(key);
      },
    };
    typeOf(enemy).onDefeat?.(enemy, defeat);
  }

  // Every defeated enemy is marked processed (deathEffectGiven) so it isn't
  // selected again next tick, and rewardGiven is set for all of them — a
  // plain enemy or a dropped item is just as much "its one payout" as a fact.
  const processedIds = new Set(defeated.map((e) => e.id));
  enemyStates.value = enemyStates.value.map((e) =>
    processedIds.has(e.id) ? { ...e, rewardGiven: true, deathEffectGiven: true } : e,
  );

  // Flush after the flag update: `enemiesDefeated` is a computed off
  // `enemyStates`, so this tick's own defeats are already in the numerator.
  for (const key of bumps) {
    spawnEffect(startCounterPopup(key, enemiesDefeated.value, levelTotals.value[key]));
  }

  for (const puff of puffs) spawnEffect(puff);
}
