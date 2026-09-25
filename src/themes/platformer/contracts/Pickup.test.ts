import type {
  Pickup,
  PickupCollisionContext,
  PickupContext,
  PickupGroups,
  PickupOutcome,
  PickupReveal,
} from './Pickup';
import type { PickupKind } from './PickupKind';
import type { CollectedFact } from '../types';

const fact: CollectedFact = {
  id: 'f1',
  sectionId: 'skills',
  sectionLabel: 'Skills',
  data: { category: 'Test', skills: [] },
  sourceType: 'coin',
};

/**
 * Type-level contract for the shared `Pickup` base and the per-kind groups map
 * the generic dispatch functions consume. Runtime assertions here guard the
 * field set; the `satisfies` clauses make a missing/renamed field a compile
 * error.
 */
describe('Pickup contract', () => {
  it('exposes-id-x-y-kind-and-the-shared-collectedFlag', () => {
    const pickup = {
      id: 'coin-1-2',
      x: 10,
      y: 20,
      kind: 'coin',
      collected: false,
    } satisfies Pickup;

    expect(Object.keys(pickup).sort()).toEqual(['collected', 'id', 'kind', 'x', 'y']);
    expect(pickup.kind).toBe('coin');
    expect(pickup.collected).toBe(false);
  });

  it('accepts-aCollectedTrueEntry-withoutRemovingIt', () => {
    const pickup: Pickup = {
      id: 'k1',
      x: 0,
      y: 0,
      kind: 'key',
      collected: true,
    };

    expect(pickup.collected).toBe(true);
  });

  it('PickupGroups-accepts-aPartialMapOfKinds', () => {
    const coin: Pickup = { id: 'c', x: 0, y: 0, kind: 'coin', collected: false };
    const groups = { coin: [coin] } satisfies PickupGroups;

    expect(Object.keys(groups)).toEqual(['coin']);
    expect(groups.coin).toHaveLength(1);
  });

  it('PickupGroups-allows-anEmptyMap', () => {
    const groups: PickupGroups = {};
    expect(groups).toEqual({});
  });

  it('everyPickupKind-isAcceptedAsAKind', () => {
    const kinds: PickupKind[] = ['coin', 'fruit', 'key', 'heart', 'bomb'];
    for (const kind of kinds) {
      const pickup: Pickup = { id: kind, x: 0, y: 0, kind, collected: false };
      expect(pickup.kind).toBe(kind);
    }
  });
});

/**
 * Type-level contract for the collect-outcome vocabulary. The `satisfies`
 * clauses make a re-introduced `self`/`disposition`/`collectedIds` a compile
 * error, and the key-set assertions pin the runtime shape.
 */
describe('PickupOutcome contract', () => {
  it('PickupCollisionContext-carries-playerHitPointsAndOptionalCapacityOnly', () => {
    const ctx = { playerHitPoints: 4 } satisfies PickupCollisionContext;
    const withCapacity = { playerHitPoints: 4, capacity: 2 } satisfies PickupCollisionContext;

    expect(Object.keys(ctx)).toEqual(['playerHitPoints']);
    expect(Object.keys(withCapacity).sort()).toEqual(['capacity', 'playerHitPoints']);
  });

  it('PickupContext-carries-pool-total-and-collectedBefore', () => {
    const ctx = { pool: [fact], total: 3, collectedBefore: 1 } satisfies PickupContext;

    expect(Object.keys(ctx).sort()).toEqual(['collectedBefore', 'pool', 'total']);
  });

  it('PickupReveal-carries-aFact-effectId-andOptionalCounterKey', () => {
    const reveal = { fact, effectId: 'e1' } satisfies PickupReveal;
    const withCounter = { fact, effectId: 'e1', counterKey: 'fruits' } satisfies PickupReveal;

    expect(reveal.effectId).toBe('e1');
    expect(withCounter.counterKey).toBe('fruits');
  });

  it('PickupOutcome-carries-onlyConsequences', () => {
    const outcome = {
      facts: [{ fact, effectId: 'e1', counterKey: 'fruits' }],
      counterKey: 'coins',
      heal: 2,
      bombs: 1,
      bankKey: true,
      flyingText: { effectId: 'k1', label: 'Key', x: 0, y: 0, target: 'keyCounter' },
    } satisfies PickupOutcome;

    expect(Object.keys(outcome).sort()).toEqual([
      'bankKey',
      'bombs',
      'counterKey',
      'facts',
      'flyingText',
      'heal',
    ]);
    // No disposition/self vocabulary survives the unification.
    expect('disposition' in outcome).toBe(false);
    expect('self' in outcome).toBe(false);
  });

  it('PickupOutcome-accepts-anEmptyOutcome', () => {
    const outcome: PickupOutcome = {};
    expect(outcome).toEqual({});
  });
});
