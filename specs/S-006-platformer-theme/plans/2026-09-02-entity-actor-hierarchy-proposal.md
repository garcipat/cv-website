# Proposal: capability interfaces, one type base, unified triggers

**Status:** accepted. Staged across three implementation plans:

| Plan | Content | Risk |
|---|---|---|
| **A — Capability interfaces** (`2026-09-02-capability-interfaces.md`) | `Moving` / `SelfAnimated` / `Damageable`; enemy and player state compose them; `Entity` deleted. | Type-level only |
| **B — Player damage model** (`2026-09-02-player-damage-model.md`) | Health onto `PlayerState` as `hitPoints`; the two post-hit timers unified into one refractory window. | Behavioral |
| **C — `WorldType` and trigger unification** (`2026-09-02-worldtype-and-triggers.md`) | One type base with optional hooks; chest and sign boxes into their modules; three overlap functions collapsed into one. | Behavioral |

All three are written. `2026-09-02-capability-rollout.md` sequences them as eleven
steps with the verification gate for each.

Companion to `2026-09-01-entity-architecture-design.md`. That document describes the
architecture as built; this proposes a correction to its central abstraction.

**Goal it serves:** adding a new enemy, interactable or block should mean writing one
implementation module. The shared interfaces should not have to change, and the new
thing's specifics should stay inside its own file.

## Two layers

Rendering is not part of an entity. There are two parallel hierarchies, joined only by
the registry key:

| | Layer | Lives | Holds |
|---|---|---|---|
| **State** | per instance | in signals, plain immutable data | `x`, `y`, `hitPoints`, `animFrame`, … |
| **Type** | per type | a module constant | `SpriteDescriptor`, `draw()`, `box()`, numbers, behavior hooks |

Fifty coins share one `PICKUP_TYPES.coin` carrying a single sprite descriptor and a
single `draw`; each coin instance stores only its position. Putting rendering on the
instance would give every coin a function reference and a descriptor, and would stop
entity state being plain serializable data — which the level editor needs, and which
signals' reference-equality change detection depends on.

The split recurs throughout: an instance stores *where it is in its cycle*, the type
stores *what the cycle is*; an instance stores `hitPoints`, the type stores
`maxHitPoints`.

## The problem

`entities/Entity.ts` declares:

```ts
export interface Entity {
  type: string;
  x: number; y: number;
  vx: number; vy: number;
  direction: Direction;
  animState: string;
  animFrame: number;
  animTimer: number;
}
```

That is not a description of an entity. It bundles independent capabilities — position,
movement, animation — into one shape, and is adopted by exactly one family:

```
BaseEnemyState extends EnemyPlacement, Entity, Damageable   ← the only implementor
```

`BlockState`, `ChestState` and the pickup states kept their own shapes and were right
to. A chest has no velocity, facing or animation. A block is the sharper case: it
**animates without moving**, so it wants half of `Entity` and not the other half — which
no single interface can express.

Two smaller symptoms of the same mis-naming:

- **The registry key has three names.** `EnemyDef.type`, `BlockDef.blockKind`,
  `CollectibleDef.spriteType` — one concept, three spellings — and chests have none.
- **Two hitboxes are still built in the engine.** `Collision.ts:257` constructs the
  chest's box inside `chestPlayerIsStandingOn`, `:282` a sign's inside
  `checkSignOverlap`. The only boxes left outside the generic overlap helper.

## Two kinds of box

Everything the player can touch has a rectangle, which is why a chest *feels* like an
entity. But the rectangles do different jobs:

| Kind | Meaning | Who has it |
|---|---|---|
| **Collision box** | participates in movement resolution — the player cannot pass through it | terrain, blocks, player, enemies |
| **Trigger box** | never affects movement; only answers *"is the player overlapping?"* | chests, signs, pickups |

Verifiable, not a judgement call:

```
Physics.ts:71    blockPlacements: readonly BlockPlacement[] = NO_BLOCKS,
Physics.ts:393   const solid = isSolidExcludingBridge(tileAt(level, col, headRow)) || blockId !== undefined;
```

A **block is solid** — physics takes block placements and treats a block as terrain. A
**chest does not appear in `Physics.ts` at all**. That is why a sign feels like a chest
and a block does not: chests and signs are both triggers; a block is solid geometry that
happens to react to being struck.

## Categories — vocabulary, not interfaces

Names for reasoning about the code. Deliberately **not** declared types; composition
happens through the capability interfaces below.

