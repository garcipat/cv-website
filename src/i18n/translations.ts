import enJson from './locales/en.json';
import deJson from './locales/de.json';

export type Translation = typeof enJson;

export const en: Translation = enJson;
export const de: Translation = deJson;

type PathsToStringProps<T> = T extends string
  ? ''
  : T extends object
    ? {
        [K in keyof T]: K extends string
          ? T[K] extends object
            ? `${K}.${PathsToStringProps<T[K]>}`
            : `${K}`
          : never;
      }[keyof T]
    : never;

export type TranslationKey = PathsToStringProps<Translation>;

export function getTranslationValue(
  translation: Translation,
  path: TranslationKey,
): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return path.split('.').reduce((current: any, key) => current?.[key], translation);
}
