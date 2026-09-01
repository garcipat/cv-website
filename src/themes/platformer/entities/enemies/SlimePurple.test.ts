import { ENEMY_TYPES } from './index';
import { slimePurple, SPIKE_COOLDOWN_DURATION_SECONDS } from './SlimePurple';
import type { SlimePurpleState } from './SlimePurple';
import type { EnemyPlacement } from '../../level/EnemyMapper';

function makePurpleEnemy(overrides: Partial<SlimePurpleState> = {}): SlimePurpleState {
  const placement: EnemyPlacement = { id: 'p1', type: 'slimePurple', x: 5, y: 0 };
  return { ...slimePurple.create(placement, 0), ...overrides };
}

describe('greenSlimeState-hasNoSpikeFields', () => {
  it('greenSlimeState-hasNoSpikeFields', () => {
    // The mechanic is purple's alone. If spiked ever reappears on the shared
    // base, this stops compiling.
    const green = ENEMY_TYPES.slimeGreen.create({ id: 'g', type: 'slimeGreen', x: 0, y: 0 }, 0);
    expect('spiked' in green).toBe(false);
  });
});

describe('slimePurple.create/revive spike defaults', () => {
  it('create-anyPlacement-startsNotSpiked', () => {
    const state = slimePurple.create({ id: 'e1', type: 'slimePurple', x: 0, y: 0 }, 0);
    expect(state.spiked).toBe(false);
    expect(state.spikeTimer).toBe(0);
  });

  it('revive-currentlySpiked-clearsSpiked', () => {
    const spiked = makePurpleEnemy({ spiked: true, spikeTimer: 0.9 });
    const revived = slimePurple.revive(spiked);
    expect(revived.spiked).toBe(false);
    expect(revived.spikeTimer).toBe(0);
  });
});

describe('slimePurple.onTick', () => {
  it('onTick-notSpiked-isNoOp', () => {
    const enemy = makePurpleEnemy({ spiked: false, spikeTimer: 0 });
    const next = slimePurple.onTick!(enemy, 1);
    expect(next).toBe(enemy);
  });

  it('onTick-spikedBelowDuration-accumulatesTimer', () => {
    const enemy = makePurpleEnemy({ spiked: true, spikeTimer: 0 });
    const next = slimePurple.onTick!(enemy, 0.5);
    expect(next.spiked).toBe(true);
    expect(next.spikeTimer).toBe(0.5);
  });

  it('onTick-reachesDuration-clearsSpiked', () => {
    const enemy = makePurpleEnemy({ spiked: true, spikeTimer: SPIKE_COOLDOWN_DURATION_SECONDS - 0.1 });
    const next = slimePurple.onTick!(enemy, 0.2);
    expect(next.spiked).toBe(false);
    expect(next.spikeTimer).toBe(0);
  });
});
