import type { DeployableItemKind } from '../../contracts/DeployableItemKind';
import type { LevelDef } from '../../level/LevelData';
import type { BubbleMessageId } from '../../level/HintCatalog';
import type {
  DeployableItemInteractionOutcome,
  DeployableItemInteractContext,
  DeployableItemReveal,
  DeployableItemState,
  DeployableItemType,
  TerrainCellWrite,
} from './DeployableItemType';
import { bombDeployableItem } from './Bomb';
import { ropeLadderDeployableItem } from './RopeLadder';
import { chestDeployableItem } from '../chests';

/**
 * Every deployable-item kind in the game. Adding a kind is one module plus one
 * line here — the page's tick/draw/interaction dispatch, the sprite loader,
 * `Renderer.ts` and `Collision.ts` need no edit. The
 * `Record<DeployableItemKind, …>` annotation pins the registry to the leaf
 * vocabulary, so a kind added to one side without the other fails to compile.
 */
export const DEPLOYABLE_ITEM_TYPES: Record<
  DeployableItemKind,
  DeployableItemType<DeployableItemState>
> = {
  bomb: bombDeployableItem,
  ladder: ropeLadderDeployableItem,
  chest: chestDeployableItem,
};

/**
 * Folds every live item's effective-terrain contribution into a new `LevelDef`
 * (the rope ladder's deployed shaft is the only contributor today). Returns the
 * SAME `level` object when nothing contributes, so `activeLevel`'s common case
 * allocates nothing.
 */
export function applyDeployableItemTerrain(
  level: LevelDef,
  items: readonly DeployableItemState[],
): LevelDef {
  let writes: TerrainCellWrite[] | null = null;
  for (const item of items) {
    const cells = DEPLOYABLE_ITEM_TYPES[item.kind].effectiveTerrainCells?.(item);
    if (!cells || cells.length === 0) continue;
    (writes ??= []).push(...cells);
  }
  if (writes === null) return level;
  const terrain = level.terrain.map((row) => [...row]);
  for (const { col, row, tile } of writes) terrain[row][col] = tile;
  return { ...level, terrain };
}

/** A resolved activation the page's one generic applier writes: the matching
 *  live item's id, its new state, and any key cost / fact reveal. */
export interface DeployableItemActivation {
  id: string;
  next: DeployableItemState;
  keyCost: number;
  reveal?: DeployableItemReveal;
}

/** The one interaction dispatch's declarative result. */
export interface DeployableItemInteraction {
  activate?: DeployableItemActivation;
  hint?: BubbleMessageId;
}

/**
 * The one shared player-interaction dispatch: scans every live item whose kind
 * declares `onPlayerInteract`, keeps the single best-`interactionPriority`
 * match (the ladder's `0` outranks the chest's `1`; a tie keeps the earlier
 * collection entry), and returns the declarative outcome. Allocates only when
 * an interactable matches. The page's one generic applier is the only writer.
 */
export function proposeDeployableItemInteraction(
  items: readonly DeployableItemState[],
  ctx: DeployableItemInteractContext,
): DeployableItemInteraction {
  let best: {
    priority: number;
    id: string;
    outcome: DeployableItemInteractionOutcome;
  } | null = null;

  for (const item of items) {
    const type = DEPLOYABLE_ITEM_TYPES[item.kind];
    if (!type.onPlayerInteract) continue;
    const outcome = type.onPlayerInteract(item, ctx);
    if (!outcome) continue;
    const priority = type.interactionPriority ?? 0;
    if (best === null || priority < best.priority) {
      best = { priority, id: item.id, outcome };
    }
  }

  if (best === null) return {};
  if (best.outcome.kind === 'blocked') return { hint: best.outcome.hint };
  return {
    activate: {
      id: best.id,
      next: best.outcome.state,
      keyCost: best.outcome.keyCost ?? 0,
      reveal: best.outcome.reveal,
    },
  };
}
