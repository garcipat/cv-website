import type { Rect } from '../geometry';
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
  /**
   * The LOGICAL frame/icon index to draw right now — for a type whose sheet
   * is scrambled (fruit-family sheets, via `FRUIT_ICON_ORDER`), this is the
   * pre-mapped index a helper like `fruitFrameSource` still expects, NOT the
   * already-packed sheet position; the packed-slot mapping happens later,
   * at draw time. For a type with no such scrambling (coin, key) the
   * logical index already IS the sheet frame, so the distinction is moot.
   *
   * `elapsed` is the shared world clock — coins spin in sync, so their frame
   * comes from it rather than from per-coin animation state. `index` is the
   * item's position within its own array (e.g. the Nth placed fruit) —
   * needed by a type whose icon varies by placement order rather than by
   * per-instance state; most types ignore it.
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
   * array (see `frameIndex`'s doc comment) — only a type whose icon varies
   * by placement order (fruit) reads it; every other type ignores it, so
   * callers iterating a single-type array (keys, bonus fruits) may omit it.
   */
  draw(state: S, dc: DrawContext, index?: number): void;
}
