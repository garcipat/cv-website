import type { Rect } from './geometry';
import type { DrawContext } from '../engine/DrawContext';

/**
 * What every drawable world object's type provides. Required members are the
 * two genuinely universal ones — a registry key and a way to draw itself —
 * so a new kind of thing never forces this interface to change; everything
 * else belongs to the family interface that composes this one.
 */
export interface WorldType<S> {
  key: string;
  draw(state: S, dc: DrawContext): void;
}

/**
 * Has a rectangle in world space. Composed by the types that actually have
 * one: enemies (a collision box), pickups and chests (trigger boxes). Blocks
 * do NOT compose this — physics locates them by grid cell
 * (`isBlockOccupied`/`blockIdAt`) and never computes a block rectangle, so
 * the member would have no consumer.
 */
export interface Boxed<S> {
  box(state: S): Rect;
}
