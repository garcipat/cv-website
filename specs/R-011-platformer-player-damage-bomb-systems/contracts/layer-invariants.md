# Contract — Layer Invariants & Structural Guard

**Feature**: `R-011-platformer-player-damage-bombs` | **Spec**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

Normative form of spec FR-014…FR-018 and SC-006. The guard lives at
`src/themes/platformer/engine/hitStructure.test.ts` and fails the suite on any regression.

---

## 1. Layer placement

| Module                   | Layer             | May import                                                          | Must not import                                             |
| ------------------------ | ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `contracts/HitEffect.ts` | `contracts/` leaf | sibling `contracts/`, `../types`                                    | `engine/`, `entities/`, `level/`, `tiles/`, `state/`, React |
| `engine/HitResolver.ts`  | `engine/`         | `contracts/`, `shared/`, `level/`, `tiles/`, `entities/`, `engine/` | `state/`, `PlatformerState`, React                          |
| `engine/BombSystem.ts`   | `engine/`         | `contracts/`, `shared/`, `level/`, `tiles/`, `entities/`, `engine/` | `state/`, `PlatformerState`, React                          |

`contracts/Outcome.ts` stays a leaf: it imports the sibling `contracts/HitEffect.ts` only.

## 2. Forbidden edges (unchanged from R-001/R-015)

```
contracts/ → { engine/, entities/, level/, tiles/, state/ }
level/     → engine/
engine/    → state/
tiles/     → { entities/, engine/ }
level/     → React
editor/ops|dev/ → React/.tsx
```

R-011 adds no exception. `HitResolver`/`BombSystem` take plain values and return data; the page/state
applies.

## 3. Structural invariants

- **SI-1 (vocabulary)** — `contracts/HitEffect.ts` declares `HitEffect` exactly once, with exactly
  the three primitives (`damage`/`velocity`/`reaction`) and no use-case member
  (`knockback`/`push`/`lift`/`splatter`/`hit`/`destroy`/`lethal`) or `Impact`/`ImpactSource`.
- **SI-2 (single resolver)** — `resolveHitEffects` is the only exported hit-resolution entry point;
  `resolveBlasts` the only exported blast entry.
- **SI-3 (no longhand shape)** — outside `engine/HitResolver.ts` and `entities/Player.ts` (and
  `*.test.ts(x)`), no module calls `takeDamage`/`applyHitReaction`/`beginPitFallReaction` or
  reconstructs `{ ...player, hitPoints, alive }`.
- **SI-4 (no kind-level hit / field vocabulary)** — no module under `entities/enemies/**` or
  `entities/blocks/**` imports `takeHit`/`applyEnemyDamage`, and no `onPlayerCollide`/`onHit` returns
  a `self` field; `contracts/Outcome.ts` declares no `damagePlayer`/`knockback`/`bounceVelocity`/`self`.
  The engine's resolved-contact aggregates (`EnemyContactResult`/`HazardContactResult`) are exempt.
- **SI-5 (no bomb internals in the page)** — `PlatformerPage.tsx` references none of `blastTiles`,
  `blocksInBlast`, `enemiesInBlast`, `playerInBlast`, `BOMB_DAMAGE`.
- **SI-6 (no compatibility shim)** — no barrel/alias/re-export provides a removed per-site helper,
  `self`, or the old field vocabulary.
- **SI-7 (parity tests exist)** — the frozen parity suites are present.

## 4. Guard implementation notes

- Test-only `node:fs`/`node:path` scanning (R-015/R-010 precedent); reuse R-015's `FORBIDDEN_EDGES`
  for §2.
- Assemble searched-for tokens from fragments so the guard's own source does not trip the quickstart
  greps.
- Frozen expectations; the guard MUST fail when an invariant is deliberately regressed (non-vacuous).
- Test names follow `{method}-{condition}-{expected-result}` (docs/TestingGuide.md).

## 5. Test-preservation invariant

No test may be deleted, skipped or weakened (spec FR-017, constitution Principle II). Consolidated
symbols (`self`-based enemy assertions) are rewritten against the shared form, never dropped.
