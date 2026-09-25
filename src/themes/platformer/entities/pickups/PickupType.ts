import type { Rect } from '../../contracts/geometry';
import type { WorldType, Boxed } from '../../contracts/WorldType';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../contracts/DrawContext';
import type { Pickup } from '../../contracts/Pickup';
import type { PickupKind } from '../../contracts/PickupKind';
import type { CollectedFact } from '../../types';
import type {
  PickupCollisionContext,
  PickupContext,
  PickupOutcome,
} from '../../contracts/PickupOutcome';

/** The band `drawPickups` draws this kind in (see engine/Renderer.ts). */
export type PickupDrawLayer = 'belowBlocks' | 'beforeEnemies' | 'afterEnemies';

/** Where and how a pickup is created from its source (a block today). */
export interface PickupSpawnSource {
  id: string;
  x: number;
  y: number;
  fact?: CollectedFact;
  /** Lazy so only a kind that consumes an icon advances the shared counter. */
  iconIndex?: () => number;
}

/**
 * Everything the engine needs to know about one pickup type, owned entirely
 * by that type's own module — including how the kind is spawned from a source
 * and what collecting it asks for. Adding a pickup means writing one of these
 * and adding one line to `pickups/index.ts`; nothing in Collision.ts,
 * Renderer.ts or PlatformerPage.tsx needs to change.
 *
 * The collect-once flag lives on the shared `Pickup` state, not here: each
 * kind supplies only its own extra eligibility gate (`isCollectible`) on top
 * of the base `!state.collected` gate, and its `onPickup` returns only
 * consequences (the shared applier sets `collected: true` itself and then
 * applies them). There is deliberately no per-kind visibility lifecycle.
 *
 * Members are declared with METHOD syntax (not function-typed properties) so
 * a concrete `PickupType<FruitState>` stays assignable to the widened
 * `PickupType<Pickup>` used by the generic engine dispatch under
 * `strictFunctionTypes`, with no `any`.
 */
export interface PickupType<S extends Pickup = Pickup> extends WorldType<S>, Boxed<S> {
  /** Must equal this module's slot in PICKUP_TYPES. */
  key: PickupKind;
  sprite: SpriteDescriptor;
  /** Which band `drawPickups` draws this kind in. */
  drawLayer: PickupDrawLayer;
  /**
   * This pickup's world-space rect, used for BOTH collision and drawing so
   * the two can never disagree. State-dependent because a rising fruit tweens
   * upward.
   */
  box(state: S): Rect;
  /**
   * The LOGICAL frame/icon index to draw right now. `elapsed` is the shared
   * world clock; `index` is the item's position within its own array (needed
   * by a type whose icon varies by placement order; most types ignore it).
   */
  frameIndex(state: S, elapsed: number, index: number): number;
  /**
   * Vertical offset added to `box().y` when DRAWING only. Collision
   * deliberately ignores it, so a bobbing pickup's hitbox does not jitter a
   * few pixels every frame independently of its sprite.
   */
  bobOffset(state: S, elapsed: number): number;
  /**
   * Draws this one pickup. `index` is this item's position within its own
   * array (see `frameIndex`'s doc comment).
   */
  draw(state: S, dc: DrawContext, index?: number): void;
  /** How this kind is created from a source (a block today). */
  spawn(source: PickupSpawnSource): S;
  /**
   * OPTIONAL extra eligibility gate on top of the shared `!state.collected`
   * base gate (fruit rise, heart full-health). Omitted = no extra gate.
   */
  isCollectible?(state: S, ctx: PickupCollisionContext): boolean;
  /** A kind's per-tick selection cap (bomb capacity); omitted = unlimited. */
  maxPerTick?(ctx: PickupCollisionContext): number;
  /**
   * Declares what collecting this kind asks for as consequences (facts,
   * counter, heal, bombs, banked key, flying text). No disposition and no
   * `self` — the shared applier flags `collected` and applies these
   * uniformly.
   */
  onPickup(state: S, ctx: PickupContext): PickupOutcome;
}
