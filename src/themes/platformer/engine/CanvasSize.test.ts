import { describe, it, expect } from 'vitest';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { playCanvasSize, PLAY_CANVAS_COLS, PLAY_CANVAS_ROWS } from './CanvasSize';

const FULL_WIDTH = PLAY_CANVAS_COLS * RENDERED_TILE_SIZE;
const FULL_HEIGHT = PLAY_CANVAS_ROWS * RENDERED_TILE_SIZE;

describe('playCanvasSize', () => {
  it('playCanvasSize-WindowLargerThanBothCaps-ReturnsTheIntendedFormat', () => {
    expect(playCanvasSize(2560, 1440)).toEqual({ width: FULL_WIDTH, height: FULL_HEIGHT });
  });

  it('playCanvasSize-WindowNarrowerThanColumnCap-ClampsWidthToTheWindow', () => {
    expect(playCanvasSize(800, 1440)).toEqual({ width: 800, height: FULL_HEIGHT });
  });

  it('playCanvasSize-WindowShorterThanRowCap-ClampsHeightToTheWindow', () => {
    expect(playCanvasSize(2560, 600)).toEqual({ width: FULL_WIDTH, height: 600 });
  });

  it('playCanvasSize-WindowSmallerThanBothCaps-ClampsBothDimensions', () => {
    expect(playCanvasSize(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it('playCanvasSize-WindowExactlyAtTheCaps-ReturnsTheCapsUnchanged', () => {
    expect(playCanvasSize(FULL_WIDTH, FULL_HEIGHT)).toEqual({
      width: FULL_WIDTH,
      height: FULL_HEIGHT,
    });
  });

  it('PLAY_CANVAS_COLS-AgainstPLAY_CANVAS_ROWS-YieldsTheIntended1280x768Frame', () => {
    expect(FULL_WIDTH).toBe(1280);
    expect(FULL_HEIGHT).toBe(768);
  });
});
