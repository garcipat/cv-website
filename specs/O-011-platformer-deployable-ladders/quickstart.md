# Quickstart: Platformer Deployable Ladders

Manual verification after implementation. Run `npm run dev`, open `/platformer`,
and use the Level Editor (`/platformer/editor`) to author `@` bundles where
needed. Every scenario below is a browser check — a passing test suite is not
evidence the deploy looks or feels right (constitution workflow rule).

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. Deploy a bundle (User Story 1)

1. In the editor, paint a `@` **Rope Ladder Bundle** on a ledge with open space
   below it and solid ground several tiles down, then hit **Try**.
2. Stand on the bundle (walk onto it from the side) and press Up.
3. **Expect**: the bundle unrolls downward over about half a second, the rope
   rungs filling the column one step at a time until the lowest rung rests on
   the ground below.
4. Repeat with a bundle whose column has no solid tile before the level's
   bottom.
5. **Expect**: the unroll reaches the level's bottom and stops there.
6. Repeat with a bundle sitting directly on the floor.
7. **Expect**: the unroll completes with no rungs, the bundle's sprite changes
   to the deployed top-rung, and the cell is a lone climbable rung.
8. Press Up on the deployed bundle again.
9. **Expect**: nothing further happens.
10. Press Up while airborne, and while grounded but away from the bundle.
11. **Expect**: no deploy; Up behaves as it does today (climb/chest/hint).

## 2. Climb the deployed ladder (User Story 2)

1. Deploy a ladder, then climb up, climb down, hang in place, shimmy sideways
   off it, jump off it, and climb to a top rung with nothing above it.
2. **Expect**: every interaction matches an authored `H` ladder exactly —
   fixed climb speed, gravity suspended, normal horizontal speed, jump cancel,
   and standing on the top rung.
3. While a ladder is mid-unroll, walk into the partially-filled column.
4. **Expect**: the partial rungs are not climbable; the character passes
   through them as air.
5. Deploy a bundle under a solid ceiling and climb it.
6. **Expect**: the character is not stopped at the bundle cell; it climbs until
   its feet leave the rope and then falls, exactly like a blocked authored shaft.

## 3. Permanence (User Story 3)

1. Deploy a ladder, then move away or press other keys mid-unroll.
2. **Expect**: the unroll continues uninterrupted and still lands.
3. Die (walk into spikes or a pit) and respawn.
4. **Expect**: the ladder is still deployed and climbable.
5. Click **Reset Game** in the journal.
6. **Expect**: the bundle is rolled up and the fabricated shaft is gone.
7. Place two bundles in the same column; deploy one.
8. **Expect**: the other stays rolled until its own Up press.

## 4. Editor landing preview (User Story 4)

1. In the editor, select the **Rope Ladder Bundle** tile.
2. **Expect**: it appears in the Terrain group with a readable label and a
   description of what Up does.
3. Paint one above a shaft with solid ground below.
4. **Expect**: a faint marker appears on the landing cell.
5. Remove the solid tile below it.
6. **Expect**: the marker moves to the level's bottom cell.
7. Place a bundle with solid ground directly beneath it.
8. **Expect**: the marker sits on the bundle's own cell (zero-length landing).
9. Hit **Try** and look at the same bundle in game.
10. **Expect**: no landing marker is drawn during play.

## 5. Rope ladder reads distinctly (User Story 5)

1. Place a `@` bundle, an `H` ladder and an `I` chain side by side, deploy the
   bundle, and stand back.
2. **Expect**: the three shafts are visually distinguishable at a glance, and
   the rolled bundle is clearly not a wooden rung.
3. Watch a deploy.
4. **Expect**: the bundle keeps its rolled sprite while the rope segments
   appear progressively from the top down, then the bundle cell switches to the
   deployed top-rung appearance.

## 6. Edge cases and regression checks

1. Pause mid-unroll (open the journal).
2. **Expect**: the unroll holds its progress and resumes on unpause.
3. Stand on top of a bundle and deploy it.
4. **Expect**: the character keeps standing rather than falling.
5. Deploy a bundle whose column already holds an authored ladder/chain.
6. **Expect**: the shaft still climbs continuously.
7. Play the shipped `main` level (no `@` bundles).
8. **Expect**: it renders and plays exactly as before — the new types cost
   nothing when absent.

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Deployment math | `engine/DeployableLadder.test.ts` | landing scan (solid/bridge/bottom/zero-length), timing, revealed steps, trigger cell, effective-grid override, immutability |
| Tile predicates | `level/Terrain.test.ts` | `ropeLadder` climbable; `ladderBundle` not climbable but standable |
| Character mapping | `level/LevelParser.test.ts` | `@` → `ladderBundle`, `findLadderBundleTiles`, `TileChar` sync |
| Physics | `engine/Physics.test.ts` | stand on rolled bundle; deployed shaft climbs; partial shaft is not climbable |
| Sprite plan | `engine/StaticObjectsCatalog.test.ts` | `ropeLadderShaftPieces` composition |
| Draw pass | `engine/Renderer.test.ts` | bundle/steps/caps drawing; no-op without a sheet |
| State wiring | `PlatformerState.test.ts` | seeding, `activeLevel`, reset lifetime |
| Palette | `editor/paletteTiles.test.ts` | `@` sprite/label/description |
| Editor preview | `editor/EditorCanvas.test.tsx` | landing marker on the correct cell |
| Game integration | `PlatformerPage.test.tsx` | Up deploys a rolled bundle; the unroll completes and becomes climbable |
