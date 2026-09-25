import { ENEMY_TYPES, typeOf } from './index';
import { toEnemyState } from '../Enemy';
import { RENDER_SCALE } from '../../level/Terrain';
import { SLIME_GREEN_SHEET, SLIME_PURPLE_SHEET } from '../sprites/sheets';
import type { EnemyPlacement } from '../../level/EnemyMapper';
import type { DefeatApi } from '../../contracts/Outcome';
import type { PickupKind } from '../../contracts/PickupKind';
import type { CounterPopupLabelKey } from '../../contracts/counters';
import type { CollectedFact } from '../../types';

/** A CV fact usable as a green slime's `fact`/`extraFacts`. */
function courseFact(id: string): CollectedFact {
  return {
    id,
    sectionId: 'courses',
    sectionLabel: 'Course',
    data: { category: id, skills: [] },
    sourceType: 'enemy',
  };
}

describe('ENEMY_TYPES', () => {
  // These are the exact values the parallel Record lookups held before this
  // refactor. Asserting them explicitly is what makes this a pure data move
  // with no behavior risk.
  it('slimeGreen-matchesItsPreRefactorConstants', () => {
    expect(ENEMY_TYPES.slimeGreen).toMatchObject({
      maxHitPoints: 1,
      defaultAnimState: 'walk',
      hitboxPaddingNative: { side: 5, top: 9, bottom: 0 },
      heldItem: null,
    });
    expect(ENEMY_TYPES.slimeGreen.movement.kind).toBe('patrol');
    expect(ENEMY_TYPES.slimeGreen.sprite.sheet).toBe(SLIME_GREEN_SHEET);
    expect(ENEMY_TYPES.slimeGreen.sprite.renderScale).toBe(1);
  });

  it('slimePurple-matchesItsPreRefactorConstants', () => {
    expect(ENEMY_TYPES.slimePurple).toMatchObject({
      maxHitPoints: 3,
      defaultAnimState: 'walk',
      hitboxPaddingNative: { side: 5, top: 9, bottom: 0 },
      heldItem: 'key',
    });
    expect(ENEMY_TYPES.slimePurple.movement.kind).toBe('patrol');
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

  it('everyEntry-declaresAMovementAndARestingStateInItsOwnTable', () => {
    // The seam's registry contract (FR-017/SC-006): every kind owns a
    // callable movement step and a resting animation state that exists in its
    // own table. The per-kind frames themselves differ (the slimes keep
    // walk/hit; the bee flies), so this only asserts presence.
    for (const type of Object.values(ENEMY_TYPES)) {
      expect(typeof type.movement.step).toBe('function');
      expect(type.sprite.animations[type.defaultAnimState]).toBeDefined();
    }
  });

  it('slimes-keepTheirWalkAndHitAnimationTables', () => {
    for (const type of [ENEMY_TYPES.slimeGreen, ENEMY_TYPES.slimePurple]) {
      expect(type.sprite.animations.walk.frames).toEqual([3, 4, 5, 6, 7]);
      expect(type.sprite.animations.hit.frames).toEqual([8, 9, 10, 11]);
    }
  });
});

describe('heldItem declarations', () => {
  it('slimePurple-heldItem-isKey', () => {
    expect(ENEMY_TYPES.slimePurple.heldItem).toBe('key');
  });

  it('slimeGreen-heldItem-isNull', () => {
    expect(ENEMY_TYPES.slimeGreen.heldItem).toBeNull();
  });

  it('enemyTypes-areExactlyOneHeldItemCarrier-thePurpleSlime', () => {
    // The drop is declared by config, not a hardcoded type literal: exactly
    // the type carrying a heldItem is the one whose own `onDefeat` asks the
    // defeat API to spawn it — the page no longer reads `heldItem` at all.
    const typesThatCarryAHeldItem = Object.entries(ENEMY_TYPES)
      .filter(([, type]) => type.heldItem !== null)
      .map(([key]) => key);
    expect(typesThatCarryAHeldItem).toEqual(['slimePurple']);
  });
});

describe('onDefeat wiring', () => {
  function makeDefeatApi() {
    return {
      spawnPickup: vi.fn<(kind: PickupKind) => void>(),
      revealFact: vi.fn<(fact: CollectedFact, effectId: string) => void>(),
      bumpCounter: vi.fn<(key: CounterPopupLabelKey) => void>(),
    } satisfies DefeatApi;
  }

  it('slimePurple-onDefeat-spawnsItsOwnHeldKeyThroughTheDefeatApi', () => {
    const api = makeDefeatApi();
    const enemy = ENEMY_TYPES.slimePurple.create(
      { id: 'p1', type: 'slimePurple', x: 10, y: 20 },
      0,
    );

    ENEMY_TYPES.slimePurple.onDefeat!(enemy, api);

    expect(api.spawnPickup).toHaveBeenCalledTimes(1);
    expect(api.spawnPickup).toHaveBeenCalledWith('key');
    expect(api.revealFact).not.toHaveBeenCalled();
    expect(api.bumpCounter).not.toHaveBeenCalled();
  });

  it('slimeGreen-onDefeat-revealsEachFactPerFactThenBumpsTheEnemiesCounterOnce', () => {
    const api = makeDefeatApi();
    const factA = courseFact('course-a');
    const factB = courseFact('course-b');
    const enemy = ENEMY_TYPES.slimeGreen.create(
      { id: 'g1', type: 'slimeGreen', x: 0, y: 0, fact: factA, extraFacts: [factB] },
      0,
    );

    ENEMY_TYPES.slimeGreen.onDefeat!(enemy, api);

    expect(api.revealFact).toHaveBeenCalledTimes(2);
    expect(api.revealFact).toHaveBeenNthCalledWith(1, factA, 'g1-0');
    expect(api.revealFact).toHaveBeenNthCalledWith(2, factB, 'g1-1');
    // The counter bump is per-defeat, not per-fact.
    expect(api.bumpCounter).toHaveBeenCalledTimes(1);
    expect(api.bumpCounter).toHaveBeenCalledWith('enemies');
    expect(api.spawnPickup).not.toHaveBeenCalled();
  });

  it('slimeGreen-withNoFact-stillBumpsTheEnemiesCounterOnce', () => {
    // A level with more green slimes than course facts gives a slime no fact
    // to reveal — it must still count toward the enemies numerator.
    const api = makeDefeatApi();
    const enemy = ENEMY_TYPES.slimeGreen.create({ id: 'g2', type: 'slimeGreen', x: 0, y: 0 }, 0);

    ENEMY_TYPES.slimeGreen.onDefeat!(enemy, api);

    expect(api.revealFact).not.toHaveBeenCalled();
    expect(api.bumpCounter).toHaveBeenCalledTimes(1);
    expect(api.bumpCounter).toHaveBeenCalledWith('enemies');
  });

  it('bee-carriesNoOnDefeatHook', () => {
    // The bee puffs and rewards/counts nothing — it declares no consequences.
    expect(ENEMY_TYPES.bee.onDefeat).toBeUndefined();
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
