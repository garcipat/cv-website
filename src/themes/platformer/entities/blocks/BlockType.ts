import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../engine/DrawContext';
import type { BlockState } from '../Block';
import type { WorldType } from '../WorldType';
import type { BlockContactSide } from '../Player';
import type { PlayerEffects, RewardEffects } from '../../engine/Outcome';

/** What a registering hit on a block MEANS — the block equivalent of
 *  `CollisionOutcome`. Carries no `self`: block hit counting stays generic
 *  (`maxHits` + `applyBlockHit`), so no kind needs to return replacement
 *  state. */
export type BlockHitOutcome = PlayerEffects & RewardEffects;

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
 * A block is hit from below, detected during ceiling collision in
 * Physics.ts, which writes `player.blockContacts` (tagged `'bottom'`); the
 * caller reads that and applies the hit. This interface owns appearance and
 * per-kind rules only.
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
  /**
   * Which contact sides register a hit on this kind, in the block's own
   * four-face vocabulary (`BlockContactSide`, from `PlayerState.blockContacts`
   * — 'top' | 'bottom' | 'left' | 'right'), not the enemy `ContactSide`
   * classification. The engine filters `player.blockContacts` against this
   * generically — it used to hardcode `blockKind !== 'coinPot'` for its
   * below-hit loop and `blockKind === 'coinPot'` for its landed-on-top loop,
   * which is exactly the per-kind knowledge that belongs here instead.
   */
  triggerSides: readonly BlockContactSide[];
  /**
   * What a registering hit MEANS for this kind. Receives the block AFTER
   * `applyBlockHit`, so comparing `block.hitsTaken` against this kind's own
   * max-hits constant is how it knows this hit was its terminal one.
   *
   * Deliberately NOT `isBlockUsedUp(block)`: that lives in `entities/Block.ts`,
   * which imports `BLOCK_TYPES`, so a block module calling it would close an
   * import cycle (Block.ts -> blocks/index.ts -> Crate.ts -> Block.ts). The
   * type-only `import type { BlockState }` these modules already have is
   * erased at build time and so is fine.
   *
   * Omitted by a kind whose destruction has no consequences beyond the
   * generic puff and removal (fragileRock).
   */
  onHit?(block: BlockState): BlockHitOutcome;
}
