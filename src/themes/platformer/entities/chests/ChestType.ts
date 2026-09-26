import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { ChestState } from './Chest';
import type { Rect } from '../../contracts/geometry';
import type { WorldInteractableType } from '../deployableItems/DeployableItemType';

/**
 * A chest's appearance, owned by its own module. Its two states are separate
 * images of different sizes, so each carries its own descriptor and its own
 * horizontal centering offset.
 *
 * R-008 folded the chest into the `WorldInteractableType` family: the family
 * owns the state, the activation hook (deploy/open) and the trigger rect here,
 * and is registered as `DEPLOYABLE_ITEM_TYPES.chest`. `box` stays required on
 * this interface (the chest's closed footprint is its trigger).
 */
export interface ChestType extends WorldInteractableType<ChestState> {
  closed: SpriteDescriptor;
  open: SpriteDescriptor;
  /** The chest's trigger footprint: its CLOSED rendered size, centered on
   *  its tile. Closed regardless of the chest's current state — an open
   *  chest is no longer a trigger, so its (narrower) open footprint would
   *  have no consumer. */
  box(chest: ChestState): Rect;
}
