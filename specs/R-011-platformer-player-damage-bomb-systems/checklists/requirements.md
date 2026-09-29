# Specification Quality Checklist: Platformer Player Damage & Bomb Systems

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-27
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

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
- This is an architecture refactor (`R-NNN`): the binding constraint is zero user-visible
  behaviour change. The spec deliberately keeps implementation choices (exact file paths,
  exact `ImpactEffect` member names, resolver dispatch shape) for `/speckit.plan`.
- Runtime symbol/path references in the spec (`PlatformerPage.tsx:NNNN`, `contracts/Outcome.ts`,
  `engine/Blast.ts`, `Bomb.ts`) are used as precise anchors for the existing code being
  refactored, matching the convention of the sibling `R-009`/`R-010` specs.
- Validation run 1 (2026-09-27, `/speckit.specify`): all items pass. Seven design decisions were
  settled with the user and recorded in the spec's `## Clarifications` section:
  - From the specify interview — pure declarative engine module (no `engine/ → state/`);
    generalized impact model with an ordered effect list; damage/push/reaction/visual as
    independent effects; all target families share the vocabulary; strict behaviour preservation.
  - From `/speckit.clarify` — the `Impact`/`ImpactEffect` vocabulary lives in the leaf
    `contracts/` layer (resolving the FR-010 ↔ FR-014 layer contradiction), and `Impact` is only
    the container while damage/push/reaction/splatter are separate members, with the enemy stomp
    migrating onto the shared resolver (`CollisionOutcome.self` no longer carries an applied hit).
- Validation run 2 (2026-09-27, `/speckit.clarify`): re-validated after the two clarification
  bullets; all 16 items still pass, no markers toggled. Coverage: Domain & Data Model,
  Constraints & Tradeoffs and Terminology all moved to Clear; no `[NEEDS CLARIFICATION]` remains.
  Deliberately deferred to `/speckit.plan`: exact `ImpactEffect` member names, the resolver
  dispatch shape, exact file paths, and whether `CollisionOutcome.self` is deleted or narrowed to
  non-hit state changes.
- **Structural-refactor exception to the "no implementation details" items**: this is a
  _refactor_ spec, so it deliberately names the existing modules/symbols being restructured
  (`applyHitReaction`, `takeDamage`, `BlastRequest`, `applyDeployableItemConsequences`,
  `engine/Blast.ts`, `Bomb.ts`, `PlayerEffects`, `contracts/Outcome.ts`). For a restructuring,
  the named symbols _are_ the requirement (FR-001–FR-018); they are the "what", not leaked
  implementation. The two content-quality items above apply to behavioural features and are
  marked pass on that basis, matching the R-009/R-010 precedent.
- FR-016 adds an automated structural guard test as a reasonable-default quality decision
  (mirroring the R-009/R-010/R-015 precedent) so SC-001/SC-002/SC-006 are enforced rather than
  verified by manual search alone.
- Validation run 3 (2026-09-28, `/speckit.analyze`): 25/25 requirements covered by tasks (100%),
  0 CRITICAL/1 HIGH/5 MEDIUM/4 LOW findings; all findings remediated — the `awayAndUp` edge-case
  bullet corrected to match the shipped `bounceAscending: true` behaviour (I1), US1's scope aligned
  so the bomb source is explicitly US3 (I2), the invalid `[P]` markers removed from the same-file
  resolver adapters and `BombSystem` (I3/I4), FR-002/Key Entities reconciled to the concrete
  `knockback`/`push`/`lift` members (A1), `Impact.source` made required in the spec (A2), US1's
  `awayAndUp` naming aligned (I5), the duplicated crouch edge-case bullet merged (D1), and a
  foreign-member-ignore resolver test added to T004 (U2). All items still pass.
