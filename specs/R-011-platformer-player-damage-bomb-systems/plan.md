# Implementation Plan: R-011 Platformer Player Damage & Bomb Systems

**Branch**: `R-011-platformer-player-damage-bomb-systems` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/R-011-platformer-player-damage-bomb-systems/spec.md`

## Summary

R-011 is a behaviour-preserving refactor of shipped platformer combat. It introduces ONE **generic**
hit-effect vocabulary — `HitEffect` = `damage{amount}` | `velocity{x?,y?,duration?,preserveJump?}` |
`reaction{blinkOnly?}` — in the leaf `contracts/` layer, and ONE pure engine resolver,
`resolveHitEffects(target, effects)`, that folds an ordered effect list into a target's next state.
There is **no container object and no source identity**; a hit is a bare `readonly HitEffect[]`. The
members are **primitives, not use-cases** (`away`/`awayAndUp`, `push`/`lift`, `splatter{variant}`,
`hit`/`destroy`, `lethal` are all gone), so a new source composes primitives with no shared-union edit.

The five longhand player damage sites (lethal spear, enemy contact, ordinary hazard, bomb blast, pit
fall) are rewritten to build an effect list; the enemy stomp migrates so enemy kinds emit a declarative
enemy hit (`selfEffects`) instead of `self: takeHit(enemy)`; the block bump emits the same vocabulary.
Visuals stay in the existing R-004 transient-effect registry: sources spawn splatters/explosions via
`spawnEffect(factory(...))`, with ONE shared `playerEffectAnchor` helper so no site re-derives the
screen maths. The ~106-line inline bomb blast loop becomes a pure `BombSystem` returning a declarative
`BlastDelta` that the page applies.

Nothing the player sees changes: same damage, invulnerability windows, ordering, knockback/facing,
crouch suppression, lethal-spear bypass, splatter visuals and blast outcomes. The fragile invariants —
pre-physics (`playerState.value`) vs post-physics (`next`), source ordering, emergent
one-hit-per-tick, and the pit-fall recovery that is not gated — are preserved and machine-checked by a
new guard test.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, no `any`) + React 19; Vite 8 bundler; `@preact/signals-react` for state.

**Primary Dependencies**: Existing platformer modules only — `contracts/Outcome.ts`,
`contracts/capabilities.ts`, `contracts/PhysicsConfig.ts`; `entities/Player.ts`, `entities/Enemy.ts`,
`entities/enemies/**`, `entities/blocks/**`, `entities/Block.ts`; `engine/Collision.ts`,
`engine/Blast.ts`, `engine/BlockAI.ts`; `engine/effects/**` (R-004 registry); R-008's
`entities/deployableItems/**` (`BlastRequest`, `applyDeployableItemConsequences`). **No new dependency.**

**Storage**: N/A — static site. No persisted change (levels, blueprints, `localStorage`, tuning, sprites untouched).

**Testing**: Vitest + React Testing Library + jsdom; the FR-016 guard uses test-only
`node:fs`/`node:path` scanning (R-015/R-010 precedent). Commands: `npm test`, `npm run build`,
`npm run lint`. Conventions from [docs/TestingGuide.md](../../docs/TestingGuide.md)
(`{method}-{condition}-{expected-result}`, Arrange/Act/Assert) are authoritative.

**Target Platform**: Browser (static build).

**Project Type**: Single static web application — one self-contained theme at `src/themes/platformer/`.

**Performance Goals**: No regression; the resolver is a per-tick pure data fold over already-copied
state. Bundle MUST NOT grow.

**Constraints**:

- Byte-for-byte behaviour preservation (FR-017): every damage source, window, order, velocity, facing,
  splatter and blast outcome identical.
- R-001/R-015 layer invariants (FR-014): `contracts/` stays a leaf; no new `level/ → engine/`; no new
  `engine/ → state/`. The vocabulary is a `contracts/` leaf; the resolver and `BombSystem` are engine
  modules taking plain values.
- Members are generic primitives; no use-case name, no container, no source identity (FR-001/FR-002).
- Visuals stay in R-004; the vocabulary names no visual (FR-008). No test deleted/skipped/weakened
  (FR-017); `self`-based enemy assertions are rewritten to `selfEffects`.

**Scale/Scope**: 5 player sites + 3 enemy kinds + `pot` + `contracts/Outcome.ts` + `engine/Collision.ts`

- the page's blast loop; new `contracts/HitEffect.ts`, `engine/HitResolver.ts`, `engine/BombSystem.ts`,
  `playerEffectAnchor`, `engine/hitStructure.test.ts`. Authoritative conventions:
  [docs/Architecture.md](../../docs/Architecture.md), [docs/TestingGuide.md](../../docs/TestingGuide.md),
  [R-001 layer-boundaries](../R-001-platformer-core-contracts/contracts/layer-boundaries.md),
  [R-015 layer-invariants](../R-015-platformer-tile-module-registry/contracts/layer-invariants.md).

### Open Issues / Risks

- **OQ-1 — Enemy-contact effect aggregation.** Kinds now emit signed `velocity` effects, so
  `resolveEnemyContacts` aggregates effect lists (max damage; the first max-damage contact's `x`/`duration`;
  the strongest `y`; `preserveJump` if any; reaction when damage > 0). The `resolveEnemyContacts
aggregation` tests pin the exact rule; the aggregation must reproduce today's max-damage /
  strongest-bounce / first-damaging-direction behaviour (research D9).
- **OQ-2 — Block `damage` = hit count.** Blocks are not `Damageable`; the block adapter maps `damage`
  to `applyBlockHit` calls (bump `1`, blast `maxHits`). This overloads the primitive's meaning for
  blocks only, which is accepted as the price of avoiding a block-only `hit`/`destroy` member.
- **OQ-3 — Enemy blast splatter parity.** The shipped blast never spawned a per-type enemy splatter
  (the splatter loop runs for contacts before the blast pass); `damagedEnemyIds` is recorded but not
  consumed for splatter. Recorded so the "visual is an effect" principle is not misread.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                               | Status          | Evidence / Mitigation                                                                                                                                                                                             |
| --------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Typed Data Architecture              | PASS            | No data-file/level/persisted change. New `HitEffect` is a `contracts/` type, no `any` (strict).                                                                                                                   |
| II. Testing (NON-NEGOTIABLE)            | PASS            | TDD ordering per task; existing damage/splatter/death/bomb suites migrate with assertions preserved (`self`→`selfEffects` rewritten); new FR-016 guard enforces the invariants. No test deleted/skipped/weakened. |
| III. Code Quality & Component Standards | PASS            | Named arrow exports, typed props, `cn()` retained; no shadcn change; no new component.                                                                                                                            |
| IV. No Feature Bloat                    | PASS            | Specified `R-NNN` refactor; no new gameplay/art/tuning/level data; `docs/Features.md` updated when done.                                                                                                          |
| V. Performance & Static Delivery        | PASS            | No dependency added; net module count reduced; per-tick pure fold.                                                                                                                                                |
| Dev Workflow: manual browser check      | PASS (required) | FR-017/SC-005 demand a manual before/after comparison of all sources, deaths and a bomb blast.                                                                                                                    |
| Dev Workflow: no auto-commit            | PASS            | Changes left uncommitted for review.                                                                                                                                                                              |
| R-001/R-015 layer invariants (FR-014)   | PASS            | `contracts/HitEffect.ts` is a leaf; the resolver/`BombSystem` import no `state/`; no new `level/ → engine/`. Guard-enforced.                                                                                      |

No violations — Complexity Tracking is empty.

_Post-design re-check (after Phase 1):_ PASS. `contracts/HitEffect.ts` imports only sibling
`contracts/`; `engine/HitResolver.ts` and `engine/BombSystem.ts` import `contracts/`, `level/`,
`entities/`, `engine/` and no `state/`; `contracts/Outcome.ts` stays a leaf (imports the sibling
`HitEffect.ts`). The page/state remains the only signal writer; `BlastRequest` is consumed unchanged.
No gate outcome changes.

## Project Structure

### Documentation (this feature)

```text
specs/R-011-platformer-player-damage-bomb-systems/
├── plan.md                       # This file
├── research.md                   # Phase 0 output — decisions D1–D12
├── data-model.md                 # Phase 1 output — primitives, resolver, blast delta
├── quickstart.md                 # Phase 1 output — runnable validation guide
├── contracts/
│   ├── hit-effect-vocabulary.md  # HitEffect exact shape + extension contract
│   ├── hit-resolver.md           # resolveHitEffects signature + per-family semantics
│   ├── bomb-system.md            # BlastRequest → BlastDelta
│   ├── migration-matrix.md       # every site's effect list, parity
│   └── layer-invariants.md       # R-001/R-015 edges + FR-016 guard checks
├── checklists/requirements.md
└── tasks.md                      # Phase 2 output
```

### Source Code (repository root)

```text
src/themes/platformer/
├── contracts/
│   ├── HitEffect.ts              # NEW — generic primitives (damage/velocity/reaction)
│   ├── Outcome.ts                # MODIFIED — PlayerEffects over HitEffect; self→selfEffects; Contact.awayDirection
│   └── capabilities.ts           # UNCHANGED
├── engine/
│   ├── HitResolver.ts            # NEW — resolveHitEffects + player/enemy/block adapters
│   ├── BombSystem.ts             # MODIFIED — returns playerEffects + playerSplatter
│   ├── Blast.ts                  # UNCHANGED — geometry
│   ├── Collision.ts              # MODIFIED — resolveEnemyContacts applies selfEffects + aggregates effects
│   └── hitStructure.test.ts      # NEW — FR-016 guard
├── entities/
│   ├── Player.ts                 # MODIFIED — + playerEffectAnchor helper
│   ├── Enemy.ts                  # MODIFIED — applyEnemyDamage stays the enemy adapter impl
│   ├── Block.ts                  # UNCHANGED
│   ├── enemies/
│   │   ├── shared.ts             # takeHit stays (not kind-called)
│   │   ├── EnemyType.ts          # onPlayerCollide returns effects/selfEffects
│   │   ├── SlimeGreen.ts / SlimePurple.ts / Bee.ts   # MODIFIED
│   │   └── movement/**           # UNCHANGED
│   └── blocks/
│       ├── BlockType.ts          # MODIFIED — outcomes use HitEffect
│       ├── pot.ts                # MODIFIED — lift becomes velocity
│       └── (other kinds)         # UNCHANGED unless they returned PlayerEffects
├── engine/effects/**             # UNCHANGED — R-004 visuals
├── PlatformerPage.tsx            # MODIFIED — sites build effect lists + spawn visuals; blast loop → resolveBlasts
└── entities/deployableItems/
    ├── Bomb.ts                   # UNCHANGED
    └── DeployableItemType.ts     # UNCHANGED — BlastRequest
```

**Structure Decision**: Single-project layout. The vocabulary is a `contracts/` leaf so both `engine/`
and `entities/` speak it without a forbidden edge; the resolver and `BombSystem` are generic runtime
services under `engine/`. `engine/Blast.ts` and the bomb lifecycle stay where R-008 put them. The page
and `engine/Collision.ts` remain the wiring/apply sites.

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
