import { describe, expect, it } from 'vitest';
import { EFFECT_REGISTRY, effectEntry, effectKeyOf, type EffectKind } from './effectRegistry';
import { startPuffEffect } from './puff';
import { startCounterPopup } from './counterPopup';
import { startSpeechBubble } from './speechBubble';

describe('EFFECT_REGISTRY', () => {
  it('declaresExactlyTheNineShippedKindsWithSpeechBubbleFirst', () => {
    expect(EFFECT_REGISTRY.map((entry) => entry.kind)).toEqual([
      'speechBubble',
      'flyingText',
      'counterPopup',
      'puff',
      'healAura',
      'debris',
      'hitSplatter',
      'fadeOutText',
      'explosion',
    ]);
  });

  it('neverDeclaresAMushroomSquashKind', () => {
    expect(EFFECT_REGISTRY.map((entry) => entry.kind)).not.toContain('mushroomSquash');
  });

  it('assignsEachKindItsLayerAndResetScopeFromTheDataModel', () => {
    const byKind = Object.fromEntries(EFFECT_REGISTRY.map((entry) => [entry.kind, entry]));
    expect(byKind.speechBubble).toMatchObject({ layer: 'worldEffects', resetScope: 'death' });
    expect(byKind.flyingText).toMatchObject({ layer: 'worldEffects', resetScope: 'progress' });
    expect(byKind.counterPopup).toMatchObject({ layer: 'hudLast', resetScope: 'progress' });
    expect(byKind.puff).toMatchObject({ layer: 'worldEffects', resetScope: 'progress' });
    expect(byKind.healAura).toMatchObject({ layer: 'midWorld', resetScope: 'progress' });
    expect(byKind.debris).toMatchObject({ layer: 'worldEffects', resetScope: 'progress' });
    expect(byKind.hitSplatter).toMatchObject({ layer: 'worldEffects', resetScope: 'progress' });
    expect(byKind.fadeOutText).toMatchObject({ layer: 'worldEffects', resetScope: 'death' });
    expect(byKind.explosion).toMatchObject({ layer: 'aboveWorld', resetScope: 'progress' });
  });

  it('declaresAKeyedSlotOnlyOnCounterPopupAndSpeechBubble', () => {
    for (const entry of EFFECT_REGISTRY) {
      if (entry.kind === 'counterPopup' || entry.kind === 'speechBubble') {
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

  it('effectKeyOf-speechBubbleReturnsItsConstantSingletonKey', () => {
    expect(effectKeyOf(startSpeechBubble('noBombs', 'I have no bombs.'))).toBe('speechBubble');
  });

  it('effectKeyOf-appendOnlyKindReturnsUndefined', () => {
    expect(effectKeyOf(startPuffEffect('p', 0, 0))).toBeUndefined();
  });
});
