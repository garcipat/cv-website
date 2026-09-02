# Entity Architecture — Follow-Ups

Companion to `2026-09-01-entity-architecture-design.md`. That document describes the
design; this one records what is **not** done, what the architecture actually costs
today, and the loose ends worth closing. Read it before picking any of this up.

## State of the architecture

| Family | Self-contained module | Owns its sprite | Owns its rendering | Owns its mechanics |
|---|---|---|---|---|
| Enemies | ✅ `entities/enemies/` | ✅ | ✅ | ✅ contact + tick hooks |
| Pickups | ✅ `entities/pickups/` | ✅ | ✅ | — geometry only |
| Blocks | ✅ `entities/blocks/` | ✅ | ✅ | — per-kind rules only |
| Chests | ✅ `entities/chests/` | ✅ | ✅ | — appearance only |
| **Player** | ❌ — no type module | ❌ | ❌ | ✅ composes `Moving`, `SelfAnimated`, `Damageable` |

Sprites are modelled as indexed sheets (`entities/sprites/`), discovered from the type
registries rather than from a hand-maintained asset list. `Renderer.ts` and
`Collision.ts` contain no enemy, pickup or block type literals.

State composes three capability interfaces — `Moving`, `SelfAnimated`, `Damageable` —
and the type layer composes `WorldType` (`key`, `draw`) with `Boxed` (`box`) and
`DamageableType` (`maxHitPoints`, `hitReactionSeconds`, `onDamaged`). Blocks compose
neither `SelfAnimated` nor `Boxed`: they have a timed transform rather than frame
animation, and physics locates them by grid cell rather than by rectangle.

**No hitbox is constructed inside `engine/Collision.ts`** except the player's own, and a
single `overlappingTriggers` helper resolves every player-versus-trigger overlap with
eligibility supplied by each caller.

## Remaining work, in the order I'd do it

### 1. Puff effects bound to world events, not fact rewards

The sparkle "puff" fires from `startFlightEffect` only when a CV fact is banked. So a
purple slime — which drops a key instead of carrying a fact — never puffs on defeat,
and a green slime defeated a second time doesn't either, because `rewardGiven`
short-circuits the reward path. `fragileRock` already needed a hand-rolled workaround
for the same reason (`PlatformerPage.tsx`, an empty-label `startFlightEffect` with all
coordinates equal), which is evidence the abstraction is inverted.

**Desired:** one seam that emits a world-event puff at a position, called wherever
something happens in the world — enemy defeated, block broken, pickup collected, chest
opened. The journal fact-flight stays a separate layer that fires only when a fact is
actually awarded, so a fact-bearing event shows both and a factless one still puffs.

This is the highest-value remaining item: it is visible and every family now has a
module hook to attach it to. Needs a `brainstorming` pass to agree the seam before
implementation. Filed as **B-003**.

### 2. A player type module

The player's *state* now composes all three capabilities and its damage model matches an
enemy's. What it still lacks is a **type module**: a `PLAYER_TYPE` holding
`PLAYER_SIDE_PADDING`, `PLAYER_HEAD_PADDING`, `PLAYER_FOOT_PADDING`, a sprite descriptor,
`maxHitPoints` and `hitReactionSeconds` — the numbers currently living as loose constants
— so the player composes `WorldType`, `Boxed` and `DamageableType` like every other
family.

**Genuinely low priority.** `Physics.ts` is ~500 lines and `Physics.test.ts` ~1250, there
is exactly one playable character, and the payoff is consistency rather than capability.

### 3. Pickup lifecycle

The four pickup types record "collected" three different ways: an external
`collectedCollectibleIds` Set for placed collectibles, a `collected` flag for dropped
keys, and removal from the array for bonus fruits. Plan 3 unified the overlap
*mechanism* while leaving each call site its own eligibility predicate.

Unifying the policy would move coins off the placements-plus-Set model that the Reset
Game respawn path reads — real behavioral risk in code the enemy refactor never
touched. The enemy lesson (flag, never remove, so instance state survives) probably
applies, but it needs its own design pass and its own regression net.

