# Platformer Architecture Analysis

Findings and refactoring plan for the platformer theme (`src/themes/platformer/`).

This document catalogues **leaky abstractions, missing abstractions, and files that
should merge into existing ones**, then proposes an ordered, step-by-step plan. It is
meant to be worked through item by item: every finding has a stable ID (`L1`, `E2`,
`D3`, …) so we can discuss, implement, and check them off independently.

> **Reading note.** Line numbers were captured during analysis and will drift as we
> work. Treat them as pointers, not contracts. Every finding lists *Evidence*,
> *Problem*, *Direction*, and *Affected files*.
>
> **Tracking.** The phases below are tracked as refactor features **R-001..R-013** under
> the *Platformer Architecture Refactor* milestone (see `docs/Features.md`). R-001..R-012 map
> to the phases; **[R-013](https://github.com/garcipat/cv-website/issues/101)** covers sprite asset/atlas organization (Group A). Finding IDs
> (`L*`, `E*`, `P*`, `D*`, `M*`, `F*`, `A*`, `X*`) are analysis-local `Letter+digit` ids —
> distinct from the `Letter-NNN` feature ids (`F-015`, `S-031`, `[R-013](https://github.com/garcipat/cv-website/issues/101)`).

---

## 1. Executive summary

The platformer theme has genuinely good architecture in places: a registry + single-file
per kind pattern already exists for **enemies, blocks, pickups, hazards, and chests**
(`entities/*/index.ts` + `typeOf`), a clean capability/mixin layer (`capabilities.ts`),
a small reward vocabulary (`Outcome.ts` / `Contact.ts`), and pure, DOM-free engine math
modules. The codebase's own doc comments repeatedly state the goal: *"add a kind = add its
own module + one registry line."*

The problem is that **only half the system actually buys into that pattern.** The
orchestration layer (`PlatformerPage.tsx`, `PlatformerState.ts`, `Renderer.ts`,
`Collision.ts`) still names concrete kinds in `if`-chains and carries one bespoke code path
per entity/effect. The result:

- `Renderer.ts` is a ~2,700-line god module that knows every entity and decor type.
- Lighting is shaped around torches; the player's carried light, enemy eyes, and fog are
  hand-rolled clones of the same math.
- Every transient effect (mushroom squash, hint bubble, and 8 collection effects) is its
  own state machine with its own signal and draw pass.
- Every placeable world item (placed bomb, deployable ladder, dropped pickups) is its own
  unrelated implementation — there is no "placeItem".
- Pickups are the one entity family with no discriminator, so the page dispatches on
  pickup **names**.
- The editor re-implements the whole level finder + mapper pipeline instead of reusing it.
- Folder placement doesn't match the dependency graph: `engine` and `level` import each
  other, `engine` reaches up into app state, and a parsing module imports React signals
  (Group F).

None of this is a correctness emergency by itself — the game works — but it makes every new
feature more expensive and more bug-prone than it should be. The good news: **the target
idioms already exist in this codebase**, so most refactors are "finish applying the pattern
we already started," not "invent an architecture."

### Severity legend

- **Impact**: High / Med / Low — how much future work this unblocks or how error-prone it is.
- **Effort**: S (< 1 day) / M (1–3 days) / L (multi-day, touches many files).

---

## 2. The intended idioms (what "done" looks like)

These already exist and work. New work should imitate them.

| Idiom | Where it lives | Why it works |
| --- | --- | --- |
| `WorldType<S>` / `Boxed<S>` base | `entities/WorldType.ts` | One shared shape for "has a key, draws, has a box". |
| Capability mixins | `entities/capabilities.ts` (`Moving`, `SelfAnimated`, `Damageable`) | Compose behaviour instead of subclass trees. |
| Keyed registries + `typeOf` cast | `enemies/`, `blocks/`, `hazards/`, `pickups/`, `chests/` | Engine dispatches generically; adding a kind touches one module + one registry line. |
| Strategy seam | `enemies/movement/MovementStrategy.ts` | Movement is swappable data, not an `if`. |
| Reward vocabulary | `Outcome.ts` (`PlayerEffects` / `RewardEffects`) | Effects are returned as data by `BlockType.onHit`. |
| Pure, DOM-free math modules | `Lighting.ts`, `Torch.ts`, `CrumblingFloor.ts`, `PlacedBomb.ts` | Unit-testable, no canvas/React. |
| Caller-owned offscreen layer | `drawDarkness`, `drawTintedSprite` | Zero per-frame allocation. |

The refactors below are almost entirely about **routing the remaining concrete-kind code
through these idioms.**

---

## 3. Findings

### Group L — Lighting and static-tile rendering

#### L1 — `Renderer.ts` is a god module that knows every concrete entity/decor type
**Impact: High · Effort: L**

**Evidence**
- Imports from ~35 modules (`Renderer.ts:1-146`), including every entity family.
- `tileSource` is a ~15-case dispatch over terrain chars (`Renderer.ts:148-217`); most
  non-trivial cases return `null` with "drawn by `drawTerrain`'s own branch".
- `drawTerrain` is a second ~11-branch `if (tile === …)` chain (`Renderer.ts:666-871`) and
  takes **12 positional parameters** (`Renderer.ts:650-663`).
- ~20 standalone one-off passes: `drawWaterForeground`, `drawDarkness`, `drawEnemyEyes`,
  `drawDeployableLadders`, `drawCrumblingFloors`, `drawDebrisEffects`, `drawBackgroundTiles`,
  `drawFog`, `drawPlayer`, `drawHeldTorch`, `drawHearts`, `drawIrisOverlay`, `drawSigns`,
  `drawSignBubble`, `drawPlacedBombs`, `drawExplosions`, `drawCheckpoints`,
  `drawCheckpointTwinkles`, `drawFadeOutTexts`, `drawLowHealthGlow`, …
- Five pickup draw wrappers over the one existing registry (`drawKeyPickups:1777`,
  `drawHeartPickups:1794`, `drawBombPickups:1810`, `drawBonusFruits:2093` alongside generic
  `drawCollectibles:1755`).
- Five HUD counter drawers hardcoding each collectible plus four width/X helpers
  (`drawCollectibleCounter:2464`, `drawChestCounter:2556`, `drawKeyCounter:2628`,
  `drawBombCounter:2657`, `chestCounterWidth:2598`, `keyCounterX:2612`,
  `keyCounterWidth:2691`, `bombCounterX:2705`).

**Problem** Static terrain/decor never received the `BlockType`/`EnemyType` treatment.
Dispatch is split across `tileSource` *and* `drawTerrain`, and every new decor tile adds a
branch **and** a parameter to every call site.

**Direction**
- Introduce a `STATIC_TILE_TYPES[tile].draw(...)` registry (mirroring `BLOCK_TYPES`); fold
  the two dispatch points into one and shrink `drawTerrain`'s signature to a context object.
- Move the visual half of `Torch.ts`, cobweb/crystal/stalactite/chain/mushroom art behind
  their own tile types.
- Collapse the pickup draw wrappers into one `drawPickups` and the counters into one
  `drawHudCounter`.
- Split world drawing (`SceneRenderer`) from HUD drawing (`HudRenderer`).

**Affected**: `engine/Renderer.ts`, `engine/StaticObjectsCatalog.ts`, `engine/GroundAtlas.ts`,
`engine/BackgroundAtlas.ts`, `engine/BackgroundDecorCatalog.ts`, `engine/Torch.ts`.

#### L2 — Lighting is torch-shaped; player light is a special-cased clone
**Impact: High · Effort: M**

**Evidence**
- The only light type is `TorchLight` (`Lighting.ts:39-44`, `{x,y,col,row,strength}`); the
  player's light is a bare `Point` carrying no radius/colour/intensity.
- `drawDarkness` takes two separate light inputs — `torches: TorchLight[]` and
  `playerLight: Point | null` (`Renderer.ts:318,322`) — and contains **two duplicated
  blocks**: torch punch `350-365` vs player punch `370-387`; torch glow `392-412` vs player
  glow `414-435`. The only differences are radius source, colour literal, and intensity.
- A parallel constant+function stack exists per light kind: player
  (`PLAYER_LIGHT_RADIUS_PX:192`, `PLAYER_GLOW_COLOR:210`, `PLAYER_GLOW_INTENSITY:213`,
  `playerGlowStrengthAt:367`) and enemy eyes (`ENEMY_EYE_*:216-230`, `enemyEyeOpacity:384`).
- `localDarknessAt` (`Lighting.ts:345-358`) hardcodes the two-kind max over
  `torches + playerLight`.

**Problem** Adding any light emitter (enemy eyes as a real emitter, a glowing pickup, a
lava tile) means editing `drawDarkness`, `localDarknessAt`, and adding a new constant/function
stack.

**Direction** One `LightSource` concept (`{x, y, radius(t), color, intensity, punchHole}`)
adaptered from torch / player / future emitters. `drawDarkness` becomes two loops (punch,
glow) over `readonly LightSource[]`; drop the separate `playerLight` parameter;
`localDarknessAt` iterates the same list. `heldTorchLightPosition` returns a `LightSource`.

**Affected**: `engine/Lighting.ts`, `engine/Renderer.ts`, `engine/Torch.ts`,
`PlatformerPage.tsx` (call sites), `PlatformerState.ts` (`torchPositions`).

#### L3 — Fog duplicates the shared falloff + hash technique
**Impact: Med · Effort: S**

**Evidence** `FOG_*` constants and `fogPuffAt` / `fogPeekStrengthAt` (`Lighting.ts:59-113,
137,176`) re-implement the smoothstep falloff and the `Math.imul` position hash; the module's
own comments (`Lighting.ts:172-175`, `1366-1367`) admit it "mirrors" `playerGlowStrengthAt`.

**Direction** Reuse the shared `smoothstep` / `hash2D` helpers (see L5/L7). Fog stays its own
effect (it is *peek-through-haze*, not light), but should not re-derive the primitives.

**Affected**: `engine/Lighting.ts`, `engine/Renderer.ts`.

#### L4 — Duplicated position hash and variant picker
**Impact: Low · Effort: S**

**Evidence** The same position hash
`(Math.imul(col,374761393) ^ Math.imul(row,668265263)) >>> 0` appears in `Torch.ts:47`,
`StaticObjectsCatalog.ts:197`, `BackgroundDecorCatalog.ts:35`, `Lighting.ts:125` (salted
variant). `pickVariant` is duplicated verbatim in `StaticObjectsCatalog.ts:181-200` and
`BackgroundDecorCatalog.ts:31-38` (the latter's comment admits it).

**Direction** One shared `hash2D(col,row,salt)` + `pickVariant`.

#### L5 — Duplicated scalar math
**Impact: Low · Effort: S**

**Evidence** `smoothstep` (`t*t*(3-2*t)`) copied 4× in `Lighting.ts:184,336,375,388`;
`clamp01` copied ~9× (`Lighting.ts:387`, `CrumblingFloor.ts:131,152`, `BlockAI.ts:64`,
`DeployableLadder.ts:117`, `MushroomSquash.ts:55`, `IrisTransition.ts:55`,
`CollectionEffects.ts:662`, `Renderer.ts:1650`); inline lerp in `CollectionEffects.ts:134-144`
re-deriving `IrisTransition.lerpRadius:54-56`; sine-pulse repeated in `Lighting.ts:152,305,406`,
`Renderer.ts:2008,2302`.

**Direction** A single `engine/math.ts` with `clamp01`, `smoothstep`, `lerp`, `hash2D`,
`pulse`, `shakeOffsetX`.

#### L6 — `GroundAtlas` and `BackgroundAtlas` are near-duplicates
**Impact: Low · Effort: S**

**Evidence** Duplicate `QuarterTurns` (`GroundAtlas.ts:25` / `BackgroundAtlas.ts:16`),
duplicate stride constant + `cell()` helper (`GroundAtlas.ts:10,16` / `BackgroundAtlas.ts:11,38`),
same `mask → {sx,sy,rotation}` entry shape (`groundAtlasCell:86` / `backgroundAtlasCell:110`).

**Direction** One shared `TileAtlas` type + helpers; the two modules keep only their tables.

---

### Group E — Transient effects and state machines

#### E1 — No shared effect abstraction; 10 parallel effect state machines
**Impact: High · Effort: L**

**Evidence**
- `CollectionEffects.ts` hand-rolls 8 effect types, each with its own start/tick/derive:
  `FlightEffect:30`, `CounterPopupEffect:184`, `PuffEffect:254`, `HealAuraEffect:293`,
  `HitSplatterEffect:381`, `FadeOutTextEffect:593`, `ExplosionEffect:639`, `DebrisEffect:686`.
- **Six tick functions are byte-identical** (`{...effect, elapsed: effect.elapsed + dt}`):
  `CollectionEffects.ts:274-276,304-306,537-539,613-615,655-657,703-705`.
- **Eight parallel signals** in `PlatformerState.ts` (`activeFadeOutTexts:532`,
  `activeExplosions:704`, `activeEffects:724`, `activePuffs:732`, `activeHealAuraEffects:739`,
  `activeHitSplatters:746`, `activeCounterPopups:756`, `activeDebrisEffects:945`).
- **Eight parallel draw passes** in `Renderer.ts` (`drawDebrisEffects:1040`,
  `drawExplosions:1913`, `drawFadeOutTexts:2071`, `drawCollectionEffects:2160`,
  `drawPuffEffects:2192`, `drawHealAuraEffects:2208`, `drawHitSplatterEffects:2266`,
  `drawCounterPopups:2406`).
- `MushroomSquash.ts` (`start:26`, `advance:39`, `dipAt:60`) and `HintTooltip.ts`
  (`start:45`, `tick:65` returning `null`) are two more bespoke machines — `HintTooltip`'s
  own doc comment says it "Mirrors … `FlightEffect`".
- Three near-identical particle-list producers: `sparkleParticles:233`,
  `hitSplatterDroplets:557`, `debrisPieces:738`.

**Problem** Every new transient effect means: a new type, a new tick, a new signal, a new
tick call, a new draw function, a new draw call, and a new reset entry.

**Direction** A `TransientEffect<S>` base (`id`, `elapsed`, `duration`, `tick`, `draw`,
`expired`) plus an effect registry; one `activeEffects` collection and one `advanceEffects`
and one draw pass. `MushroomSquash` and `HintTooltip` become registered effects. Promote the
shared particle producer.

**Affected**: `engine/CollectionEffects.ts`, `engine/MushroomSquash.ts`,
`engine/HintTooltip.ts`, `PlatformerState.ts`, `engine/Renderer.ts`.

#### E2 — `HintTooltip` is sign-named but already generic (the missing "speech bubble")
**Impact: Med · Effort: S**

**Evidence**
- `HintTooltipState` is named/documented around signs but has a `transient` flag
  (`HintTooltip.ts:17-24,45-47`) used only by non-sign bubbles.
- It is already reused for the locked-chest bubble (`PlatformerPage.tsx:1695,1713-1715`) and
  the "no bombs" bubble (`PlatformerPage.tsx:2056`).
- It is drawn **above the player's head**, not the sign (`PlatformerPage.tsx:899-909`), via
  `drawSignBubble` (`Renderer.ts:1653`).
- `HintId` (`types.ts:146`) mixes sign hints with UI-only messages (`noBombs`,
  `noKeyForChest`) that `HintCatalog.ts:9` explicitly says are not sign hints.

**Problem** The generic speech-bubble concept exists in substance but is named and typed
around signs, so it reads as sign-specific and its two consumers are undocumented special
cases.

**Direction** Rename/generalize to `SpeechBubble` (effect from E1); split `SignHintId` from
`BubbleMessageId`; rename `drawSignBubble` → `drawSpeechBubble`. This is the abstraction the
user asked for.

**Affected**: `engine/HintTooltip.ts`, `engine/Renderer.ts`, `types.ts`,
`level/HintCatalog.ts`, `PlatformerPage.tsx`.

#### E3 — `MushroomSquash` is a standalone file that belongs to the effect (or timed-tile) family
**Impact: Low · Effort: S**

**Evidence** `MushroomSquash.ts` is a 67-line per-cell transient `{col,row,elapsed}` with its
own signal (`PlatformerState.ts:936` area), tick call, and draw branch in `drawTerrain`.

**Direction** Fold into the effect registry (E1); it is a cosmetic transient exactly like the
others. If it should affect collision/standability it belongs to the shared timed-tile module (E4).

**Affected**: `engine/MushroomSquash.ts`, `PlatformerState.ts`, `Renderer.ts`.

#### E4 — Four near-identical timed-tile state machines
**Impact: Med · Effort: M**

**Evidence**

| Concept | state | arm | advance | phase at | armed? | shake |
| --- | --- | --- | --- | --- | --- | --- |
| `MushroomSquash.ts` | `{col,row,elapsed}` | `:26` | `:39` | `mushroomSquashDip:54` | presence | — |
| `FloorSpike.ts` | `{id,elapsed}` | `:38` | `:50` | `floorSpikePhaseAt:63` | `:83` | — |
| `CrumblingFloor.ts` | `{col,row,elapsed}` | `:39` | `:52` | `crumblingFloorPhaseAt:68` | `:100` | `:171` |
| `FallingStalactite.ts` | `{id,elapsed}` | `:43` | `:53` | `phaseFor:145` | `:62` | `:88` |

Two structural clones (`{col,row,elapsed}` and `{id,elapsed}`); arm/advance bodies are
copy-paste; shake is byte-identical except amplitude (`CrumblingFloor.ts:172` /
`FallingStalactite.ts:90`: `Math.sin(elapsed*40)*AMP`).

**Direction** One shared `timedTile` module (`arm`, `advance`, `elapsedFor`, `shakeOffsetX`) with each
module keeping only its durations and phase table.

**Affected**: the four engine modules + `PlatformerState.ts` tick wiring.

---

### Group P — Placeable world items ("no `placeItem`")

#### P1 — `PlacedBomb` and `DeployableLadder` are unrelated bespoke implementations
**Impact: High · Effort: M**

**Evidence**
- `PlacedBombState` (`PlacedBomb.ts:16-34`) and `DeployableLadderState`
  (`DeployableLadder.ts:23-34`) are near-identical: `id`, `col`, `row`, tile-aligned `x/y`,
  a lifecycle timer (`fuseElapsed` / `elapsed`), a `step`/`advance`, a bespoke renderer.
- Neither is in any registry. The engine wires each by hand: signals `placedBombs`
  (`PlatformerState.ts:697`) and `deployableLadderStates` (`:822`); ticks inline / `:842`;
  draws `drawPlacedBombs` (`Renderer.ts:1867`) and `drawDeployableLadders` (`:892`).
- Dropped pickups (`BombPickup`, `HeartPickup`, `KeyPickup`) are conceptually the same thing
  ("something with id/x/y in the world you touch") but a third parallel family.

**Problem** There is no generic "placeable world item". Adding a thrown item, a placed
turret, a bear trap, etc. starts from scratch again.

**Direction** A `WorldItemType<S>` registry (`id, col, row, step(state,dt), box?, draw`) with
one `placedItems` collection, one tick, one draw pass. `PlacedBomb` and `DeployableLadder`
become registered entries; the stateless `Torch` is a degenerate variant.

**Affected**: `engine/PlacedBomb.ts`, `engine/DeployableLadder.ts`, `PlatformerState.ts`,
`Renderer.ts`, `PlatformerPage.tsx`.

#### P2 — The bomb concept is spread across three files
**Impact: Med · Effort: S**

**Evidence** `engine/PlacedBomb.ts` (state + fuse + fall), `entities/pickups/Bomb.ts` (the
`PickupType` view), `entities/BombPickup.ts` (state + constants for the world pickup), plus
`entities/blocks/BombPot.ts` (a block that drops a bomb). `pickups/Bomb.ts:12-16` explicitly
says `BombPickup.ts` "remains the source of truth for every constant".

**Problem** One concept, three-plus files and two disjoint registries; the fuse/frame logic
is not reachable from the pickup view even though both draw `bomb.png`.

**Direction** Fold the pickup-view constants into the item module (P1) so a bomb has one home,
exposing both its "held/pickup" and "placed/lit" faces.

**Affected**: `engine/PlacedBomb.ts`, `entities/pickups/Bomb.ts`, `entities/BombPickup.ts`.

#### P3 — "First landing row below" implemented three times
**Impact: Med · Effort: S**

**Evidence** `DeployableLadder.ladderLandingRow:52-59` (uses `isSolid` only);
`PlacedBomb.bombLandingRow:80-94` (re-derives standability from `isSolid` /
`isBlockOccupied` / crumbling); `FallingStalactite.fallingStalactiteLandingRow:98-109`
(correctly uses the shared `isStandableCell`). The sanctioned shared definition is
`Standable.ts:isStandableCell:38-57`.

**Problem** Three downward scans drift apart; only one uses the shared standability rule.

**Direction** `findLandingRow(level, col, fromRow, isSolidForKind)` in `Standable.ts`; each
caller passes its predicate.

---

### Group D — Registry dispatch leaks in orchestration

#### D1 — Pickups have no discriminator, so the page dispatches on pickup names
**Impact: High · Effort: M**

**Evidence**
- State types share no base and carry no `kind`: `BombPickupState` (`BombPickup.ts:24-28`),
  `HeartPickupState` (`HeartPickup.ts:27-31`), `KeyPickupState` (`KeyPickup.ts:49-54`),
  `BonusFruitState` (`BonusFruit.ts:28-40`), `CollectiblePlacement` (`CollectibleMapper.ts`)
  — unlike `EnemyState.type` / `BlockState.blockKind`.
- Consequence: five family-specific collision functions (`Collision.ts:117,239,429,450,466`),
  four+ draw wrappers (`Renderer.ts:1755,1777,1794,1810,2093`), and a page `if/else` on
  pickup names `bonusFruit` / `coin` / `heart` / `bomb` (`PlatformerPage.tsx:2132,2137,2145,2152`).
- `pickups/index.ts:8-11` documents the split arrays as a deliberate choice — exactly the
  smell.

**Problem** The one entity family that did *not* get a discriminator is the one the
orchestrator has to special-case everywhere.

**Direction** Add `kind: PickupKind` to each pickup state + a shared `Pickup` base; one
generic `checkPickupCollisions`, one `drawPickups`, and a `PickupType.spawn(source)` /
`onCollect(...)` hook so the page stops naming kinds.

**Affected**: `entities/*Pickup.ts`, `entities/Coin.ts`, `entities/Fruit.ts`,
`entities/BonusFruit.ts`, `entities/pickups/*`, `engine/Collision.ts`, `engine/Renderer.ts`,
`engine/Outcome.ts`, `PlatformerPage.tsx`.

#### D2 — Enemy defeat/reward is hand-coded; `EnemyType` has no `onDefeat`
**Impact: High · Effort: M**

**Evidence**
- Block rewards are generic: `BlockType.onHit` returns `RewardEffects` and the page applies
  them uniformly.
- Enemy rewards are not: `PlatformerPage.tsx:1281-1396` hardcodes `heldItem === 'key'`
  (`:1315`), `enemy.type === 'slimeGreen'` (`:1351`), and the fact list.
- Two parallel drop vocabularies: `ItemKind` (`enemies/EnemyType.ts:14`, only `'key'`) vs
  `PickupKind` (`pickups/index.ts:18`).

**Problem** A second enemy drop (heart, bomb, coin) requires editing the page instead of a
registry entry.

**Direction** Add `EnemyType.onDefeat(enemy): RewardEffects` mirroring `BlockType.onHit`; a
shared reward applier consumes it. Make `heldItem: PickupKind | null` and delete `ItemKind`.

**Affected**: `entities/enemies/EnemyType.ts`, `entities/enemies/*`, `engine/Outcome.ts`,
`PlatformerPage.tsx`.

#### D3 — Hazard kind is switched on in three layers
**Impact: High · Effort: M**

**Evidence**
- `PlatformerState.hazardPlacementsForTick:956-982` branches
  `hazard.hazardType === 'floorSpike'` (`:958`) / `'fallingStalactite'` (`:965`) and writes
  kind-specific fields.
- `Collision.ts` gates triggers by kind (`checkFloorSpikeTriggers:377`,
  `checkFallingStalactiteTriggers:498`).
- `PlatformerPage.tsx:1978-1982` decides knockback by
  `hazardType === 'floorSpike' || 'fallingStalactite'`.
- `HazardType` (`hazards/HazardType.ts`) exposes `damage`/`lethal`/`isContact` but no
  `knocksBack` and no tick-state hook.

**Problem** `HazardType`'s doc promises "adding a kind touches one line", but three layers
disagree.

**Direction** Extend `HazardType` with `knocksBack` and `withTickState(placement, timers)`;
move the merge and the knockback decision behind it.

**Affected**: `entities/hazards/HazardType.ts`, `entities/hazards/*`,
`PlatformerState.ts`, `engine/Collision.ts`, `PlatformerPage.tsx`.

#### D4 — Counter totals filter by concrete kind names
**Impact: Med · Effort: S**

**Evidence** `PlatformerState.ts:396-409` (`blockKind === 'coinPot' | 'questionMark' | 'crate'`,
`spriteType === 'coin'`, `type === 'slimeGreen'`), `:465-472` (`blockKind !== 'crate'`),
`:482-484` (`type === 'slimeGreen'`).

**Problem** Adding a countable kind means editing the totals computation.

**Direction** Registry metadata (`counterKey` / `countsAs`) on `BlockType` / `PickupType` /
`EnemyType`; compute totals by iterating placements generically.

#### D5 — Player damage/knockback/splatter duplicated 4–5× inline
**Impact: High · Effort: M**

**Evidence** The same `takeDamage → alive → applyHitReaction → splatter` shape at
lethal spear (`PlatformerPage.tsx:1836-1853`), enemy contact (`:1892-1941`), ordinary hazard
(`:1954-2006`), bomb blast (`:2319-2359`), pit fall (`:2400-2417`). Each re-derives player
centre from camera origin and re-implements "crouch suppresses knockback".

**Direction** A `PlayerDamageSystem.applyHit(player, {damage, side, sourceKind, knockback})`
owning "at most one hit per tick" and splatter placement.

#### D6 — Bomb subsystem is ~120 lines inline in the tick
**Impact: Med · Effort: M**

**Evidence** `PlatformerPage.tsx:2258-2379` (step fuse, detonation, `blastTiles`,
`blocksInBlast`, `enemiesInBlast`, `playerInBlast`, explosion effect, filtering).

**Direction** `engine/BombSystem.ts` returning world deltas; the page applies them.

#### D7 — Reset coordinators manually enumerate ~30 signals
**Impact: Med · Effort: M**

**Evidence** `resetGame` (`PlatformerState.ts:1019-1068`) and `resetGameProgress`
(`:1088-1116`) each touch ~20–28 signals with subtle per-domain rules (blocks whose kind
`restoredOnRespawn`, checkpoint-first ordering).

**Direction** Per-domain store objects exposing `reset(respawn)` / `resetFull()`; each domain
resets itself.

#### D8 — Asset loading + manifest embedded in the mount effect
**Impact: Med · Effort: M**

**Evidence** ~300 lines in `PlatformerPage.tsx:2536-2831`: ~25 `loadImage` chains, a registry
walk, 20+ individual refs, and a module-level side effect `setSpearTipMask(...)` (`:2680-2681`).

**Direction** `engine/AssetLoader` / `SpriteManifest` returning a populated `SpriteLookup` +
ready promise; remove per-sheet refs.

#### D9 — HUD composition is hardcoded by kind
**Impact: Med · Effort: S**

**Evidence** `PlatformerPage.tsx:923-975` hardcodes popup label order and specific sprites
(`SLIME_GREEN_SHEET` frame 2 at `:946`, `blockFrameSource('crate')` at `:953`);
`:990-1028` computes counter X positions from chest counts (`keyCounterX`/`bombCounterX`).

**Direction** A HUD model + `HudRenderer`/`HudLayout` consuming it.

#### D10 — Level-marker vocabulary known to the state layer
**Impact: Low · Effort: S**

**Evidence** `torchPositions` reads `marker?.kind === 'torch'` and `marker.strength` directly
(`PlatformerState.ts:256-268`); checkpoints/ladders similarly.

**Direction** Typed `TorchPlacement` mapper, matching the `placeBlocks`/`placeEnemies` pattern.

---

### Group M — Level mappers, parsing, and editor duplication

#### M1 — `gridRenderState.ts` duplicates the whole finder + mapper pipeline
**Impact: High · Effort: M**

**Evidence** The editor re-synthesizes every placement instead of reusing `LevelParser`
finders + `*Mapper` place functions:
- `findAllPositions` (`gridRenderState.ts:40-50`) ≡ `findAllOfKind` (`LevelParser.ts:465-475`).
- `synthesizeSignPlacements:200-212` ≡ `findSignTiles` + `placeSigns`.
- `synthesizeHazardPlacements:220-255` ≡ `findHazardTiles` + `placeHazards`.
- `synthesizeCollectiblePlacements:110-120`, `synthesizeEnemyStates`/`synthesizeBlockStates`/
  `synthesizeChestStates`/`synthesizeCheckpointStates` (`:122-193`), `synthesizeLadderBundleStates`
  (`:261-266`) — all parallel copies. Doc comments admit it (`:197-199`, `:214-219`).

**Direction** A `gridCharGridToLayout(grid)` adapter so the editor calls the real chain once.

**Affected**: `editor/gridRenderState.ts`, `level/LevelParser.ts`, `level/*Mapper.ts`.

#### M2 — Seven `*Mapper` files with no shared interface; near-identical place loops
**Impact: Med · Effort: M**

**Evidence** All reduce to
`markers.map(({col,row}) => ({id:\`${prefix}-${col}-${row}\`, ...tileToPixel(col,row)}))`:
`CheckpointMapper.placeCheckpoints:31-34`, `SignMapper.placeSigns:36-39`,
`HazardMapper.placeHazards:49-52`, `CollectibleMapper.placeCollectibles:91-99`,
`EnemyMapper.placePurpleSlimes:100-103` / `placeBees:109-112`,
`BlockMapper.placeBlocks:198-222`. `placeCrates` (`BlockMapper.ts:148-167`) and
`placeGreenSlimes` (`EnemyMapper.ts:75-94`) are the same proportional fact-pool slice
algorithm written twice.

**Direction** `placeAtMarkers(markers, {idPrefix, build})` and
`placeWithFactPool(markers, pool, {idPrefix, kind})`.

#### M3 — CVData→fact flattening duplicated across 4 files / 8 converters
**Impact: Med · Effort: M**

**Evidence** `BlockMapper.ts:7-80` (five converters), `EnemyMapper.ts:14-27`,
`ChestMapper.ts:6-18`, `CollectibleMapper.ts:15-27`; `slugify` lives in
`CollectibleMapper.ts:8-13` but is imported by Block/Enemy/Chest.

**Direction** `defFromCvItem(item, {idPrefix, sectionId, sectionLabel, sourceType})` + shared
`level/ids.ts`.

#### M4 — Raw-file validation/parsing duplicated (with a real bug)
**Impact: Med · Effort: S**

**Evidence** `isLayout`/`isBackground`/`isMarkers` verbatim in `levelRegistry.ts:48-84` and
`BlueprintData.ts:30-54`; `idFromPath` in `levelRegistry.ts:45-46` and
`blueprintRegistry.ts:4-5`; `parseLevelModules` ≡ `parseBlueprintModules`.
**Bug:** `editorState.ts:31-40` `isMarkerEntry` duplicates but is weaker than
`LevelParser.normalizeMarkerEntry:323-338` — it omits the `'torch'` kind, so a persisted torch
marker is silently dropped on reload.

**Direction** One `layoutFile.ts` module used by all four consumers; fixes the torch-drop.

#### M5 — Kind unions split across parallel lists
**Impact: Med · Effort: S**

**Evidence** Hazards: `HazardKind` (`LevelParser.ts:142`) vs `HAZARD_TYPES`
(`hazards/index.ts:10`) vs `HAZARD_CHARS` (`LevelParser.ts:154-168`). Blocks: `BlockKind`
(`Block.ts:13`) vs `BlockDef.blockKind` (`types.ts:120`) vs `BLOCK_TYPES` (`blocks/index.ts:11`).
Enemies already get it right: `EnemyTypeKey = keyof typeof ENEMY_TYPES`.

**Direction** Derive `HazardKind = keyof typeof HAZARD_TYPES` and likewise for blocks.

#### M6 — Palette metadata is four parallel tables + tool union
**Impact: Med · Effort: M**

**Evidence** `PALETTE_TILE_SPRITES` (`paletteTiles.ts:103-530`), `PALETTE_TILE_GLYPHS:581-584`,
`PALETTE_TILE_DESCRIPTIONS:595-637`, `PALETTE_TILE_LABELS:642-684`, plus `EditorTool`/`MarkerTool`
(`editorState.ts:18-23`) and `DECORATION_CHARS` (`Palette.tsx:54`). Adding a tool touches up to
six places.

**Direction** One `PALETTE_TOOLS: Record<EditorTool, {label, description, sprite, glyph, group}>`.

#### M7 — Editor paint/import/save duplication
**Impact: Med · Effort: M**

**Evidence**
- `EditorCanvas.applyToolAt:1030-1119` re-encodes per-tool semantics (marker tools,
  sign/falling-stalactite, torch, and a "clear marker on repaint" set) that duplicate
  `paintMarkerCell.ts:49-100` and `parseMarkers`.
- `paintCell` (`paintCell.ts:119-169`), `paintBackgroundCell` (`paintBackgroundCell.ts:13-23`),
  `paintMarkerCell` (`paintMarkerCell.ts:49-59`) all copy the grid + write one cell + re-use
  `growGrid`; `placeBlueprint.ts:29-61` and `rebaseBlueprintBackground:141-180` add two more copies.
- `importLayout:31-54` vs `parseLevel:370-385`; `cropLayoutToBox` (`exportLayout.ts:60-72`) vs
  `cropLevelForExport.ts:40-57`.
- `saveLevelFile.ts:13-134` vs `saveBlueprintFile.ts:21-139` are near-identical (same slug body,
  same `hasBackgroundContent`, same POST-with-download-fallback).

**Direction** Generic `paintGrid<T>(...)`, a one-shot layout adapter, and a generic
`saveFile({endpoint, fileName, contents})`.

#### M8 — Three overlapping raw-file shapes
**Impact: Low · Effort: S**

**Evidence** `LevelDef` (`LevelData.ts:154-161`), `LevelEntry` (`levelRegistry.ts:15-24`),
`Blueprint` (`BlueprintData.ts:14-23`) all describe `{name?, layout, background?, markers?}`
with minor differences.

**Direction** One `LayoutFile` type; `LevelEntry`/`Blueprint` alias it.

#### M9 — Hint/type conflation feeds E2
**Impact: Low · Effort: S**

**Evidence** `HintId` (`types.ts:146`) = `keyof Translation['platformer']['hints']`, mixing sign
hints and UI-only messages; `HintCatalog.ts:9` calls this out explicitly.

**Direction** Covered by E2's `SignHintId` / `BubbleMessageId` split.

---

### Group F — File and folder placement

The folders are organised by "kind of thing" (engine / entities / level / editor) rather than
by dependency layer, and the actual import graph does not respect that taxonomy. Two folders
import each other, `engine/` reaches up into application state, and a pure parsing folder
imports React signals. The concrete misplacements below are what make the tree feel
inconsistent.

Dependency reality (observed via imports):

```
PlatformerPage / PlatformerState        (app / orchestration)
        │
        ▼
   engine ───────────────► level   ──┐
     ▲   ◄─────────────────────────┘ │  cycle (F2)
     │                                │
   entities ─────────────► level      │
     │  └──► engine (DrawContext, Outcome, Contact, PhysicsConfig, BlockAI, …)
     │
   engine/RewardReveal ──► PlatformerState   (engine depends on app state — F3)
   level/level.ts ──► @preact/signals-react  (pure layer depends on React state — F5)
```

#### F1 — Shared contracts are scattered across `entities/` and `engine/`
**Impact: High · Effort: S**

**Evidence** The low-level contracts every entity and engine module needs are split by
accident of history:
- `entities/WorldType.ts` (`WorldType`/`Boxed`), `entities/capabilities.ts`,
  `entities/geometry.ts`.
- `engine/Outcome.ts` (`PlayerEffects`/`RewardEffects`), `engine/Contact.ts`
  (`CollisionOutcome`), `engine/DrawContext.ts` (every `draw` signature), `engine/PhysicsConfig.ts`.

Entity *type* modules import the engine for their own contract:
`entities/WorldType.ts:2`, `entities/blocks/BlockType.ts:2,6` (`DrawContext`, `Outcome`),
`entities/enemies/EnemyType.ts:9,10` (`DrawContext`, `Contact`),
`entities/pickups/PickupType.ts:4`, `entities/Checkpoint.ts:3` (`Box` from `Collision`),
`entities/hazards/FallingStalactite.ts` (`FallingStalactite` + `CollectionEffects`).

**Problem** There is no shared contracts layer; the contracts live wherever they were first
written. `DrawContext` in particular is a render contract that entities must import from
`engine/`.

**Direction** A `contracts/` layer holding `WorldType`, `capabilities`,
`geometry`, `Outcome`, `Contact`, `DrawContext`, `PhysicsConfig`, plus the Phase 0 `math` and
`GridCell` primitives. `engine/` and `entities/` both depend *down* on it. *(Resolved by
R-001 — `specs/R-001-platformer-core-contracts/`: `PhysicsConfig` lands in `contracts/`, and
`sprites/` stays in `entities/`.)*

**Affected**: the 8 files above plus their importers.

#### F2 — `engine/` and `level/` import each other (cycle)
**Impact: Med · Effort: M**

**Evidence**
- `engine/*` → `level/*` heavily (`Terrain`, `LevelData`, every `*Placement` mapper).
- `level/*` → `engine/*`: `HazardMapper.ts:3-4` (`FloorSpikePhase`, `FallingStalactitePhase`),
  `LevelParser.ts:13` (`DEFAULT_TORCH_STRENGTH`, `isTorchStrength` from `engine/Torch`),
  `SignMapper.ts:2` (`Box` from `engine/Collision`).

**Problem** Three small type/constant leaks force a cycle between two large folders.

**Direction** `Box` → `contracts/geometry.ts`; the whole torch module (`TorchStrength`,
constants, validator, frame animation) → `entities/Torch.ts`; hazard phase types →
`entities/hazards/phases.ts` (the hazard kinds own their phases). After this, `level/` no
longer imports `engine/` (it still reaches `entities/`, mirroring the existing
`entities/ → level/` edge). [R-004](https://github.com/garcipat/cv-website/issues/92) later
relocates the spike/stalactite state machines themselves into `entities/hazards/`. *(Resolved by
R-001.)*

**Affected**: `level/HazardMapper.ts`, `level/LevelParser.ts`, `level/SignMapper.ts`,
`engine/Torch.ts`, `engine/Collision.ts`, `engine/FloorSpike.ts`,
`engine/FallingStalactite.ts`.

#### F3 — `engine/RewardReveal.ts` imports `PlatformerState` (layer inversion)
**Impact: Med · Effort: S**

**Evidence** `engine/RewardReveal.ts:1` imports `collectedFacts`, `activeEffects`,
`activeCounterPopups`, `levelTotals` from `../PlatformerState` and writes to them. It is
"describe a reveal → produce state + flight + popup", i.e. feature/application logic, not a
pure engine service.

**Problem** An `engine/` module depends on global app state and the journal model, so the
engine folder can't be reasoned about or tested without signals.

**Direction** Move `RewardReveal` to the state/features layer (e.g.
`state/rewards.ts` or `features/rewards/`), or invert it so it returns `RewardEffects` data
(like `BlockType.onHit` already does) and the state layer applies it.

**Affected**: `engine/RewardReveal.ts`, `engine/CollectionEffects.ts`,
`entities/CollectiblesSummary.ts`, `entities/JournalEntry.ts`.

#### F4 — Journal and HUD-model files live in `entities/`
**Impact: Med · Effort: S**

**Evidence** `entities/JournalAnimation.ts` (journal open animation),
`entities/JournalEntry.ts` (fact → journal display), `entities/JournalSections.ts`
(bookmark order/colours), and `entities/CollectiblesSummary.ts` (counter/journal summary
model) are not entities — nothing in the world implements them. They are consumed by
`components/Journal.tsx` and the HUD.

**Problem** `entities/` is the world-object folder; presentation/content models obscure it.

**Direction** A `journal/` (or `ui/journal/`) folder holding the `Journal.tsx` component,
`BookmarkTabs.tsx`, and these three modules; `CollectiblesSummary` → `hud/` or `journal/`.

**Affected**: four `entities/` modules + `components/Journal.tsx`, `components/BookmarkTabs.tsx`.

#### F5 — `level/level.ts` mixes raw level data with React signal state
**Impact: High · Effort: M**

**Evidence** `level/level.ts` (404 lines) defines the shipped level literals
(`LEVEL_1_LAYOUT:186`, `LEVEL_1_BACKGROUND:223`, `LEVEL_1_MARKERS:238`, `SCRATCH_LAYOUT:255`)
**and** the runtime computed signals (`currentLayout:272`, `currentLevel:303`, plus 15
`*_TILES` computed signals), importing `@preact/signals-react` at `:1`.

**Problem** The parsing folder (which should be pure data → `LevelDef`, no UI) now depends on
React signals, and shipped level data is buried in a state module instead of the
`level/levels/` folder that exists for exactly this purpose.

**Direction** Move raw literals into `level/levels/` (currently only a README) and the signal
wiring into `state/` (`levelSession.ts`). This also makes `level/levels/` real and removes
React from `level/`.

**Affected**: `level/level.ts`, `level/levelRegistry.ts`, `PlatformerState.ts`, editor modules
that import `LEVEL_1_LAYOUT`.

#### F6 — `level/levels/` and `level/blueprints/` are empty placeholder folders
**Impact: Low · Effort: S**

**Evidence** `level/levels/` contains only `README.md`; `level/blueprints/` only `.gitkeep`.
`levelRegistry.ts:1` reads built-in levels from `level.ts`, so the folders the registry is
designed to load from are unused.

**Problem** The structure advertises file-backed levels that do not exist.

**Direction** Populate `level/levels/` from F5, or drop the empty folders until file-backed
levels are actually supported.

**Affected**: `level/levels/`, `level/blueprints/`, `level/levelRegistry.ts`,
`level/blueprintRegistry.ts`.

#### F7 — `engine/` is three folders' worth of concerns in one
**Impact: Med · Effort: L**

**Evidence** 39 non-test modules mixing:
- **Generic services**: `Physics`, `Collision`, `Standable`, `Crouch`, `Camera`, `Input`,
  `GameLoop`, `GameLifecycle`, `IrisTransition`, `FontLoader`, `SpriteLoader`, `CanvasSize`.
- **Rendering**: `Renderer` (~2.7k), `DrawContext`, `GroundAtlas`, `BackgroundAtlas`,
  `StaticObjectsCatalog`, `BackgroundDecorCatalog`, `BackgroundLayers`, `AmbientClouds`.
- **Per-feature state machines**: `CrumblingFloor`, `DeployableLadder`, `FallingStalactite`,
  `FloorSpike`, `PlacedBomb`, `MushroomSquash`, `Torch`, `Blast`, `RewardReveal`,
  `CheckpointLogic`, `BlockAI`, `EnemyAI`, `HintTooltip`.

**Problem** A reader looking for "the renderer" or "the bomb" scans a flat 39-file list with
no grouping, and the feature modules are indistinguishable from services.

**Direction** Split into `engine/` (services), `engine/render/` (the renderer + atlases +
layer catalogs), and `features/` (the per-feature machines, each folding into E/P findings).
This pairs naturally with L1's `SceneRenderer`/`HudRenderer` split.

**Affected**: most of `engine/`.

#### F8 — `editor/` mixes three concerns
**Impact: Med · Effort: M**

**Evidence** 36 non-test modules:
- **UI** (`*.tsx`): `EditorCanvas`, `EditorCanvasPane`, `EditorSidebar`, `EditorToolbar`,
  `EditorWorkspace`, `EditorSaveDialog`, `EditorEntrySelect`, `Palette`, `PaletteTile`,
  `BlueprintSelect`, `LevelSelect`, `LevelEditorPage`.
- **Pure editing ops** (`.ts`): `paintCell`, `paintBackgroundCell`, `paintMarkerCell`,
  `growGrid`, `importLayout`, `exportLayout`, `cropLevelForExport`, `placeBlueprint`,
  `blueprintCells`, `blueprintFit`, `gridRenderState`, `paletteTiles`,
  `backgroundPaletteTiles`, `caveLightingPreview`, `editorState`, `editorActions`,
  `EditorZoom`, `EditorPan`.
- **Dev/save infrastructure**: `saveLevelFile`, `saveBlueprintFile`, `saveLevelEndpoint`,
  `saveBlueprintEndpoint`, `devEnvironment`, `devEnvironmentEndpoint`.

**Problem** React UI, pure transform functions, and Vite dev-server plumbing share one flat
list, and (per M1) the pure ops duplicate the level pipeline.

**Direction** `editor/` (UI), `editor/ops/` (pure transforms — which the M1/M6/M7 unification
would shrink), `editor/dev/` (save endpoints + dev environment).

**Affected**: most of `editor/`.

#### F9 — `entities/` top level is a grab bag above per-kind folders
**Impact: Med · Effort: M**

**Evidence** `entities/` mixes: family dispatchers (`Enemy.ts`, `Block.ts`, `Chest.ts`),
standalone entities (`Player.ts`, `Checkpoint.ts`), update/shared (`Health.ts`,
`CollectiblesSummary.ts`), pure mixins (`WorldType.ts`, `capabilities.ts`, `geometry.ts`), the
pickup state modules (`Coin.ts`, `Fruit.ts`, `BonusFruit.ts`, `BombPickup.ts`,
`HeartPickup.ts`, `KeyPickup.ts`) that already have `pickups/*` type views, sprite data
(`sprites/`), and the journal modules (F4).

**Problem** Three naming conventions coexist: some families are folders
(`blocks/`,`enemies/`,`hazards/`,`pickups/`,`chests/`), some entities are loose files, and the
pickup states are split from their views. It is not obvious where a new entity module goes.

**Direction** One folder per family (`entities/player/`, `entities/checkpoint/`, …), pickup
constants colocated with their `pickups/*` views (also X6), contracts moved to `contracts/`
(`sprites/` stays in `entities/`). Keep each family a self-contained unit.

**Affected**: `entities/` top level; overlaps X6.

#### F10 — The hint concept is split across `level/`, `engine/`, and `types.ts`
**Impact: Med · Effort: S**

**Evidence** Catalog in `level/HintCatalog.ts`, effect/state machine in
`engine/HintTooltip.ts`, id union in `types.ts` (`HintId`), rendered by
`engine/Renderer.drawSignBubble` and driven from `PlatformerPage.tsx`.

**Problem** A single feature (speech bubble / sign hint) has no home; its pieces are in four
places under three names.

**Direction** Unify under the E2 `SpeechBubble` effect plus a `hints/` (or `features/bubble/`)
home for the catalog + id types. Directly tied to E2/M9.

**Affected**: `level/HintCatalog.ts`, `engine/HintTooltip.ts`, `types.ts`, `engine/Renderer.ts`.

#### F11 — `components/` is a thin UI bucket overlapping `editor/`
**Impact: Low · Effort: S**

**Evidence** `components/` holds only `Journal.tsx`, `ControlsOverlay.tsx`,
`BookmarkTabs.tsx`, `ThankYouScreen.tsx`, while the editor's ~12 UI components live in
`editor/`. `BookmarkTabs.tsx` is journal-only.

**Problem** No consistent rule for "game UI" vs "editor UI" vs "components".

**Direction** Rename/scope to `ui/` for game-level UI, with a `ui/journal/` subfolder absorbing
F4 and `BookmarkTabs`. Editor UI stays under `editor/`.

**Affected**: `components/`.

#### F12 — Filename casing is inconsistent
**Impact: Low · Effort: S (cosmetic)**

**Evidence** PascalCase components/types (`Renderer.ts`, `Player.ts`) sit beside lowercase
modules that export signals/registries (`level.ts`, `levelRegistry.ts`,
`blueprintRegistry.ts`, `paletteTiles.ts`, `editorState.ts`, `paintCell.ts`). There is no
stated rule; it happens to track "class-like vs module-like", but `LevelData.ts`/`LevelParser.ts`
break even that.

**Direction** State a rule in `docs/CodingGuidelines.md` (e.g. PascalCase for a module whose
main export is a class/type/component; camelCase for functions/registries) and apply it during
the moves above. Purely cosmetic — do it opportunistically, not as its own task.

---

### Group A — Sprite asset organization ([R-013](https://github.com/garcipat/cv-website/issues/101))

The sprite assets use three different storage/addressing patterns, and a few sequences are
split across files with hand-written paths. The inconsistency is in the *addressing model*,
not just file count.

#### A1 — `SpriteSheet` conflates grid sheets with atlas "loading units"
**Impact: Med · Effort: S**

**Evidence** `SpriteSheet` (`entities/sprites/SpriteSheet.ts:11-18`) describes a uniform
frame grid addressed by `frameSource` (`:39`). But several registered sheets are *atlases* with
gutters or non-uniform art, where `frameWidth`/`columns` do not describe the art — the comments
say so repeatedly: `sheets.ts` for `GROUND_ATLAS_SHEET`, `BACKGROUND_TILES_SHEET`,
`STATIC_OBJECTS_SHEET`, `DECORATIONS_SHEET`, `ROPE_LADDER_SHEET`, `MUSHROOM_SHEET`,
`AMBIENT_CLOUDS_SHEET`, `BACKGROUND_LAYERS_SHEET` all note "this registration exists for
loading, not addressing".

**Direction** Split the type: `SpriteSheet` (uniform grid + `frameSource`) vs `SpriteAtlas`
(explicit rect table, also the loading unit). Atlases stop lying about their geometry.

#### A2 — Split sequences with ad-hoc paths and hand-loading
**Impact: Med · Effort: M**

**Evidence**
- Journal open animation: `journal_open_1..9.png`, deliberately non-uniform (208x132 …
  132x183), addressed by string interpolation (`JournalAnimation.ts:16-19`) plus a hand-kept
  dimension table (`JournalAnimation.ts:26-36`).
- Player: `knight.png` (256x288, 32px frames) and `knight2.png` (1024x484, 128px frames)
  loaded as raw paths (`PlatformerPage.tsx:2702,2712`), not registered sheets.
- Chest: `chest_closed.png` (28x20) + `chest_open.png` (24x20) — separate files.
- Journal chrome/icons: `journal.png`, `journal-reset.png`, `journal-close.png`,
  `journal-chevron-left/right.png` — 5 files, different sizes.
- Bookmarks: 6 × `bookmark_{color}.png`, all 106x221 — only the colour differs.

**Direction** Register all of these through the sprite registry so loading is uniform; group
same-size variants (bookmarks → one sheet; journal chrome → one UI atlas with rects; chest → one
atlas or a 2-state descriptor). Keep genuinely different sequences split (journal-open trimmed
frames; `knight` vs `knight2`; background layers) but describe them in one descriptor.

#### A3 — Same-size variants are not grouped
**Impact: Low · Effort: S**

**Evidence** The 6 bookmark sprites are byte-size-identical frames (106x221) differing only in
colour — the same situation `mushroom.png`/`fruit.png` already solve with a grid.

**Direction** One bookmark sheet (6 cells), addressed by colour index.

#### A4 — Unreferenced leftover assets in `public/sprites/`
**Impact: Low · Effort: S**

**Evidence** No runtime references exist for `terrain_.png`, `winter_.png`, `summer_.png`,
`autumn_.png`, `spring_.png`, `backgrounds.png`, or `banner_straight.png` (they are tileset/
scene *sources* that were cropped into the shipped sheets).

**Direction** Noted, not acted on: decide delete vs move to an art-source folder later.

#### A5 — Loading is partly registry-driven, partly hand-listed
**Impact: Med · Effort: S**

**Evidence** `collectSheetSources` (`SpriteSheet.ts:57-59`) discovers registry sheets, but
`EXPLOSION_SHEET`, `SPEAR_SHEET`, `FLOOR_SPIKE_SHEET`, `knight`, `knight2`, `hearts`, `coin`,
`fruit`, `chest_closed`, and `key` are hand-listed `loadImage` calls
(`PlatformerPage.tsx:2662-2813`).

**Direction** Extend the loader manifest so every sheet/atlas — including secondary and
sequence assets — is discovered, not hand-listed. This overlaps [R-012](https://github.com/garcipat/cv-website/issues/100)'s `AssetLoader`.

#### A6 — Non-shared sprite art lives away from its owner
**Impact: Med · Effort: M**

**Evidence** Every sprite is registered centrally in `entities/sprites/sheets.ts`, including art
used by exactly one entity or tile (`FLOOR_SPIKE_SHEET`, `SPEAR_SHEET`, `DECORATIONS_SHEET`, the
torch frames). The consumer and its art therefore live in different folders.

**Direction** Keep only genuinely shared sheets/atlases in `entities/sprites/`; move art used by
a single entity or tile beside that owner (e.g. the hazard, block, or torch module) and expose it
through the owner. Depends on the A1 `SpriteSheet`/`SpriteAtlas` split.

---

### Group X — File merges and dead code

| ID | Finding | Evidence | Direction | Impact/Effort |
| --- | --- | --- | --- | --- |
| X1 | `EnemyAI.ts` is a dead compatibility shim | `EnemyAI.ts:6-18` admits it; only `stepEnemyHitReaction:52-64` is live | Migrate `EnemyAI.test.ts` then delete the shim | Low/S |
| X2 | `IrisTransition.ts` used only by `GameLifecycle.ts` (+ one page import) | — | Merge math into `GameLifecycle` | Low/S |
| X3 | `BackgroundDecorCatalog.ts` duplicates `StaticObjectsCatalog` picker | `:31-38` vs `StaticObjectsCatalog.ts:181-200` | Merge into one variant catalog | Low/S |
| X4 | `Contact.ts` + `Outcome.ts` mutually dependent | `Contact.ts:1`; `Outcome.ts:39-66` | One outcome-vocabulary module | Low/S |
| X5 | `Torch.ts` + torch half of `Lighting.ts` are one concept split | `Lighting.ts:16` imports from `Torch` | One `TorchLight` module (fits L2) | Med/S |
| X6 | Pickup constant modules should live beside their type views | `Coin.ts`, `Fruit.ts`, `BonusFruit.ts`, `BombPickup.ts`, `HeartPickup.ts`, `KeyPickup.ts` each feed exactly one `pickups/*.ts`; blocks already colocate | Fold constants into `pickups/*.ts`; delete dead `coinFrameSource` (`Coin.ts:28`, proven duplicate of `frameSource` by `pickups/PickupType.test.ts:9`) | Med/S |
| X7 | `CHEST_TYPE` is a degenerate one-member family with two import paths | `chests/Chest.ts:35`, `chests/index.ts:1-2`, consumers import both `entities/Chest` and `entities/chests` | Promote to keyed registry or fold into blocks/world items | Low/S |
| X8 | Pot semantics leak into the generic Block layer | `BlockType.pot?` (`BlockType.ts:77`), `BlockState.rewardGiven` (`Block.ts:74-80`), `restoredOnRespawnForBlock` (`Block.ts:54-56`), `computePotRenderPlan` (`potRenderPlan.ts:26-41`) | Generic `BlockType.drop` + optional `renderGroup` capability | Med/M |

---

## 4. North-star abstractions (one-line sketches)

These are the shared constructs most findings converge on. Names are proposals; exact shape
to be settled per item.

- **`LightSource`** — `{ x, y, radius(t), color, intensity, punchHole }` adapters from torch,
  player, future emitters. Unblocks L1/L2/L3.
- **`TransientEffect<S>`** — `{ id, elapsed, duration, tick, draw, expired }` registry.
  Unblocks E1/E2/E3/E4 and absorbs the timed-tile boilerplate in E4.
- **`SpeechBubble`** — a `TransientEffect` variant carrying `{ textId, anchor, transient }`.
  Unblocks E2/M9.
- **`WorldItemType<S>`** — `{ id, col, row, step(state,dt), box?, draw }` registry for placed
  items. Unblocks P1/P2.
- **`StaticTileType`** — `{ key, draw(...) }` registry for terrain decor. Unblocks L1/L6.
- **`placeAtMarkers` / `placeWithFactPool`** + a declarative entity registry
  `{ char, finder, mapper, synthesize }`. Unblocks M1/M2/M3/M5.
- **Registry metadata** (`counterKey`, `onDefeat`, `knocksBack`, `withTickState`, `spawn`,
  `onCollect`) — completes the dispatch pattern. Unblocks D1–D4.

The metapoint: **the registry + per-kind-module pattern is the house style. Nearly every
finding is a place where that style did not get applied.**

---

## 4.1 Proposed folder structure

A target tree that (a) gives the shared contracts a real layer, (b) breaks the
`engine`↔`level` cycle, (c) separates renderer from services from feature machines, and
(d) makes each entity family self-contained. Names are proposals.

```
src/themes/platformer/
├── contracts/                # shared contracts + pure primitives (no canvas, no React)
│   ├── WorldType.ts
│   ├── capabilities.ts
│   ├── geometry.ts           # Direction, Rect, Box, GridCell, tileBox (absorbs F2)
│   ├── Outcome.ts
│   ├── Contact.ts
│   ├── DrawContext.ts
│   ├── PhysicsConfig.ts
│   ├── math.ts               # clamp01/smoothstep/lerp/hash2D/pulse/shake (Phase 0)
│   └── ids.ts                # slugify + id helpers (M3)
├── level/                    # raw parsing + placement — pure, NO signals
│   ├── LevelData.ts
│   ├── Terrain.ts
│   ├── LevelParser.ts
│   ├── *Mapper.ts
│   ├── HintCatalog.ts
│   ├── SkillFactPacing.ts
│   ├── layoutFile.ts         # shared raw-file validation (M4)
│   ├── levelRegistry.ts
│   ├── blueprintRegistry.ts
│   ├── BlueprintData.ts
│   ├── levels/               # shipped raw level data (from level.ts — F5/F6)
│   └── blueprints/
├── engine/                   # generic runtime services
│   ├── Physics.ts  Collision.ts  Standable.ts  Crouch.ts
│   ├── Camera.ts  Input.ts  GameLoop.ts  GameLifecycle.ts  IrisTransition.ts
│   ├── FontLoader.ts  SpriteLoader.ts  CanvasSize.ts
│   └── render/               # atlases, layers, catalogs
│       ├── Renderer.ts       # → split SceneRenderer / HudRenderer (L1)
│       ├── GroundAtlas.ts  BackgroundAtlas.ts  TileAtlas.ts
│       ├── StaticObjectsCatalog.ts  BackgroundDecorCatalog.ts
│       ├── BackgroundLayers.ts  AmbientClouds.ts
├── features/                 # per-feature state machines (fold into E/P where possible)
│   ├── torch/                # Torch.ts + LightSource (L2/X5)
│   ├── bombs/                # PlacedBomb + blast + BombSystem (P1/P2/D6)
│   ├── ladders/              # DeployableLadder
│   ├── mushrooms/            # MushroomSquash (→ effect, E3)
│   ├── checkpoints/          # CheckpointLogic
│   └── effects/              # CollectionEffects + SpeechBubble registry (E1/E2)
├── entities/                 # one folder per family, self-contained
│   ├── player/               # Player.ts, Health.ts, Crouch? 
│   ├── blocks/               # Block.ts + blocks/* (constants colocated — X6/F9)
│   ├── enemies/
│   ├── hazards/              # views + FloorSpike/FallingStalactite state machines (E4)
│   ├── pickups/              # states + type views together (X6/F9)
│   ├── chests/
│   ├── checkpoint/
│   └── sprites/              # shared sheets/atlases only (R-013 — non-shared art with its owner)
├── state/                    # signals/stores (PlatformerState split — D7)
│   ├── (per-domain stores)
│   └── levelSession.ts       # currentLayout/currentLevel signals (from level.ts — F5)
├── ui/                       # game-level React UI (was components/)
│   ├── Journal.tsx  ControlsOverlay.tsx  ThankYouScreen.tsx
│   └── journal/              # JournalAnimation/Entry/Sections, BookmarkTabs (F4/F11)
├── editor/
│   ├── (UI components)
│   ├── ops/                  # pure transforms (M1/M6/M7)
│   └── dev/                  # save endpoints + dev environment (F8)
├── types.ts
├── PlatformerState.ts        # shrinks as stores move to state/
└── PlatformerPage.tsx
```

**R-001 interim landings (before the F7 split).** Landed early as cheap, independent moves:
the shared contracts live in `contracts/`; the torch module lives at `entities/Torch.ts`
(later folded into `features/torch/` with `LightSource` at L2/X5); hazard phase types live at
`entities/hazards/phases.ts`; and `RewardReveal` moves to `state/rewards.ts`.

**Important sequencing note.** Moving files is high-churn and generates merge conflicts, and
many files here are scheduled to be **merged or deleted** anyway (X1–X8, E/P findings). Do
*not* do a big-bang move first. Instead, land moves **with** the logical change that touches
the file — e.g. fold `MushroomSquash` into the effect registry and land it under
`features/effects/` in the same change. The cheap, independent moves (F1 contracts, F3
`RewardReveal`, F4 journal modules, F6 empty folders) can happen early; the rest ride along.

| Move | Rides with |
| --- | --- |
| F1 contracts → `contracts/` | Phase 0 (primitives) |
| F2 `Box`/torch/phases → `contracts/`/`entities/` | Phase 0 + Phase 4 |
| F3 `RewardReveal` → state/features | Phase 4 (reward applier) |
| F4/F11 journal → `ui/journal/` | independent, early |
| F5/F6 `level.ts` split → `level/levels/` + `state/levelSession` | Phase 7 |
| F7 `engine/` + `features/` split | Phases 1/2/6 (as files fold) |
| F8 `editor/ops` + `editor/dev` | Phase 7 |
| F9 entity folders | Phases 3/5 (with X6) |
| F10 hints → speech bubble | Phase 2 (E2) |
| F12 casing | opportunistic |

---

## 5. Proposed sequencing

Ordered for leverage and dependency. Phases 0, 1 are independent of the rest; later phases
can be reordered, but the dependencies noted must hold.

### Phase 0 — Shared primitives and safe dedup (low risk, unlocks later work) ([R-001](https://github.com/garcipat/cv-website/issues/89), [R-002](https://github.com/garcipat/cv-website/issues/90))
- **L4/L5** `contracts/math.ts`: `clamp01`, `smoothstep`, `lerp`, `hash2D`, `pulse`, `shakeOffsetX`.
- **L6** shared `TileAtlas` type.
- **P3** `findLandingRow` in `Standable.ts`; route the three callers.
- **M4** one `layoutFile.ts`; fixes the torch-marker-drop bug.
- **M5** derive kind unions from registries.
- **X1, X2, X3, X4, X6** low-risk file merges/deletions (keep tests green).
- **Structure:** create `contracts/` and land **F1** (contracts) + **F2** (`Box`/`geometry`) here;
  move `RewardReveal` (**F3**); journal modules (**F4**) and the empty folder cleanup (**F6**)
  are independent and can land any time.
- *Checkpoint: full test suite + build.*

### Phase 1 — `LightSource` (highest visual leverage) ([R-003](https://github.com/garcipat/cv-website/issues/91))
- **L2** LightSource abstraction; **L3** reuse math; **X5** merge torch halves.
- Depends on Phase 0 math helpers.
- *Checkpoint: lighting unit tests + visual smoke test in a cave level.*

### Phase 2 — Effect unification ([R-004](https://github.com/garcipat/cv-website/issues/92), [R-005](https://github.com/garcipat/cv-website/issues/93))
- **E1** `TransientEffect` registry + single collection/pass.
- **E2/M9** `SpeechBubble` (this is the abstraction the user asked for for tooltips);
  fold the hint pieces into one home (**F10**).
- **E3** mushroom squash as an effect; **E4** timed-tile module shared with the effect expiry.
- **Structure:** begin the `engine/render/` + `features/` split (**F7**) as these files move.
- *Checkpoint: each migrated effect keeps its existing tests; add registry contract test.*

### Phase 3 — Pickup unification ([R-006](https://github.com/garcipat/cv-website/issues/94))
- **D1** add `kind` discriminator + generic collision/draw + `spawn`/`onCollect`.
- **X6/F9** fold constant modules into `pickups/*` and give each family its own folder.
- *Checkpoint: page's pickup-name `if/else` deleted; counter totals (D4) can follow.*

### Phase 4 — Registry dispatch completion ([R-007](https://github.com/garcipat/cv-website/issues/95))
- **D2** `EnemyType.onDefeat` + shared reward applier; unify `ItemKind`/`PickupKind`.
- **D3** `HazardType.knocksBack` + `withTickState`.
- **D4** counter metadata.
- Depends on Phase 3 (reward applier shape).

### Phase 5 — Placeable world items ([R-008](https://github.com/garcipat/cv-website/issues/96))
- **P1** `WorldItemType` registry; **P2** bomb consolidation; **X7** chest decision.
- Depends on Phase 3 (pickup drop path) and Phase 4 (reward applier).

### Phase 6 — Static tile registry and renderer split ([R-009](https://github.com/garcipat/cv-website/issues/97))
- **L1** `STATIC_TILE_TYPES` + collapse `drawTerrain`; split `SceneRenderer`/`HudRenderer`;
  **L6** atlas sharing (already in Phase 0).
- Large but mostly mechanical once Phase 1/2 removed the lighting/effect special cases.

### Phase 7 — Mapper and editor unification ([R-010](https://github.com/garcipat/cv-website/issues/98))
- **M1** editor reuse of finder/mapper chain; **M2/M3** shared place helpers and def flattening;
  **M6/M7/M8** palette/paint/save unification.
- **Structure:** split `editor/ops` + `editor/dev` (**F8**); split `level.ts` into
  `level/levels/` data + `state/levelSession` signals and realise the placeholder folders
  (**F5/F6**).
- Largely independent of Phases 1–6; can run in parallel with a different workstream.

### Phase 8 — God-file decomposition (systems + stores) ([R-011](https://github.com/garcipat/cv-website/issues/99), [R-012](https://github.com/garcipat/cv-website/issues/100))
- **D5** `PlayerDamageSystem`; **D6** `BombSystem`; **D7** per-domain stores;
  **D8** `AssetLoader`; **D9** `HudRenderer`; **D10** typed placements.
- Do this **last**, after the registry/abstraction work has already removed most branches —
  otherwise we'd be extracting code we are about to rewrite.

---

## 6. Recommended first slice

If we want one high-signal, low-risk starter that demonstrates the pattern and de-risks the
rest, do **Phase 0 + Phase 1** together:

1. `contracts/math.ts` (L4/L5) — tiny, pure, immediately removes ~15 duplicated sites.
2. `contracts/` extraction of the shared contracts (F1) + break the `Box`/phase cycle (F2) — cheap,
   and everything after it gets a sane home.
3. `LightSource` (L2/L3, X5) — small surface area, high payoff, exercises the exact
   "abstract interface that torch and player both implement" the user described.

The independent cheap structure moves (**F3** `RewardReveal`, **F4** journal modules,
**F6** empty folders) can be picked up in parallel at any point.

After that, **Phase 2 (SpeechBubble + effect registry)** delivers the user's other named
example (mushroom squash / hint tooltip behind an abstract speech bubble), and **Phase 3
(pickups)** delivers the `placeItem`-family fix.

---

## 7. Open questions to resolve per phase

- **LightSource**: does enemy-eye visibility remain a *post-darkness overlay* (current) or
  become a true emitter in the light list? (Affects L2 scope.)
- **Effect registry**: one heterogeneous `activeEffects` list vs a small keyed set — which
  keeps the render order deterministic and cheap?
- **WorldItemType**: do dropped pickups join the same registry as placed bombs/ladders, or
  stay in the pickup family with a shared `id/x/y` base? (Affects P1 vs D1 boundary.)
- **StaticTileType**: how much decor art is "tile" vs "entity"? (Affects L1 scope.)
- **Mappers**: is `LevelDef` the single parse artifact, or do we keep a distinct editor grid
  type and adapt at the boundary? (Affects M1.)
- **Chest/CHEST_TYPE**: is a second chest kind actually planned? (Affects X7.)
- ✅ **`contracts/` boundary** (resolved by R-001): `PhysicsConfig` lives in `contracts/`
  (shared tuning); `sprites/` stays in `entities/`. The shared layer is named `contracts/`.
  (Affects F1/F2/F9.)
- **`features/` boundary**: which `engine/` modules are "services" vs "features"? Is a
  feature-per-folder split worth it now, or only once E/P fold the machines together?
  (Affects F7.)
- **`state/` split**: how many stores, and does `state/levelSession` own the layout signals
  or does `level/` keep them and only expose a pure parse API? (Affects F5.)

---

## Appendix A — Non-test module inventory (by area)

| Area | Notable modules |
| --- | --- |
| Engine | `Renderer` (~2.7k), `CollectionEffects` (~0.77k), `Physics` (~0.71k), `Collision` (~0.51k), `Lighting` (409), `AmbientClouds`, `StaticObjectsCatalog`, `BackgroundLayers`, `FallingStalactite`, `PlacedBomb`, `Camera`, `CrumblingFloor`, `DeployableLadder`, `GameLifecycle`, `DebugOverlay`, `PhysicsConfig`, `RewardReveal`, `BackgroundAtlas`, `FloorSpike`, `Crouch`, `HintTooltip`, `GroundAtlas`, `Torch`, `Blast`, `Outcome`, `CheckpointLogic`, `Input`, `BlockAI`, `MushroomSquash`, `EnemyAI`, `IrisTransition`, `Standable`, `BackgroundDecorCatalog`, `GameLoop`, `Contact`, `CanvasSize`, `DrawContext`, `FontLoader`, `SpriteLoader` |
| Entities | `Player`, `Enemy`, `Block`, `Chest`, `Checkpoint`, `Health`, `CollectiblesSummary`, `Journal*`, `WorldType`, `capabilities`, `geometry`, pickup state modules, `blocks/*`, `enemies/*` (+ `movement/`), `hazards/*`, `pickups/*`, `chests/*`, `sprites/*` |
| Level | `LevelParser`, `LevelData`, `level`, `Terrain`, `BlockMapper`, `HazardMapper`, `EnemyMapper`, `CollectibleMapper`, `ChestMapper`, `CheckpointMapper`, `SignMapper`, `HintCatalog`, `SkillFactPacing`, `levelRegistry`, `blueprintRegistry`, `BlueprintData` |
| Editor | `EditorCanvas`, `EditorCanvasPane`, `GridRenderState`, `paletteTiles`, `paint*`, `placeBlueprint`, `editorState`, `editorActions`, `EditorSidebar/Toolbar/Workspace/SaveDialog`, `LevelEditorPage`, `LevelSelect`, `save*File/Endpoint`, `importLayout`, `exportLayout`, `cropLevelForExport`, `EditorZoom`, `EditorPan`, `growGrid` |
| UI components | `Journal`, `ControlsOverlay`, `BookmarkTabs`, `ThankYouScreen` |

> `PlatformerPage.tsx` (~2.9k lines) and `PlatformerState.ts` (~1.1k lines) are covered in
> Group D rather than the inventory table.
