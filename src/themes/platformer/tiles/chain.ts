import {
  RENDER_SCALE,
  RENDERED_TILE_SIZE,
  chainAttachment,
  chainRunLength,
  tileAt,
} from '../level/Terrain';
import type { ChainAttachment } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { isClimbableTile, isSolidTile } from './registry';
import type { ChainPieceRect } from './spriteRects';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `chain` — a purely visual ladder skin (`I`) that climbs exactly like
 * `ladder`. Climbable; fogged; drawn in the terrain band. Owns the chain piece
 * tables + whole-run compositing relocated from `engine/StaticObjectsCatalog.ts`
 * and `engine/Renderer.ts` (US4/T029).
 */

/**
 * Four sprite families (one per `ChainAttachment`), each with a "cap" piece
 * (rounded/closed end, used alone when a shaft is exactly 1 tile, or as the
 * literal bottom of a longer one — the wall-hugging families' hook shape only
 * makes sense at a shaft's point of attachment, so the SAME cap serves both
 * roles) and a "continues" piece (used at the top of a shaft when more chain
 * follows below it, connecting into `CHAIN_MIDDLE`/`CHAIN_BOTTOM`).
 * `left`/`right`'s pieces are 7px wide (not 5, like `ceiling`/`floating`) — the
 * extra width is a horizontal bar baked into the art itself that reads as
 * "hooks onto the wall beside it", so `chainRunPieces`'s caller draws them flush
 * against that side of the tile rather than centered.
 */
const CHAIN_CAP: Record<ChainAttachment, ChainPieceRect> = {
  ceiling: { sx: 91, sy: 101, width: 5, height: 13 },
  left: { sx: 99, sy: 102, width: 7, height: 12 },
  right: { sx: 110, sy: 102, width: 7, height: 12 },
  floating: { sx: 119, sy: 102, width: 5, height: 12 },
};
const CHAIN_CONTINUES: Record<ChainAttachment, ChainPieceRect> = {
  ceiling: { sx: 91, sy: 120, width: 5, height: 16 },
  left: { sx: 99, sy: 121, width: 7, height: 15 },
  right: { sx: 110, sy: 121, width: 7, height: 15 },
  floating: { sx: 119, sy: 121, width: 5, height: 15 },
};

/** Plain, hookless, seamlessly-tileable-on-both-ends middle segment — reused
 *  for every attachment, since only a shaft's top cell needs to show which wall
 *  (if any) it's connected to. Repeated as many times as fit in the space
 *  between the top and bottom pieces. */
const CHAIN_MIDDLE: ChainPieceRect = { sx: 128, sy: 118, width: 5, height: 18 };

/** Plain, hookless bottom cap for a shaft LONGER than 1 tile — cut mid-body at
 *  its own top (so it connects seamlessly under `CHAIN_MIDDLE` or any
 *  attachment's `CHAIN_CONTINUES` piece) with a proper rounded terminator at the
 *  bottom. Distinct from `CHAIN_CAP`: that family's hook shapes are only
 *  meaningful where a shaft actually touches its wall (the top), so a long
 *  shaft's bottom always uses this plain cap regardless of attachment. */
const CHAIN_BOTTOM: ChainPieceRect = { sx: 137, sy: 118, width: 5, height: 15 };

/**
 * Composes the full vertical sequence of sprites for a chain shaft's TOP cell
 * to draw (only the top cell of a run draws anything). A 1-tile shaft is just
 * its attachment's cap. A longer one stacks: the attachment's "continues"
 * piece, then as many `CHAIN_MIDDLE` pieces as fit in the remaining
 * native-pixel budget (`runLength * 16`), then `CHAIN_BOTTOM` — deliberately
 * capped rather than exact, since these pieces' heights don't divide evenly
 * into `16 * runLength`; better to stop a few pixels short than overflow into
 * whatever tile is below the shaft (tiles draw top-to-bottom, so an overflow
 * would just get silently painted over anyway, never visible — this is about
 * not relying on that, and choosing the shortfall deliberately instead).
 */
export function chainRunPieces(attachment: ChainAttachment, runLength: number): ChainPieceRect[] {
  if (runLength <= 1) return [CHAIN_CAP[attachment]];

  const pieces: ChainPieceRect[] = [CHAIN_CONTINUES[attachment]];
  let usedHeight = CHAIN_CONTINUES[attachment].height;
  const nativeBudget = runLength * 16;

  while (usedHeight + CHAIN_MIDDLE.height + CHAIN_BOTTOM.height <= nativeBudget) {
    pieces.push(CHAIN_MIDDLE);
    usedHeight += CHAIN_MIDDLE.height;
  }
  pieces.push(CHAIN_BOTTOM);
  return pieces;
}

