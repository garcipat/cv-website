---
description: 'Task list for R-011 Platformer Player Damage & Bomb Systems'
---

# Tasks: Platformer Player Damage & Bomb Systems (R-011)

**Input**: Design documents from `/specs/R-011-platformer-player-damage-bomb-systems/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (Clarifications 2026-09-27 + 2026-09-29), [research.md](./research.md) (D1–D12, OQ-1–OQ-3), [data-model.md](./data-model.md), [contracts/](./contracts/) ([hit-effect-vocabulary](./contracts/hit-effect-vocabulary.md), [hit-resolver](./contracts/hit-resolver.md), [bomb-system](./contracts/bomb-system.md), [migration-matrix](./contracts/migration-matrix.md), [layer-invariants](./contracts/layer-invariants.md)), [quickstart.md](./quickstart.md), [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

**Nature of this feature**: A **behaviour-preserving refactor** of the shipped damage and bomb paths.
The acceptance bar is byte-for-byte behaviour preservation (FR-017, SC-005). The hit vocabulary is
**generic primitives** — `damage{amount}`, `velocity{x?,y?,duration?,preserveJump?}`,
`reaction{blinkOnly?}` — with **no container and no source identity**; visuals stay in R-004. Only
TypeScript module homes, types, helper APIs and call shape move. No gameplay/art/tuning/level-data/HUD change.

**Tests**: Required (constitution II, FR-017). New pure modules get `{method}-{condition}-{expected-result}`
unit tests; every existing test migrates and keeps its assertions, except `self`-based enemy
assertions rewritten to `selfEffects` (a consolidated symbol, never weakened). The new
`engine/hitStructure.test.ts` guard (T024) is proven non-vacuous (T025).

**Out of scope**: any gameplay/balance change; R-008's `Bomb.ts`/`DeployableItemType.ts` and
`engine/Blast.ts` are consumed unchanged; R-004's visual factories/registry internals; R-012/R-013/R-014;
reward/defeat appliers (`resolveBlockTerminalOutcome`, `applyEnemyDefeats`); `takeHit`/`applyEnemyDamage`
stay internal implementations.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1–US5
- Paths are relative to `src/themes/platformer/` unless they start with `docs/`/`specs/`.

## Story ↔ phase map (dependency order)

| Phase | Work group                                          | User story          |
| ----- | --------------------------------------------------- | ------------------- |
| 3     | The player damage sites become ordered effect lists | **US1** (P1) 🎯 MVP |
| 4     | Every target family speaks the generic vocabulary   | **US2** (P1)        |
| 5     | The bomb blast is resolved by `BombSystem`          | **US3** (P1)        |
| 6     | The refactor is invisible (parity + FR-016 guard)   | **US4** (P1)        |
| 7     | A new source/effect is a local addition             | **US5** (P2)        |

US1 precedes US2 because the player sites build on the resolver core and can be validated against the
existing `EnemyContactResult`/`BlockHitOutcome` aggregates before US2 restructures the kind-facing
vocabulary. US3 depends on the resolver's player + enemy + block adapters. US4 runs last; US5 proves
the extension contract.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Confirm branch `R-011-platformer-player-damage-bomb-systems` is checked out; run `npm install`, then `npm test`, `npm run build` and `npm run lint` — all MUST pass before any edit. No source changes.
- [x] T002 [P] Capture the pre-refactor behaviour baseline for US4 (record in the completion notes): the exact names of the damage/knockback/splatter/death/bomb suites this refactor must preserve, plus the current `blastTiles`/`BOMB_DAMAGE`/splatter-anchor values. This is the SC-005 diff baseline.

**Checkpoint**: Baseline green; parity baseline captured.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the generic vocabulary, the resolver core, and the shared splatter-anchor helper.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [x] T003 [P] Create `src/themes/platformer/contracts/HitEffect.ts` per [contracts/hit-effect-vocabulary.md](./contracts/hit-effect-vocabulary.md) §1–§2: `HitEffect` = `damage{amount}` | `velocity{x?,y?,duration?,preserveJump?}` | `reaction{blinkOnly?}`. **Exactly three primitives, no container, no source identity, no use-case member** (`knockback`/`push`/`lift`/`splatter`/`hit`/`destroy`/`lethal`). Add `contracts/HitEffect.test.ts` asserting the union covers each primitive and that the module imports nothing from `engine|entities|level|tiles|state`.
- [x] T004 Create `src/themes/platformer/engine/HitResolver.ts` with the **player adapter** and the fold per [contracts/hit-resolver.md](./contracts/hit-resolver.md) §1–§3: `PlayerHitResult` and the `resolveHitEffects(player, effects)` overload. Map `damage` (via `takeDamage` + `alive`), `reaction` (`blinkOnly` → `beginPitFallReaction`, else `applyHitReaction`), and `velocity` (`x`⇒`vx`+facing, `y`⇒`vy`, `duration`⇒`knockbackTimer`, `preserveJump`⇒`bounceAscending`); ignore unknown primitives; do **not** gate on invulnerability. Add `engine/HitResolver.test.ts` (TDD) covering: velocity-only (moves, no damage), damage-only (damages, no movement), `reaction{blinkOnly}` opens only the window, `velocity` reproduces `applyHitReaction` fields, and a foreign primitive is ignored with the rest still applying. Depends on T003.
- [x] T005 Create `playerEffectAnchor(player: PlayerState, originX: number, originY: number, anchor: 'center' | 'feet'): { x: number; y: number }` in `src/themes/platformer/entities/Player.ts` (beside the `PLAYER_*` constants) plus its unit test: `'center'` = `x + PLAYER_RENDERED_SIZE/2 + originX`, `y + PLAYER_VISUAL_CENTER_Y_OFFSET + originY`; `'feet'` = `x + PLAYER_RENDERED_SIZE/2 + originX`, `y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING + originY`. Depends on T003.
- [x] T006 Run `npm test`; the full suite MUST stay green (the resolver/anchor are unused by the page yet). **Checkpoint — Foundational.** Do NOT create the FR-016 guard yet.

**Checkpoint**: Vocabulary, resolver core and anchor helper exist; the running game is unchanged.

---

## Phase 3: User Story 1 - One ordered effect list replaces the duplicated player damage sites (Priority: P1) 🎯 MVP

**Goal**: Replace the four inline player damage sites — lethal spear, enemy contact, ordinary hazard,
pit fall — and the block-bounce write with ordered `HitEffect` lists resolved through
`engine/HitResolver.ts` (FR-006–FR-008). Each source keeps its guard, resolution point and storage
target. Visuals are spawned from the source via R-004 with `playerEffectAnchor`.

**Independent Test**: `rg "takeDamage\(|applyHitReaction\(|beginPitFallReaction\(" src/themes/platformer/PlatformerPage.tsx`
and `rg "hitPoints, alive" …` find no match; the spear/hazard/enemy/pit/crouch/splatter suites pass with
assertions unchanged.

### Implementation for User Story 1

- [x] T007 [US1] Rewrite the lethal-spear site (~1567–1593) to `resolveHitEffects(playerState.value, [{ damage, amount: playerState.value.hitPoints }])`; keep the `spearKilled` flag and the suppression of the enemy/hazard blocks, and spawn the feet blood via `startSpearBloodSplatter('spear-<n>', …)` using `playerEffectAnchor(…, 'feet')`. Depends on T004, T005.
- [x] T008 [US1] Rewrite the ordinary-hazard site (~1680–1739): build `[damage{damage}, reaction, velocity{x: away-from-hazard, duration} unless `!knocksBack || crouching`]`, resolve against `playerState.value`, keep the `!spearKilled && !isInvulnerable(...)` guard, and spawn the centre splatter (side `contactSide`) only when the hit survives. Depends on T004, T005.
- [x] T009 [US1] Rewrite the enemy-contact player-damage site (~1627–1678) to resolve `contacts.hitEffects` against `playerState.value` under the `!spearKilled && !isInvulnerable(...)` guard, and apply `contacts.bounceEffects` unguarded against `playerState.value` (the stomp bounce) — preserving the bounce-before-damage order; spawn the centre splatter (side `-knockbackDirection`) only when the hit survives. Depends on T004, T005.
- [x] T010 [US1] Rewrite the pit-fall site (~2108–2125) to `resolveHitEffects(next, [{ damage: PIT_FALL_DAMAGE }, { reaction, blinkOnly: true }])` when `!isInvulnerable(next, PLAYER_HIT_REACTION_SECONDS)`; `resolvePitFall(next)` MUST still run unconditionally. Depends on T004.
- [x] T011 [US1] Rewrite the block-bounce write (~1967–1973) so the aggregated `strongerBounce` result is applied as `resolveHitEffects(next, [{ velocity, y: bounceVelocity, preserveJump: true }]).player`, keeping the `strongerBounce` aggregation and the mushroom-cap squash trigger. Depends on T004.
- [x] T012 [US1] Run `npm test`; run the SC-001 greps from [quickstart.md](./quickstart.md) §2. Confirm the spear/hazard/enemy/pit/crouch/splatter suites pass unchanged. **Checkpoint — US1 MVP.** Do not commit.

**Checkpoint**: The four inline sites build effect lists; the longhand shape is gone from the page.

---

## Phase 4: User Story 2 - Every target family consumes the generic vocabulary (Priority: P1)

**Goal**: Re-express the kind-facing vocabulary over `HitEffect` (FR-010), migrate the enemy stomp to
`selfEffects` (FR-009/D9) and the block `onHit` to a `velocity` effect (D10), and have the engine apply
hits through the resolver.

**Independent Test**: `rg "self\??:" src/themes/platformer/entities` finds no outcome `self`;
`contracts/Outcome.ts` declares no `damagePlayer`/`knockback`/`bounceVelocity`; no enemy/block kind
imports `takeHit`/`applyEnemyDamage`; enemy/block tests pass with only `self`-form assertions rewritten.

### Implementation for User Story 2

- [x] T013 [US2] Re-express `src/themes/platformer/contracts/Outcome.ts`: `PlayerEffects { effects?: readonly HitEffect[] }`; `CollisionOutcome { selfEffects?: readonly HitEffect[] }` with `self?: S` deleted and the `<S>` parameter removed; add `Contact.awayDirection: -1 | 1`; keep `RewardEffects`/`DefeatApi`. Update `contracts/Outcome.test.ts`. Depends on T003.
- [x] T014 [P] [US2] Add the **enemy adapter** + `EnemyHitResult` to `engine/HitResolver.ts`: `damage` = one `takeHit` per point then `onDamaged`; `reaction` folded (no-op, entered by `takeHit`). Extend `engine/HitResolver.test.ts`; keep `entities/Enemy.test.ts`'s `applyEnemyDamage` assertions valid. Depends on T003.
- [x] T015 [US2] Add the **block adapter** + `BlockHitResult` to `engine/HitResolver.ts`: `damage` = `amount` × `applyBlockHit`, saturating at `isBlockUsedUp`; return `outcome` from `BLOCK_TYPES[next.blockKind].onHit?.(next) ?? {}`. Extend `engine/HitResolver.test.ts`. Depends on T003.
- [x] T016 [US2] Migrate the enemy kinds `entities/enemies/SlimeGreen.ts`, `SlimePurple.ts`, `Bee.ts`: a stomp returns `{ selfEffects:[damage 1, reaction], effects:[velocity{y: DEFAULT_STOMP_BOUNCE_VY, preserveJump:true}] }`; a side contact `{ effects:[damage 1, velocity{x: contact.awayDirection*DEFAULT_HIT_KNOCKBACK.vx, duration: DEFAULT_HIT_KNOCKBACK.duration}] }`; purple's spiked top adds `velocity{y: SLIME_PURPLE_SPIKE_REBOUND_VY, preserveJump:true}` (D13). **Remove `takeHit` imports**; rewrite the `outcome.self` assertions in `SlimePurple.test.ts`/`Bee.test.ts` to `selfEffects` (never weaken). Depends on T013.
- [x] T017 [US2] Update `engine/Collision.ts`'s `resolveEnemyContacts` per [contracts/migration-matrix.md](./contracts/migration-matrix.md) §1: apply each `selfEffects` via `resolveHitEffects`, derive `damagedEnemyIds` from `damaged`, aggregate `bounceEffects` (strongest `y`, unguarded) and `hitEffects` (max `damage`; the first max-damage contact's `x`/`duration`; the strongest `y`; `preserveJump` if any; `reaction` when damage > 0), and return `knockbackDirection`. Update `engine/Collision.test.ts` (assertions preserved). Depends on T013, T014, T016.
- [x] T018 [US2] Migrate `entities/blocks/BlockType.ts` (`BlockHitOutcome` effects-based) and `entities/blocks/pot.ts` (`onHit` returns `{ effects:[velocity{y: POT_BOUNCE_VY, preserveJump:true}] }`); migrate every other block kind that returned a `PlayerEffects` field. Update the block-kind tests (`pot`, `Crate`, others). Depends on T013.
- [x] T034 [US2] Colocate the hit-impulse constants (research D13, executed after T033): create `shared/knockback.ts` (`DEFAULT_HIT_KNOCKBACK`, `DEFAULT_STOMP_BOUNCE_VY`); add `SLIME_PURPLE_SPIKE_REBOUND_VY` (`SlimePurple.ts`), `POT_BOUNCE_VY` (`pot.ts`) and `MUSHROOM_BOUNCE_VY` (`bouncyMushroom.ts`); remove the six impulse fields from `contracts/PhysicsConfig.ts` (keeping general movement only); retarget every consumer (`PlatformerPage.tsx`, `engine/BombSystem.ts`, the kinds/tile) and every referencing test. Behaviour-identical (values unchanged). Depends on T016, T018.
- [x] T019 [US2] Rewire the block bump loop in `PlatformerPage.tsx` (~1926–1957) to `resolveHitEffects(block, [{ damage, amount: 1 }])`, keep `resolveBlockTerminalOutcome` as the applier for the returned outcome, and read the outgoing bounce from the outcome's `effects` for the T011 aggregation. Depends on T015, T018.
- [x] T020 [US2] Run `npm test`; run the no-`self` greps from [quickstart.md](./quickstart.md) §2. **Checkpoint — US2.** Do not commit.

**Checkpoint**: Kinds speak `HitEffect`; the stomp and block hit go through the resolver.

---

## Phase 5: User Story 3 - Bombs are resolved by `BombSystem` (Priority: P1)

**Goal**: `engine/BombSystem.ts` resolves the blast into a `BlastDelta` — blocks to destroy, enemies to
hit, the player's effect list plus a splatter request, and the explosion requests (FR-011–FR-013).

**Independent Test**: `rg "blastTiles|blocksInBlast|enemiesInBlast|playerInBlast|BOMB_DAMAGE" src/themes/platformer/PlatformerPage.tsx`
finds no match; the `bombs (O-012)` suite, the crouched-blast test and `engine/Blast.test.ts` pass
unchanged.

### Implementation for User Story 3

- [x] T021 [US3] Rework `src/themes/platformer/engine/BombSystem.ts` per [contracts/bomb-system.md](./contracts/bomb-system.md) §1–§2: `BlastWorld { level, player, blocks, enemies }` (drop `originX`/`originY`), `BlastDelta { blocks, terminalBlockIds, enemies, damagedEnemyIds, playerEffects?, playerSplatter?, explosions }`, and `resolveBlasts` driving blocks to terminal with `damage{amount: BLOCK_TYPES[kind].maxHits}`, enemies with `[damage BOMB_DAMAGE, reaction]`, the single player `[damage, reaction, velocity (omitted if crouched)]`, and `playerSplatter = { side, id: blast.hitEffectId }` only when the hit survives. Update `engine/BombSystem.test.ts`. Depends on T004, T014, T015.
- [x] T022 [US3] Replace the inline blast loop in `PlatformerPage.tsx` (~2024–2073) with `resolveBlasts(blasts, { level, player: next, blocks, enemies })` + the apply steps: assign `delta.blocks` and run `resolveBlockTerminalOutcome` per `terminalBlockIds`; assign `delta.enemies`; apply `delta.playerEffects` via `resolveHitEffects(next, …)`; spawn `delta.playerSplatter` via `playerEffectAnchor(…, 'center')` + `startPlayerHitSplatter`; spawn `delta.explosions`. Keep the crates popup gated by `crateDestroyedThisTick`. Depends on T021.
- [x] T023 [US3] Run `npm test`; run the SC-002 bomb greps from [quickstart.md](./quickstart.md) §2. **Checkpoint — US3.** Do not commit.

**Checkpoint**: The blast is resolved by `BombSystem`; the page holds no bomb internals.

---

## Phase 6: User Story 4 - The refactor changes nothing the player sees (Priority: P1)

**Goal**: Prove parity and lock the structure with the FR-016 guard (FR-014–FR-018, SC-001/002/005/006).

### Implementation for User Story 4

- [x] T024 [US4] Write `src/themes/platformer/engine/hitStructure.test.ts` per [contracts/layer-invariants.md](./contracts/layer-invariants.md) SI-1…SI-7 (test-only `node:fs`/`node:path` scan, frozen expectations): one `HitEffect` declaration with exactly the three primitives and no use-case member; one `resolveHitEffects`/`resolveBlasts` entry; no longhand damage shape outside the resolver + `Player.ts` (tests excluded); no kind-level `takeHit`/`applyEnemyDamage`/`self` and no field vocabulary in `contracts/Outcome.ts`; no bomb internals in the page; no compatibility re-export; the R-001 `FORBIDDEN_EDGES` scan. Assemble searched tokens from fragments so the guard does not trip the quickstart greps. Depends on T023.
- [x] T025 [US4] Prove the guard non-vacuous: temporarily reintroduce one regression (e.g. a `takeDamage(` call or a `blastTiles` reference in the page), run `npx vitest run src/themes/platformer/engine/hitStructure.test.ts`, confirm a failure, then revert. Record the result. Depends on T024.
- [x] T026 [US4] Test-preservation audit (FR-017): diff pre/post `**/*.test.ts(x)` sets and assertion counts against T002's baseline; confirm zero deleted/skipped tests and only the sanctioned `self`→`selfEffects` rewrites. Record the audit. Depends on T012, T020, T023.
- [x] T027 [US4] Behavioural parity check (SC-005): run `npm test`, `npm run build`, `npm run lint` (all MUST pass, no new dependency, no bundle regression) and the full [quickstart.md](./quickstart.md) §2 grep set. Depends on T024.
- [ ] T028 [US4] Manual browser check per [quickstart.md](./quickstart.md) §4 against the pre-refactor build: every damage source, each crouched hit, pit fall, standing/crouched blasts, crate destruction, green-slime kill, purple-slime wound, second-bomb untouched, stomp/pot/mushroom bounce, death/respawn, and every splatter/explosion visual. **Checkpoint — US4 (behaviour gate).** Do not commit.

**Checkpoint**: The restructuring is invisible; the guard locks it in.

---

## Phase 7: User Story 5 - A new source or effect is a local addition (Priority: P2)

- [x] T029 [P] [US5] Add extensibility cases to `engine/HitResolver.test.ts`: a velocity-only list moves a target with no damage/reaction; a damage-only list damages without moving; a foreign primitive (e.g. `velocity` on an enemy) is ignored and the rest still applies; assert no source-identity branching exists by exercising two different sources with the same list. Depends on T004.
- [x] T030 [US5] Update [contracts/hit-effect-vocabulary.md](./contracts/hit-effect-vocabulary.md) §4 and [data-model.md](./data-model.md) §1 with the "adding a primitive or source" recipe (one union member + one handler per family; a family ignores unknown members), so the extension contract is documented. Depends on T029.

**Checkpoint**: Adding a source or primitive is a local, documented addition.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T031 [P] Update `docs/Features.md`'s dependency diagram per `AGENTS.md`: prefix the `R011` node label with `✅ ` and add `class R011 done` alongside its category class. Do not add a feature list or status table.
- [x] T032 [P] Run the [quickstart.md](./quickstart.md) §2 structural greps and §3 unit-level parity checks end-to-end (SC-001–SC-006); confirm `engine/Blast.ts`, `entities/deployableItems/Bomb.ts`/`DeployableItemType.ts` and `engine/effects/**` are unmodified.
- [x] T033 Final audit: confirm no compatibility re-export or second path survives (no longhand shape, no `self`, no page bomb internals, no `Impact`/use-case member); confirm no gameplay/art/tuning/level-data/HUD change (FR-017); run `npm test`, `npm run build`, `npm run lint` one last time. **No auto-commit.**

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; **BLOCKS** all stories.
- **US1 (Phase 3)**: depends on T004/T005.
- **US2 (Phase 4)**: depends on Foundational; after US1 (its aggregates are validated first).
- **US3 (Phase 5)**: depends on Foundational + US2's enemy/block adapters.
- **US4 (Phase 6)**: depends on US1–US3.
- **US5 (Phase 7)**: depends on T004.
- **Polish (Phase 8)**: depends on all phases.

### Parallel Opportunities

- **Foundational**: T003 independent; T004/T005 after it.
- **US2**: T014 (enemy adapter) and T015 (block adapter) share `engine/HitResolver.ts` — run sequentially; T016 (kinds) and T018 (blocks) touch disjoint files.
- **Polish**: T031/T032 independent.

---

## Requirements Coverage

| Requirement                                                | Tasks                              |
| ---------------------------------------------------------- | ---------------------------------- |
| FR-001 (generic primitives, no container/source)           | T003, T013                         |
| FR-002 (damage/velocity/reaction, any subset/order)        | T003, T029                         |
| FR-003 (one resolver, per-family adapters, state only)     | T004, T014, T015, T030             |
| FR-004 (per-family semantics preserved; visuals via R-004) | T004, T014, T015, T021             |
| FR-005 (cascade: block onHit / defeat rewards)             | T018, T019                         |
| FR-006 (five sources emit effect lists)                    | T007–T011, T022                    |
| FR-007 (call points/targets preserved)                     | T007–T011, T022                    |
| FR-008 (one `playerEffectAnchor`; visuals stay R-004)      | T005, T007–T009, T022              |
| FR-009 (block/enemy paths share the model)                 | T016–T019, T021                    |
| FR-010 (`PlayerEffects` reconciled)                        | T013, T016, T018                   |
| FR-011 (`BombSystem` owns blast resolution)                | T021, T022                         |
| FR-012 (consume R-008, no fuse re-owning)                  | T021, T032                         |
| FR-013 (blast behaviour preserved)                         | T021, T022, T027                   |
| FR-014 (R-001 edges unwidened)                             | T024, T027                         |
| FR-015 (no longhand shape survives)                        | T007–T011, T019, T022, T024        |
| FR-016 (guard test)                                        | T024, T025                         |
| FR-017 (tests migrate/pass/build)                          | T026, T027, T033                   |
| FR-018 (no compatibility shim)                             | T024, T033                         |
| SC-001 (longhand shape gone)                               | T007–T011, T024                    |
| SC-002 (bomb loop gone)                                    | T021, T022, T024                   |
| SC-003 (local addition)                                    | T029, T030                         |
| SC-004 (suite + build green)                               | T006, T012, T020, T023, T027, T033 |
| SC-005 (behaviour identical)                               | T002, T027, T028                   |
| SC-006 (layer edges unchanged)                             | T024, T027                         |
| SC-007 (no test weakened)                                  | T026                               |

---

## Notes

- **Generic primitives only**: no `Impact` container, no source union, no `knockback`/`push`/`lift`/
  `splatter`/`hit`/`destroy`/`lethal`. A new source composes `damage`/`velocity`/`reaction`; a new visual
  is a new R-004 effect.
- **Visuals stay in R-004**: sources spawn splatters/explosions via `spawnEffect(factory(...))`, with one
  `playerEffectAnchor` helper for the player's centre/feet anchor.
- **The resolver never gates invulnerability**: callers keep `!isInvulnerable(...)`/`!spearKilled`; the
  spear deals `damage{amount: player.hitPoints}`; the blast latch lives in `BombSystem`.
- **Blocks**: `damage` = hit count (bump `1`, blast `maxHits`); terminal outcome stays page-side.
- **R-008 consumed, not rebuilt**; R-004 factories/registry unmodified.
- **[P] tasks** = different files, no incomplete dependency; verify before running.
- **No auto-commit**: leave all changes uncommitted for review.
