import { takeHit } from './shared';
import { ENEMY_TYPES } from './index';
import type { EnemyPlacement } from '../../level/EnemyMapper';

function makeGreenPlacement(): EnemyPlacement {
  return { id: 'enemy-cert-x', type: 'slimeGreen', x: 320, y: 96 };
}

describe('takeHit', () => {
  it('anyEnemy-entersHitStateAtFrameZeroAndFreezesMovement', () => {
    const state = { ...ENEMY_TYPES.slimeGreen.create(makeGreenPlacement(), 0), vx: 60, direction: 'right' as const };
    const next = takeHit(state);
    expect(next.animState).toBe('hit');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
    expect(next.hitTimer).toBe(0);
    expect(next.vx).toBe(0);
  });

  it('enemyAlreadyMidHitReactionFromAnEarlierStomp-resetsAnimationAgain', () => {
    // takeHit itself never refuses a second call (see its doc comment) —
    // calling it again mid-reaction must replay from frame 0, not continue
    // wherever the first stomp's animation had gotten to. The type module's
    // own `onPlayerCollide` (via `isStunned`) is what actually prevents this
    // from happening via real player input while mid-reaction — this test
    // exercises the function directly, bypassing that gate.
    const placement: EnemyPlacement = { id: 'enemy-cert-x', type: 'slimePurple', x: 320, y: 96 };
    const state = {
      ...ENEMY_TYPES.slimePurple.create(placement, 0),
      hitPoints: 2,
      animState: 'hit' as const,
      animFrame: 3,
      animTimer: 0.05,
      hitTimer: 0.2,
    };
    const next = takeHit(state);
    expect(next.hitPoints).toBe(1);
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
    expect(next.hitTimer).toBe(0);
  });
});
