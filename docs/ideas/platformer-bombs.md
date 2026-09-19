# Idea: Platformer Bombs (Collect & Place)

## Status: Design Exploration

## Summary

A new collectible item: **bombs**. The player can collect bombs (like keys/coins),
then place them on the ground to explode. The blast destroys **fragile rocks** (`F`
— currently only breakable from below) and **damages enemies**, adding an alternate
way to clear obstacles and threats beyond stomping and hitting from underneath.

## Interaction loop

1. **Collect** — bombs are gained somehow (pickup entity, enemy drop, block reveal —
   open question below).
2. **Carry** — the player holds a bomb count, shown in the HUD (a small counter, in
   the style of the existing key counter).
3. **Place** — press a button (e.g. Down while grounded) to set a bomb on the ground
   beneath the player.
4. **Fuse & blast** — the bomb sits with a burning fuse (animated, ~1–2 s), then
   explodes.
5. **Effect** — the blast:
   - destroys `fragileRock` tiles within its blast radius, and
   - damages enemies caught in the blast (stomp-style defeat, or generic damage —
     open question).

## State model

Bombs are an entity-driven feature, not a terrain feature:

- A **carried-bomb count** lives in `PlatformerState` (like the key count).
- A placed bomb is a **runtime entity** with its own state (fuse timer, state machine
  `lit → exploding → gone`), drawn and updated like other entities.
- Destroying terrain: fragile rock is an entity block (`fragileRock` block kind), so
  the blast triggers the same break/defeat machinery blocks already use — result
  reuses existing reveal/destroy code.

## Art

- Bomb sprite (a classic round bomb), a **lit/fuse animation** strip, and an
  **explosion** effect (expanding flash, maybe a brief screen-freeze or shake as
  optional juice). Per repo sprite convention: one sheet/strip, shared style.

## Level editor

- Enemy/block markers already exist; a bomb pickup would need its own entity marker
  character if it's placed in levels.

## Open questions

- **How are bombs collected?** (Floor pickup like coins/hearts — or drop from purple
  slimes / crate reveals.)
- **How many can be carried?** (Cap at 1? 3? Unlimited with HUD count?)
- **Does the blast hurt the player?** (Classic answer: yes, unless you stand clear —
  but that needs a knockback/damage contract.)
- **Do bombs affect other destroyable blocks** (crates, question-mark blocks, coin
  pots), or only fragile rocks and enemies?
- **Explosion delay & radius:** how long is the fuse, how wide is the blast?
- **Placement:** only on the ground beneath the player, or can they be tossed?