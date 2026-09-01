import type { Rect } from '../Entity';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../engine/DrawContext';

/**
 * Everything the engine needs to know about one pickup type, owned entirely
 * by that type's own module. Adding a pickup means writing one of these and
 * adding one line to `pickups/index.ts` — nothing in Collision.ts,
 * Renderer.ts or PlatformerPage.tsx needs to change, and no sprite registry
 * needs editing: the loader discovers assets from `sprite.sheet`.
 *
 * Deliberately carries no lifecycle: whether a given pickup has already been
 * collected is recorded differently per family (an external id Set for
 * placed collectibles, a flag for dropped keys, removal for bonus fruits),
 * and each call site supplies its own eligibility predicate. This interface
 * owns geometry and appearance only.
 */
export interface PickupType<S> {
  /** Must equal this module's slot in PICKUP_TYPES. */
  key: string;
  sprite: SpriteDescriptor;
  /**
   * This pickup's world-space rect, used for BOTH collision and drawing so
   * the two can never disagree. State-dependent because a bonus fruit tweens
   * upward while it rises.
   */
  box(state: S): Rect;
  /** Which frame of `sprite.sheet` to draw right now. `elapsed` is the shared
   *  world clock — coins spin in sync, so their frame comes from it rather
   *  than from per-coin animation state. */
  frameIndex(state: S, elapsed: number): number;
  /**
   * Vertical offset added to `box().y` when DRAWING only. Collision
   * deliberately ignores it, so a bobbing pickup's hitbox does not jitter a
   * few pixels every frame independently of its sprite.
   */
  bobOffset(state: S, elapsed: number): number;
  draw(state: S, dc: DrawContext): void;
}
