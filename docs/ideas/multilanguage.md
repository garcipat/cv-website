# Idea: Multilanguage Support (EN ↔ DE)

## Status: Design Exploration

## Summary

The CV website supports English and German via a language toggle. Two layers need translation:

1. **CV content data** — the actual CV information (name, experience entries, project descriptions, etc.)
2. **UI strings** — labels, navigation, theme names, status bar text, buttons (e.g., "Experience", "Projects", "Skills", "Dark Mode")

A Preact Signal with localStorage persistence drives the active locale. Pattern proven in [elnopal](https://github.com/anomalyco/elnopal).

## Data Pattern

### CV Content Data

```
src/data/
├── cv.en.json      # English CV content
└── cv.de.json      # German CV content
```

Both files share the same TypeScript type (`CVData`), ensuring structural consistency.

### UI Translations

```
src/i18n/
├── translations.ts   # Translation type + loader (static imports)
├── en.ts             # English UI strings
└── de.ts             # German UI strings
```

Example translation type:

```typescript
// src/i18n/translations.ts
export interface UITranslations {
  nav: {
    about: string;
    experience: string;
    projects: string;
    skills: string;
    personality: string;
    contact: string;
  };
  themes: {
    ide: string;
    space3d: string;
    terminal: string;
    themeLabel: string;
  };
  status: {
    language: string;
    encoding: string;
    spaces: string;
  };
  // ... etc
}
```

```typescript
// src/i18n/en.ts
export const en: UITranslations = {
  nav: {
    about: 'About',
    experience: 'Experience',
    projects: 'Projects',
    skills: 'Skills',
    personality: 'Personality',
    contact: 'Contact',
  },
  themes: {
    ide: 'IDE',
    space3d: '3D Room',
    terminal: 'Terminal',
    themeLabel: 'Theme',
  },
  // ...
};
```

## Data Pipeline (F-002 → F-013)

F-002 (Data Model) provides the typed data files and wrapper modules:

```
src/data/
├── cv.en.json      # English CV content (raw JSON)
├── cv.en.ts        # Wrapper: import { cvEn } — named export, typed as CVData
├── cv.de.json      # German CV content (raw JSON)
└── cv.de.ts        # Wrapper: import { cvDe } — named export, typed as CVData
```

F-013 (Multilanguage) wires the `currentLocale` signal to select which wrapper module to expose. The locale-aware computed signal lives in F-013, not F-002 — keeping the data model focused on types + content.

## State — Preact Signals (F-013)

```typescript
// src/state/locale.ts (created in F-013)
import { signal, computed } from '@preact/signals-react';
import { cvEn } from '@/data/cv.en';
import { cvDe } from '@/data/cv.de';
import { en } from '@/i18n/en';
import { de } from '@/i18n/de';
import type { CVData } from '@/types/cv';
import type { UITranslations } from '@/i18n/translations';

const supportedLocales = ['en', 'de'] as const;
export type Locale = (typeof supportedLocales)[number];

function getBrowserLocale(): Locale {
  const lang = navigator.language.split('-')[0];
  return supportedLocales.includes(lang as Locale) ? (lang as Locale) : 'en';
}

export const [currentLocale] = createLocalStorageSignal<Locale>('locale', getBrowserLocale());

const cvDataMap: Record<Locale, CVData> = { en: cvEn, de: cvDe };
const uiMap: Record<Locale, UITranslations> = { en, de };

export const currentCV = computed<CVData>(() => cvDataMap[currentLocale.value]);
export const currentUI = computed<UITranslations>(() => uiMap[currentLocale.value]);

export const changeLocale = (locale: Locale) => {
  currentLocale.value = locale;
};
```

## How Components Use It

- **CV data**: `currentCV.value.experience[0].company` — reactive, recomputes on locale change
- **UI strings**: `currentUI.value.nav.experience` — reactive, recomputes on locale change
- Both use computed signals — any component that accesses them re-renders only when the locale changes

## Language Toggle

- UI element (button, dropdown, or flag icons) placed in a consistent location across all themes
- IDE theme: could be in the status bar
- 3D Room: could be a floating control
- Terminal: could be a command (`:lang de`)
- Switches `currentLocale` signal — both `currentCV` and `currentUI` recompute automatically
- Persisted to `localStorage` — survives page reloads

## Browser Detection

- On first visit, detect `navigator.language`
- Map `de` / `de-DE` / `de-AT` / `de-CH` → German
- Everything else → English (default)

## Why Preact Signals Works Well Here

- Zero prop drilling — any component imports `currentCV` or `currentUI` directly
- Theme components stay oblivious to locale logic
- No React Context re-render cascades
- Same pattern already battle-tested in the elnopal project

## Open Questions

- Should the language toggle be part of the theme-switcher UI, or independent?
- Should URLs reflect locale (e.g., `/de/ide`, `/en/ide`) for shareability?