| Category | Family | Box | What the player's presence does to it |
|---|---|---|---|
| **Actor** | player | collision | damaged, then dies |
| | green slime, purple slime | collision | damaged, then dies |
| **Solid** | crate, question-mark, fragile rock | collision | struck from below → damaged → consumed (question-mark persists, spent) |
| **Trigger** | coin, fruit | trigger | consumed on overlap |
| | dropped key | trigger | consumed on overlap |
| | bonus fruit | trigger | consumed on overlap, once its rise finishes |
| | chest | trigger | permanent state flip; needs Up and a held key |
| | sign | trigger | nothing — the sign never changes; the UI does |

Terrain tiles are solid too, but they are a character grid with no per-instance state.
Blocks are the bridge: solid like terrain, stateful like an object.

### Invariant: state is only for things that change

**Terrain must never become entities.** It is a character grid; `drawTerrain` iterates
that grid and `tileSource(level, tile, col, row)` derives each sprite from the grid plus
its neighbours. A wall costs one character, not an object.

Only markers that can *change* become stateful: the `X` / `Q` / `F` markers that produce
`blockStates` entries with `hitsTaken`, `animState` and `animTimer`. In the current level
that is **six stateful blocks** against hundreds of terrain tiles.

This is what keeps a large map affordable — ten times the map is ten times the
*characters*, not ten times the *objects*. Two rules follow:

- A new **static decorative** tile is a terrain character and a `tileSource` case, **not**
  a block type. The block registry is for things with state.
- A new **block kind** is only justified if instances of it genuinely differ over time.
  If every instance always looks and behaves identically, it is terrain.

Nothing in this proposal changes that split, and nothing should.

Inside **Trigger**, the sub-axis is what happens to the trigger itself:

| Sub-shape | Families | Eligibility rule |
|---|---|---|
| disappears | coin, fruit, key, bonus fruit | "not yet collected" — recorded three different ways |
| changes state permanently | chest | "not already open" |
| never changes | sign | none — there is nothing to exhaust |

The sign is the cleanest evidence for the model: `SignPlacement` is `{ id, hintId, x, y }`
and nothing else. A taxonomy that cannot place a sign comfortably is wrong.

## Proposal

### 1. Replace `Entity` with capability interfaces

Delete `Entity`. Its capabilities become independent interfaces a family composes:

```ts
// entities/capabilities.ts

/** Moves under its own power. */
export interface Moving {
  vx: number;
  vy: number;
  direction: Direction;
}

/**
 * Advances its own animation on a per-instance timer, so two of the same type
 * can be out of phase. A type whose frames come from the shared world clock —
 * a spinning coin, a bobbing key — needs none of this; its `frameIndex` reads
 * `elapsed` instead. Both are animated; only this one stores state.
 */
export interface SelfAnimated {
  animState: string;
  animFrame: number;
  animTimer: number;
}

/**
 * Takes damage, and is gone at zero. `hitTimer` counts seconds since the last
 * hit landed; while it is below the type's `hitReactionSeconds`, further hits
 * are ignored — the post-hit refractory window.
 */
export interface Damageable {
  hitPoints: number;
  alive: boolean;
  hitTimer: number;
}
```

Position (`x`, `y`) stays declared by each family's `Placement` type, as it already is.
An interface for two fields every family has would be ceremony.

Composition per family:

| Family | Moving | SelfAnimated | Damageable | Its own fields |
|---|---|---|---|---|
| player | ✅ | ✅ | ✅ | `grounded`, `climbing`, `knockbackTimer`, `bounceAscending`, … |
| enemies | ✅ | ✅ | ✅ | `homeX/homeY`, `rewardGiven`; purple adds `spiked`/`spikeTimer` |
| blocks | ❌ | ❌ *(see below)* | ❌ | `hitsTaken` |
| chests | ❌ | ❌ | ❌ | `state: 'closed' \| 'open'` |
| coin, fruit, key | ❌ | ❌ | ❌ | key adds `collected` |
| bonus fruit | ❌ | ❌ | ❌ | `elapsed`, `startY`, `restY`, `iconIndex` |
| signs | ❌ | ❌ | ❌ | `hintId` |

### 2. The player is `Damageable` — hearts become presentation

The player's health currently lives in a standalone `healthState` signal. It should be
`hitPoints` on the player like any other damageable thing.

**The data is already right.** `MAX_HALF_HEARTS = MAX_HEARTS * 2 = 6`, and health is
already tracked in half-heart integers. So the player has **6 hit points, displayed as 3
hearts** — and `heartRemaining`, `heartFrameIndex` and `drawHearts` all take a plain
number and need no change whatsoever. The three-heart display was always pure
presentation; it simply was not labelled as such.

The unit is a per-type concern, exactly like `maxHitPoints` already is for enemies:

