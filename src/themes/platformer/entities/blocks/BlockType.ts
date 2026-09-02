import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../engine/DrawContext';
import type { BlockState } from '../Block';

/**
 * Everything the engine needs to know about one block kind, owned entirely by
 * that kind's own module. Adding a block means writing one of these and adding
 * one line to `blocks/index.ts` — nothing in Renderer.ts or PlatformerPage.tsx
 * needs to change, and no sprite registry needs editing: the loader discovers
 * assets from `sprite.sheet`.
 *
 * Carries no trigger mechanism. A block is hit from below, detected during
 * ceiling collision in Physics.ts, which writes `player.hitBlockIds`; the
 * caller reads that and applies the hit. This interface owns appearance and
 * per-kind rules only.
 */
export interface BlockType {
  /** Must equal this module's slot in BLOCK_TYPES. */
  key: string;
  sprite: SpriteDescriptor;
  /** Upward hits this kind responds to before it is used up. */
  maxHits: number;
  /**
   * Whether this kind leaves the world once used up and its animation has
   * settled. False for a kind that stays as a permanent, solid, spent block.
   */
  removeWhenUsedUp: boolean;
  /** Which frame of `sprite.sheet` to draw for the given hit count — a kind
   *  whose appearance does not change ignores the argument. */
  frameIndex(hitsTaken: number): number;
  draw(block: BlockState, dc: DrawContext): void;
}
