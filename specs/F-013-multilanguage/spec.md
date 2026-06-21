# Feature Specification: Multilanguage Support (EN ↔ DE)

**Feature Branch**: `F-013-multilanguage`  
**Created**: 2026-06-20  
**Status**: Draft  
**Input**: Ideas document at `docs/ideas/multilanguage.md` with user clarifications on language toggle placement and localStorage-only locale persistence.  
**Clarifications session**: 2026-06-20 — 5 questions answered (see ## Clarifications).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - First Visit with Browser Language Detection (Priority: P1)

A German-speaking visitor opens the CV website for the first time. Their browser is configured with German as the preferred language. Without clicking any button or selecting any option, the website renders in German — all CV content (experience, skills, projects) and all UI labels (navigation, theme names, status bar text) appear in German.

**Why this priority**: Automatic locale detection is the most impactful user experience improvement. It ensures new visitors see content in their language immediately, reducing friction and bounce rate. Without it, every German visitor would need to manually switch from the English default.

**Independent Test**: Set `navigator.language` to `'de-DE'` (via jsdom mock or Puppeteer), load the page, verify the first render shows German text across all components. Clear `localStorage` before each test run to simulate first visit.

**Acceptance Scenarios**:

1. **Given** a fresh browser profile with `navigator.language` set to `'de-DE'`, **When** the page loads, **Then** all CV content and UI labels render in German without any user interaction.
2. **Given** a fresh browser profile with `navigator.language` set to `'de'`, **When** the page loads, **Then** the active locale is `'de'` and German translations are displayed.
3. **Given** a fresh browser profile with `navigator.language` set to `'de-AT'` or `'de-CH'`, **When** the page loads, **Then** the locale maps to `'de'` (language tag before the hyphen is matched, not the full subtag).
4. **Given** a fresh browser profile with `navigator.language` set to `'fr'`, `'es'`, or any unsupported locale, **When** the page loads, **Then** the active locale falls back to `'en'` (default) and English content is displayed.
5. **Given** a fresh browser profile where `navigator.language` is `'en-US'` or `'en-GB'`, **When** the page loads, **Then** the active locale is `'en'` and English content is displayed.
6. **Given** a fresh browser profile with `navigator.language` set to `'de'`, **When** the page loads and React hydrates, **Then** content switches to German within the same frame as the first React render. A brief flash of English (~50-150ms) before JS execution is accepted — no blocking inline script or loading skeleton is used to suppress it.

---

### User Story 2 - Toggle Language Mid-Session (Priority: P1)

A bilingual user is viewing the CV in English and decides to switch to German. They click the language toggle (button, dropdown, or flag icon depending on the active theme) and the entire page instantly updates: CV content sections (experience, skills, projects, etc.) switch to German, and all UI labels (navigation "Experience" → "Erfahrung", theme names "IDE" → "IDE" unchanged, "3D Room" → "3D-Raum", "Terminal" → "Terminal") update simultaneously. No page reload occurs.

**Why this priority**: The core interaction of the feature — toggling between languages — must work seamlessly. This is the primary user-facing capability of multilanguage support.

**Independent Test**: Open the page in English locale, click the language toggle to switch to German, verify every user-facing string on the page changes to German without a full page reload. Switch back to English and verify the reverse.

**Acceptance Scenarios**:

1. **Given** the active locale is `'en'`, **When** the user clicks the language toggle to switch to `'de'`, **Then** all CV content on the page updates to German instantly (no full page reload).
2. **Given** the active locale is `'de'`, **When** the user clicks the language toggle to switch to `'en'`, **Then** all CV content updates to English instantly (no full page reload).
3. **Given** the user toggles between `'en'` and `'de'` rapidly (3+ clicks within 1 second), **When** the final state settles, **Then** all content reflects the last-selected locale correctly with no race conditions or partial updates.
4. **Given** the user switches language while scrolled halfway down the page, **When** content updates, **Then** the scroll position is preserved.
5. **Given** the user switches language while a section is collapsed or expanded (if accordion/expandable sections exist), **When** content updates, **Then** the expansion state is preserved.

---

### User Story 3 - Locale Persists Across Page Reloads (Priority: P2)

A user switches the language to German, browses the page, then closes the browser tab. The next day they open the same URL. The page renders in German without requiring a second language selection. The locale preference is remembered from the previous session.

**Why this priority**: Persistence is essential for returning visitors. Without it, every visit would require the user to re-select their language, which is poor UX. This priority is P2 because the feature works without persistence (users can toggle each visit), but persistence dramatically improves the experience.

**Independent Test**: Set locale to `'de'` via the toggle, verify `localStorage.getItem('locale')` is `'"de"'` (JSON-encoded). Hard-reload the page (clear caches, simulate new session), verify the page renders in German. Change locale to `'en'`, reload, verify English.

**Acceptance Scenarios**:

1. **Given** a user has set the locale to `'de'`, **When** they close and reopen the browser tab (real page load, not a dev hot-reload), **Then** the page renders in German.
2. **Given** a user has set the locale to `'en'`, **When** they close and reopen the browser tab, **Then** the page renders in English.
3. **Given** `localStorage` has the value `'"de"'` stored under the key `'locale'`, **When** the page loads, **Then** `currentLocale` initializes to `'de'` without consulting `navigator.language`.
4. **Given** `localStorage` contains an invalid locale value (e.g., `'"fr"'`), **When** the page loads, **Then** `currentLocale` falls back to the browser-detected locale (or `'en'` as ultimate fallback).
5. **Given** `localStorage` is cleared or unavailable (private browsing with storage restrictions), **When** the page loads, **Then** `currentLocale` falls back to browser language detection, and the feature degrades gracefully without errors.
6. **Given** a user switches locale in one tab, **When** they reload a second tab that was open with the previous locale, **Then** the second tab reads the updated `localStorage` value and renders in the new locale (cross-tab consistency on reload).

---

### User Story 4 - Developer Adds a New Language (Priority: P3)

A developer wants to add French (`fr`) as a third supported language. They need a clear extension path: create `cv.fr.json` with the same `CVData` structure, create `src/i18n/fr.ts` implementing the `UITranslations` interface, and register the locale. No framework or build-tool changes should be required.

**Why this priority**: The project currently specifies EN and DE only. Adding more languages is a future concern. This story ensures the architecture doesn't paint the project into a corner.

**Independent Test**: Add `'fr'` to the supported locales list, create `cv.fr.json` and `src/i18n/fr.ts`, add a French flag to the toggle, reload. Verify French content renders and all tests pass.

**Acceptance Scenarios**:

1. **Given** a developer adds `'fr'` to the `supportedLocales` array in the locale signal, **When** they create `cv.fr.json` with the `CVData` type structure, **Then** TypeScript validates the file at build time.
2. **Given** a developer creates `src/i18n/fr.ts` exporting a `fr` object that satisfies the `UITranslations` interface, **When** they register it in the locale signal's `uiMap`, **Then** TypeScript enforces that all required fields are present.
3. **Given** the language toggle receives the new locale, **When** a user selects French, **Then** both CV content and UI strings switch to French with zero code changes beyond the registration steps.
4. **Given** the new locale is registered, **When** a user with `navigator.language === 'fr'` visits for the first time, **Then** the page renders in French automatically.

---

### Edge Cases

- ✅ **localStorage unavailable or throws**: `createLocalStorageSignal` wraps all `localStorage` access in try/catch. If storage is unavailable, the signal falls back to browser language detection for the initial value, and changes work in-memory but do not persist. No error is thrown.
- ✅ **Invalid stored locale**: If `localStorage` contains a locale string that is not in the supported locales list (e.g., `"fr"` before French is added, or corrupted data), the signal validates the stored value against the supported locales. On mismatch, it falls back to browser language detection (then to `'en'`).
- ✅ **Browser language changes mid-session**: The `navigator.language` detection only runs on first visit (when no stored locale exists). Once a locale is stored or manually selected, browser language changes have no effect until `localStorage` is cleared.
- ✅ **Rapid toggling**: Preact Signals process synchronous updates immediately. Rapid clicks on the language toggle are queued as synchronous value changes; all computed signals (`currentCV`, `currentUI`) recompute synchronously. React re-renders batch as usual. No debounce or throttle is needed.
- ✅ **Language-independent data**: Dates, URLs, company names, tech stack names, and numeric data are identical across locales. The `cv.en.json` and `cv.de.json` files each independently contain these values — there is no shared data source. Authors maintain both files separately.
- ✅ **Missing translations**: If a developer adds a UI string key to `UITranslations` in the type definition but forgets to add it to one locale file, TypeScript will report a compile-time error because the `uiMap` registration enforces the full interface.
- ✅ **Language toggle on narrow viewports**: The language toggle adapts to available space. On mobile or narrow viewports, it may show as a compact two-letter abbreviation (`EN` / `DE`) or a flag icon instead of a full dropdown.
- ✅ **Existing user with stored locale visits after an unsupported locale is removed**: If locale `'fr'` was stored and later French is removed from supported locales, the validation logic falls back gracefully to browser detection or `'en'`.
- ✅ **Print rendering**: When printing, the page prints in the currently active locale. No print-specific locale handling is needed — what the user sees is what prints.
- ✅ **HTML `lang` attribute sync**: On locale change, `document.documentElement.lang` is updated synchronously alongside the active locale signal. This ensures screen readers and browsers reflect the current language without delay.
- ✅ **Document title and meta description sync**: On locale change, `document.title` and `meta[name="description"]` content are updated to translated values from the `UITranslations` object. If the `<meta>` tag does not exist in the DOM, the system creates it gracefully without throwing.
- ✅ **No screen reader live region**: Locale changes do not trigger an `aria-live` announcement. The dynamic `aria-label` on the toggle button itself is the sole assistive technology affordance — sufficient since the content change is visually and structurally apparent.

## Requirements _(mandatory)_

### Functional Requirements

#### State Management

- **FR-001**: System MUST define a `Locale` type as a union of supported locale identifiers (`'en' | 'de'`) in `src/state/locale.ts`, along with a `supportedLocales` array of type `readonly Locale[]` containing all valid locale identifiers.

- **FR-002**: System MUST create a `createLocalStorageSignal<Locale>('locale', getBrowserLocale())` signal named `currentLocale` in `src/state/locale.ts` that:
  - Reads the stored locale from `localStorage` on initialization
  - Persists every change back to `localStorage`
  - Falls back to browser language detection when no stored value exists
  - Validates the stored value against `supportedLocales` and falls back if invalid

- **FR-003**: System MUST implement `getBrowserLocale(): Locale` that:
  - Reads `navigator.language`, splits on `-` to get the primary language tag
  - Returns the locale if it matches a supported locale (case-insensitive)
  - Returns `'en'` as the ultimate fallback for unsupported or unavailable languages

- **FR-004**: System MUST provide a `changeLocale(locale: Locale): void` function in `src/state/locale.ts` that sets `currentLocale.value` and is importable by components. In addition to updating the signal, `changeLocale` MUST also:
  - Update `document.documentElement.lang` to the active locale value (essential for WCAG SC 3.1.1 Language of Page — Level A: screen readers use this attribute for correct pronunciation, browsers use it for spell-check dictionaries)
  - Update `document.title` and the `<meta name="description">` content to their translated counterparts

#### Computed Signals

- **FR-005**: System MUST provide a computed signal `currentCV` in `src/state/locale.ts` that returns the active locale's CV data object. The signal must:
  - Import `cvEn` and `cvDe` from their respective data files (or JSON imports if wrapper modules are not created)
  - Return the correct `CVData` object based on `currentLocale.value`
  - Recompute synchronously whenever `currentLocale` changes
  - Be typed as `Computed<CVData>`

 - **FR-006**: System MUST provide a computed signal `currentUI` in `src/state/locale.ts` that returns the active locale's UI translation object. The signal must:
  - Import `en` and `de` from their respective i18n files
  - Return the correct `UITranslations` object based on `currentLocale.value`
  - Recompute synchronously whenever `currentLocale` changes
  - Be typed as `Computed<UITranslations>`

#### UI Translation Data

- **FR-007**: System MUST define a `UITranslations` interface in `src/i18n/translations.ts` covering all user-facing UI strings in the application (navigation labels, theme names, theme selector label, status bar strings, section headings, button labels, aria-labels, and any other translatable UI text). Every user-facing string MUST be included in this interface.

- **FR-008**: System MUST provide a complete English UI translations file at `src/i18n/en.ts` that exports a typed `UITranslations` object with all strings in English.

- **FR-009**: System MUST provide a complete German UI translations file at `src/i18n/de.ts` that exports a typed `UITranslations` object with all strings translated to German.

- **FR-010**: System MUST register both locale files in the `uiMap` inside the locale signal so that TypeScript enforces compile-time completeness — any missing translation entry causes a build failure.

#### Language Select Component

- **FR-011**: System MUST provide a `LanguageSelect` component in `src/components/LanguageSelect.tsx` that:
  - Renders a dropdown (Select) showing the currently active locale's localized name
  - Lists all supported locales with their localized names (e.g., "English" / "Deutsch" when viewing English)
  - Includes an accessible label via `aria-label` on the trigger
  - Is keyboard-navigable (the Select component handles Tab, arrow keys, Enter)
  - Is fully functional in isolation — it uses `changeLocale` to apply the selection
  - Does NOT reference any theme-specific styling; themes apply their own wrapping/positioning

- **FR-012**: System MUST allow each theme layout to render the `LanguageSelect` in its own style and location:
  - All themes: Rendered adjacent to `<ThemeSelect />` in the same header row
  - The placement MUST be visually consistent within each theme's design language
  - The component instance is the same; the theme wraps or positions it, but does not modify its behavior

- **FR-013**: System MUST ensure that the `LanguageSelect` option labels come from the `currentUI` computed signal via `currentUI.value.language.names`, where each locale maps to its localized display name (e.g., `{ en: "English", de: "Deutsch" }` when English is active). The selected value in the trigger displays the active locale's localized name.

#### Integration

 - **FR-014**: System MUST ensure that the `App.tsx` entry point does NOT need modification for locale switching. Locale is a signal-driven concern — components import `currentCV` and `currentUI` directly. The `App.tsx` should remain focused on theme rendering only.

- **FR-015**: System MUST import the locale signal module (`src/state/locale.ts`) as a side-effect import in the application entry point (or a module loaded early enough) so that the `currentLocale` signal is initialized before any component reads its value. This can be achieved by importing it in `main.tsx` or in a module that `App.tsx` imports.

- **FR-016**: System MUST NOT implement URL-based locale routing (no `/en/`, `/de/` paths). Locale is determined solely by `localStorage` and browser detection.

- **FR-017**: System MUST include `page.title` (browser tab title) and `page.description` (<meta name="description"> content) fields in the `UITranslations` interface. The `changeLocale()` function MUST update `document.title` and `document.querySelector('meta[name="description"]').content` to their translated values on every locale change.

### Key Entities

- **Locale**: A union type (`'en' | 'de'`) representing the currently active language. Defined in `src/state/locale.ts`. Used as the key type for translation lookup maps and as the generic parameter for the `currentLocale` signal.

- **currentLocale Signal**: A `Signal<Locale>` created via `createLocalStorageSignal` with key `'locale'`. Persists to `localStorage`. Initialized from stored value > browser detection > `'en'` fallback. Writing to `currentLocale.value` triggers recomputation of dependent computed signals.

- **currentCV (Computed Signal)**: A `Computed<CVData>` that returns the `CVData` object for the active locale. Reads from a `Record<Locale, CVData>` map (`{ en: cvEn, de: cvDe }`). Component import: `import { currentCV } from '@/state/locale'`. Usage: `currentCV.value.experience[0].company`.

- **currentUI (Computed Signal)**: A `Computed<UITranslations>` that returns the UI translation object for the active locale. Reads from a `Record<Locale, UITranslations>` map (`{ en, de }`). Component import: `import { currentUI } from '@/state/locale'`. Usage: `currentUI.value.nav.experience`.

- **Translation Type**: Inferred from `typeof enJson` (English JSON) in `src/i18n/translations.ts`. The English JSON file is the source of truth; TypeScript validates all other locale files against it at build time. Missing or extra fields cause compilation errors.

- **LanguageSelect Component**: A React component in `src/components/LanguageSelect.tsx` that renders a locale dropdown (Select element based on `@base-ui/react`). Independent of theme (each theme positions/wraps it differently). Uses `useSignals()` from `@preact/signals-react/runtime` to reactively read `currentLocale` and `currentUI`, and calls `changeLocale()` on user selection.

- **Locale-Specific Data File**: Each locale has a corresponding JSON file at `src/data/cv.{locale}.json` sharing the `CVData` type. Created by F-002 (Data Model). F-013 consumes these files but does not create or modify them.

**Entity Relationships**:
```
currentLocale (Signal<Locale>)
 ├── Determines currentCV (Computed<CVData>)
 │       └── Maps via: { en: cvEn, de: cvDe }
 └── Determines currentUI (Computed<UITranslations>)
         └── Maps via: { en: en, de: de }

LanguageSelect (Component)
 ├── Reads currentLocale and currentUI reactively via useSignals()
 ├── Writes via changeLocale()
 └── Rendered by each theme in its own style/location

Translation (Type inferred from en.json)
 ├── en.json defines the shape
 ├── de.json validated against it at build time
 └── New locales add new JSON files

CVData (Interface from F-002)
 ├── cv.en.json implements it
 ├── cv.de.json implements it
 └── Both imported statically at build time
```

All relationships are compositional — the locale signal owns both translation maps. Components access translated content through computed signals without knowing which locale is active.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Locale persistence**: A hard browser reload preserves the last-selected locale 100% of the time. Verified by: set locale to `'de'`, hard-reload (Ctrl+Shift+R / Cmd+Shift+R), observe German content on first paint. Repeat for `'en'`.

- **SC-002 — Instant switching**: Language toggle completes without a full page reload. Verified by: open DevTools Network tab, toggle language, verify zero network requests are made (all translations are bundled at build time).

- **SC-003 — Complete translation coverage**: Every user-facing string in the application is translated for all supported locales. Verified: TypeScript compilation fails if any field is missing from any locale's `UITranslations` implementation. No runtime fallback to hardcoded strings.

- **SC-004 — First-visit detection accuracy**: First-time visitors (no stored locale) whose browser language is `de`, `de-DE`, `de-AT`, or `de-CH` see the page in German. Visitors with any other browser language see English. Verified by automated test: mock `navigator.language` to each variant, clear localStorage, measure initial `currentLocale.value`.

- **SC-005 — Zero runtime errors**: All acceptance scenarios pass without console errors, warnings, or uncaught exceptions. Verified by: run full test suite (Vitest) with locale switching tests covering initialization, toggle, persistence, and fallback paths.

- **SC-006 — Component independence**: The `LanguageToggle` component renders correctly in all three themes without requiring theme-specific props, conditionals, or layout awareness. Verified by: render the component in each theme layout and verify it functions identically.

## Assumptions

- **Two initial locales**: English (`'en'`) and German (`'de'`) are the only supported locales in this feature. Additional locales can be added later following the documented extension path.
- **CVData files exist**: `cv.en.json` and `cv.de.json` are already created by F-002 (Data Model) and importable. F-013 does not create or modify CV data files — it only wires the locale-driven selection.
- **createLocalStorageSignal exists**: The utility function `createLocalStorageSignal<T>(key, defaultValue)` is already implemented in `src/lib/utils.ts` (created by F-010 Design System). F-013 uses it, does not reimplement it.
- **No URL routing**: Locale is persisted only in `localStorage`. There are no URL paths like `/en/` or `/de/`. Page reloads use the same URL regardless of locale.
- **Browser language detection runs once**: `getBrowserLocale()` is called only during signal initialization (first module load or when no stored locale exists). It does not re-run on page focus or language change events.
- **Static imports**: All translation data (CV JSON and UI strings) is statically imported at build time. No dynamic `import()` or lazy loading of locale chunks — all locales are bundled.
- **CV data has identical structure across locales**: Both `cv.en.json` and `cv.de.json` conform to the same `CVData` interface. Fields containing language-independent data (dates, URLs, company names, tech stack names) may have identical values but are maintained independently in each file.
- **Current theme signal exists**: `currentTheme` and the theme system (F-012) are already implemented. F-013's `LanguageToggle` component is integrated into each theme layout but does not depend on the theme signal directly.
- **Toggle label convention**: The toggle shows the target locale's ISO 639-1 code: `DE` (not `GER`) to switch to German, `EN` (not `ENG`) to switch to English. This is consistent and unambiguous across languages.
- **Theme integration is per-theme layout responsibility**: Each theme's layout component (e.g., `IdePage.tsx`, `SpacePage.tsx`, `TerminalPage.tsx`) is responsible for importing and positioning the `LanguageToggle`. The toggle component itself has no knowledge of its placement or surrounding theme.
- **Locale is independent of theme**: The active locale and active theme are orthogonal state values. Changing locale does not affect the theme, and changing theme does not affect the locale.
- **Language toggle immediately adjacent to theme switcher**: The `LanguageToggle` component renders directly next to the `ThemeSwitcher` component in the same visual row/group (e.g., IDE status bar: `[ThemeSwitcher] [LanguageToggle]`), but is a completely separate component. It does not share DOM structure, event handlers, or styling with the theme switcher.

## Clarifications

Record of the clarification session on 2026-06-20. Five questions were asked and answered before finalizing the spec. Each answer is encoded into the relevant sections above.

| # | Question | Choice | Impact |
|---|---|---|---|
| 1 | Should the HTML `lang` attribute update when locale changes? (WCAG SC 3.1.1) | **Always update** — `document.documentElement.lang` is set to the active locale on every change, not just on initialization. | Added WCAG reference to FR-004. Added edge case for `lang` sync. |
| 2 | Should a screen reader live region announce locale changes? | **No announcement** — The toggle's dynamic `aria-label` is sufficient. No `aria-live` region. | Added edge case noting no live region. |
| 3 | How to handle the flash of English content before JS loads on German-first visitors? | **Accept brief flash** — ~50-150ms flash is imperceptible to most users. Updated US1 Scenario 6 to reflect this. | Updated US1 Scenario 6 wording. |
| 4 | How should `LanguageToggle` be positioned relative to `ThemeSwitcher`? | **Immediately adjacent, same row** — Same visual group (e.g., `[ThemeSwitcher] [LanguageToggle]`), no dividers or separators. | Updated Assumption entry. |
| 5 | Should HTML `<title>` and `<meta name="description">` be translated with locale? | **Translate both** — Include `page.title` and `page.description` in `UITranslations`. Update via DOM on locale change. | Added fields to UITranslations (FR-007). Added FR-017 for DOM updates. Added edge case. |
