# Capability Refactor — Rollout and Verification

The ordered path from today's code to the accepted design, and what proves each step
worked. Detail for each step lives in its own plan; this is the sequence and the gates.

**Design:** `2026-09-02-entity-actor-hierarchy-proposal.md` (accepted)

## Standing gates — every step, without exception

| Gate | Command | Passing means |
|---|---|---|
| Tests | `npm test` | every pre-existing assertion unchanged and green |
| Types | `npx tsc -b --noEmit` | **no output at all** |
| Lint | `npx eslint src/themes/platformer` | **exactly one** error — the pre-existing `ControlsOverlay.tsx:125` |

Lint is not optional. `tsc` and Vitest do not catch lint-only rules; six errors once
accumulated across four otherwise-clean task reviews because lint was missing from the
reviewer prompts. eslint is slow here — allow a generous timeout.

**Browser checks use a FRESH TAB.** Once Vite's client HMR runtime throws during editing,
that tab stays wedged — a reload does not recover it, and neither does restarting the dev
server. This has produced convincing false alarms, including an apparently dead game loop.

## The sequence

Steps are ordered so that every behavioral change lands on a foundation already proven
type-level. Steps 1-4 cannot change behavior at all; 5 onward can.

| # | Step | Plan | Risk | What proves it |
|---|---|---|---|---|
| 1 | Split `Entity.ts` into `geometry.ts` + `capabilities.ts`; add `Moving` / `SelfAnimated` / `Damageable`; enemy state composes all three; delete `Entity` | A | type-level | Standing gates. `grep -rn "entities/Entity" src/` returns nothing. |
| 2 | `BlockState` composes `SelfAnimated` | A | type-level | Standing gates. **Decision point — see below.** |
| 3 | `PlayerState.facing` → `direction` | A | rename only | Standing gates, plus `Physics.test.ts` unmodified apart from the rename. **Browser:** player faces its movement direction; sprite still mirrors left. |
| 4 | `PlayerState` composes `Moving` + `SelfAnimated` | A | type-level | Standing gates. |
| 5 | Player health moves onto `PlayerState` as `hitPoints` (6) and `alive` | B | **behavioral** | **Browser:** take a pit fall and an enemy hit — hearts decrease correctly; at zero the death/respawn iris still plays. |
| 6 | `invincibleTimer` + enemy `hitTimer` unified into `Damageable.hitTimer` counting up, duration on the type | B | **behavioral** | **Browser:** after a hit the player blinks for ~1.2s and a second touch does not land during it; a stomped slime is harmless during its ~0.4s reaction. |
| 7 | `DamageableType` with `onDamaged` / `onDeath`; purple's spike growth moves out of `onPlayerCollide` | B | **behavioral** | `EnemyContact.contract.test.ts` unmodified. **Browser:** spikes still grow on a non-fatal stomp and retract on the same timing. |
| 8 | `WorldType` added; the four type modules extend it; `ChestType` gains `box()` | C | type-level | Standing gates. The chest's `box()` must return the rect `chestPlayerIsStandingOn` builds today, `CHEST_CLOSED_OFFSET_X` included. |
| 9 | `chestPlayerIsStandingOn` reads `ChestType.box()` | C | **behavioral** | **Browser:** standing on a closed chest with a key still opens it; standing without one still shows the locked hint. |
| 10 | Signs get a `box()`; `checkSignOverlap` reads it | C | **behavioral** | **Browser:** walking past each sign still shows its hint at the same spot. |
| 11 | The three overlap functions collapse into one trigger helper | C | **behavioral** | **Browser:** collect a coin, a fruit, a dropped key and a bonus fruit; open a chest; pass a sign. All four eligibility rules still hold. |

## Two decisions to settle before the steps that need them

**Before step 2 — does a block satisfy all of `SelfAnimated`?**
`BlockState` has `animState` and `animTimer` but **no `animFrame`**; a block's appearance
comes from `BLOCK_TYPES[kind].frameIndex(hitsTaken)`. If that holds, forcing
`animFrame: 0` onto it would be exactly the dead field this refactor exists to remove.
Plan A's Task 2 is written to **stop and report** rather than decide. The resolution is
either splitting `SelfAnimated` into a timer part and a frame part, or blocks keeping
their own two fields and not composing it. Both are defensible.

**Before step 7 — is `DamageableType` in scope?**
The type-side counterpart to `Damageable`: `maxHitPoints`, `hitReactionSeconds`,
`onDamaged?`, `onDeath?`, extended by `EnemyType` and `PLAYER_TYPE`. It gives purple's
spike growth a home separate from interpreting a contact, and makes "add a damageable
thing" mean composing two halves. Not yet in the proposal; folding it in is cheaper than
discovering it mid-Plan-B.

## Verification that spans the whole rollout

Three invariants must hold after **every** step, not just at the end. Each has been a
real defect in this codebase's history, so they are checked rather than assumed.

- **`EnemyContact.contract.test.ts`'s `CONTACT_CASES` and `expected` blocks stay
  byte-identical.** They pin collision behavior and have survived four refactors
  unchanged. Construction helpers may change; expectations may not.
- **No test is deleted whose behavior is still live.** A shrinking suite once hid four
  lost assertions behind a correct-looking "these called a deleted alias" explanation —
  the alias was gone, the behavior was not. Account for every deletion.
- **Terrain never becomes entities.** Only markers that can change carry state — six
  stateful blocks against hundreds of terrain tiles. A new static decorative tile is a
  terrain character and a `tileSource` case, never a block type.

## Rollback

Every step is its own commit, and steps 1-4 and 8 are type-level, so a bad step reverts
cleanly. The behavioral steps each change one mechanism: health storage (5), the
refractory window (6), damage hooks (7), and one trigger's geometry apiece (9, 10, 11).
None depends on a later one, so any single step can be reverted without unwinding the
rest.

The exception is step 6, which touches both the player's and the enemy's damage path in
one change. If it needs reverting, step 5 stands on its own.