### 4. Blocks and chests in the contact model

Neither resolves through `Contact`/`CollisionOutcome`. A block is hit from below,
detected during ceiling collision in `Physics.ts`, which writes `player.hitBlockIds`;
there is no player-versus-block overlap test. A chest opens on standing on it AND
pressing Up AND holding a key.

Unifying them would require `Physics.ts` to emit contacts and `CollisionOutcome` to
carry input state — the latter would grow the shared outcome vocabulary that the
design explicitly warns against letting sprawl. Probably not worth it; recorded so the
question isn't reopened from scratch.

## What adding a type actually costs

The design's "one module, one registry line, one sprite asset" holds for the
**appearance, geometry and rendering** axis. Reaching the rest of the game costs more.
Traced concretely:

**A new enemy type:** its module, one line in `enemies/index.ts`, its `type` literal in
`types.ts`'s `EnemyDef` union, a sheet const, the PNG. `Collision.ts`, `Renderer.ts`,
`EnemyAI.ts` and `DebugOverlay.ts` need no edit.

**A new block kind:** its module, one line in `blocks/index.ts`, its frame index inside
its own module. To be *reachable* it also needs its literal in `types.ts`'s `BlockDef`
union and in `entities/Block.ts`'s parallel `BlockKind` union.

**A new placed-collectible variant:** about nine files. Beyond the module and registry
line — `types.ts`'s `CollectibleDef.spriteType` union, `CollectibleMapper.ts`'s
hardcoded `CollectibleMarkerPositions` keys and its two-way `isCoin` branch,
`LevelParser.ts` for a marker char, and three editor files.

**A new pickup family with its own array** (like bonus fruit) additionally needs a
signal in `PlatformerState.ts`, another `overlappingPickups` call, a draw loop, and a
collection handler — i.e. the lifecycle surface item 3 above defers.

**Placing any of them in a level** always touches `LevelParser.ts`, the relevant
mapper, and the editor (`LevelEditorPage.tsx`, `paletteTiles.ts`,
`editor/gridRenderState.ts`). That surface is untouched by this architecture and is
the natural target if "adding content should be cheap" is the goal.

## Loose ends

None of these affect behavior. Grouped by whether they're worth a deliberate pass.

**Deferred from the accepted design:**

- **`DamageableType.onDeath` is not implemented.** The proposal defines it as
  `onDeath?(state, world: WorldApi)`, but no `WorldApi` exists and no plan creates one,
  so adding the hook would mean an invented empty type with no implementer and no
  caller. `maxHitPoints`, `hitReactionSeconds` and `onDamaged` are all in place. The
  natural moment to add it is the first work that needs an entity to affect the world on
  death — most likely B-003, the world-event puff, which is exactly an on-death and
  on-break effect.

**Worth fixing when nearby:**

- `entities/Block.ts`'s `BlockKind` union duplicates `types.ts`'s `BlockDef.blockKind`,
  which is the one `BlockState` actually inherits. Two unions for one concept.
- `components/Journal.tsx` and `PlatformerPage.tsx` reference `SLIME_GREEN_SHEET`
  directly for the enemy counter icon. A `counterIcon` field (sheet + frame index) on
  `EnemyType` would let both read it from one place.
- `entities/Health.ts`'s `SIDE_HIT_DAMAGE` has no production caller; the literal `1`
  now lives in `SlimeGreen.ts` and `SlimePurple.ts`.
- `engine/Contact.ts`'s `ContactSide` declares a `'bottom'` variant that is never
  produced and never consumed.
- `entities/Block.ts`'s `BLOCK_RENDERED_SIZE` now has only a test consumer.
- `entities/Enemy.ts`'s `ENEMY_RENDERED_SIZE` / `ENEMY_TILE_OFFSET_X` /
  `ENEMY_TILE_OFFSET_Y` survive as green-slime aliases used only by tests.
- `key.png` loads twice — once via `keySpriteRef` for the HUD counter, once via the
  registry. Consolidating touches five sites in `PlatformerPage.tsx`.
