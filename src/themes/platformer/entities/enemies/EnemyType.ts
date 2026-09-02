import type { Moving, SelfAnimated, Damageable, DamageableType } from '../capabilities';
import type { WorldType, Boxed } from '../WorldType';
import type { Rect } from '../geometry';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { EnemyPlacement } from '../../level/EnemyMapper';
import type { CollectedFact, EnemyDef } from '../../types';
import type { EnemyAnimState } from './EnemyAnimation';
import type { DrawContext } from '../../engine/DrawContext';
import type { Contact, CollisionOutcome } from '../../engine/Contact';
import type { PlayerState } from '../Player';

/** Item kinds an enemy type can drop on defeat. Grows as items are added. */
export type ItemKind = 'key';

/**
 * What every enemy has, regardless of type. Type-specific state — a
 * temporary defense a stomped enemy grows, for example — is declared by that
 * type's own module, which extends this.
 */
export interface BaseEnemyState extends EnemyPlacement, Moving, SelfAnimated, Damageable {
  /** Key into ENEMY_TYPES. Each type module narrows this to its own literal. */
  type: EnemyDef['type'];
  animState: EnemyAnimState;
  /** Placement position; `revive` restores x/y from these. */
  homeX: number;
  homeY: number;
  fact?: CollectedFact;
  /** True once this enemy's one reward has been handed out. Survives death
   *  and respawn; cleared only by resetGameProgress(). */
  rewardGiven: boolean;
  /** True once this life's defeat has shown its world-event puff (see
   *  B-003) — gates one puff per enemy per life, independent of whether a
   *  fact-flight reward also fires (that's gated separately, by
   *  `rewardGiven`/`fact` in PlatformerPage.tsx). Unlike `rewardGiven`, this
   *  is reset on revive: a revived-and-redefeated enemy gets nothing further
   *  to give (rewardGiven stays true forever) but still deserves a puff for
   *  THIS death, so it needs its own once-per-life gate. */
  deathEffectGiven: boolean;
}

/**
 * Everything the engine needs to know about one enemy type, owned entirely by
 * that type's own module. Adding an enemy means writing one of these and
 * adding one line to `enemies/index.ts` — nothing in Collision.ts,
 * Renderer.ts, EnemyAI.ts, or PlatformerPage.tsx needs to change, and no
 * sprite registry needs editing either: the loader discovers assets from
 * `sprite.sheet`.
 */
export interface EnemyType<S extends BaseEnemyState>
  extends DamageableType<S>,
    WorldType<S>,
    Boxed<S> {
  /** Must equal this module's slot in ENEMY_TYPES — see index.test.ts. */
  key: string;
  patrolSpeedMultiplier: number;
  /** Transparent margin inside the native frame, in pre-scale pixels. */
  hitboxPaddingNative: { side: number; top: number };
  sprite: SpriteDescriptor;
  /** What a finishing stomp drops, or null for a type that carries a CV fact
   *  instead. */
  heldItem: ItemKind | null;

  create(placement: EnemyPlacement, index: number): S;
  revive(enemy: S): S;
  /**
   * This enemy's collision box — the visible silhouette, inset from the full
   * render slot by the sprite's own transparent margins, so a touch against
   * empty space never registers as a hit. Owned here rather than in
   * Collision.ts so the box and the sprite it is derived from stay in one
   * file.
   */
  box(enemy: S): Rect;
  /** Renders this enemy. Owning rendering here is what lets a new enemy type
   *  ship as one file: Renderer.ts iterates and supplies the camera, and
   *  never branches on type. */
  draw(enemy: S, dc: DrawContext): void;
  /** Decides what a contact means for this type. The engine supplies the
   *  geometry; everything else — whether the top is safe to land on, whether
   *  a mechanic is currently active — is this module's business alone. It
   *  decides only what the contact MEANS: whatever a landed hit then costs
   *  this type belongs in `onDamaged`, which the engine applies afterward. */
  onPlayerCollide(enemy: S, player: PlayerState, contact: Contact): CollisionOutcome<S>;
  /** Advances any per-tick state this type owns beyond patrol/hit-reaction
   *  (both handled generically by EnemyAI.ts) — a temporary defense's
   *  cooldown, for example. Optional: most types need nothing here. */
  onTick?(enemy: S, dt: number): S;
}
