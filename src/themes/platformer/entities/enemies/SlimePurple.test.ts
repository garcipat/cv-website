import { ENEMY_TYPES } from './index';
import { slimeGreen } from './SlimeGreen';
import { slimePurple, SPIKE_COOLDOWN_DURATION_SECONDS } from './SlimePurple';
import { takeHit } from './shared';
import type { SlimePurpleState } from './SlimePurple';
import type { EnemyPlacement } from '../../level/EnemyMapper';
import type { PlayerState } from '../Player';
import { PLAYER_HIT_REACTION_SECONDS } from '../Player';
import type { Contact } from '../../engine/Contact';

function makePurpleEnemy(overrides: Partial<SlimePurpleState> = {}): SlimePurpleState {
  const placement: EnemyPlacement = { id: 'p1', type: 'slimePurple', x: 5, y: 0 };
  return { ...slimePurple.create(placement, 0), ...overrides };
}

function makePlayer(): PlayerState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: false,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: 0,
    lastGroundedY: 0,
    animState: 'jump',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    hitBlockIds: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };
}

function makeTopContact(): Contact {
  return {
    side: 'top',
    playerVx: 0,
    playerVy: 200,
    playerBox: { x: 0, y: 0, width: 24, height: 38 },
    selfBox: { x: 0, y: 0, width: 96, height: 96 },
  };
}

it('greenSlimeState-hasNoSpikeFields', () => {
  // The mechanic is purple's alone: a green enemy's created state never has
  // a `spiked` property at all.
  const green = ENEMY_TYPES.slimeGreen.create({ id: 'g', type: 'slimeGreen', x: 0, y: 0 }, 0);
  expect('spiked' in green).toBe(false);
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

describe('slimePurple.onPlayerCollide top contact', () => {
  it('onPlayerCollide-topContact-appliesTheHitAndBounces', () => {
    // Deciding what the contact MEANS is all this hook does; what surviving
    // the hit costs the slime is `onDamaged`'s business.
    const enemy = makePurpleEnemy({ hitPoints: 3, spiked: false, spikeTimer: 0 });
    const outcome = slimePurple.onPlayerCollide(enemy, makePlayer(), makeTopContact());
    expect(outcome.self?.hitPoints).toBe(2);
    expect(outcome.bouncePlayer).toBe(true);
  });
});

describe('slimePurple.onDamaged', () => {
  it('survivingStomp-growsSpikesWithAResetTimer', () => {
    const enemy = { ...makePurpleEnemy(), hitPoints: 3 };
    const damaged = slimePurple.onDamaged!(takeHit(enemy), 1);
    expect(damaged.spiked).toBe(true);
    expect(damaged.spikeTimer).toBe(0);
  });

  it('killingStomp-doesNotGrowSpikes', () => {
    const enemy = { ...makePurpleEnemy(), hitPoints: 1 };
    const damaged = slimePurple.onDamaged!(takeHit(enemy), 1);
    expect(damaged.spiked).toBe(false);
  });

  it('spikesGrownByOnDamaged-retractOnceTheCooldownElapses', () => {
    // The cooldown `onTick` runs is the one `onDamaged` starts — the two
    // halves of the mechanic still meet.
    const enemy = { ...makePurpleEnemy(), hitPoints: 3 };
    const spiked = slimePurple.onDamaged!(takeHit(enemy), 1);
    const midCooldown = slimePurple.onTick!(spiked, SPIKE_COOLDOWN_DURATION_SECONDS - 0.1);
    expect(midCooldown.spiked).toBe(true);
    const retracted = slimePurple.onTick!(midCooldown, 0.1);
    expect(retracted.spiked).toBe(false);
    expect(retracted.spikeTimer).toBe(0);
  });
});

describe('green slime', () => {
  it('hasNoOnDamagedHook', () => {
    // Nothing happens to a green slime beyond the shared hit reaction, so it
    // implements no hook at all.
    expect(slimeGreen.onDamaged).toBeUndefined();
  });
});
