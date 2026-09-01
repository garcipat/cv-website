import { slimeGreen } from './SlimeGreen';
import { slimePurple } from './SlimePurple';
import type { SlimeGreenState } from './SlimeGreen';
import type { SlimePurpleState } from './SlimePurple';
import type { EnemyType, BaseEnemyState } from './EnemyType';

/** Every enemy type in the game. Adding an enemy is one line here plus its
 *  module plus its sprite asset — nothing else in the codebase changes. */
export const ENEMY_TYPES = { slimeGreen, slimePurple };

export type EnemyTypeKey = keyof typeof ENEMY_TYPES;
export type EnemyState = SlimeGreenState | SlimePurpleState;

/**
 * The module owning `enemy`.
 *
 * The cast is deliberate and is the single soundness hole in this design.
 * `ENEMY_TYPES` is heterogeneous — each entry is `EnemyType<its own state>` —
 * so TypeScript cannot prove that indexing it by `enemy.type` yields the entry
 * whose state parameter matches `enemy`. That invariant IS guaranteed, by each
 * module declaring its own `type` literal and its `key` identically, which
 * `index.test.ts` asserts for every entry. Confining the cast here is what
 * keeps "add an enemy" to one file plus one registry line; the alternative is
 * an exhaustive switch that grows a case per type in a shared file.
 */
export function typeOf<S extends BaseEnemyState>(enemy: S): EnemyType<S> {
  return ENEMY_TYPES[enemy.type as EnemyTypeKey] as unknown as EnemyType<S>;
}
