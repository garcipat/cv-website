import { bombPot } from './BombPot';
import { toBlockState } from '../Block';
import type { BlockState } from '../Block';
import { PHYSICS_CONFIG } from '../../engine/PhysicsConfig';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import { computePotRenderPlan } from './potRenderPlan';
import { tileToPixel, RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { DrawContext } from '../../engine/DrawContext';

/** Row 8, column 0 of `world_tileset.png` — the blue bottle directly left of
 *  the potion pot's red bottle. */
const BOMB_POT_FRAME = 8 * 16 + 0; // 128

function blockAt(kind: string, col: number, row: number, id = `${kind}-${col}-${row}`): BlockState {
  const { x, y } = tileToPixel(col, row);
  return toBlockState({ id, blockKind: kind as BlockState['blockKind'], x, y });
}

function makeDrawContext(image: HTMLImageElement | null): {
  dc: DrawContext;
  drawImage: ReturnType<typeof vi.fn>;
} {
  const drawImage = vi.fn();
  const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
  const dc: DrawContext = {
    ctx,
    sprites: image ? { [WORLD_TILESET_SHEET.src]: image } : {},
    originX: 0,
    originY: 0,
    worldElapsed: 0,
  };
  return { dc, drawImage };
}

describe('bombPot BlockType', () => {
  it('sharedFactoryContract-fixesOneHitTopTriggerAndRemoval', () => {
    expect(bombPot.maxHits).toBe(1);
    expect(bombPot.removeWhenUsedUp).toBe(true);
    expect(bombPot.triggerSides).toEqual(['top']);
  });

  it('declaresItsOwnDropDropPolicyAndRespawnFlag', () => {
    expect(bombPot.pot).toMatchObject({
      drop: 'bomb',
      dropPolicy: 'everyBreak',
      restoredOnRespawn: true,
    });
  });

  it('drawsFromTheSharedTileset-blueBottleFrame', () => {
    expect(bombPot.sprite.sheet).toBe(WORLD_TILESET_SHEET);
    expect(frameSource(WORLD_TILESET_SHEET, bombPot.frameIndex(0))).toEqual(
      frameSource(WORLD_TILESET_SHEET, BOMB_POT_FRAME),
    );
    expect(bombPot.frameIndex(0)).toBe(128);
  });

  it('drawPot-drawsItsFixedBottleFrameNeverAClayVariant', () => {
    // FR-006: the bomb pot is never swapped for a clay size variant inside a
    // bunch — its single-pot draw always blits its own frame 128.
    const image = {} as HTMLImageElement;
    const { dc, drawImage } = makeDrawContext(image);
    const block = blockAt('bombPot', 4, 2);

    bombPot.pot!.drawPot(block, dc);

    expect(drawImage).toHaveBeenCalledTimes(1);
    const args = drawImage.mock.calls[0];
    expect(args[1]).toBe(0); // sx of frame 128
    expect(args[2]).toBe(128); // sy of frame 128
  });
});

describe('bombPot.onHit', () => {
  it('everyBreak-dropsABombAndBouncesThePlayer', () => {
    const pot = toBlockState({ id: 'b1', blockKind: 'bombPot', x: 0, y: 0 });

    const outcome = bombPot.onHit!({ ...pot, hitsTaken: 1 });

    expect(outcome).toEqual({
      spawnPickup: 'bomb',
      bounceVelocity: PHYSICS_CONFIG.potBounceVelocity,
    });
  });

  it('afterRewardGiven-stillDropsAFreshBombEveryBreak', () => {
    const pot = toBlockState({ id: 'b1', blockKind: 'bombPot', x: 0, y: 0 });

    const outcome = bombPot.onHit!({ ...pot, hitsTaken: 1, rewardGiven: true });

    expect(outcome).toEqual({
      spawnPickup: 'bomb',
      bounceVelocity: PHYSICS_CONFIG.potBounceVelocity,
    });
  });
});

describe('bombPot bunch merging', () => {
  it('adjacentToCoinAndPotionPots-mergesWithASeamFillerAndKeepsItsOwnBottleFrame', () => {
    const coin = blockAt('coinPot', 5, 2);
    const bomb = blockAt('bombPot', 6, 2);
    const potion = blockAt('potionPot', 7, 2);

    const plan = computePotRenderPlan([coin, bomb, potion]);

    const run = plan.runsByOwnerId.get(coin.id)!;
    expect(run.blocks.map((m) => m.block.id)).toEqual([coin.id, bomb.id, potion.id]);
    expect(run.blocks.map((m) => m.kind.drop)).toEqual(['coin', 'bomb', 'heart']);
    expect(run.fillers).toHaveLength(2);
    expect(run.fillers[0].x).toBe(coin.x + RENDERED_TILE_SIZE / 2);
    expect(run.fillers[1].x).toBe(bomb.x + RENDERED_TILE_SIZE / 2);
    // The bomb pot's member kind still draws its own fixed frame.
    expect(bombPot.frameIndex(0)).toBe(BOMB_POT_FRAME);
  });
});