- `engine/Collision.ts`'s `Box` and `entities/geometry.ts`'s `Rect` are structurally
  identical duplicate interfaces. `signBox` returns `Box` while every other box returns
  `Rect`; it compiles by structural typing. One should be an alias of the other.
- `entities/Enemy.ts`'s `enemyHitboxTopPadding` is now consumed only by tests — where it
  deliberately restates the pre-refactor hitbox formula as an independent check, so
  deleting it would remove the evidence that the geometry did not move.
  `enemyHitboxSidePadding` is still live in `EnemyAI.ts`.
- Both padding helpers' doc comments still describe them as producing "the collision
  box". No collision box is built from them any more — `spriteSheetHitbox` computes its
  own. Stale by role rather than by fact.
- `Boxed.box` could take a `this: void` parameter. Every `box` is an arrow property
  closing over module constants, so passing `CHEST_TYPE.box` as a bare reference is safe
  today — but if one were ever rewritten as method shorthand using `this`, the detached
  reference would throw at runtime and TypeScript would not flag it, since
  `this`-parameter checking does not apply to a property read.

**Filed as bug tickets** (see `docs/Bugs.md`):

- **B-003** — the puff coupling described in item 1 above.
- **B-004** — the held-key overlay is gated on the key sheet being loaded but not on
  the slime's body sheet, so a floating key with no body is reachable for a frame or
  two during the initial asset-load race.
- **B-005** — enemy spikes now draw inside each enemy's own `draw` rather than in a
  separate pass after all bodies, so a later-drawn enemy's body can overlap an earlier
  one's spikes. Unreachable in the shipped level: its enemies are ~72px apart against a
  24px player hitbox, so no two can be contacted on the same tick.

**Known and accepted, not worth a ticket:**

- `engine/Collision.ts`'s `EnemyContactResult.knockbackDirection` is non-optional and
  defaults to `1` when nothing damaging happened, so its type is slightly wider than
  its meaning.
- `frameSource(COIN_SHEET, i)` and `coinFrameSource(i)` diverge for `i >= 12` because
  the latter wraps and the former does not. `coin.png` is one row and every caller
  passes a wrapped index.

## Working notes for whoever picks this up

- **Run `npx eslint src/themes/platformer` in every task review**, not just tests and
  `tsc`. The baseline is exactly one error — the pre-existing
  `components/ControlsOverlay.tsx:125` `react-hooks/set-state-in-effect`. Lint-only
  rules are invisible to Vitest and `tsc`, and six errors once accumulated across four
  clean task reviews because of it. eslint is slow here; allow a generous timeout.
  Note the config has no `argsIgnorePattern`, so an `_` prefix does not silence an
  unused parameter; the default `args: 'after-used'` reports only trailing unused
  parameters, so trim those rather than changing the config.
- **`entities/Enemy.ts` and `entities/Block.ts` import their registries at runtime**, so
  the dependency edge runs one way: `Enemy.ts` → `enemies/*` and `Block.ts` →
  `blocks/*`, never back. A production import of a runtime *value* from a module back
  into its own registry's parent leaves the registry `undefined` at load — it compiles
  cleanly and shows as a blank page. Anything a type module needs from its parent must
  be `import type` or must move into the module. `entities/Chest.ts` imports nothing
  from `entities/chests/`, so that edge is unidirectional and a value import is safe
  there.
- **`EnemyContact.contract.test.ts` is a characterization test.** Its `CONTACT_CASES`
  and `expected` blocks pin collision behavior; they have stayed byte-identical
  through every refactor and should continue to. Its construction helpers may change;
  its expectations may not.
- **After a task that edited files while the dev server was live, open a FRESH browser
  tab before investigating anything that looks broken.** Once Vite's client HMR runtime
  throws, that tab stays wedged — a reload does not recover it, and neither does
  restarting the dev server. This has produced convincing false alarms (a dead game
  loop, errors naming symbols that no longer exist anywhere).
- **`Renderer.test.ts` asserts the structure of canvas calls, not pixel offsets.** Any
  task relocating drawing code needs a browser check; a rewritten-from-memory version
  passes the whole suite and is wrong only on screen.