| | `hitPoints` counts | max on the type | presented as |
|---|---|---|---|
| enemy | stomps | `EnemyType.maxHitPoints` | the hit reaction |
| player | half-hearts | `PLAYER_TYPE.maxHitPoints` = 6 | three heart sprites |

`takeDamage(current, amount)` is already a pure function on a number and works unchanged
for both. `alive: false` replaces `healthState.value === 0` as the death trigger, and
respawn becomes the same `revive` shape enemies already have.

Six production reads of `healthState` change, all in `PlatformerPage.tsx`.

### 3. One refractory window, not two

`invincibleTimer` and `hitTimer` are the same concept in two encodings:

| | Player `invincibleTimer` | Enemy `hitTimer` |
|---|---|---|
| Direction | counts **down** from `INVINCIBILITY_DURATION_SECONDS` | counts **up** from 0 |
| Gates further hits | directly — `invincibleTimer <= 0` | indirectly — `isStunned` reads `animState === 'hit'` |
| Also drives | the render blink | the hit animation, then revert-or-die |

The gating only looks different: `animState === 'hit'` is true **exactly while**
`hitTimer < HIT_REACTION_DURATION_SECONDS`. Both are a post-hit window during which
further hits do not land.

Unify as `Damageable.hitTimer`, **counting up**, with the duration on the type:

```ts
EnemyType.hitReactionSeconds     // 0.4 today
PLAYER_TYPE.hitReactionSeconds   // 1.2 today (INVINCIBILITY_DURATION_SECONDS)
```

One shared predicate replaces both `player.invincibleTimer > 0` and `isStunned(enemy)`:

```ts
isInvulnerable(state, type.hitReactionSeconds)
```

Counting up matters: counting down bakes the duration into the initial value so every
instance carries a copy, while counting up leaves it on the type — which is what lets a
new damageable thing get its refractory window by declaring one number.

What stays type-specific is what *happens* during and after the window — the player
blinks then becomes vulnerable; an enemy plays its hit animation then reverts or dies.
That is `onTick` business, not interface business.

### 3b. `DamageableType` — the type-side half

`Damageable` holds fields; the numbers and behavior belong on the type, paired with it:

```ts
export interface DamageableType<S extends Damageable> {
  maxHitPoints: number;
  /** Length of the post-hit refractory window. */
  hitReactionSeconds: number;

  /** What taking a hit does to this type beyond decrementing hit points —
   *  growing a temporary defense, entering a reaction animation. */
  onDamaged?(state: S, amount: number): S;
  /** Fired once when `alive` flips false. */
  onDeath?(state: S, world: WorldApi): void;
}
```

`EnemyType` extends `WorldType<S> & DamageableType<S>`; so does `PLAYER_TYPE`. Adding a
damageable thing then means composing two halves — `Damageable` on its state,
`DamageableType` on its type — rather than wiring damage by hand.

`maxHitPoints` already exists on `EnemyType`. `hitReactionSeconds` replaces the two
hardcoded durations. `onDamaged` gives the purple slime's spike growth a home separate
from interpreting a contact: today it happens inside `onPlayerCollide`, which conflates
*what this contact means* with *what happens to me when hit*.

### 4. Blocks compose neither `Damageable` nor `SelfAnimated`

A block's `hitsTaken` counts **up** to a per-kind max rather than down to zero, and a
spent question-mark **stays solid in the world**, so `alive` has no meaning for it.

Blocks also compose no `SelfAnimated`: no block cycles sprite frames — `Crate` and
`FragileRock`'s `frameIndex` are constants, and `QuestionMark`'s is a function of
`hitsTaken`, not of time. A block's `animTimer` only drives `blockBumpOffsetY` (a
y-offset) and `crateShatterOpacity` (an alpha) — transforms applied to a static sprite
rather than animation through frames. Blocks keep their own `animState`, `animTimer` and
`hitsTaken`.

This is worth leaving as-is rather than forcing: two of three damage models unify
cleanly, and the third is genuinely a different shape. If blocks are ever reworked to
count down with a `removeWhenUsedUp` type flag deciding whether `alive: false` removes
them, they could join — but that is a behavior change, not a typing exercise.

### 5. One type base, with optional hooks

The universal capability — *has a box and can be drawn* — belongs on the type layer:

```ts
export interface WorldType<S> {
  key: string;
  box(state: S): Rect;
  draw(state: S, dc: DrawContext): void;

  /** Optional behavior. A type implements only what applies to it, so adding a
   *  new kind of thing never requires changing this interface. */
  onPlayerCollide?(state: S, player: PlayerState, contact: Contact): CollisionOutcome<S>;
  onTick?(state: S, dt: number): S;
}
```

