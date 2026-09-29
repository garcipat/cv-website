import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { Rect } from '../../contracts/geometry';
import type { DrawContext } from '../../contracts/DrawContext';
import type { ChestPlacement } from '../../level/ChestMapper';
import type { CollectedFact } from '../../types';
import { aabbOverlap, playerHitbox } from '../../engine/Collision';
import { CHEST_CLOSED_SHEET, CHEST_OPEN_SHEET } from '../sprites/sheets';
import type { ChestType } from './ChestType';
import type {
  DeployableItemInteractContext,
  DeployableItemInteractionOutcome,
  DeployableItemState,
} from '../deployableItems/DeployableItemType';

/**
 * Native pixel dimensions of the two chest sprites (public/sprites/
 * chest_closed.png / chest_open.png) — flat/front-facing 2D style matching the
 * crate tile, non-square and deliberately NOT the 16x16 block tile grid: a
 * chest is a standalone placed object, not wall-adjacent, so it doesn't need
 * to tile. Each is a standalone image file, not a sheet — no sx/sy lookup.
 */
export const CHEST_CLOSED_WIDTH = 28;
export const CHEST_CLOSED_HEIGHT = 20;
export const CHEST_OPEN_WIDTH = 24;
export const CHEST_OPEN_HEIGHT = 20;

// Rendered height is pinned to match the other in-game blocks/tiles
// (RENDERED_TILE_SIZE) rather than a flat RENDER_SCALE multiplier — a flat 2x
// multiplier would make chests noticeably taller than the 32px blocks sitting
// on the same terrain grid. Width stays proportional to the shared scale
// factor, so it can legitimately be wider than one tile — chests aren't meant
// to fit inside a single tile cell.
const CHEST_SPRITE_SCALE = RENDERED_TILE_SIZE / CHEST_CLOSED_HEIGHT;

export const CHEST_CLOSED_RENDERED_WIDTH = CHEST_CLOSED_WIDTH * CHEST_SPRITE_SCALE;
export const CHEST_CLOSED_RENDERED_HEIGHT = RENDERED_TILE_SIZE;
export const CHEST_OPEN_RENDERED_WIDTH = CHEST_OPEN_WIDTH * CHEST_SPRITE_SCALE;
export const CHEST_OPEN_RENDERED_HEIGHT = RENDERED_TILE_SIZE;

/**
 * Horizontal offset (in rendered pixels, always <= 0) to add to a chest's
 * tile-aligned `x` so it draws horizontally CENTERED on its assigned tile
 * instead of left-aligned to the tile's top-left corner — the chest's rendered
 * width is wider than one tile, so centering means its left edge sits this many
 * pixels to the LEFT of the tile's left edge. No vertical counterpart is
 * needed: rendered height exactly equals `RENDERED_TILE_SIZE`.
 */
export const CHEST_CLOSED_OFFSET_X = (RENDERED_TILE_SIZE - CHEST_CLOSED_RENDERED_WIDTH) / 2;
export const CHEST_OPEN_OFFSET_X = (RENDERED_TILE_SIZE - CHEST_OPEN_RENDERED_WIDTH) / 2;

export type ChestVisualState = 'closed' | 'open';

/**
 * Live per-instance open/closed state for a placed chest — composes the shared
 * `DeployableItemState` base so the chest travels the one `deployableItems`
 * collection/registry. No hit-count/animation timer: opening is a
 * single, permanent, un-animated state flip.
 */
export interface ChestState extends DeployableItemState {
  kind: 'chest';
  state: ChestVisualState;
  fact: CollectedFact;
}

/** Converts a placed-but-static `ChestPlacement` into its initial live state
 * always starts closed. */
export function toChestState(placement: ChestPlacement): ChestState {
  return {
    id: placement.id,
    kind: 'chest',
    col: placement.col,
    row: placement.row,
    x: placement.x,
    y: placement.y,
    state: 'closed',
    fact: placement.fact,
  };
}

/** Narrows a generic deployable-item state to a chest (the derived
 * `chestStates` projection over the one `deployableItems` collection). */
export function isChestState(item: DeployableItemState): item is ChestState {
  return item.kind === 'chest';
}

export function isChestOpen(chest: ChestState): boolean {
  return chest.state === 'open';
}

