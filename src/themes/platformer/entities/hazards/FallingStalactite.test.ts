import { describe, it, expect, vi } from 'vitest';
import { fallingStalactite } from './FallingStalactite';
import type { HazardPlacement } from '../../level/HazardMapper';
import { isStalactiteTwin, stalactiteEntry, TWIN_LEFT_RECT, TWIN_RIGHT_RECT } from '../../engine/StaticObjectsCatalog';
import { DECORATIONS_SHEET } from '../sprites/sheets';
import { RENDER_SCALE, RENDERED_TILE_SIZE, TILE_SIZE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';
import type { DrawContext } from '../../engine/DrawContext';
import type { PlayerState } from '../Player';

function findCell(twin: boolean, parity?: 0 | 1): { col: number; row: number } {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 60; col++) {
      if (parity !== undefined && col % 2 !== parity) continue;
      if (isStalactiteTwin(col, row) === twin) return { col, row };
    }
  }
  throw new Error(`no cell found for twin=${twin} parity=${parity}`);
}

function hazard(overrides: Partial<HazardPlacement> = {}): HazardPlacement {
  return {
    id: 'h',
    hazardType: 'fallingStalactite',
    facing: 'down',
    x: 100,
    y: 50,
    col: 0,
    row: 0,
    ...overrides,
  };
}

const PLAYER = {} as PlayerState;
const HITBOX = { x: 0, y: 0, width: 0, height: 0 };

describe('fallingStalactite hazard type', () => {
  it('key-isFallingStalactiteAndDamageIsHalfAHeart', () => {
    expect(fallingStalactite.key).toBe('fallingStalactite');
    expect(fallingStalactite.damage).toBe(SIDE_HIT_DAMAGE);
    expect(fallingStalactite.lethal).toBeUndefined();
  });

  it('isContact-isTrueOnlyWhileFalling', () => {
    expect(fallingStalactite.isContact!(hazard({ fallingStalactitePhase: 'falling' }), PLAYER, HITBOX)).toBe(true);
    expect(fallingStalactite.isContact!(hazard({ fallingStalactitePhase: 'shaking' }), PLAYER, HITBOX)).toBe(false);
    expect(fallingStalactite.isContact!(hazard({ fallingStalactitePhase: 'gone' }), PLAYER, HITBOX)).toBe(false);
    expect(fallingStalactite.isContact!(hazard({}), PLAYER, HITBOX)).toBe(false);
  });
});

describe('fallingStalactite.box', () => {
  it('largeVariant-isAWholeTileWideAtItsOwnRectHeight', () => {
    const cell = findCell(false);
    const box = fallingStalactite.box(hazard({ col: cell.col, row: cell.row }));
    const entry = stalactiteEntry(cell.col, cell.row);
    expect(box).toEqual({
      x: 100,
      y: 50,
      width: entry.width! * RENDER_SCALE,
      height: entry.height! * RENDER_SCALE,
    });
  });

  it('twinEvenColumn-usesTheLeftLargerHalfOffsetAtZero', () => {
    const cell = findCell(true, 0);
    const box = fallingStalactite.box(hazard({ col: cell.col, row: cell.row }));
    expect(box).toEqual({
      x: 100,
      y: 50,
      width: TWIN_LEFT_RECT.width * RENDER_SCALE,
      height: TWIN_LEFT_RECT.height * RENDER_SCALE,
    });
  });

  it('twinOddColumn-usesTheRightSmallerHalfOffsetToTheRightHalf', () => {
    const cell = findCell(true, 1);
    const box = fallingStalactite.box(hazard({ col: cell.col, row: cell.row }));
    expect(box).toEqual({
      x: 100 + TWIN_RIGHT_RECT.sx * RENDER_SCALE,
      y: 50,
      width: TWIN_RIGHT_RECT.width * RENDER_SCALE,
      height: TWIN_RIGHT_RECT.height * RENDER_SCALE,
    });
  });

  it('appliesTheFallOffsetAndShakeOffset', () => {
    const cell = findCell(false);
    const box = fallingStalactite.box(
      hazard({ col: cell.col, row: cell.row, fallingStalactiteOffsetY: 12, fallingStalactiteShakeOffsetX: 3 }),
    );
    expect(box.y).toBe(62);
    expect(box.x).toBe(103);
  });
});

