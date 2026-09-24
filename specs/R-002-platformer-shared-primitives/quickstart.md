# Quickstart — Platformer Shared Primitives & Dedup (R-002)

How to build, verify, and manually confirm this refactor. No new tooling or data is involved; the
acceptance bar is behavior preservation.

## 1. Install & run

```bash
npm install        # no new dependencies — re-run only to ensure a clean tree
npm run dev        # Vite dev server; open the platformer theme
```

There is no server/API/DB (static site, [docs/Architecture.md](../../docs/Architecture.md)). The
platformer renders to a `<canvas>` in the web app.

## 2. Tests

```bash
npm test           # single run (Vitest + jsdom)
npm run test:watch # watch mode while working
```

Per [docs/TestingGuide.md](../../docs/TestingGuide.md), tests follow `{method}-{condition}-{expected-result}`
naming with `// Arrange / Act / Assert` where a section spans more than one line. Every `engine/`,
`entities/`, and `level/` module carries a co-located `.test.ts`.

**Acceptance (FR-024, SC-006):** the full suite passes. Existing tests were *relocated only* (import
paths updated), never deleted or weakened. New pure modules (`shared/math`, `TileAtlas`,
`layoutFile`, `findLandingRow`) carry co-located unit tests.

## 3. Static inspection (the phase's independent tests)

These are one-time manual import-graph / grep checks, mirroring R-001's "one-time manual import
inspection" convention (no new automated boundary test).

**Math primitives defined once (SC-001):**
```bash
# each primitive's formula appears only in shared/math.ts
rg "t \* t \* \(3 - 2 \* t\)" src/themes/platformer        # smoothstep → shared/math.ts only
rg "374761393" src/themes/platformer                       # hash constant → shared/math.ts only
rg "Math\.sin\(elapsed \* 40\)" src/themes/platformer      # shake → shared/math.ts only
```
Each former site now *imports* from `shared/math.ts` (FR-003).

**One landing-row scan (SC-002):**
```bash
# no module contains its own downward scan; all three call findLandingRow
rg "for \(let row = fromRow \+ 1|bombLandingRow|ladderLandingRow|fallingStalactiteLandingRow" src/themes/platformer
```
The three callers pass their own predicate and keep their own off-by-one adjustment (research R2).

**One TileAtlas (SC-003):**
```bash
rg "QuarterTurns|ATLAS_STRIDE" src/themes/platformer      # defined once in engine/TileAtlas.ts
```

**Kind unions derived (SC-005):**
```bash
rg "keyof typeof HAZARD_TYPES|keyof typeof BLOCK_TYPES" src/themes/platformer/entities
```
Adding a registry entry extends the union without editing a parallel list.

**Dead code gone (SC-007):**
```bash
rg "stepEnemyPatrol|IrisTransition|coinFrameSource|pickups/Fruit" src/themes/platformer
```
No references remain (except documentation). `contracts/Contact.ts` is gone; importers use
`contracts/Outcome.ts`.

**Layer invariants (FR-025):**
```bash
# contracts/ stays a leaf; no level/ → engine/; no engine/ → state
rg "from '\.\./engine|from '\.\./\.\./engine|from '\./engine" src/themes/platformer/level src/themes/platformer/contracts
```

## 4. Manual browser pass (SC-006)

The constitution's "changes with visible behavior must be verified by a manual browser check" rule
applies — a passing suite is not proof the game looks right. Open a cave level and confirm **no visible
difference** vs. before the refactor:

1. **Torches** — flame animation and light glow unchanged; a torch placed in the editor survives a
   **save → reload** round-trip (this is the fixed bug, SC-004).
2. **Falling stalactites** — shake telegraph then drop; rest position identical.
3. **Bombs** — fuse, fall, rest row, detonation, and "falls out of an open shaft" behavior identical.
4. **Ladders** — unroll to the same landing row, including over crumbly/occupied cells.
5. **Ground & background terrain** — tile shapes, rotations, and variant placement identical.
6. **Player light / fog / enemy eyes** — darkness, fog haze, and eye markers unchanged.
7. **The HUD coin counter icon** still renders correctly (its icon frame now comes from
   `frameSource(COIN_SHEET, 0)` after `coinFrameSource` was removed).

## 5. Production build

```bash
npm run build
```
Must succeed with no new dependency and no bundle regression (constitution Principle V).

## 6. Completion tracking

When implementation **and** tests are fully done, update `docs/Features.md` — prefix the `R002` node
label with `✅ ` and add `class R002 done` to the dependency diagram (per
[AGENTS.md](../../AGENTS.md) feature-tracking rules). Do not commit; wait for an explicit request.
