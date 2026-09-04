import type { BlockState } from '../Block';
import { isBlockUsedUp } from '../Block';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';

/** The 6 permutations of the 3 pot-size variant indices (0=small,
 *  1=tall, 2=square — see CoinPot.ts's VARIANT_TILE_COLUMNS). */
const PERMUTATIONS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/**
 * Deterministically picks one of the 6 permutations of [0,1,2] from a run's
 * leftmost tile column — same position-hash trick `StaticObjectsCatalog.ts`'s
 * `pickVariant` uses for bush/tree variety, single-input version since a
 * coin-pot run only has one degree of freedom to seed from (its leftmost
 * column), not a (col,row) pair.
 */
export function permutationForColumn(col: number): readonly [number, number, number] {
  const hash = Math.imul(col, 374761393) >>> 0;
  return PERMUTATIONS[hash % PERMUTATIONS.length];
}

export interface CoinPotFiller {
  x: number;
  y: number;
  variantIndex: number;
}

export interface CoinPotRun {
  /** Run members left-to-right — the SAME `BlockState` objects passed into
   *  `computeCoinPotRenderPlan`, so a consumer can still read each member's
   *  own live `animState`/`animTimer` for the shared bump animation. */
  blocks: BlockState[];
  fillers: CoinPotFiller[];
}

export interface CoinPotRenderPlan {
  /** Variant index (0/1/2) for every currently-live coin-pot block, keyed by
   *  its id — covers every run member, not just each run's owner. */
  variantByBlockId: Map<string, number>;
  /** Every live coin-pot block's run-owner id (a run's leftmost block's own
   *  id, for every member including itself) — only the owner actually
   *  renders anything for the whole run. */
  ownerBlockId: Map<string, string>;
  /** Each run, keyed by its owner's block id. */
  runsByOwnerId: Map<string, CoinPotRun>;
}

/**
 * Computes, fresh from the CURRENT live block list, how every still-live
 * coin-pot tile should render this frame: which of the 3 sprite variants
 * each one shows, and which adjacent pairs need an extra "filler" pot
 * between them so a run of adjacent pots reads as one merged bunch instead
 * of N separate jars with visible gaps.
 *
 * Recomputed every frame directly from `blocks` (never cached across
 * ticks): a block already hit (`isBlockUsedUp`) no longer counts as part of
 * any run, even before its bump/shatter animation finishes and it's
 * actually removed from the world — so destroying one tile immediately
 * reshuffles how its former neighbors render on the very next frame (e.g.
 * destroying the middle of a 3-run leaves both remaining tiles isolated,
 * with no filler between them, since they're no longer adjacent).
 *
 * Within one row, adjacent live tiles (column N and N+1) form a run. Each
 * run picks one permutation of the 3 variants (seeded off its leftmost
 * tile's column) and walks slot index 0,1,2,3,... through it: base tiles
 * occupy even slots (0,2,4,...), one filler pot per internal seam occupies
 * the odd slots between them (1,3,...), centered on the tile boundary. A
 * permutation's 3 entries are pairwise distinct, so no two consecutive
 * rendered pots (base or filler) ever share a variant, even across the `% 3`
 * wraparound for runs longer than 3 rendered slots — and a run of exactly 2
 * tiles (3 rendered slots) uses all 3 variants exactly once.
 */
export function computeCoinPotRenderPlan(blocks: readonly BlockState[]): CoinPotRenderPlan {
  const variantByBlockId = new Map<string, number>();
  const ownerBlockId = new Map<string, string>();
  const runsByOwnerId = new Map<string, CoinPotRun>();

  const live = blocks.filter((b) => b.blockKind === 'coinPot' && !isBlockUsedUp(b));

  const byRow = new Map<number, BlockState[]>();
  for (const block of live) {
    const row = Math.round(block.y / RENDERED_TILE_SIZE);
    const rowBlocks = byRow.get(row);
    if (rowBlocks) rowBlocks.push(block);
    else byRow.set(row, [block]);
  }

  for (const rowBlocks of byRow.values()) {
    rowBlocks.sort((a, b) => a.x - b.x);

    let runStart = 0;
    for (let i = 1; i <= rowBlocks.length; i++) {
      const prevCol = Math.round(rowBlocks[i - 1].x / RENDERED_TILE_SIZE);
      const curCol = i < rowBlocks.length ? Math.round(rowBlocks[i].x / RENDERED_TILE_SIZE) : undefined;
      const contiguous = curCol !== undefined && curCol === prevCol + 1;
      if (contiguous) continue;

      const run = rowBlocks.slice(runStart, i);
      runStart = i;

      const leftmostCol = Math.round(run[0].x / RENDERED_TILE_SIZE);
      const permutation = permutationForColumn(leftmostCol);
      const owner = run[0].id;
      const fillers: CoinPotFiller[] = [];

      run.forEach((block, k) => {
        variantByBlockId.set(block.id, permutation[(2 * k) % 3]);
        ownerBlockId.set(block.id, owner);
      });
      for (let k = 0; k < run.length - 1; k++) {
        fillers.push({
          x: run[k].x + RENDERED_TILE_SIZE / 2,
          y: run[k].y,
          variantIndex: permutation[(2 * k + 1) % 3],
        });
      }

      runsByOwnerId.set(owner, { blocks: run, fillers });
    }
  }

  return { variantByBlockId, ownerBlockId, runsByOwnerId };
}
