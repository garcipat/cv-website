# Quickstart — Verifying Platformer Core Contracts

**Feature**: R-001 | **Branch**: `R-001-platformer-core-contracts`

Verification for this refactor has four parts: the one-time manual import
inspection (SC-001), the full test suite (SC-003/FR-011), the production build
(FR-011), and a browser pass (SC-003). No new automated boundary test is added
(spec clarification).

---

## 1. Layer inspection (SC-001 / SC-002)

Run from the repo root (`rg` = ripgrep; on Windows Git Bash/WSL works too).

### 1.1 `contracts/` is a strict leaf

```powershell
rg "from '(\.\./)+((engine|entities|level|state|editor|components)/|PlatformerState|PlatformerPage)" src/themes/platformer/contracts
```

**Expected**: no output. `contracts/**` may import only `contracts/**` and `../types`.

### 1.2 No `level/ → engine/` edge (FR-008)

```powershell
rg "from '(\.\./)?engine/" src/themes/platformer/level
```

**Expected**: no output.

### 1.3 No `engine/ → PlatformerState` edge (FR-010)

```powershell
rg "PlatformerState|from '.*state/" src/themes/platformer/engine
```

**Expected**: no output (comments referencing `RewardReveal.ts` are fine; no
`import` statements).

### 1.4 No legacy paths required (FR-012)

```powershell
rg "engine/(Outcome|Contact|DrawContext|PhysicsConfig|Torch|RewardReveal)" src/themes/platformer
rg "entities/(WorldType|capabilities|geometry)" src/themes/platformer
```

**Expected**: matches may remain only inside **doc comments**. Every `import …
from` must point at `contracts/`, `entities/Torch.ts`, `entities/hazards/phases.ts`,
or `state/rewards`.

### 1.5 Spot-check the new homes

```powershell
rg "from '.*contracts/(WorldType|capabilities|geometry|Outcome|Contact|DrawContext|PhysicsConfig|SpriteLookup|PickupKind|counters)'" src/themes/platformer
```

**Expected**: each contract has importers and no two modules re-declare it.

---

## 2. Test suite (FR-011 / SC-003)

```powershell
npm test
```

**Expected**: all tests pass. No test was deleted, skipped, or weakened; only
import paths changed. Contract-related tests now live at:

- `contracts/Outcome.test.ts`
- `entities/Torch.test.ts`
- `state/rewards.test.ts`

`entities/WorldType.test.ts` and `entities/capabilities.test.ts` remain in
`entities/` unchanged except the latter's `./capabilities` import path.

---

## 3. Production build + lint (FR-011 / Principle I)

```powershell
npm run build
npm run lint
```

**Expected**: both succeed. `tsc -b` in strict mode with no `any` introduced.
The `PICKUP_TYPES` conformance clause and the `DrawContext<TPotPlan>` generic
must compile cleanly.

---

## 4. Browser pass (SC-003)

Start the dev server and manually exercise the moved code:

```powershell
npm run dev
```

Check that nothing player-visible changed:

1. **Torches** — enter the cave level; torches flicker and light the cave at the
   same radii as before (torch strength/scale preserved).
2. **Floor spikes** — trigger one; the delay → warning → full-extend → retract
   cycle and its damage are unchanged.
3. **Falling stalactites** — pass under one; the shake, fall, landing stop, and
   shatter look identical.
4. **Reward reveal** — defeat an enemy, open a chest, destroy a crate, and
   collect a coin; each produces the same journal entry, flight effect, and
   counter popup (now driven from `state/rewards.ts`).
5. **Editor** — open the level editor and confirm pot runs still render with
   their seam filler (the `DrawContext<PotRenderPlan>` wiring).

---

## 5. Feature completion tracking (Principle IV)

When implementation and tests are done, update the dependency diagram in
`docs/Features.md`:

```diff
-        R001["R-001: Platformer Core Contracts & Dependency Layers"]
+        R001["✅ R-001: Platformer Core Contracts & Dependency Layers"]

-    class R001,R002,R003,R004,R005,R006,R007,R008,R009,R011,R012 themes
+    class R001,R002,R003,R004,R005,R006,R007,R008,R009,R011,R012 themes
+    class R001 done
```

(Check the actual labels around the `R001` node before editing; the snippet
above matches the current file.)

---

## Rollback

This is a pure structural refactor. If verification fails, the safest rollback
is to revert the branch; no data migration, asset change, or gameplay tuning is
involved.
