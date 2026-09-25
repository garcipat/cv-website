# Specification Quality Checklist: Platformer Generic Speech Bubble

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- All items pass. This is a refactor spec, so it names module/type/symbol homes (as R-004's spec does): that is the behaviour under test, not an implementation choice — the acceptance bar is that those names and homes change while the shipped game does not.
- **No `[NEEDS CLARIFICATION]` markers were needed.** The issue's three directives are unambiguous; the open decisions were resolved with documented defaults (Assumptions):
  1. **S-011 dependency.** The issue lists S-011 (Interact Hint Overlay) as a dependency, but S-011 has no spec and the sign/locked-chest/no-bombs bubble consumers already ship. R-005 generalises the bubble so S-011 can reuse it; it does not implement S-011's overlay. Sequencing is a planning concern (Assumptions).
  2. **Hint vocabulary home.** `level/HintCatalog.ts` owns the catalog and both id types; the sign definition moves with it so the root `types.ts` stays below `contracts/` (Assumptions/FR-008).
  3. **Squash relocated beside the mushroom.** The squash is a cosmetic, grid-cell-keyed timed tile with no self-drawn output, so it moves to `entities/blocks/Mushroom.ts` (together with the mushroom cap-role art helpers) rather than becoming a `mushroomSquash` effect kind; the dip stays applied inside the terrain pass and no duplicate cap renderer is invented (Assumptions/FR-010/FR-012). This deliberately reinterprets analysis E3 and R-004's deferral.
- Behaviour-preservation is the dominant requirement (US4): every FR constrains a visible or testable outcome, and SC-005 requires a manual browser pass.
- **Spec amended 2026-09-25** (mushroom squash relocated to `entities/blocks/Mushroom.ts`, not the effect registry; and the speech bubble now carries its own resolved text, refreshed by the page on a language change, with no `bubbleText` render-context field). The plan was regenerated accordingly and `tasks.md` is current; a `/speckit.analyze` pass applied the follow-up fixes.
