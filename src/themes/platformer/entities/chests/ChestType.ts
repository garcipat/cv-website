import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { ChestState } from '../Chest';
import type { WorldType, Boxed } from '../WorldType';
import type { Rect } from '../geometry';

/**
 * A chest's appearance, owned by its own module. Its two states are separate
 * images of different sizes, so each carries its own descriptor and its own
 * horizontal centering offset.
 *
 * Carries no trigger mechanism: opening requires standing on the chest AND
 * pressing Up AND holding a key, which the caller decides. This interface
 * owns appearance and the footprint that decides "standing on it" — not what
 * standing on it means.
 */
export interface ChestType extends WorldType<ChestState>, Boxed<ChestState> {
  closed: SpriteDescriptor;
  open: SpriteDescriptor;
  /** The chest's trigger footprint: its CLOSED rendered size, centered on
   *  its tile. Closed regardless of the chest's current state — an open
   *  chest is no longer a trigger, so its (narrower) open footprint would
   *  have no consumer. */
  box(chest: ChestState): Rect;
}
