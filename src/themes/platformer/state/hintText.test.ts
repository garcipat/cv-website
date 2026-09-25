import { afterEach, describe, expect, it } from 'vitest';
import { hintText } from './hintText';
import { changeLocale } from '@/state/locale';
import { de, en } from '@/i18n/translations';

describe('hintText', () => {
  afterEach(() => {
    changeLocale('en');
  });

  it('mirrorsTheCurrentUIsHintStrings', () => {
    expect(hintText.value.bridgeDropThrough).toBe(en.platformer.hints.bridgeDropThrough);
    expect(hintText.value.noBombs).toBe(en.platformer.hints.noBombs);
  });

  it('reEvaluatesWhenTheLocaleChanges', () => {
    const before = hintText.value.bridgeDropThrough;

    changeLocale('de');

    expect(hintText.value.bridgeDropThrough).toBe(de.platformer.hints.bridgeDropThrough);
    expect(hintText.value.bridgeDropThrough).not.toBe(before);
  });
});
