# Quickstart: Validating the Platformer Transient Effect Registry (R-004)

**Feature**: `specs/R-004-platformer-transient-effect-registry/` | **Date**: 2026-09-25

This guide proves the refactor end-to-end. It is a validation/run guide only — implementation details live in [plan.md](./plan.md), [data-model.md](./data-model.md), and [contracts/](./contracts/).

## Prerequisites

- Node + npm installed; repository at the feature branch `R-004-platformer-transient-effect-registry`.
- `npm install` run from the repo root.
- No new dependency is expected; if `package.json` changed, treat it as a defect (FR-019).

## 1. Automated checks

```bash
npm test          # Vitest — must be green
npm run build     # production build — must succeed
```

Expected: every existing test passes, updated only for import paths/signatures/locations (FR-014); the build succeeds (SC-007).

New/updated test coverage to confirm exists:

- **Registry contract**: one `TransientEffect<S>` base, one registry; a throwaway registered kind starts, advances, draws, and expires with no edit to state/tick/draw/reset (US1-5/SC-003).
- **Advance boundaries**: each family's exact expiry (`>` for six, `phase === 'done'` for `flyingText`, `null` sentinel for counter popup) and the `dying` filtered advance (US5-3).
- **Keyed slot**: two same-type collects leave exactly one popup with the refreshed count/timer; different types coexist (US5-1).
- **Timed-tile core**: arm/prune/re-arm/`dt <= 0`/shake gating for all four callers (US2).
- **Particle byte-identity**: sparkle/splatter/debris outputs unchanged at sampled elapsed times (US3-3/SC-005).
- **Hazard relocation**: machine functions still pass, now imported from `entities/hazards/*`.

## 2. Structural checks (one-time import/code inspection)

Run from the repo root.

```bash
# FR-018: the old effect home and per-kind parallel paths are gone
test ! -f src/themes/platformer/engine/CollectionEffects.ts   # expect: file removed
rg "from '.*CollectionEffects" src/            # expect: no import statements
rg "activePuffs|activeHealAuraEffects|activeHitSplatters|activeCounterPopups|activeExplosions|activeFadeOutTexts|activeDebrisEffects" src/
#   expect: no signal declarations / consumers; only the unified activeEffects remains

# FR-003 / SC-001: exactly one collection, advance, and dispatch
rg "export const activeEffects" src/themes/platformer/PlatformerState.ts   # expect: exactly 1
rg "advanceEffects" src/                                                   # expect: one definition + call sites
rg "drawEffects\(" src/themes/platformer/PlatformerPage.tsx                # expect: 4 layer invocations (midWorld, worldEffects, aboveWorld, hudLast)

# FR-011 / SC-006: hazard machines moved, no orphan phase module
rg "from '.*(engine/FloorSpike|engine/FallingStalactite|hazards/phases)" src/   # expect: no import statements
ls src/themes/platformer/entities/hazards/                                 # expect: FloorSpike.ts, FallingStalactite.ts, no phases.ts

# FR-013 / SC-008: R-001 forbidden edges not widened
rg "from '.*engine/" src/themes/platformer/level/                          # expect: no matches (no level/ → engine/)
rg "from '.*(PlatformerState|state/)" src/themes/platformer/engine/        # expect: no matches (no engine/ → state/)
```

Expected outcomes: exactly one effect collection/advance/dispatch; zero per-kind effect signals in state; four invocations of the one dispatch preserving depth; no engine hazard modules or orphan `phases.ts`; no forbidden edges.

## 3. Manual browser pass (required — SC-007)

A passing suite is not evidence of visual equivalence. Start the dev server:

```bash
npm run dev
```

Play a level that exercises every effect and confirm **no visible or behavioural difference** from the pre-refactor build:

- Collect a coin and a bonus fruit — flying text rises/holds/flies; counter popups show per type and refresh in place on a quick second collect.
- Stomp a green and a purple slime — puff + splatter, key drop for the purple.
- Take damage / fall in a pit — red splatter; splatters keep spraying through the death lead-in while the world stays frozen.
- Take a heart — golden aura follows the moving player.
- Open a chest and break a crate/crumbling tile — label fade, debris.
- Detonate a bomb — explosion sits above world effects and below the counters.
- Trigger a floor spike and drop a falling stalactite — shake/rise/fall/shudder unchanged; stalactite shatter debris.
- Die to a spear — spear blood splatter.
- Press Reset Game, then die to confirm reset scope: death/respawn clears fading labels and the four timed-tile timers only; Reset Game clears the whole effect collection.

Layering spot-checks: the heal aura sits mid-world (over the player, under collectibles); explosions over world effects and under the counters; counter popups drawn last.

## 4. Timed-tile and hazard spot-checks (US2/US4)

- Bounce a mushroom repeatedly — the squash re-arms (replaces) and never stacks.
- Trigger a floor spike twice during its cycle — the second contact is a no-op; spike prunes after its cycle.
- Step on a crumbling tile — crack/broken/reform cycle; prune at cycle end.
- Arm a stalactite — `gone` persists for the attempt and only death/respawn re-hangs it.
- Open the level editor — hazard palette/preview unchanged; no editor reference to the removed engine machines.

## 5. Recipe validation (US6 / SC-011)

Follow the contributor recipe shipped with the feature to add a throwaway effect. Confirm the **only** files edited are the new effect module and one registry line — not `PlatformerState.ts`'s collection/tick, the draw pass, or reset code. The throwaway kind must start, advance, draw, and expire in-game, then be removed.

## 6. Definition of done

- [ ] `npm test` green and `npm run build` succeeds.
- [ ] Structural + import-invariant checks in §2 pass.
- [ ] Manual browser pass (§3) and timed-tile/hazard checks (§4) show no visible or behavioural difference.
- [ ] Recipe validation (§5) succeeds.
- [ ] `docs/Features.md` dependency diagram updated for R-004 (at implementation completion, per [AGENTS.md](../../AGENTS.md)).
