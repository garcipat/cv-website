# Quickstart: Platformer Bombs

Manual verification after implementation. Run `npm run dev`, open `/platformer`,
and use the Level Editor (`/platformer/editor`) to author `b` pots and `6` signs
where needed. Every scenario below is a browser check — a passing test suite is
not evidence the blast looks or feels right (constitution workflow rule).

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. The blue pot yields a bomb (User Story 1)

1. In the editor, paint a `b` **Bomb Pot** on solid ground and hit **Try**.
2. Land on it from above.
3. **Expect**: it breaks with the standard bounce and puff, and a bobbing bomb
   pickup appears in its tile.
4. Walk over the bomb.
5. **Expect**: the HUD gains a bomb icon showing `1`.
6. Paint a `b` next to a `u` (coin pot) and a `p` (potion pot).
7. **Expect**: all three render as one merged bunch with a clay filler on each
   seam, and the blue pot keeps its own bottle sprite (never a clay variant).

## 2. Place a bomb and get clear (User Story 2)

1. Carry at least one bomb, stand on flat ground, and press `B`.
2. **Expect**: a bomb appears at your feet, the carried count drops by one, and
   the bomb's fuse lights and pulses — small, then bigger, then small again —
   ending on the larger orange frame.
3. Stand still until it detonates.
4. **Expect**: a 3×3 explosion plays once, and you lose a full heart (2
   hitpoints).
5. Repeat but run clear first.
6. **Expect**: no damage.
7. Get hit by a slime, then immediately walk into a blast during the blink.
8. **Expect**: no further damage (shared invincibility window).

## 3. The blast clears the way (User Story 3)

1. Place a crate (`=`), a fragile rock (`F`), a coin pot (`u`), a question-mark
   (`Q`) and a slime (`M`) within one tile of a bomb's tile.
2. Detonate the bomb.
3. **Expect**: the crate, fragile rock, coin pot and slime are destroyed/defeated
   — the crate/coin pot reveal or drop exactly what a normal break does, and the
   slime drops its normal reward. The `Q` question-mark is untouched.
4. Place a loose coin, a dropped heart and another placed bomb inside the blast.
5. Detonate.
6. **Expect**: the coin, heart and second bomb are all untouched; the second bomb
   still explodes only when its own fuse expires (no chain).
7. Detonate a bomb next to ground/wall/bridge/ladder.
8. **Expect**: the terrain is unchanged.

## 4. The inventory has limits (User Story 4)

1. Break several blue pots and collect bombs until the HUD reads `5`.
2. Break one more pot and walk over the dropped bomb.
3. **Expect**: the count stays `5` and the pickup stays on the ground, still
   bobbing.
4. Press `B`.
5. **Expect**: the count drops to `4`, and the waiting pickup can now be
   collected.
6. Press `B` with zero bombs.
7. **Expect**: nothing is placed, nothing is consumed, and a brief "I have no
   bombs." bubble appears.
8. Press `B` while standing on a tile that already holds a placed bomb.
9. **Expect**: nothing is placed, nothing is consumed, no bubble.
10. Walk through a placed bomb's tile.
11. **Expect**: you are never blocked or stood up by it.

## 5. Death, respawn and refill (User Story 5)

1. Place a bomb, break a blue pot, then die (spikes or a pit).
2. **Expect**: the placed bomb is gone, the carried count is `0`, the bomb HUD is
   hidden, and every broken blue pot is standing again.
3. Break a restored blue pot.
4. **Expect**: it yields a fresh bomb.

## 6. The editor knows the blue pot (User Story 6)

1. In the editor, select **Bomb Pot**.
2. **Expect**: it appears in the Entities group with a readable label and
   description, and paints a `b`.
3. Paint it beside another pot.
4. **Expect**: the canvas merges them exactly as the game does.
5. Look through the palette for a placed bomb or an explosion.
6. **Expect**: no such entry exists.

## 7. Falling, bridges and ladders (FR-015)

1. Place a bomb in mid-air (jump and press `B`).
2. **Expect**: it falls under gravity to the first solid surface below and rests
   there; its fuse keeps ticking while it falls.
3. Place a bomb above a bridge.
4. **Expect**: it rests on the bridge and never falls through.
5. Place a bomb on a ladder tile.
6. **Expect**: the ladder is open air, so the bomb falls to the surface below.
7. Place a bomb over a bottomless pit.
8. **Expect**: it falls out of the level and is removed without exploding.

## 8. Onboarding (FR-034/FR-035/SC-014)

1. Start the shipped level and play to the first blue pot.
2. **Expect**: a hint sign stands beside it; stand on it and press Up to read a
   hint naming the `B` key.
3. Restart and watch the start-of-game controls overlay.
4. **Expect**: it is unchanged — no bomb keycap or caption.

## 9. Regression and pause

1. Play the shipped level's coin and potion pots exactly as before.
2. **Expect**: unchanged behaviour (drop, bounce, trigger side, removal,
   respawn, bunch merging).
3. Open the journal mid-fuse.
4. **Expect**: the fuse and the fall freeze with the world and resume on unpause.
5. Click **Reset Game**.
6. **Expect**: all placed bombs, the carried count, dropped bomb pickups and any
   active explosion are cleared; blue pots are intact.

## 10. Choose the explosion (both candidates kept)

Both explosion sheets are registered and loaded; one `EXPLOSION_SHEET` constant
selects the active one, so the comparison is a one-line swap.

1. Detonate a bomb with the default `EXPLOSION_SHEET = EXPLOSION_2_SHEET`
   (spiky/cartoonish, 8 frames).
2. **Expect**: the blast reads as a jagged comic burst.
3. Switch the constant in `entities/sprites/sheets.ts` to `EXPLOSION_1_SHEET`
   (round fireball, 9 frames) and detonate again.
4. **Expect**: the blast reads as a round fireball.
5. Keep whichever fits the game's art better; the other stays registered but
   unused.

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Placed bomb math | `engine/PlacedBomb.test.ts` | landing scan (bridge/ladder/no floor), gravity, fuse timeline, frame sequence |
| Blast math | `engine/Blast.test.ts` | 3×3 clipping, block/enemy/player membership, exclusions |
| Bomb pot | `entities/blocks/BombPot.test.ts` | kind contract, frame 128, everyBreak/restored, bunch merge |
| Bomb pickup | `entities/BombPickup.test.ts` | spawn, box, centering |
| Explosion effect | `engine/CollectionEffects.test.ts` | tick/frame/expiry |
| Pickup collision | `engine/Collision.test.ts` | cap-aware collection, at-cap no-op |
| Marker + sign | `level/LevelParser.test.ts`, `level/BlockMapper.test.ts` | `b` → bombPot, `6` → bomb, `TileChar` sync |
| Palette + preview | `editor/paletteTiles.test.ts`, `editor/gridRenderState.test.ts` | `b`/`6` entries, bombPot synthesis |
| State lifetime | `PlatformerState.test.ts` | seeding, `MAX_BOMBS`, reset clears bombs |
| Draw passes | `engine/Renderer.test.ts` | bomb pickup, placed bomb frames, explosion, HUD counter |
| Game integration | `PlatformerPage.test.tsx` | place with/without bombs, cap, detonation, blast outcomes, respawn, onboarding |
