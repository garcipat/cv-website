# Phase 0 Research: Platformer Bombs

The spec's Clarifications session already settled every behavioural question
(the bomb is carried and placed, the blast is a 3×3 square with no chains and no
effect on loose pickups, the cap is 5, the key is `B`, blue pots restore on
respawn, the shipped level gains a pot and a sign). These decisions cover the
remaining implementation choices: how the pot, pickup, placed bomb, blast and
onboarding reuse the codebase's existing extension points.

One spec note is stale, not open: the Edge Cases entry for a bomb on a ladder
says "unresolved", but the Clarifications session already resolved it ("a bridge
stops a bomb … a ladder tile is open air"). This plan implements that resolution;
no clarification remains outstanding.

## D1 — The bomb pot is a third `createPotType` kind

**Decision**: Add `entities/blocks/BombPot.ts`, built with the O-017
`createPotType` factory:

```ts
createPotType({
  key: 'bombPot',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  drop: 'bomb',
  dropPolicy: 'everyBreak',
  restoredOnRespawn: true,
  frameIndex: () => BOMB_POT_FRAME,          // world_tileset.png row 8, col 0 = frame 128
  drawPot: (block, dc) => drawBlockTile(block, dc, BOMB_POT_FRAME),
})
```

Register it in `blocks/index.ts`, widen `BlockKind` (`entities/Block.ts`) and
`BlockDef.blockKind` (`types.ts`), and add the level marker `b` to
`ENTITY_CHARS`/`EntityKind`/`TileChar` plus `findBombPotTiles` and
`BOMB_POT_TILES`.

**Rationale**: This is exactly the drop-in the O-017 spec anticipated ("a third
(the bomb pot, O-012) must be addable without touching the shared behavior").
`'everyBreak'` + `restoredOnRespawn: true` mirrors the potion pot, which is what
makes the pot re-farmable after a death (FR-003/FR-029). The fixed blue-bottle
sprite (`world_tileset.png` frame 128, directly left of the potion pot's red
bottle at frame 129) means `drawPotBunch` never swaps it for a clay size variant
(FR-006) and no new art is needed.

**Alternatives considered**:
- *Drop the bomb only once (`'once'`)* — rejected: the spec requires a restored
  pot to yield a fresh bomb every break (FR-003).
- *A new pot-specific marker mechanism* — rejected: the level marker is already a
  separate `LevelParser`/`BlockMapper` edit by design, independent of the kind
  declaration.

## D2 — The bomb pickup follows the heart family, not the coin family

**Decision**: Model a dropped bomb as its own pickup family, mirroring the
heart: a `BombPickupState` (`entities/BombPickup.ts`), a `pickups/Bomb.ts`
`PickupType` (draws `bomb.png` frame 0, bobs via the shared `coinBobOffset`), a
`bombPickupStates` signal array, and a cap-aware
`checkBombPickupCollisions(player, states, count, cap)` in `Collision.ts`. The
sheet is discovered automatically by the existing `PICKUP_TYPES`-driven loader.

**Rationale**: A bomb has no CV fact, is never pre-placed in a level, and is
gated by an inventory cap rather than a per-item dedup id. That is the heart's
shape (array + filter-on-touch + a count gate), not the coin's
(`CollectiblePlacement` + `collectedCollectibleIds` + a fact-pool role the bomb
must not have, FR-011). Reusing the heart's conventions keeps the loader,
`PickupType`, and `drawXPickups` patterns uniform.

**Alternatives considered**:
- *Reuse the coin placement path (`spawnedCoinPlacements`)* — rejected: coins
  feed the skill-fact pool and the coin counter; a bomb must contribute to
  neither (FR-011).
- *Store the bomb as a `KeyPickupState`-style flagged entry* — rejected: bombs
  are removed outright on collection (like hearts/bonus fruits), so the
  flagged-in-place convention a key needs (for its HUD count across respawn) is
  unnecessary.

## D3 — Carry cap and HUD

**Decision**: Add `carriedBombs = signal<number>(0)` and `export const MAX_BOMBS = 5`
to `PlatformerState.ts`. Collecting a pickup increments the count only while it
is below `MAX_BOMBS`; at the cap the pickup stays in the world, still bobbing
(FR-009). The HUD draws a bomb icon (`bomb.png` frame 0) plus the count, in a new
group to the right of the key counter, and the whole group is **hidden while the
count is 0** (FR-010).

**Rationale**: A plain count signal matches `collectedKeys`; the cap is a single
constant the spec calls out as a tuning default. `drawBombCounter` mirrors
`drawKeyCounter`, and its X is derived from the *measured* key-counter width (the
same `ctx.measureText` approach `keyCounterX` already uses) so the HUD rhythm
stays exactly `HUD_GROUP_GAP` between groups, and it accounts for the key counter
being hidden at 0 keys.

**Alternatives considered**:
- *A fixed X position for the bomb counter* — rejected: the key counter's width
  varies with digit count, so a fixed X would drift.
- *Show the counter at 0* — rejected: FR-010 requires the group hidden at 0.

## D4 — Placement: which tile, and what the `B` key means

**Decision**: `KeyB` is added to `GAME_KEYS` (`engine/Input.ts`) and read as an
edge-triggered `input.consumePress('KeyB')` once per tick. The placed bomb's tile
is the column containing the player's **horizontal centre** and the row
containing the player's **feet** (the same `footRow` `Physics.ts` uses), i.e. the
air tile the character is standing in. Pressing `B`:

- with `carriedBombs > 0` and no placed bomb in that tile → place one bomb,
  decrement the count by exactly one;
- with `carriedBombs === 0` → place nothing, consume nothing, and show the
  transient "no bombs" bubble (D10);
- on a tile that already holds a placed bomb → place nothing, consume nothing,
  no bubble (FR-014).

`KeyB` is **not** added to `ControlsOverlay` (FR-012).

**Rationale**: The character's render slot is 64 px wide over a 32 px tile, so
"the tile the character occupies" needs one deterministic rule; horizontal centre
+ feet row is the same geometry the rest of the codebase uses and reads as "at
the character's feet". `KeyB` never overlaps movement, jump, drop-through or
climb, so navigating down can never place a bomb by accident.

**Alternatives considered**:
- *The tile under the player's left edge / render-slot origin* — rejected: a
  2-tile-wide sprite has two candidate columns; the centre is the stable choice.
- *A dedicated HUD keycap on the overlay* — explicitly out of scope (FR-012).

## D5 — Placed-bomb physics: fall, rest, and falling out

**Decision**: Add a pure `engine/PlacedBomb.ts` holding `PlacedBombState`
(`id`, `x`, `y`, `vy`, `fuseElapsed`, `landingRow: number | null`, `landed`) and:

- `bombLandingRow(level, blocks, col, row): number | null` — scan rows below the
  bomb's own row; the first row whose cell is **solid for a bomb** is the floor,
  and the bomb rests in the row immediately above it (`row` itself when the cell
  directly below is solid). A column with no floor returns `null`.
- `stepPlacedBomb(state, level, blocks, dt)` — always advances `fuseElapsed`;
  while `landingRow !== null` and the bomb has not reached it, applies gravity
  and clamps to the resting surface; with `landingRow === null` it keeps falling
  and the caller removes it once it passes the level's bottom.

"Solid for a bomb" is `isSolid(tileAt(level, col, r)) || isBlockOccupied(blocks, col, r)`.
`isSolid` already includes `bridge`, so **a bridge stops a bomb**; `ladder` is
not solid and `isStandableLadderTop` is deliberately **not** consulted, so **a
ladder tile is open air** (FR-015). A placed bomb is never added to
`blockPlacements`, so it is non-solid and never blocks the player.

**Rationale**: Reusing `isSolid`/`isBlockOccupied` (the player's own ground
predicate) minus the ladder-top term gives the exact one-way-tile semantics the
spec asks for with no new tile classification. A precomputed `landingRow` makes
the fall deterministic and trivially testable, mirroring `DeployableLadder`'s
`landRow` approach.

**Alternatives considered**:
- *Per-tick continuous collision against every tile* — rejected: unnecessary for
  a single entity and harder to test than a computed landing row.
- *Treat a ladder top as standable (so a bomb rests on it)* — rejected: the spec
  explicitly calls a ladder tile open air.
- *Include `ladderBundle`/`isStandableLadderBundleTop`* — rejected: a bomb is not
  a character; a rolled bundle is not a "solid surface".

## D6 — Fuse timeline and pre-detonation animation

**Decision**: A fixed `BOMB_FUSE_SECONDS ≈ 2`. A pure
`bombFuseFrame(fuseElapsed): { frame: number; scale: number }` maps the fuse onto
the sequence `[1, 2, 3, 4, 5, 4, 5, 4, 5]` (three `4 → 5` alternations, ending on
frame 5), each segment `BOMB_FUSE_SECONDS / 9` long. `scale` is `1.25` on frame 5
and `1` otherwise (the spec's tunable `BOMB_PULSE_SCALE`). Frame 0 never appears
on a placed bomb — it is only the HUD/pickup icon (FR-017).

**Rationale**: A pure elapsed→frame function is deterministic, testable over the
whole fuse timeline (SC-004), and keeps the draw pass free of animation state.
The sequence and the 1.25 scale are the spec's confirmed values.

**Alternatives considered**:
- *Incremental frame state on `PlacedBombState`* — rejected: derives from
  `fuseElapsed` anyway, and a stored frame can drift.
- *A separate `explosion` frame for detonation in the bomb sheet* — rejected: the
  blast is its own sheet (D8).

## D7 — Blast resolution reuses the existing outcome pipelines

**Decision**: Add a pure `engine/Blast.ts`:

- `blastTiles(col, row, width, height)` — the 3×3 cells centred on the bomb,
  clipped to the level bounds (FR-018).
- `blocksInBlast(blocks, tiles)` — every live, destructible block whose tile is
  in the set. "Destructible" = the kind's `removeWhenUsedUp === true` (crate,
  fragileRock, coinPot, potionPot, bombPot). A question-mark block is never
  destroyed (FR-022/edge: a spent block is inert).
- `enemiesInBlast(enemies, tiles, tileSize)` — every live enemy whose
  `typeOf(enemy).box(enemy)` overlaps any blast tile.
- `playerInBlast(playerBox, tiles, tileSize)` — whether `playerHitbox(player)`
  overlaps any blast tile.

`PlatformerPage.tsx` applies the effects once, at detonation, by **reusing the
existing pipelines**:

- **Blocks**: the per-block terminal-outcome code currently in the `hitBlocks`
  loop is refactored into one local helper (`resolveBlockTerminalOutcome`) and
  called for each blast block after driving it to its terminal hit
  (`applyBlockHit` until `isBlockUsedUp`), so facts/pickups/puffs/popups behave
  exactly as a normal destruction (FR-019). This also fires
  `firePuffIfJustUsedUp`.
- **Enemies**: mark each affected enemy defeated (`hitPoints: 0`, `alive: false`)
  and let the existing `justDefeated` block pay its reward, drop its item and
  puff it — exactly as a stomp does (FR-020).
- **Player**: if `playerInBlast` and not `isInvulnerable`, `takeDamage(2)` then
  `beginHitReaction` (opens the shared invincibility window with no directional
  knockback — a blast has no single side), plus a player hit splatter
  (FR-021/SC-007).

**Loose pickups and other placed bombs are never enumerated**, so FR-033 and
FR-025/FR-026 hold by construction rather than by a guard.

**Rationale**: The spec demands *identical* outcomes to the existing destruction,
defeat and damage paths; sharing the code path is the only way to guarantee it.
Keeping the target selection pure and side-effect-free in `Blast.ts` makes the
3×3/clipping/overlap rules unit-testable without a DOM.

**Alternatives considered**:
- *A second, blast-specific destruction implementation* — rejected: it would
  drift from the hit path (facts, popups, puff) and violate the spec's parity
  wording.
- *Routing enemy defeat through `takeHit` + the hit-reaction timer* — rejected:
  the spec says "defeated", and the existing `justDefeated` block already
  processes a dead enemy's reward/puff immediately; a stun delay would be an
  invented behaviour.
- *Chaining blasts* — explicitly out of scope; bombs are not blast targets.

## D8 — The explosion is a transient visual effect; both sheets kept, one-constant swap

**Decision**: Add an `ExplosionEffect` to `engine/CollectionEffects.ts`
(alongside `PuffEffect`/`HitSplatterEffect`), holding `id`, `x`, `y`, `elapsed`
and a frame count. It plays the active sheet's frames once, in order, over a
fixed duration and is then dropped. It carries **no hazard** (FR-023). Register
both explosion sheets in `entities/sprites/sheets.ts` and load them in
`PlatformerPage.tsx` (they are not any type's primary sprite, so the registry
walk cannot discover them — the same hand-listed exception `crack_overlay.png`
already has). Draw the effect centred on the bomb's tile at `renderScale 2`
(48 px native × 2 = 96 px, exactly the 3×3 footprint).

**Both candidates are kept**: `explosion1.png` (432×48 = 9 × 48×48, round
fireball) and `explosion2.png` (384×48 = 8 × 48×48, spiky/cartoonish). A single
`EXPLOSION_SHEET` constant selects the one drawn, so switching is a one-line
change. The **initial default is `explosion2.png`** (the cartoonish burst the
requester asked for); the final choice is made by the in-engine comparison in
`quickstart.md`, with `explosion1.png` available as the alternate.

**Rationale**: Transient canvas effects already live in `CollectionEffects.ts`;
putting the explosion there keeps the draw pass uniform and avoids a new
effect-lifecycle concept.

**Alternatives considered**:
- *A dedicated `engine/Explosion.ts` module* — rejected as a near-duplicate of
  the existing effect tick/frame pattern.
- *Drawing the blast as 9 tile-sized sprites* — rejected: the delivered art is
  one 48 px explosion sprite per frame, not a tile set.

## D9 — Respawn and full-reset lifetime

**Decision**: In `resetGame()` (death/respawn): clear `placedBombs`, set
`carriedBombs = 0`, clear `bombPickupStates`, and rely on the existing
`restoredOnRespawnForBlock` path to rebuild every broken bomb pot intact (it
already handles any kind that opts in). `resetGameProgress()` inherits all of
this through `resetGame()` and additionally clears `activeExplosions`.

**Rationale**: FR-027/FR-028/FR-029. Clearing `bombPickupStates` mirrors the
existing `heartPickupStates` clear on respawn: a dropped pickup belongs to a pot
that is being restored, so leaving it would let the player collect it *and*
re-break the pot. Because a bomb pot only drops once per life and the array is
cleared on respawn, reusing the pot's own id as the pickup id (the heart
convention) is safe.

**Alternatives considered**:
- *Keep placed-but-unexploded bombs across respawn* — rejected by FR-027.
- *Keep dropped bomb pickups across respawn* — rejected: it would double the
  reward relative to the restored pot.

## D10 — Onboarding: a sign digit, two hint strings, a transient bubble

**Decision**: Add two strings to `platformer.hints` in both `en.json` and
`de.json`: `bomb` (the sign, naming the `B` key) and `noBombs` (the
empty-inventory bubble). `HintId` derives from these keys automatically. Add sign
digit `6 → 'bomb'` to `SIGN_CHARS` (and `TileChar`/palette entries). The shipped
level gains one `b` pot and one adjacent `6` sign on solid ground, updating the
layout's marker legend comment.

The `noBombs` bubble reuses `HintTooltipState`/`drawSignBubble`, but its exit is
**transient**: the existing tooltip only exits when the player leaves a sign's
overlap, whereas a `B` press with no bombs has no overlap to leave. Add an
optional `transient: boolean` to `HintTooltipState`; `startHintTooltip(hintId,
{ transient: true })` makes the tooltip auto-begin its exit after a short fixed
dwell regardless of overlap, so it reads as a brief speech bubble.

**Rationale**: The spec explicitly asks for the same bubble mechanism and the
same sign/hint system. The transient flag is the minimal addition needed for a
keypress-triggered (rather than overlap-triggered) bubble.

**Alternatives considered**:
- *A separate bubble component/signal* — rejected: duplicates the grow+fade
  animation and draw call.
- *Advertising `B` on the controls overlay* — explicitly out of scope (FR-012).

## D11 — Editor parity comes for free

**Decision**: Add `b` to the editor palette (`paletteTiles.ts`: sprite =
`world_tileset.png` row 8 col 0, label "Bomb Pot", description), add `6` sign
entries, and synthesize `bombPot` blocks from `b` in
`editor/gridRenderState.ts`. No placed bomb or explosion palette entry is added
(FR-031).

**Rationale**: `EditorCanvas.tsx` already feeds its synthesized block states
through `computePotRenderPlan`, so the blue pot merges with neighbouring pots in
the canvas exactly as in game with no further editor change (FR-030/SC-011). The
existing sign palette button cycles through every registered digit, so the new
sign is reachable without a new button.

**Alternatives considered**:
- *A dedicated bomb palette section* — rejected: bombs/explosions are runtime
  only.

## D12 — Testing strategy

**Decision**: TDD order per constitution Principle II:

1. `engine/PlacedBomb.test.ts` — landing scan (bridge stops, ladder open, no
   floor → removed), gravity/fuse timeline, frame sequence ending on 5 with the
   pulse scale, fuse ticks while falling.
2. `engine/Blast.test.ts` — clipping at edges, block membership (destructible vs
   question-mark/terrain), enemy box overlap, player hitbox overlap, loose
   pickups/bombs excluded.
3. `entities/blocks/BombPot.test.ts`, `entities/BombPickup.test.ts` — kind
   contract, frame 128, drop policy, pickup box/bob.
4. `engine/CollectionEffects.test.ts` — explosion effect tick/frame/expiry.
5. `level/LevelParser.test.ts`, `level/BlockMapper.test.ts`,
   `editor/paletteTiles.test.ts`, `editor/gridRenderState.test.ts` — marker `b`,
   sign `6`, palette entries, TileChar sync.
6. `engine/Collision.test.ts` — cap-aware bomb pickup collision.
7. `PlatformerState.test.ts` — seeding, cap constant, reset lifetime.
8. `PlatformerPage.test.tsx` — place with/without bombs, cap behaviour, fuse →
   detonation, blast destroys a crate/enemy, player damage + invincibility, no
   chain, respawn reset, shipped-level onboarding, overlay unchanged.

**Rationale**: Mirrors the O-011 pattern; every pure rule is tested without a
DOM, and the integration tests prove the wiring.

## D13 — No open clarifications

The spec's Clarifications session resolved every behavioural question, including
the one Edge Cases line still annotated "unresolved" (the ladder/bridge rule).
No `NEEDS CLARIFICATION` remains in the Technical Context.
