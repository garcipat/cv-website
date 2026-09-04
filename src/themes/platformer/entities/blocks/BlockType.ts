import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../engine/DrawContext';
import type { BlockState } from '../Block';
import type { WorldType } from '../WorldType';

/**
 * Everything the engine needs to know about one block kind, owned entirely by
 * that kind's own module. Adding a block means writing one of these and adding
 * one line to `blocks/index.ts` — nothing in Renderer.ts needs to change. If
 * the new kind draws from an already-registered sheet (`WORLD_TILESET_SHEET`,
 * as every kind does today), PlatformerPage.tsx's loader needs no edit either
 * — it discovers `sprite.sheet` from `BLOCK_TYPES` directly. A kind
 * introducing a brand-new sheet adds it to `sprites/sheets.ts`, and — only if
 * it's a secondary overlay rather than the kind's own primary `sprite.sheet`
 * (the way `Crate.ts`'s crack overlay is) — also to that loader's hand-listed
 * exceptions, since a spread over `BLOCK_TYPES` can't discover a sheet that
 * isn't any type's primary descriptor.
 *
 * Carries no trigger mechanism. A block is hit from below, detected during
 * ceiling collision in Physics.ts, which writes `player.blockContacts`
 * (tagged `'bottom'`); the caller reads that and applies the hit. This
 * interface owns appearance and per-kind rules only.
 */
export interface BlockType extends WorldType<BlockState> {
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
  /**
   * Rendered px to shrink this kind's horizontal solid hitbox by on EACH
   * side, relative to the full tile — omitted (or 0) means the full tile is
   * solid, same as every block kind before this field existed. Exists for a
   * kind whose sprite doesn't fill its tile edge-to-edge (unlike
   * crate/questionMark/fragileRock's `world_tileset.png` art): without it,
   * the player stops at the full tile boundary well outside the visible
   * sprite, reading as an invisible wall. Physics.ts's horizontal collision
   * resolves against `tile boundary ± hitboxInsetX`, not the raw tile
   * boundary, whenever the occupying block declares one.
   */
  hitboxInsetX?: number;
  /** Which frame of `sprite.sheet` to draw for the given hit count — a kind
   *  whose appearance does not change ignores the argument. */
  frameIndex(hitsTaken: number): number;
  draw(block: BlockState, dc: DrawContext): void;
}
