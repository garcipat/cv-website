import type { BlockState } from '../Block';
import type { BlockType } from './BlockType';
import type { PotFiller, PotRenderPlan, PotRun, PotRunMember } from './potTypes';
import { BLOCK_TYPES } from './index';
import { fillerVariantAt } from './clayVariants';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';

/**
 * Computes, fresh from the CURRENT live block list, how every still-live pot
 * tile renders this frame: which adjacent tiles form a merged bunch (a run),
 * which need a clay filler on the seam between them, and which run member is
 * the owner that actually draws.
 *
 * Kind-agnostic by design: a block is a pot member iff its registry entry
 * declares a `pot` descriptor, so adding a kind is one `BLOCK_TYPES` entry
 * and needs no edit here (FR-003/FR-004). The optional `registry` parameter
 * exists purely so a test can register a test-only kind without mutating the
 * global registry (SC-005); production callers use the default.
 *
 * Recomputed every frame directly from `blocks` (never cached across ticks):
 * a block already hit (`isBlockUsedUp`) no longer counts as part of any run,
 * even before its bump animation finishes and it is actually removed from the
 * world — so destroying one tile immediately re-forms its former neighbours'
 * bunches on the very next frame (FR-010, SC-004).
 */
export function computePotRenderPlan(
  blocks: readonly BlockState[],
  registry: Record<string, BlockType> = BLOCK_TYPES,
): PotRenderPlan {
  const ownerBlockId = new Map<string, string>();
  const runsByOwnerId = new Map<string, PotRun>();

  const live: PotRunMember[] = [];
  for (const block of blocks) {
    const type = registry[block.blockKind];
    if (!type || type.pot === undefined) continue;
    // Mirrors `isBlockUsedUp`, but reads the SUPPLIED registry's `maxHits`
    // so a test-only kind registered only through `registry` is handled too
    // (the global helper would not know that kind).
    if (block.hitsTaken < type.maxHits) live.push({ block, kind: type.pot });
  }

  const byRow = new Map<number, PotRunMember[]>();
  for (const member of live) {
    const row = Math.round(member.block.y / RENDERED_TILE_SIZE);
    const rowMembers = byRow.get(row);
    if (rowMembers) rowMembers.push(member);
    else byRow.set(row, [member]);
  }

  for (const rowMembers of byRow.values()) {
    rowMembers.sort((a, b) => a.block.x - b.block.x);

    let runStart = 0;
    for (let i = 1; i <= rowMembers.length; i++) {
      const prevCol = Math.round(rowMembers[i - 1].block.x / RENDERED_TILE_SIZE);
      const curCol =
        i < rowMembers.length ? Math.round(rowMembers[i].block.x / RENDERED_TILE_SIZE) : undefined;
      const contiguous = curCol !== undefined && curCol === prevCol + 1;
      if (contiguous) continue;

      const run = rowMembers.slice(runStart, i);
      runStart = i;

      const owner = run[0].block.id;
      for (const member of run) ownerBlockId.set(member.block.id, owner);

      const fillers: PotFiller[] = [];
      for (let k = 0; k < run.length - 1; k++) {
        const left = run[k].block;
        fillers.push({
          x: left.x + RENDERED_TILE_SIZE / 2,
          y: left.y,
          variantIndex: fillerVariantAt(
            Math.round(left.x / RENDERED_TILE_SIZE),
            Math.round(left.y / RENDERED_TILE_SIZE),
          ),
        });
      }

      runsByOwnerId.set(owner, { blocks: run, fillers });
    }
  }

  return { ownerBlockId, runsByOwnerId };
}
