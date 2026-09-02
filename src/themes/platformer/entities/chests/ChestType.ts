import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../engine/DrawContext';
import type { ChestState } from '../Chest';

/**
 * A chest's appearance, owned by its own module. Its two states are separate
 * images of different sizes, so each carries its own descriptor and its own
 * horizontal centering offset.
 *
 * Carries no trigger mechanism: opening requires standing on the chest AND
 * pressing Up AND holding a key, which the caller decides. This interface owns
 * appearance only.
 */
export interface ChestType {
  key: string;
  closed: SpriteDescriptor;
  open: SpriteDescriptor;
  draw(chest: ChestState, dc: DrawContext): void;
}
