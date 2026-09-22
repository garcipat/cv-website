# Quickstart: Ambient Background Clouds

Manual verification after implementation. Run `npm run dev`, open
`/platformer`, and play any level.

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. Alive while standing still (User Story 1)

1. Open the platformer and stand still on the ground for several seconds.
2. **Expect**: soft white clouds change horizontal position across the open sky
   above the treeline — with no input at all.
3. Watch two clouds over the same interval.
4. **Expect**: they travel at visibly different speeds and sit at different
   heights.
5. Walk left and right so the camera scrolls.
6. **Expect**: the clouds' own drift is unchanged — it is not tied to the camera.
7. Watch one cloud leave the left edge.
8. **Expect**: another cloud enters from the right, so the sky is never empty.

## 2. A procession that reads as random (User Story 2)

1. Watch the sky until every cloud has crossed at least once.
2. **Expect**: clouds enter and leave by crossing an edge, never appearing or
   vanishing mid-sky.
3. **Expect**: no two clouds overlap into an unreadable blob; more than one
   silhouette is visible over time.
4. **Expect**: a cloud's second pass uses a different speed and starting offset
   from its first — the procession does not visibly loop.

## 3. Confined to the sky, never in the way (User Story 3)

1. Play a level with a tall sky and watch clouds cross the full width.
2. **Expect**: no cloud is ever drawn over the treeline, the village, the grass
   or the terrain.
3. Jump, climb and fight near the clouds.
4. **Expect**: clouds never draw in front of the character, enemies, tiles,
   collectables or the heads-up display — they are always behind everything.

## 4. Reduced motion (User Story 4)

1. Enable the OS/browser "reduce motion" setting, then open the platformer.
2. **Expect**: the clouds are still visible but do not drift; the character,
   terrain, entities and HUD play exactly as normal.
3. Turn the setting back off and reload.
4. **Expect**: the clouds drift again.

## 5. Edge cases and regression checks

1. Resize the window from narrow to wide.
2. **Expect**: the number of clouds scales with the width — more clouds when
   wide, never fewer than the minimum when narrow, and the sky is never empty.
3. Resize to a very short window.
4. **Expect**: if the sky band can no longer fit a cloud, the layer is simply not
   drawn; the backdrop, level and HUD still render.
5. Simulate a failed sprite load (block `ambient_clouds.png` in devtools).
6. **Expect**: the ambient layer is absent and nothing else breaks.
7. Pause (open the journal), die, and restart.
8. **Expect**: the clouds freeze with the world and resume from where they were —
   no jump forward.
9. Play a level normally at a typical window size.
10. **Expect**: no perceptible stutter (SC-004), and gameplay (standing, walking,
    climbing, falling, damage, scoring) is completely unchanged (SC-005).

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Population | `engine/AmbientClouds.test.ts` | density scales with width; never below the minimum (SC-007) |
| Drift | `engine/AmbientClouds.test.ts` | x decreases over time with no camera input; two clouds differ in speed/height (SC-001, SC-002) |
| Lifecycle | `engine/AmbientClouds.test.ts` | left exit respawns at the right edge with a new speed and different shape (FR-005/FR-006/FR-007/FR-008) |
| Containment | `engine/AmbientClouds.test.ts` | every cloud stays inside `[skyTop, openSkyBottom]` (FR-010) |
| Reduced motion | `engine/AmbientClouds.test.ts` | `reducedMotion = true` leaves positions unchanged (FR-014, SC-006) |
| Degradation | `engine/AmbientClouds.test.ts` | short sky → empty field; null image → no draw calls (FR-012/FR-013) |
| Rounding | `engine/AmbientClouds.test.ts` | every drawn dest x is a whole number (FR-009) |
| Band geometry | `engine/BackgroundLayers.test.ts` | `backgroundBandGeometry` returns the same edges the backdrop draws; existing assertions stay green |
| Sheet loading | `entities/sprites/sheets.ts` consumers | `AMBIENT_CLOUDS_SHEET` resolves to `/sprites/ambient_clouds.png` |