/** Opens a chest — permanent for the rest of the session (only Reset Game,
 * via PlatformerState.ts's resetGameProgress, puts it back to closed). A
 * no-op (same reference) if already open, matching Block.ts's
 * applyBlockHit's already-used-up guard convention. */
export function openChest(chest: ChestState): ChestState {
  if (chest.state === 'open') return chest;
  return { ...chest, state: 'open' };
}

/** Whether every chest in the level has been opened (the Thank You screen
 * trigger) — false for an empty array so a level with zero chests never
 * spuriously "completes". */
export function allChestsOpen(chests: readonly ChestState[]): boolean {
  return chests.length > 0 && chests.every(isChestOpen);
}

/** The chest's trigger footprint: its CLOSED rendered size, centered on its
 * tile. Closed regardless of the chest's current state — an open chest is no
 * longer a trigger, so its (narrower) open footprint would have no consumer. */
export function chestTriggerBox(chest: ChestState): Rect {
  return {
    x: chest.x + CHEST_CLOSED_OFFSET_X,
    y: chest.y,
    width: CHEST_CLOSED_RENDERED_WIDTH,
    height: CHEST_CLOSED_RENDERED_HEIGHT,
  };
}

/**
 * The chest family's one home (resolving X7 by folding): the
 * state, helpers, constants and this `WorldInteractableType<ChestState>` entry,
 * reachable only from `entities/chests`.
 *
 * Draws at its current open/closed sprite — each state is a standalone image
 * (not a shared sheet), so this always crops from (0, 0) at that state's own
 * native size. Either sprite may independently be null (not yet loaded); a
 * chest whose current state's sprite is missing is simply skipped for the
 * frame. The destination x is shifted by the state's `*_OFFSET_X` so the chest
 * draws horizontally centered on its tile.
 */
export const chestDeployableItem: ChestType = {
  key: 'chest',
  sprite: { sheet: CHEST_CLOSED_SHEET, renderScale: 1, animations: {} },
  drawLayer: 'afterCrumblingFloors',
  resetScope: 'progress',
  interactionPriority: 1,
  closed: { sheet: CHEST_CLOSED_SHEET, renderScale: 1, animations: {} },
  open: { sheet: CHEST_OPEN_SHEET, renderScale: 1, animations: {} },
  box: chestTriggerBox,
  onPlayerInteract: (
    state: ChestState,
    ctx: DeployableItemInteractContext,
  ): DeployableItemInteractionOutcome<ChestState> | null => {
    if (isChestOpen(state)) return null;
    if (!aabbOverlap(playerHitbox(ctx.player), chestTriggerBox(state))) return null;
    if (ctx.keys <= 0) return { kind: 'blocked', hint: 'noKeyForChest' };
    return {
      kind: 'activate',
      state: openChest(state),
      keyCost: 1,
      reveal: {
        fact: state.fact,
        effectId: state.id,
        // Shifted by CHEST_CLOSED_OFFSET_X so the flying text starts from the
        // chest's actual centered-on-tile left edge (only the closed offset
        // applies, since this fires the instant a closed chest is opened).
        x: state.x + CHEST_CLOSED_OFFSET_X,
        y: state.y,
      },
    };
  },
  draw: (chest: ChestState, dc: DrawContext) => {
    const open = isChestOpen(chest);
    const sprite = dc.sprites[open ? CHEST_OPEN_SHEET.src : CHEST_CLOSED_SHEET.src];
    if (!sprite) return;
    const srcWidth = open ? CHEST_OPEN_WIDTH : CHEST_CLOSED_WIDTH;
    const srcHeight = open ? CHEST_OPEN_HEIGHT : CHEST_CLOSED_HEIGHT;
    const destWidth = open ? CHEST_OPEN_RENDERED_WIDTH : CHEST_CLOSED_RENDERED_WIDTH;
    const destHeight = open ? CHEST_OPEN_RENDERED_HEIGHT : CHEST_CLOSED_RENDERED_HEIGHT;
    const offsetX = open ? CHEST_OPEN_OFFSET_X : CHEST_CLOSED_OFFSET_X;
    dc.ctx.drawImage(
      sprite,
      0,
      0,
      srcWidth,
      srcHeight,
      chest.x + dc.originX + offsetX,
      chest.y + dc.originY,
      destWidth,
      destHeight,
    );
  },
};
