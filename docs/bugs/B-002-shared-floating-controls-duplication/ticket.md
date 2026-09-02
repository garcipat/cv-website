# Bug Ticket: FloatingControls duplicated across themes

**Bug ID**: B-002
**Found In**: S-006 (Platformer theme) step 1 implementation
**Status**: Resolved
**Severity**: Minor (code duplication / maintainability)

## Description

`src/themes/space/components/FloatingControls.tsx` and
`src/themes/platformer/components/FloatingControls.tsx` are structurally
identical: both are a thin wrapper (`fixed top-4 right-4 z-50 flex items-center
gap-2`) around the shared `ThemeSelect` and `LanguageSelect` components from
`src/components/`. Keeping two copies means any future change (positioning,
behavior, new controls) has to be made twice and can drift out of sync.

## Suggested Fix

Extract a shared `src/components/FloatingControls.tsx` (or similar location
following this repo's conventions — check `src/components/ui/` vs
`src/components/` placement patterns first) and have both themes import it
instead of keeping their own copies. Follow the project's constitution
(`.specify/memory/constitution.md`): named arrow function exports, props
interfaces in the same file if any props are needed, no new shadcn
components. Verify both themes still render correctly after the change
(existing tests for both FloatingControls components should be
updated/consolidated accordingly).

## Resolution

Extracted `src/components/FloatingControls.tsx`: a named arrow export taking
an optional `variant?: 'glass' | 'plain'` prop (default `'plain'`). The space
theme's glass-morphism styling (translucent background, border, shadow) moved
behind `variant="glass"`, passed explicitly from `SpacePage.tsx`; the
platformer theme uses the default, matching its previous bare wrapper
byte-for-byte. Both themes now import the shared component instead of their
own copies, which are deleted along with platformer's now-redundant
`FloatingControls.test.tsx`. Space's `FloatingControls.page.ts` test helper
needed no change — it only queries `data-testid="floating-controls"`, which
the shared component still renders regardless of variant.

## Related

- Follow-up task spawned in-session: task_7985e54c ("Extract shared
  FloatingControls component")
