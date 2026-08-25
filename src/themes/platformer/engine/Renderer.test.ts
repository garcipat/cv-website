import { drawTerrain } from './Renderer';
import type { LevelDef } from '../level/LevelData';

function makeMockContext() {
  return {
    imageSmoothingEnabled: true,
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const fakeTileset = {} as HTMLImageElement;

describe('drawTerrain', () => {
  it('groundGrassTopExposed-draws-fromGrassTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
  });

  it('groundGrassNotExposed-draws-fromGrassFillSource', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 0, 16, 16, 16, 0, 32, 32, 32);
  });

  it('groundRockTopExposed-draws-fromRockTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundRock']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 16, 0, 16, 16, 0, 0, 32, 32);
  });

  it('wallTile-draws-fromStoneBlockSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 0, 16, 16, 0, 0, 32, 32);
  });

  it('bridgeTile-draws-fromLowestChainLinkSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['bridge']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 144, 32, 16, 16, 0, 0, 32, 32);
  });

  it('platformTile-draws-fromGrassTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['platform']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
  });

  it('emptyTile-doesNotDraw', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('multiTileLevel-draws-atCorrectPixelPositions', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['groundGrass', 'wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 128, 0, 16, 16, 32, 0, 32, 32);
  });

  it('draws-setsImageSmoothingEnabledFalse', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});
