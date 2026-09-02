# Bug Tracker

Tickets live in `docs/bugs/{B-NNN}-{slug}/ticket.md`, one folder per bug —
mirrors how `specs/` holds one folder per feature. Bug IDs use the prefix
`B-NNN`.

## Open

- [ ] **B-001** — Space theme locale gaps (side nav dots, intro hint text) +
  shared dropdown scroll-up-arrow quirk —
  [ticket](bugs/B-001-space-theme-locale-and-dropdown/ticket.md)
- [ ] **B-002** — `FloatingControls` duplicated across the Space and
  Platformer themes —
  [ticket](bugs/B-002-shared-floating-controls-duplication/ticket.md)
- [ ] **B-003** — Defeat/break puff fires on the CV reward instead of the world
  event, so a purple slime never puffs and a re-killed green slime doesn't either —
  [ticket](bugs/B-003-puff-bound-to-fact-reward/ticket.md)
- [ ] **B-004** — Held key can draw with no slime body during the first-load asset
  race — [ticket](bugs/B-004-held-key-drawn-without-slime-body/ticket.md)
- [ ] **B-005** — Enemy spikes can be overlapped by a later enemy's body (not
  reachable in the shipped level) —
  [ticket](bugs/B-005-enemy-spikes-drawn-per-enemy-z-order/ticket.md)

## Resolved

_None yet._

---

## Status Table

| #     | Title                                     | Status | Severity | Ticket                                                                 |
| ----- | ------------------------------------------ | ------ | -------- | ----------------------------------------------------------------------- |
| B-001 | Space locale gaps + dropdown scroll-arrow  | Open   | Minor    | [ticket](bugs/B-001-space-theme-locale-and-dropdown/ticket.md)       |
| B-002 | FloatingControls duplicated across themes  | Open   | Minor    | [ticket](bugs/B-002-shared-floating-controls-duplication/ticket.md)  |
| B-003 | Puff bound to CV reward, not world event   | Open   | Minor    | [ticket](bugs/B-003-puff-bound-to-fact-reward/ticket.md)              |
| B-004 | Held key drawn without its slime body      | Open   | Trivial  | [ticket](bugs/B-004-held-key-drawn-without-slime-body/ticket.md)      |
| B-005 | Enemy spikes overlapped by a later body    | Open   | Trivial  | [ticket](bugs/B-005-enemy-spikes-drawn-per-enemy-z-order/ticket.md)   |

---

## Workflow

1. **File** — create `docs/bugs/{B-NNN}-{slug}/ticket.md` describing the bug,
   repro steps, and a suggested fix. Add a row to this file (both the
   checklist and the status table).
2. **Fix** — implement + test the fix (TDD per the constitution).
3. **Resolve** — move the entry from Open to Resolved in this file, check
   the box, and note the fixing commit/PR in the ticket.
