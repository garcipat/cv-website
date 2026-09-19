# Quickstart: Platformer Cave Lighting

Manual verification after implementation. Run `npm run dev`, open
`/platformer`, and use the Level Editor (`/platformer/editor`) to author the
cave/background pieces and torches where needed.

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. Darkening on entry/exit (User Story 1)

1. Author (or load) a level where open ground sits next to a cave region built
   from **charcoal** background pieces, with a walkable route between them.
2. Walk the player from open ground into the cave footprint.
3. **Expect**: the view dims smoothly over roughly 0.3–0.6 s — no snap — and
   brightens just as smoothly when you walk back out.
4. Walk anywhere in a level with **no** cave background pieces.
5. **Expect**: the view never darkens at all (full-brightness regression).

## 2. Torch light pools (User Story 2)

1. In the cave, paint one or more `Torch` tiles (Decoration group, `¥`) into
   the wall.
2. Stand in the cave so the torch is on screen.
3. **Expect**: a warm, roughly circular pool around each torch that is clear
   near the flame and fades softly into the surrounding darkness — no
   hard-edged disc. Two nearby torches combine cleanly where they overlap.
4. Scroll the camera past a torch.
5. **Expect**: the pool stays anchored to the torch in the world, not to the
   screen.
6. Watch a torch for several seconds.
7. **Expect**: the flame animates and stays visible inside its own light; the
   pool breathes very mildly and never strobes.
8. Stand in a dark cave with no torch nearby.
9. **Expect**: dark but not pitch black — the ground and the player stay faintly
   readable and the game is playable.

## 3. Enemy eyes (User Story 3)

1. Place a living enemy (green or purple slime) in a dark cave area with no
   torch.
2. **Expect**: the enemy shows as a small pair of glowing yellow eyes visible
   through the darkness.
3. Move a torch's pool over the enemy (or brighten the area).
4. **Expect**: the eyes fade out and the normal slime sprite is clearly visible.
5. Stomp the enemy.
6. **Expect**: no eyes are shown for a defeated enemy.
7. Return to full brightness.
8. **Expect**: enemies render exactly as before, with no eye marker.

## 4. Editor palette sections (User Story 4)

1. Open the Level Editor and switch the palette to the **background** layer.
2. **Expect**: two clearly labelled sections, **Surface** (dirt pieces, which do
   not darken) and **Cave** (charcoal pieces, which do).
3. Place a cave piece, hit **Try**, and walk the player over that cell.
4. **Expect**: the view darkens. Place a surface piece and confirm it does not.
5. Confirm the **Torch** tile is still available in the foreground Decoration
   group.

## 5. The player's carried light (User Story 5)

1. Walk the player through a dark cave, away from every wall torch.
2. **Expect**: a small warm glow around the player keeps them discernible, and a
   very small torch sprite appears in their hand while walking (mirrored to the
   direction of travel).
3. Stop, jump, and climb.
4. **Expect**: the glow stays, but the held-torch sprite is not drawn.
5. Stand right next to a wall torch.
6. **Expect**: the player's glow is clearly smaller than the wall torch's pool.
7. Return to full brightness.
8. **Expect**: neither the glow nor the held torch is drawn.

## 6. Freeze / UI / regression checks

1. Open the journal, or die, while standing in a dark cave.
2. **Expect**: the darkness freezes — it does not keep animating or flicker.
3. While dark, confirm the hearts HUD, counters, hint bubbles, journal, and
   collection popups are all fully readable (not dimmed).
4. Author a cave with several torches and several enemies on screen.
5. **Expect**: smooth frame rate; no perceptible stutter.

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Lighting math | `engine/Lighting.test.ts` | fade easing, footprint darkening, overlap cap, torch falloff/pulse, local darkness, eye opacity, player glow |
| Catalog family | `engine/BackgroundCatalog.test.ts` | dirt → surface, charcoal → cave, unknown id → undefined |
| Torch discovery | `level/LevelParser.test.ts`, `level/level.test.ts` | `findTorchTiles` finds every `¥` cell |
| State wiring | `PlatformerState.test.ts` | `torchPositions`, darkness reset on respawn |
| Overlay + player light + held torch + eyes | `engine/Renderer.test.ts` | draws nothing at `darknessLevel <= 0`; player-light hole/glow; held torch only while walking |
| Palette sections | `editor/Palette.test.tsx`, `editor/backgroundPaletteTiles.test.ts` | Surface/Cave sections, membership, click behaviour |
