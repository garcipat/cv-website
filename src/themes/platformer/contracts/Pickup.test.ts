import type { Pickup, PickupGroups } from './Pickup';
import type { PickupKind } from './PickupKind';

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