function makeDrawContext() {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const ctx = {
    drawImage,
    fillRect,
    imageSmoothingEnabled: true,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
  const image = { tag: 'decorations' } as unknown as HTMLImageElement;
  const dc: DrawContext = {
    ctx,
    sprites: { [DECORATIONS_SHEET.src]: image },
    originX: 10,
    originY: 20,
    worldElapsed: 0,
  };
  return { ctx, dc, image, drawImage, fillRect };
}

describe('fallingStalactite.draw — camouflage (US2)', () => {
  it('largeVariant-untintedBlitReproducesTheDecorationAtTheCell', () => {
    const cell = findCell(false);
    const { dc, image, drawImage, fillRect } = makeDrawContext();
    fallingStalactite.draw(hazard({ col: cell.col, row: cell.row, fallingStalactitePhase: 'hanging' }), dc);
    const entry = stalactiteEntry(cell.col, cell.row);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledWith(
      image,
      entry.sx,
      entry.sy,
      entry.width ?? TILE_SIZE,
      entry.height ?? TILE_SIZE,
      100 + 10,
      50 + 20,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
    // No tint is ever applied in game.
    expect(fillRect).not.toHaveBeenCalled();
    expect(dc.ctx.globalAlpha).toBe(1);
  });

  it('twinVariant-drawsBothHalvesSoTheHangingArtMatchesTheDecoration', () => {
    const cell = findCell(true, 0);
    const { dc, image, drawImage } = makeDrawContext();
    fallingStalactite.draw(hazard({ col: cell.col, row: cell.row, fallingStalactitePhase: 'hanging' }), dc);
    // Selected (left) half + survivor (right) half.
    expect(drawImage).toHaveBeenCalledWith(
      image,
      TWIN_LEFT_RECT.sx,
      TWIN_LEFT_RECT.sy,
      TWIN_LEFT_RECT.width,
      TWIN_LEFT_RECT.height,
      100 + 10,
      50 + 20,
      TWIN_LEFT_RECT.width * RENDER_SCALE,
      TWIN_LEFT_RECT.height * RENDER_SCALE,
    );
    expect(drawImage).toHaveBeenCalledWith(
      image,
      TWIN_RIGHT_RECT.sx,
      TWIN_RIGHT_RECT.sy,
      TWIN_RIGHT_RECT.width,
      TWIN_RIGHT_RECT.height,
      100 + TWIN_RIGHT_RECT.sx * RENDER_SCALE + 10,
      50 + 20,
      TWIN_RIGHT_RECT.width * RENDER_SCALE,
      TWIN_RIGHT_RECT.height * RENDER_SCALE,
    );
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it('shakeOffsetsTheSelectedHalfHorizontallyOnly', () => {
    const cell = findCell(true, 0);
    const { dc, drawImage } = makeDrawContext();
    fallingStalactite.draw(
      hazard({ col: cell.col, row: cell.row, fallingStalactitePhase: 'shaking', fallingStalactiteShakeOffsetX: 4 }),
      dc,
    );
    // The selected (left) half is shifted by the shake; the survivor is not.
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      TWIN_LEFT_RECT.sx,
      TWIN_LEFT_RECT.sy,
      TWIN_LEFT_RECT.width,
      TWIN_LEFT_RECT.height,
      100 + 4 + 10,
      50 + 20,
      TWIN_LEFT_RECT.width * RENDER_SCALE,
      TWIN_LEFT_RECT.height * RENDER_SCALE,
    );
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      TWIN_RIGHT_RECT.sx,
      TWIN_RIGHT_RECT.sy,
      TWIN_RIGHT_RECT.width,
      TWIN_RIGHT_RECT.height,
      100 + TWIN_RIGHT_RECT.sx * RENDER_SCALE + 10,
      50 + 20,
      TWIN_RIGHT_RECT.width * RENDER_SCALE,
      TWIN_RIGHT_RECT.height * RENDER_SCALE,
    );
  });

  it('goneLargeVariant-drawsNothing', () => {
    const cell = findCell(false);
    const { dc, drawImage } = makeDrawContext();
    fallingStalactite.draw(hazard({ col: cell.col, row: cell.row, fallingStalactitePhase: 'gone' }), dc);
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('goneTwinVariant-stillDrawsTheSurvivingHalf', () => {
    const cell = findCell(true, 0);
    const { dc, drawImage } = makeDrawContext();
    fallingStalactite.draw(hazard({ col: cell.col, row: cell.row, fallingStalactitePhase: 'gone' }), dc);
    // Only the survivor (right) remains.
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      TWIN_RIGHT_RECT.sx,
      TWIN_RIGHT_RECT.sy,
      TWIN_RIGHT_RECT.width,
      TWIN_RIGHT_RECT.height,
      100 + TWIN_RIGHT_RECT.sx * RENDER_SCALE + 10,
      50 + 20,
      TWIN_RIGHT_RECT.width * RENDER_SCALE,
      TWIN_RIGHT_RECT.height * RENDER_SCALE,
    );
  });

  it('missingSheetImage-isANoOp', () => {
    const drawImage = vi.fn();
    const dc: DrawContext = {
      ctx: { drawImage, imageSmoothingEnabled: true } as unknown as CanvasRenderingContext2D,
      sprites: {},
      originX: 0,
      originY: 0,
      worldElapsed: 0,
    };
    expect(() => fallingStalactite.draw(hazard({ fallingStalactitePhase: 'hanging' }), dc)).not.toThrow();
    expect(drawImage).not.toHaveBeenCalled();
  });
});
