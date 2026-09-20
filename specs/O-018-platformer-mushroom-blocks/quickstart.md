# Quickstart: Platformer Bouncy Mushroom Blocks

Manual verification after implementation. Run `npm run dev`, open `/platformer`,
and use the Level Editor (`/platformer/editor`) to author `§`/`s` mushrooms
where needed. Every scenario below is a browser check — a passing test suite is
not evidence the bounce looks or feels right (constitution workflow rule).

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. Bounce off the red mushroom (User Story 1)

1. In the editor, paint one `§` **Bouncy Mushroom** on open ground, then hit
   **Try**.
2. Walk horizontally into its cap and its stem.
3. **Expect**: the character passes straight through, never stopped or bounced.
4. Jump up into its cap and stem from below.
5. **Expect**: the character passes through and keeps rising.
6. Fall onto its cap from a short hop, then from a long fall.
7. **Expect**: both landings launch the character to the same height — clearly
   higher than a normal jump (~5.5 tiles) — and the cap visibly dips about two
   pixels and returns in roughly a tenth of a second.
8. Land on the same mushroom three times in a row.
9. **Expect**: it bounces identically every time; it is never consumed, never
   breaks, never awards anything.
10. Stand on the ground beside the mushroom and walk onto the cap at the same
    height.
11. **Expect**: the moment the character is over the cap, gravity settles it and
    it bounces, rather than coming to rest on the cap.
12. Hold the jump key, and separately tap it, during a bounce.
13. **Expect**: the launch reaches the same height either way — it is not a jump
    and is never cut short.

## 2. Build a taller mushroom from cap and stem segments (User Story 2)

1. Paint a vertical run of three or more `§` cells with nothing solid directly
   above the top one, then hit **Try**.
2. **Expect**: the run reads as one mushroom — cap on top, a straight stem in
   the middle cells, a foot at the bottom.
3. Fall onto a stem cell below the cap.
4. **Expect**: the character passes straight through, never landing or bouncing.
5. Fall onto the top cap.
6. **Expect**: the same launch as a one-cell mushroom.
7. Paint a single `§` cell and compare.
8. **Expect**: it reads as a complete little mushroom (cap, stem, foot) and
   bounces on its cap identically.
9. Save the level, reload it.
10. **Expect**: the run is preserved and renders identically.

## 3. The small decorative mushroom (User Story 3)

1. Paint a `s` **Mushroom** and hit **Try**.
2. Walk into it, jump onto it from above, jump into it from below.
3. **Expect**: the character passes through or falls past it every time — no
   stop, no landing, no bounce, no reward, no state change.

## 4. Author both mushrooms from the palette (User Story 4)

1. Open the editor and look at the palette.
2. **Expect**: **Bouncy Mushroom** (`§`) appears in the **Terrain** group and
   **Small Mushroom** (`s`) in the **Decoration** group, each with a readable
   name, a description and a preview showing its real art.
3. Paint each, including a vertical `§` run; save and reload.
4. **Expect**: the cells and the run persist and render correctly.

## 5. Edge cases and regression checks

1. Place a `§` cap directly under a solid tile, then try to fall onto it.
2. **Expect**: the cap is not landable — the character falls straight through
   it, exactly like a stem. A cap in the level's top row still bounces.
3. Fall onto a cap mid-dip (bounce again quickly).
4. **Expect**: it bounces normally and the dip restarts; the dip never changes
   collision.
5. Stomp an enemy or break a pot in the same instant as a mushroom landing.
6. **Expect**: one upward impulse — the strongest (the mushroom) — never a sum.
7. Land on a mushroom, then die and respawn.
8. **Expect**: the mushroom is unchanged and any in-progress dip is gone.
9. Click **Reset Game**.
10. **Expect**: mushrooms are unchanged (they were never destructible); no dip.
11. Walk an enemy across a mushroom.
12. **Expect**: the enemy treats both kinds as non-solid, passes through and is
    never bounced.
13. Play the shipped `main` level (no mushrooms).
14. **Expect**: it renders and plays exactly as before — the new kinds cost
    nothing when absent.

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Cap predicate | `level/Terrain.test.ts` | top/only standable with open sky; covered cap, middle/bottom and decorative not standable |
| Character mapping | `level/LevelParser.test.ts` | `§`/`s` → the two kinds; `TileChar` sync |
| Physics | `engine/Physics.test.ts` | land on an open-sky cap; fall through a covered cap; side/underside unaffected |
| Bounce query | `engine/Physics.test.ts` | `playerOnMushroomCap` centre-column and grounded rules |
| Squash math | `engine/MushroomSquash.test.ts` | start/replace, advance/prune, dip curve, immutability |
| Sprite plan | `engine/StaticObjectsCatalog.test.ts` | role entries and `mushroomHasCap` |
| Draw branch | `engine/Renderer.test.ts` | role crops, cap-only squash shift, decorative cell, no-sheet fallback |
| Palette | `editor/paletteTiles.test.ts` | `§`/`s` sprite/label/description |
| Palette grouping | `editor/Palette.test.tsx` | `§` in Terrain, `s` in Decoration |
| Game integration | `PlatformerPage.test.tsx` | landing bounces, pass-through cases, repeatability, squash lifetime |