`EnemyType`, `PickupType`, `BlockType` and `ChestType` extend it. All four already have
`draw`; three have `box`, and `ChestType`'s absence becomes a compile error rather than
an oversight.

**Optional hooks are what serve the extensibility goal.** `EnemyType` already works this
way — `onTick` is optional and only the purple slime implements it.

### 6. Unify the triggers

Chests, signs and pickups share one shape: a trigger box, an eligibility rule, and an
effect on overlap. These three are already the same function:

```ts
overlappingPickups(player, items, boxOf, eligible)   // all matches
chestPlayerIsStandingOn(player, chests)              // first match's id
checkSignOverlap(player, signs)                      // first match's payload
```

Collapsing them onto one helper also moves the chest's and sign's geometry into their
own modules, leaving **zero hitboxes constructed inside `Collision.ts` outside the
shared helper**.

Keep the eligibility predicate caller-supplied, as `overlappingPickups` already does.
The pickup families record "collected" three different ways; unifying that is a separate
decision, and the mechanism unifies without it.

## What this deliberately does not do

- **No declared `Actor` / `Solid` / `Trigger` types.** Vocabulary only. A family's
  membership is already evident from which capabilities it composes.
- **No change to how blocks or chests are triggered.** A block is struck from below via
  `player.hitBlockIds` from ceiling collision; a chest opens on standing plus Up plus a
  held key.
- **No renaming of the three registry-key fields.** Real inconsistency, but changing it
  touches level parsing, the mappers and the editor. Worth doing on its own terms.

## What still blocks the extensibility goal

**The interfaces are not the remaining friction.** Adding an enemy or block already costs
one module plus one registry line, with no edit to `Renderer.ts`, `Collision.ts` or
`EnemyAI.ts`, and the loader discovers the sprite by itself.

What still forces edits to shared code is the **placement pipeline**:

- `types.ts`'s unions — `EnemyDef.type`, `BlockDef.blockKind`, `CollectibleDef.spriteType`
- `LevelParser.ts` — a marker character
- the relevant `*Mapper.ts` — hardcoded marker keys, and for collectibles a two-way
  `isCoin` branch
- the editor — `LevelEditorPage.tsx`, `paletteTiles.ts`, `editor/gridRenderState.ts`

A new placed collectible costs roughly nine files, almost none of it interface design.
If "adding content should be cheap" is the goal, that pipeline is the higher-value
target than anything in this proposal.

## Risk, stated plainly

Every time this codebase shared behavior through a **base interface**, it grew dead
members: `spiked` on every enemy including one that could never spike; `Entity` itself is
the larger instance. Every time it shared through **functions and data models** —
`overlappingPickups`, `SpriteSheet`/`SpriteDescriptor`, `DrawContext` — it worked without
residue.

This proposal removes a base, replaces it with small capability interfaces a family opts
into, adds exactly one type base whose required members are genuinely universal, and puts
weight on a shared *function*. **If `WorldType` starts accumulating required members,
that is the signal it was the wrong tool.**

## Rough shape of the work

Not a plan — a sketch, to convey size. Each would be a task with tests first.

1. Add `Moving` / `SelfAnimated` / `Damageable`; point `BaseEnemyState` at them; delete
   `Entity`. Type-level only.
2. `BlockState implements SelfAnimated`. Free — it already has the fields.
3. Move the player's health onto `PlayerState` as `hitPoints`/`alive`; `PLAYER_TYPE`
   holds `maxHitPoints: 6`. Six call sites; `drawHearts` and the heart helpers unchanged.
4. Unify `invincibleTimer` and `hitTimer` into `Damageable.hitTimer` counting up, with
   `hitReactionSeconds` on the type and one `isInvulnerable` predicate.
5. Add `WorldType`; have the four type modules extend it. Compile-error-driven.
6. Give `ChestType` a `box()` and repoint `chestPlayerIsStandingOn`.
7. Give signs a `box()` and repoint `checkSignOverlap`.
8. Collapse the three overlap functions onto one trigger helper.

Steps 1, 2 and 5 are type-level. **Steps 3, 4, 6, 7 and 8 carry behavioral risk** and
each needs a browser check alongside tests: health must still decrease and the hearts
still render; invincibility must still blink and still block a second hit; standing on a
chest must still offer to open it; walking past a sign must still show its hint. The
chest and sign boxes must come out byte-identical — the chest's includes
`CHEST_CLOSED_OFFSET_X`.

## Open question

Should signs get a full type module, or is a `box()` helper enough? A sign has no state
and no per-type variation beyond its `hintId`. Step 7 assumes a module for symmetry; the
cheaper alternative is a bare `signBox(sign)` function next to the placement type.
