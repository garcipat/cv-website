import type { LevelDef } from '../level/LevelData';
import { tileAt } from '../level/Terrain';
import { isClimbableTile, isSolidTile } from './registry';
import type { ChainPieceRect } from './spriteRects';
import type { TileModule } from './TileModule';

/**
 * `ropeLadder` — a deployed rope-ladder rung cell. Registry-only (never
 * author-placeable, so it declares no `char`). Climbable; fogged; rendered by
 * 's deployable-item pass, so `drawBand` is `'deployable'`. Owns the rope
 * art geometry relocated from `engine/StaticObjectsCatalog.ts`;
 * 's `entities/deployableItems/RopeLadder.ts` imports it back (an allowed
 * `entities/ → tiles/` edge) and keeps the deployment lifecycle.
 */

/**
 * The shared ladder-shaft-top rule — identical to `ladder`/`chain` (see
 * `tiles/ladder.ts`'s doc comment).
 */
function standableAt(level: LevelDef, col: number, row: number): boolean {
  const above = tileAt(level, col, row - 1);
  return isClimbableTile(tileAt(level, col, row)) && !isClimbableTile(above) && !isSolidTile(above);
}

/** The rope-ladder sheet's pieces. `ROPE_BUNDLE` is the rolled 16x16 parcel;
 * the other four are 16x8 half-tile pieces the deployed shaft stacks. */
export const ROPE_BUNDLE: ChainPieceRect = { sx: 0, sy: 0, width: 16, height: 16 };
export const ROPE_TOP_CAP: ChainPieceRect = { sx: 16, sy: 0, width: 16, height: 8 };
export const ROPE_STEP: ChainPieceRect = { sx: 16, sy: 8, width: 16, height: 8 };
export const ROPE_BOTTOM_CAP: ChainPieceRect = { sx: 16, sy: 24, width: 16, height: 8 };

/**
 * Composes the full vertical sequence of pieces for a COMPLETED deployed rope
 * ladder, given the number of rung cells BELOW the bundle cell (`shaftCellCount`).
 * The bundle cell itself is drawn as `ROPE_TOP_CAP` (its deployed top-rung
 * appearance), then two `ROPE_STEP`s per cell below, with the very last piece
 * replaced by `ROPE_BOTTOM_CAP`. A zero-length landing (`shaftCellCount === 0`)
 * is `[ROPE_TOP_CAP, ROPE_BOTTOM_CAP]` — a lone rung cell, cap over cap.
 */
export function ropeLadderShaftPieces(shaftCellCount: number): ChainPieceRect[] {
  if (shaftCellCount <= 0) return [ROPE_TOP_CAP, ROPE_BOTTOM_CAP];
  const pieces: ChainPieceRect[] = [ROPE_TOP_CAP];
  // 2n + 1 steps, so replacing the last with the bottom cap leaves exactly
  // 2n steps between the two caps — the full (n + 1)-cell shaft.
  for (let cell = 0; cell < shaftCellCount; cell++) {
    pieces.push(ROPE_STEP, ROPE_STEP);
  }
  pieces.push(ROPE_STEP);
  pieces[pieces.length - 1] = ROPE_BOTTOM_CAP;
  return pieces;
}

export const ropeLadderModule = {
  fogExempt: false,
  climbable: true,
  drawBand: 'deployable',
  standableAt,
} as const satisfies TileModule;
