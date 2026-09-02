# Bug Ticket: Space theme locale gaps + dropdown scroll-arrow quirk

**Bug ID**: B-001
**Found In**: S-006 (Platformer theme) manual testing, but affects the Space theme and the shared `Select` component — not caused by S-006
**Status**: Resolved
**Severity**: Minor (cosmetic / i18n completeness)

## Description

Two small pre-existing issues found while manually verifying the Platformer
theme's step 1 (theme skeleton):

1. **Space theme translation gaps** — the side navigation points (section
   navigation dots, e.g. `AnchorDots.tsx` or similar under
   `src/themes/space/components/`) and the intro hint text shown at the start
   of the Space theme (currently reads something like "Scroll — circles drop
   in from top, drift out to the corners") do not update when the locale is
   switched via `changeLocale`. They appear to be hardcoded English strings
   rather than pulled from `currentUI.value` (see `src/i18n/locales/en.json` /
   `de.json`, `src/i18n/translations.ts`).

2. **Dropdown scroll-up-arrow quirk** — the shared `Select` component
   (`src/components/ui/select.tsx`, used by `ThemeSelect`/`LanguageSelect`
   across all themes) opens its dropdown aligned so the currently-selected
   item sits at the trigger's position (base-ui Select's default
   "align item with trigger" behavior). When the floating controls sit near
   the top of the viewport (`fixed top-4 ...`) and a non-first item is
   selected, this pushes earlier items above the viewport top and triggers an
   unnecessary scroll-up chevron even though the full list would otherwise
   fit on screen. Reproduced in the Space theme with "Space" (2nd of 4 items)
   selected.

## Repro Steps (dropdown quirk)

1. Load the site, switch to the Space theme.
2. Open the theme dropdown (top-right floating controls).
3. Observe a scroll-up chevron above "IDE", even though only 4 items exist
   and they'd all fit without scrolling.

## Suggested Fix

- Locale gaps: wire the hardcoded strings through `currentUI.value`, adding
  missing keys to both `en.json` and `de.json`.
- Dropdown quirk: adjust base-ui Select's positioning (check `Popup`/
  `Positioner` props for disabling align-to-trigger) from the call site
  (`ThemeSelect`/`LanguageSelect`), or a scoped CSS fix. Do not hand-edit the
  shadcn-generated `select.tsx` internals beyond what's necessary — per this
  repo's constitution, shadcn components are CLI-managed.

## Resolution

- **Locale gaps**: already fixed by unrelated prior work — `AnchorDots.tsx`'s
  `sectionLabel` and `SpacePage.tsx`'s poster subtitle both now read from
  `currentUI.value` (`space.posterSubtitle`, `nav.*`), present in both
  `en.json` and `de.json`. Verified live: switching to German shows
  "Kreisparade" / "Scrollen — Kreise fallen von oben ein und driften zu den
  Ecken" / "ÜBER MICH". No code change needed for this half.
- **Dropdown quirk**: `ThemeSelect.tsx` and `LanguageSelect.tsx` now pass
  `alignItemWithTrigger={false}` to `SelectContent` (a prop `select.tsx`
  already exposed), so the popup opens positioned below the trigger instead
  of aligned to the selected item — no more spurious scroll-up chevron when a
  non-first item is selected near the top of the viewport. Verified live with
  "Space" (2nd of 4) and "Deutsch" (2nd of 2) selected: both dropdowns now
  open cleanly with every item visible and no scroll arrows.

## Related

- Follow-up task spawned in-session: task_a25525b8 ("Fix Space theme locale
  gaps + dropdown scroll-arrow quirk")
