# Quickstart: Enemy Movement & Animation Seam + Bee

Manual verification after implementation. Run `npm run dev`, open `/platformer`,
and use the Level Editor (`/platformer/editor`) to author `q` bees where needed.
Every scenario below is a browser check — a passing test suite is not evidence
the bee flies, bobs or reads right (constitution workflow rule).

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. The bee flies (User Story 1)

1. Start the shipped level and play to the bee over the Zone D pit (one `q`
   marker ships in `LEVEL_1_LAYOUT`).
2. **Expect**: it hovers at chest height, drifts horizontally, and rises and dips
   in a steady repeating cycle around its placement row.
3. Watch it cross the gap a slime in the same spot would turn around at.
4. **Expect**: it flies straight across — no reversal over the gap.
5. Fall onto its back from above.
6. **Expect**: it takes one hit, is frozen and inert for the reaction, and you
   bounce upward exactly as off a green slime.
7. Walk into it from the side (in a fresh run).
8. **Expect**: you lose half a heart and are knocked back away.
9. Let a stomped bee finish its reaction.
10. **Expect**: it disappears with the shared defeat puff, revealing nothing.
11. Open the journal and the HUD counters after defeating a bee.
12. **Expect**: the enemies counter, the journal and completion are unchanged —
    bees are not progression.

## 2. Movement is a per-kind choice (User Story 2)

1. In the editor, paint a slime (`M`/`m`) and a bee (`q`) on the same stretch of
   ground, then hit **Try**.
2. **Expect**: the slimes patrol exactly as before (same speed, same turn
   points, same ledge/patrol-boundary behavior, same stand-still in a narrow
   lane), while the bee flies over the gap.
3. Paint a `P` patrol boundary on the bee's row and on the slimes' row.
4. **Expect**: it bounds both — a patrol boundary is not patrol-specific.
5. Paint a `P` on a different row from the bee.
6. **Expect**: it bounds nothing (a boundary only affects its own row), exactly
   as for the slimes.

## 3. Animation is a per-kind choice (User Story 3)

1. Watch the bee fly.
2. **Expect**: it flutters on its own frames (not the slime walk).
3. Stomp a bee and watch the reaction end without defeating it (paint a bee with
   the editor next to a low ceiling, or use the chase fixture in tests).
4. **Expect**: it resumes flying, not walking.
5. Watch the slimes.
6. **Expect**: their walk and reaction frames are unchanged.

## 4. Bees are authorable (User Story 4)

1. In the editor's entity palette, look for the bee.
2. **Expect**: it is present with a readable name ("Bee"), a description, and a
   preview of its art.
3. Paint a bee into the air over a gap.
4. **Expect**: the editor canvas previews it as a real bee sprite at its marker.
5. Save the level, reload the page, load it again.
6. **Expect**: the `q` round-trips unchanged and the bee behaves identically
   when played.
7. Try to paint a bee whose character already belongs to another map.
8. **Expect**: the module-load guard rejects the collision at load (this is a
   compile/startup failure, not a silent misplacement).

## 5. Regression — the slimes are untouched (SC-001)

1. Play the whole shipped level's slime sections.
2. **Expect**: identical speed, turn points, ledge/patrol-boundary handling,
   stand-still behavior, stomp bounce, side damage and animation to before this
   feature.
3. Kill and respawn a slime.
4. **Expect**: it returns to its spawn, resumes `walk`, and keeps its animation
   stagger.

## 6. Pause, death and respawn

1. Open the journal while a bee is mid-bob.
2. **Expect**: the bob and the flight freeze with the world and resume on the
   same phase — the bee does not restart its cycle.
3. Stomp a bee, then die before its reaction ends.
4. **Expect**: on respawn the bee returns at its placement, flies again, and
   puffs again on a later defeat, with nothing further to give.
5. Click **Reset Game**.
6. **Expect**: every bee returns to its placement and behaves identically.

## 7. Tuning check (game feel)

1. Watch a bee for several cycles.
2. **Expect**: the bob's amplitude reads as a clear hover, its period as a slow,
   readable rhythm, and its speed as slightly quicker than a slime — the numbers
   live in one `flyMovement({...})` config in `Bee.ts`, so retune there if not.

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Patrol parity | `engine/EnemyAI.test.ts` (unchanged) + `entities/enemies/movement/patrol.test.ts` | Same reference values as before the seam (SC-001) |
| Fly movement | `entities/enemies/movement/fly.test.ts` | Crosses gaps, reverses at walls/patrol/blocks, bounded periodic bob (SC-002/SC-003) |
| Chase movement | `entities/enemies/movement/chase.test.ts` | Idle when absent/out of range, pursues in range (FR-016) |
| Seam contract | `entities/enemies/movement/contract.test.ts` | Every kind declares movement + a resting state in its table (SC-006); a fixture kind works end-to-end (SC-005); missing-state fallback (FR-009) |
| Animation | `entities/Enemy.test.ts` + animation cases | Per-kind frames, hit revert to `defaultAnimState`, slime table unchanged |
| Bee combat | `entities/enemies/Bee.test.ts` | Create/revive/box, stomp vs. side vs. inert-while-reacting |
| Marker + placement | `level/LevelParser.test.ts`, `level/EnemyMapper.test.ts` | `q` → `enemyBee`, `TileChar` sync, plain placement with no fact |
| Palette + preview | `editor/paletteTiles.test.ts`, `editor/gridRenderState.test.ts`, `editor/EditorCanvas.test.tsx` | `q` entry, bee synthesis, bee image wired into the draw context |
| State / progression | `PlatformerState.test.ts`, `PlatformerPage.test.tsx` | Bee placement seeded; totals/defeated exclude bees; flight/stomp/side integration (SC-004/SC-008) |
