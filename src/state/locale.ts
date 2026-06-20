import { computed, effect } from '@preact/signals-react';
import { createLocalStorageSignal } from '@/lib/utils';
import cvEn from '@/data/cv.en.json';
import cvDe from '@/data/cv.de.json';
import { en, de, type Translation } from '@/i18n/translations';
import type { CVData } from '@/types/cv';

export type Locale = 'en' | 'de';
export const supportedLocales: Locale[] = ['en', 'de'];

export function getBrowserLocale(): Locale {
  try {
    const primary = navigator.language.split('-')[0].toLowerCase();
    return supportedLocales.find((l) => l === primary) ?? 'en';
  } catch { return 'en'; }
}

export const currentLocale = createLocalStorageSignal<Locale>('locale', getBrowserLocale());

if (!supportedLocales.includes(currentLocale.value)) {
  currentLocale.value = getBrowserLocale();
}

export const currentCV = computed(() => {
  const all: Record<Locale, CVData> = { en: cvEn as CVData, de: cvDe as CVData };
  return all[currentLocale.value];
});

export const currentUI = computed(() => {
  const all: Record<Locale, Translation> = { en, de };
  return all[currentLocale.value];
});

effect(() => {
  const ui = currentUI.value;
  document.documentElement.lang = currentLocale.value;
  document.title = ui.page.title;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    const el = document.createElement('meta');
    el.setAttribute('name', 'description');
    document.head.appendChild(el);
    meta = el;
  }
  meta.setAttribute('content', ui.page.description);
});

export function changeLocale(locale: Locale): void {
  if (supportedLocales.includes(locale)) currentLocale.value = locale;
}