/** Native-pixel offset used two ways for a wall-hugging chain shaft
 *  (left/right attachment): vertically, its TOP piece starts this far below the
 *  cell's own top (its hook art has no top-side neck margin the way
 *  ceiling/floating pieces do, so without this it reads as sitting higher than a
 *  ceiling-attached shaft's top at the same row); horizontally, every piece
 *  BELOW the top one is offset this far in from the wall tile beside it, instead
 *  of flush against it — deliberately leaving room to draw a small connector
 *  piece bridging the seam later. Never applied to the top piece's own
 *  horizontal position (its art already has that gap baked in — that's what
 *  makes the hook read as "attached to the wall"), and never applied at all to
 *  ceiling/floating shafts, which have no wall edge.
 *
 * A function rather than a top-level const on purpose: this module sits on the
 * accepted `level/ ↔ tiles/` cycle, so reading `RENDER_SCALE` at module-eval
 * would be a TDZ error. */
function chainWallGap(): number {
  return 2 * RENDER_SCALE;
}

/**
 * Horizontal destination for one chain piece within its cell. `left`/`right`
 * pieces are 7px (not 5) wide — the extra width is a connector bar baked into
 * the art — and only the run's TOP piece draws flush against its wall
 * (`isTopPiece`): its own art already has the wall gap baked in. Every piece
 * below it is a plain, symmetric shape with no such gap built in, so
 * `chainWallGap` is added there instead. Ceiling/floating pieces are always
 * centered, having no wall to hug at all.
 */
function chainPieceDestX(
  attachment: ChainAttachment,
  isTopPiece: boolean,
  destX: number,
  renderedWidth: number,
): number {
  if (attachment === 'left') return destX + (isTopPiece ? 0 : chainWallGap());
  if (attachment === 'right') {
    return destX + RENDERED_TILE_SIZE - renderedWidth - (isTopPiece ? 0 : chainWallGap());
  }
  return destX + (RENDERED_TILE_SIZE - renderedWidth) / 2;
}

/**
 * The shared ladder-shaft-top rule — identical to `ladder`/`ropeLadder`, since
 * a chain climbs exactly the same way (see `tiles/ladder.ts`'s doc comment).
 */
function standableAt(level: LevelDef, col: number, row: number): boolean {
  const above = tileAt(level, col, row - 1);
  return isClimbableTile(tileAt(level, col, row)) && !isClimbableTile(above) && !isSolidTile(above);
}

/**
 * Only a run's TOP cell draws anything — every cell below it is part of the
 * same composited shaft and is skipped here (drawn already, from the top). Chain
 * pieces don't fit the 16px tile grid, so a chain shaft is composited as one
 * continuous stack of native-sized pieces rather than one sprite per cell.
 */
function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images } = rc;
  const staticObjects = images.staticObjects;
  if (!staticObjects) return;
  if (tileAt(level, col, row - 1) === 'chain') return;

  const attachment = chainAttachment(level, col, row);
  const runLength = chainRunLength(level, col, row);
  const pieces = chainRunPieces(attachment, runLength);
  const capY = destY + runLength * RENDERED_TILE_SIZE;
  const isWallAttached = attachment === 'left' || attachment === 'right';
  let drawY = isWallAttached ? destY + chainWallGap() : destY;
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index];
    const renderedWidth = piece.width * RENDER_SCALE;
    const renderedHeight = piece.height * RENDER_SCALE;
    const drawHeight = Math.min(renderedHeight, capY - drawY);
    if (drawHeight <= 0) break;
    const pieceDestX = chainPieceDestX(attachment, index === 0, destX, renderedWidth);
    ctx.drawImage(
      staticObjects, piece.sx, piece.sy, piece.width, drawHeight / RENDER_SCALE,
      pieceDestX, drawY, renderedWidth, drawHeight,
    );
    drawY += drawHeight;
  }
}

export const chainModule = {
  char: 'I',
  fogExempt: false,
  climbable: true,
  drawBand: 'terrain',
  standableAt,
  draw,
} as const satisfies TileModule;
