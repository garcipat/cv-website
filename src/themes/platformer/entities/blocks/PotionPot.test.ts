import { potionPot } from './PotionPot';
import { toBlockState } from '../Block';
import { POT_BOUNCE_VY } from './pot';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';

describe('potionPot BlockType', () => {
  it('sharedFactoryContract-fixesOneHitTopTriggerAndRemoval', () => {
    expect(potionPot.maxHits).toBe(1);
    expect(potionPot.removeWhenUsedUp).toBe(true);
    expect(potionPot.triggerSides).toEqual(['top']);
  });

  it('declaresItsOwnDropDropPolicyAndRespawnFlag', () => {
    expect(potionPot.pot).toMatchObject({
      drop: 'heart',
      dropPolicy: 'everyBreak',
      restoredOnRespawn: true,
    });
  });

  it('drawsFromTheSharedTileset-purpleBottleFrame', () => {
    // Row 8, column 1 of world_tileset.png (16px tiles, 16 columns) — see
    // this step's brainstorming for how the potion sprite was located.
    expect(frameSource(WORLD_TILESET_SHEET, potionPot.frameIndex(0))).toEqual(
      frameSource(WORLD_TILESET_SHEET, 8 * 16 + 1),
    );
  });
});

describe('potionPot.onHit', () => {
  it('anyDestruction-dropsAHeartAndBouncesThePlayer', () => {
    const pot = toBlockState({ id: 'p1', blockKind: 'potionPot', x: 0, y: 0 });

    const outcome = potionPot.onHit!({ ...pot, hitsTaken: 1 });

    expect(outcome).toEqual({
      spawnPickup: 'heart',
      effects: [{ type: 'velocity', y: POT_BOUNCE_VY, preserveJump: true }],
    });
  });

  it('afterRewardGiven-stillDropsAFreshHeartEveryBreak', () => {
    const pot = toBlockState({ id: 'p1', blockKind: 'potionPot', x: 0, y: 0 });

    const outcome = potionPot.onHit!({ ...pot, hitsTaken: 1, rewardGiven: true });

    expect(outcome).toEqual({
      spawnPickup: 'heart',
      effects: [{ type: 'velocity', y: POT_BOUNCE_VY, preserveJump: true }],
    });
  });
});
