# Bug Tracker

Tickets live in `docs/bugs/{B-NNN}-{slug}/ticket.md`, one folder per bug —
mirrors how `specs/` holds one folder per feature. Bug IDs use the prefix
`B-NNN`.

## Open

- [ ] **B-005** — A purple slime is two tiles tall but `stepEnemyPatrol` only tests
  its anchor row, so an obstacle at head height is invisible and the slime walks
  through it —
  [ticket](bugs/B-005-oversized-enemy-ignores-head-height-obstacles/ticket.md)

## Resolved

- [x] **B-004** — Held key could draw with no slime body during the first-load
  asset race — `showsHeldKey` now also requires the slime's own body sheet to
  be loaded, not just the key sheet —
  [ticket](bugs/B-004-held-key-drawn-without-slime-body/ticket.md)
- [x] **B-001** — Dropdown scroll-up-arrow quirk in the shared `Select` fixed
  (`alignItemWithTrigger={false}` on `ThemeSelect`/`LanguageSelect`); the
  locale-gap half of the ticket was already fixed by prior work (`AnchorDots`
  and the intro subtitle already read from `currentUI.value`) —
  [ticket](bugs/B-001-space-theme-locale-and-dropdown/ticket.md)
- [x] **B-002** — `FloatingControls` was duplicated across the Space and
  Platformer themes — extracted to `src/components/FloatingControls.tsx` with
  a `variant` prop ('glass' for Space, 'plain' default for Platformer) so both
  keep their existing look —
  [ticket](bugs/B-002-shared-floating-controls-duplication/ticket.md)
- [x] **B-003** — Defeat/break puff fires on the CV reward instead of the world
  event, so a purple slime never puffs and a re-killed green slime doesn't either —
  fixed in roadmap step 34 (branch `S-006-step34-world-event-puff`) —
  [ticket](bugs/B-003-puff-bound-to-fact-reward/ticket.md)

---

## Status Table

| #     | Title                                     | Status | Severity | Ticket                                                                 |
| ----- | ------------------------------------------ | ------ | -------- | ----------------------------------------------------------------------- |
| B-001 | Space locale gaps + dropdown scroll-arrow  | Resolved | Minor  | [ticket](bugs/B-001-space-theme-locale-and-dropdown/ticket.md)       |
| B-002 | FloatingControls duplicated across themes  | Resolved | Minor  | [ticket](bugs/B-002-shared-floating-controls-duplication/ticket.md)  |
| B-003 | Puff bound to CV reward, not world event   | Resolved | Minor  | [ticket](bugs/B-003-puff-bound-to-fact-reward/ticket.md)              |
| B-004 | Held key drawn without its slime body      | Resolved | Trivial | [ticket](bugs/B-004-held-key-drawn-without-slime-body/ticket.md)      |
| B-005 | Oversized enemy ignores head-height walls   | Open     | Major   | [ticket](bugs/B-005-oversized-enemy-ignores-head-height-obstacles/ticket.md) |

---

## Workflow

1. **File** — create `docs/bugs/{B-NNN}-{slug}/ticket.md` describing the bug,
   repro steps, and a suggested fix. Add a row to this file (both the
   checklist and the status table).
2. **Fix** — implement + test the fix (TDD per the constitution).
3. **Resolve** — move the entry from Open to Resolved in this file, check
   the box, and note the fixing commit/PR in the ticket.
