# Quickstart — Platformer Registry Dispatch Completion (R-007)

How to build, verify, and manually confirm this refactor. No new tooling, dependency, or data is
involved; the acceptance bar is **behaviour preservation** with the dispatch moved behind the enemy /
hazard registries (SC-005/SC-006).

## 1. Install & run

```bash
npm install        # no new dependencies — re-run only to ensure a clean tree
npm run dev        # Vite dev server; open the platformer theme
```

There is no server/API/DB (static site, [docs/Architecture.md](../../docs/Architecture.md)). The
platformer renders to a `<canvas>` in the web app.

## 2. Tests

```bash
npm test             # single run (Vitest + jsdom)
npm run test:watch   # watch mode while working
npm run build        # production build must succeed (FR-011/SC-005)
```

Per [docs/TestingGuide.md](../../docs/TestingGuide.md), tests follow
`{method}-{condition}-{expected-result}` naming with `// Arrange / Act / Assert` where a section spans
more than one line. Every `engine/`, `entities/`, and `level/` module carries a co-located `.test.ts`.

**Acceptance (FR-011/SC-005):** the full suite passes with the production build. Existing tests were
relocated and re-expressed around the new hooks/applier/metadata only — never deleted, skipped or
weakened. The restructured suites are:

- `engine/Collision.test.ts` — `checkFloorSpikeTriggers` + `checkFallingStalactiteTriggers` describes →
  `checkHazardArmTriggers` (same fixtures, same expected ids).
- `PlatformerPage.test.tsx` — the enemy-defeat and hazard-damage describes → `applyEnemyDefeats` /
  `typeOf(hazard).knocksBack` forms; the `spawnKeyPickup` defeat fixture (line ~1695) becomes an
  `onDefeat`-routed assertion.
- `PlatformerState.test.ts` — `hazardPlacementsForTick` assertions re-expressed against the generic
  form (same phase/extension/offset/shake values).
- `entities/enemies/index.test.ts` — "heldItem drop wiring" → "onDefeat wiring" (heldItem assertions
  stay, re-typed `PickupKind`).

New co-located coverage: `state/enemyRewards.test.ts` (puff/gating/hook-invocation/bump-dedup), and
`entities/hazards/*.test.ts` (`knocksBack`, `withTickState`, `armTriggerRects` per kind).

## 3. Static inspection (the feature's independent tests)

One-time manual import-graph / grep checks, mirroring R-001/R-002/R-006's convention (no new automated
boundary test).

**No `ItemKind`, no page-side spawn (SC-001/SC-002):**
```bash
rg "ItemKind" src/themes/platformer                                                        # no matches
rg "spawnKeyPickup" src/themes/platformer/PlatformerPage.tsx                              # no import/call
rg "heldItem === 'key'|enemy\.type === 'slimeGreen'" src/themes/platformer/PlatformerPage.tsx   # no matches
rg "applyEnemyDefeats" src/themes/platformer                                              # defined once + one call site
```

**No hazard kind branch in the three layers (SC-003):**
```bash
rg "hazardType === |hazardType !== " src/themes/platformer/PlatformerState.ts src/themes/platformer/engine/Collision.ts src/themes/platformer/PlatformerPage.tsx   # no matches
rg "checkFloorSpikeTriggers|checkFallingStalactiteTriggers|armFloorSpikeTrigger|armFallingStalactiteTrigger" src/themes/platformer   # no matches
rg "checkHazardArmTriggers|armHazardTrigger|knocksBack|withTickState" src/themes/platformer   # defined once each + call sites
```

**Contracts stays a leaf (SC-008):**
```bash
rg "from '\.\./(engine|entities|level)/|from '\.\./\.\./(engine|entities|level)/" src/themes/platformer/contracts   # no matches
```

## 4. Manual browser pass (SC-006 — required by the constitution)

Visible behaviour is unchanged, so a passing suite is not sufficient. In the running theme:

1. Stomp a green slime — its course fact(s) reveal (one flying text per fact) and the enemies HUD
   counter bumps once, showing the defeated/total count; a fact-less green slime still bumps the
   counter.
2. Stomp a purple slime — the held key drops and bobs; a revived-and-redefeated purple slime puffs but
   drops nothing further.
3. Stomp a bee — it puffs but rewards and counts nothing.
4. Stand on a floor spike and a spear — the floor spike deals no-knockback half-heart damage; the spear
   pushes the player away; crouching through any hazard never knocks back.
5. Walk under a falling stalactite — it shakes then falls, dealing no-knockback damage; the trigger
   arms exactly once.
6. Collect a coin, break a crate, and hit a question-mark block — coin/crate/fruit counters and the
   journal totals are numerically identical to before.
7. Die/respawn and use Reset Game — enemy `rewardGiven`/`deathEffectGiven` flags, counter totals, and
   reset scopes behave exactly as before.
8. Open the journal — the five totals and two progress counters match the pre-refactor build.

## 5. Expected outcome

No gameplay, tuning, visual, level-data or translation difference; the only changes are that enemy
defeat rewards and hazard knockback/tick/trigger state dispatch through their registries instead of
hand-coded kind switches. The build and full test suite are green, and
`docs/Features.md`'s dependency diagram is updated once implementation and tests are done.
