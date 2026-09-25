import { describe, expect, it } from 'vitest';
import { EFFECT_REGISTRY, effectEntry, effectKeyOf, type EffectKind } from './registry';
import { startPuffEffect } from './puff';
import { startCounterPopup } from './counterPopup';

describe('EFFECT_REGISTRY', () => {
  it('declaresExactlyTheEightShippedKinds', () => {
    expect(EFFECT_REGISTRY.map((entry) => entry.kind)).toEqual([
      'flight',
      'counterPopup',
      'puff',
      'healAura',
      'debris',
      'hitSplatter',
      'fadeOutText',
      'explosion',
    ]);
  });

  it('assignsEachKindItsLayerAndResetScopeFromTheDataModel', () => {
    const byKind = Object.fromEntries(EFFECT_REGISTRY.map((entry) => [entry.kind, entry]));
    expect(byKind.flight).toMatchObject({ layer: 'worldEffects', resetScope: 'progress' });
    expect(byKind.counterPopup).toMatchObject({ layer: 'hudLast', resetScope: 'progress' });
    expect(byKind.puff).toMatchObject({ layer: 'worldEffects', resetScope: 'progress' });
    expect(byKind.healAura).toMatchObject({ layer: 'midWorld', resetScope: 'progress' });
    expect(byKind.debris).toMatchObject({ layer: 'worldEffects', resetScope: 'progress' });
    expect(byKind.hitSplatter).toMatchObject({ layer: 'worldEffects', resetScope: 'progress' });
    expect(byKind.fadeOutText).toMatchObject({ layer: 'worldEffects', resetScope: 'death' });
    expect(byKind.explosion).toMatchObject({ layer: 'aboveWorld', resetScope: 'progress' });
  });

  it('declaresAKeyedSlotOnlyOnCounterPopup', () => {
    for (const entry of EFFECT_REGISTRY) {
      if (entry.kind === 'counterPopup') {
        expect(entry.keyOf).toBeDefined();
      } else {
        expect(entry.keyOf).toBeUndefined();
      }
    }
  });
});

describe('effectEntry / effectKeyOf', () => {
  it('effectEntry-resolvesEachDeclaredKind', () => {
    for (const entry of EFFECT_REGISTRY) {
      expect(effectEntry(entry.kind).kind).toBe(entry.kind);
    }
  });

  it('effectEntry-unknownKind-throws', () => {
    expect(() => effectEntry('notAKind' as EffectKind)).toThrow();
  });

  it('effectKeyOf-keyedKindReturnsItsLabelKey', () => {
    expect(effectKeyOf(startCounterPopup('coins', 1, 3))).toBe('coins');
  });

  it('effectKeyOf-appendOnlyKindReturnsUndefined', () => {
    expect(effectKeyOf(startPuffEffect('p', 0, 0))).toBeUndefined();
  });
});
