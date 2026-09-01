import type { Entity, Damageable } from '../Entity';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { EnemyPlacement } from '../../level/EnemyMapper';
import type { CollectedFact, EnemyDef } from '../../types';
import type { EnemyAnimState } from './EnemyAnimation';

/** Item kinds an enemy type can drop on defeat. Grows as items are added. */
export type ItemKind = 'key';

/**
 * What every enemy has, regardless of type. Type-specific state — purple's
 * spike timer, for example — is declared by that type's own module, which
 * extends this.
 */
export interface BaseEnemyState extends EnemyPlacement, Entity, Damageable {
  /** Key into ENEMY_TYPES. Each type module narrows this to its own literal. */
  type: EnemyDef['type'];
  animState: EnemyAnimState;
  /** Placement position; `revive` restores x/y from these. */
  homeX: number;
  homeY: number;
  hitTimer: number;
  /** True while this enemy's top is spiked and un-stompable. */
  spiked: boolean;
  /** Seconds elapsed since `spiked` was last set true — meaningless while
   *  `spiked` is false. */
  spikeTimer: number;
  fact?: CollectedFact;
  /** True once this enemy's one reward has been handed out. Survives death
   *  and respawn; cleared only by resetGameProgress(). */
  rewardGiven: boolean;
}

/**
 * Everything the engine needs to know about one enemy type, owned entirely by
 * that type's own module. Adding an enemy means writing one of these and
 * adding one line to `enemies/index.ts` — nothing in Collision.ts,
 * Renderer.ts, EnemyAI.ts, or PlatformerPage.tsx needs to change, and no
 * sprite registry needs editing either: the loader discovers assets from
 * `sprite.sheet`.
 */
export interface EnemyType<S extends BaseEnemyState> {
  /** Must equal this module's slot in ENEMY_TYPES — see index.test.ts. */
  key: string;
  maxHitPoints: number;
  patrolSpeedMultiplier: number;
  /** Transparent margin inside the native frame, in pre-scale pixels. */
  hitboxPaddingNative: { side: number; top: number };
  sprite: SpriteDescriptor;
  /** What a finishing stomp drops, or null for a type that carries a CV fact
   *  instead. */
  heldItem: ItemKind | null;

  create(placement: EnemyPlacement, index: number): S;
  revive(enemy: S): S;
}
