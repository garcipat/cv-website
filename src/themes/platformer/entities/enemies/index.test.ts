import { ENEMY_TYPES, typeOf } from './index';
import { toEnemyState } from '../Enemy';
import { RENDER_SCALE } from '../../level/Terrain';
import { SLIME_GREEN_SHEET, SLIME_PURPLE_SHEET } from '../sprites/sheets';
import type { EnemyPlacement } from '../../level/EnemyMapper';

describe('ENEMY_TYPES', () => {
  // These are the exact values the parallel Record lookups held before this
  // refactor. Asserting them explicitly is what makes this a pure data move
  // with no behavior risk.
  it('slimeGreen-matchesItsPreRefactorConstants', () => {
    expect(ENEMY_TYPES.slimeGreen).toMatchObject({
      maxHitPoints: 1,
      patrolSpeedMultiplier: 1,
      hitboxPaddingNative: { side: 5, top: 9 },
      heldItem: null,
    });
    expect(ENEMY_TYPES.slimeGreen.sprite.sheet).toBe(SLIME_GREEN_SHEET);
    expect(ENEMY_TYPES.slimeGreen.sprite.renderScale).toBe(1);
  });

  it('slimePurple-matchesItsPreRefactorConstants', () => {
    expect(ENEMY_TYPES.slimePurple).toMatchObject({
      maxHitPoints: 3,
      patrolSpeedMultiplier: 0.7,
      hitboxPaddingNative: { side: 5, top: 9 },
      heldItem: 'key',
    });
    expect(ENEMY_TYPES.slimePurple.sprite.sheet).toBe(SLIME_PURPLE_SHEET);
    expect(ENEMY_TYPES.slimePurple.sprite.renderScale).toBe(2);
  });

  it('everyEntry-declaresItsOwnKey', () => {
    // Guards the dispatcher's cast: typeOf indexes ENEMY_TYPES by the state's
    // `type`, which is sound only while each module's key matches its slot.
    for (const [key, type] of Object.entries(ENEMY_TYPES)) {
      expect(type.key).toBe(key);
    }
  });

  it('everyEntry-declaresWalkAndHitAnimations', () => {
    for (const type of Object.values(ENEMY_TYPES)) {
      expect(type.sprite.animations.walk.frames).toEqual([3, 4, 5, 6, 7]);
      expect(type.sprite.animations.hit.frames).toEqual([8, 9, 10, 11]);
    }
  });
});

describe('typeOf', () => {
  it('purpleSlimeState-returnsThePurpleModule', () => {
    const placement: EnemyPlacement = { id: 'e', type: 'slimePurple', x: 0, y: 0 };
    expect(typeOf(toEnemyState(placement)).key).toBe('slimePurple');
  });
});

describe('enemy geometry from the registry', () => {
  it('purpleSlime-rendersAtTwiceGreensSize', () => {
    expect(ENEMY_TYPES.slimePurple.sprite.renderScale).toBe(
      2 * ENEMY_TYPES.slimeGreen.sprite.renderScale,
    );
  });

  it('hitboxPadding-scalesWithRenderScaleAndRenderScaleConstant', () => {
    const purple = ENEMY_TYPES.slimePurple;
    expect(purple.hitboxPaddingNative.side * RENDER_SCALE * purple.sprite.renderScale).toBe(20);
    expect(purple.hitboxPaddingNative.top * RENDER_SCALE * purple.sprite.renderScale).toBe(36);
  });
});
