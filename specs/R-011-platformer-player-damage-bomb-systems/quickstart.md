# Quickstart — R-011 Platformer Player Damage & Bomb Systems

**Feature**: `R-011-platformer-player-damage-bombs`
**Purpose**: runnable checks that prove the refactor landed **and** that the game plays exactly as
before. Details live in [data-model.md](./data-model.md) and [contracts/](./contracts/).

---

## Prerequisites

- Node ≥ 24, npm ≥ 10; `npm install`.
- Run the guard greps against the **working tree** (the refactor is intentionally left uncommitted).

## 1. Automated suite + build (SC-004)

```bash
npm test        # full Vitest suite, including engine/hitStructure.test.ts
npm run build   # tsc -b && vite build — must succeed
npm run lint    # eslint — must pass
```

Expected: all existing damage/knockback/splatter/death/bomb tests pass with assertions preserved
(only `self`-based enemy assertions rewritten to `selfEffects`), the new guard passes, build succeeds.
No new dependency.

## 2. Structural invariants (SC-001, SC-002, SC-006)

`engine/hitStructure.test.ts` is the authority; these greps are a manual cross-check (repo root).

```bash
# SC-001: the longhand damage shape is gone from the sources
rg "takeDamage\(|applyHitReaction\(|beginPitFallReaction\(" src/themes/platformer/PlatformerPage.tsx   # → none
rg "hitPoints, alive" src/themes/platformer/PlatformerPage.tsx                                          # → none

# SC-002: the bomb blast loop is gone; geometry lives in one place
rg "blastTiles|blocksInBlast|enemiesInBlast|playerInBlast|BOMB_DAMAGE" src/themes/platformer/PlatformerPage.tsx  # → none
rg "export function resolveBlasts" src/themes/platformer/engine    # → one (BombSystem)
rg "export function resolveHitEffects" src/themes/platformer/engine # → one (HitResolver)

# vocabulary: three primitives, no use-case members, leaf-safe
rg "type HitEffect" src/themes/platformer/contracts/HitEffect.ts   # → one
rg "knockback|splatter|'hit'|'destroy'|lethal|ImpactSource" src/themes/platformer/contracts/HitEffect.ts  # → none
rg "from '\.\./(engine|entities|level|tiles|state)/" src/themes/platformer/contracts/HitEffect.ts         # → none

# no kind-level hit, no self field
rg "takeHit|applyEnemyDamage" src/themes/platformer/entities/enemies/SlimeGreen.ts src/themes/platformer/entities/enemies/SlimePurple.ts src/themes/platformer/entities/enemies/Bee.ts  # → none
rg "self\??:" src/themes/platformer/entities src/themes/platformer/engine    # → no outcome `self:`

# FR-014 / SC-006: no forbidden edges
rg "from '(\.\./)+state/" src/themes/platformer/engine
rg "from '(\.\./)+((engine|entities|level|state|editor|components)/|PlatformerState|PlatformerPage)" src/themes/platformer/contracts
# → both empty
```

## 3. Behavioural parity, unit level (SC-005)

- **Resolver**: unit-test `resolveHitEffects` per family — a velocity-only list moves without damage; a
  damage-only list damages without moving; `reaction{blinkOnly}` opens only the window; `velocity`
  reproduces `applyHitReaction`'s fields (`vx`/`direction`/`knockbackTimer`/`vy`/`bounceAscending`); a
  foreign primitive is ignored and the rest still applies.
- **Enemy stomp**: `SlimeGreen`/`SlimePurple`/`Bee` `onPlayerCollide` now return
  `selfEffects`/`effects`; `resolveEnemyContacts` produces the same `damagedEnemyIds`,
  `playerEffects` (max damage, strongest lift, first damaging direction) as before.
- **Bomb**: `resolveBlasts` reproduces the shipped blast — 21-tile interior, crate destroyed
  identically to a bump, question-mark untouched, green slime dies after its reaction, purple slime
  takes 2 and survives, second bomb untouched, one player hit per tick, crouched blast = damage no push.
- **Sites**: `PlatformerPage.test.tsx`'s damage/knockback/splatter/pit/spear/crouch suites keep their
  assertions.

## 4. Manual browser check (SC-005, constitution)

Because the change is visible-behaviour-preserving, the suite alone is not sufficient. With the
pre-refactor build available, `npm run dev` and confirm each plays identically:

1. Side hit from a slime and a bee; a purple slime's spiked top; a floor spike; a falling stalactite; a
   lethal spear (including while invulnerable).
2. A crouched hit of each — damage and flash, no displacement.
3. A pit fall — half heart, position recovery, no splatter.
4. A bomb blast standing and crouched; a blast that destroys a crate; one that kills a green slime;
   one that only wounds a purple slime; a second bomb in the blast untouched.
5. Death and respawn; the enemy stomp bounce; a pot land bounce; a mushroom-cap super-jump.
6. Visual check: every splatter colour/anchor and every explosion appears where before.

## 5. Done-when checklist

- [ ] `npm test`, `npm run build`, `npm run lint` pass.
- [ ] §2 greps show one vocabulary/resolver/system and no forbidden edges.
- [ ] §3 parity tests pass and §4 manual check is clean.
- [ ] `engine/hitStructure.test.ts` fails when an invariant is deliberately regressed (spot-check once).
- [ ] No commit is made; changes remain in the working tree for review.
