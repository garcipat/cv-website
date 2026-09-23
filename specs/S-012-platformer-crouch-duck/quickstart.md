# Quickstart: Platformer Crouch/Duck

Manual verification after implementation. Run `npm run dev`, open `/platformer`,
and use `?debug=hitboxes` to see the collision box. Every scenario below is a
browser check — a passing test suite is not evidence the crouch looks or feels
right (constitution workflow rule).

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. Duck and crawl under a low ceiling (User Story 1, P1)

1. Stand on plain ground (not a ladder, not a bridge) and hold Down.
2. **Expect**: the character drops into a visibly lower duck pose; with
   `?debug=hitboxes`, the yellow/cyan box is one tile tall.
3. Keep holding Down and press Left/Right.
4. **Expect**: the character crawls at a noticeably slower pace than walking,
   in both directions, and the duck pose loops its four frames.
5. Crawl into the authored one-tile corridor (around array columns 89–94) from
   one side and out the other.
6. **Expect**: it passes through; a standing character cannot enter it.
7. While crouched, press Jump.
8. **Expect**: no jump.
9. Release Down on open ground.
10. **Expect**: the character stands back up to full height, walk speed and
    jump ability.

## 2. Refuse to stand up into a ceiling (User Story 2, P1)

1. Crouch, crawl into the corridor, and release Down mid-corridor.
2. **Expect**: the character stays crouched (the debug box stays one tile).
3. Keep holding a direction until the ceiling ends.
4. **Expect**: the character stands automatically the moment the full standing
   box fits in clear space — with no pop through the ceiling and no overlap at
   any point.
5. Under the ceiling, release and press Down repeatedly.
6. **Expect**: it stays crouched throughout, with no height flicker.
7. Crawl the whole corridor while releasing/re-pressing Down.
8. **Expect**: the box never overlaps a solid tile (SC-002).

## 3. Down still climbs and drops (User Story 3, P1)

1. On every ladder in the level, hold Down.
2. **Expect**: the character climbs down exactly as before; it never crouches.
3. On every bridge tile, hold Down.
4. **Expect**: the character drops through exactly as before; it never crouches.
5. Stand on plain ground and hold Down.
6. **Expect**: the character crouches.
7. Crouch and crawl onto a bridge tile while still holding Down.
8. **Expect**: it drops through the bridge rather than staying crouched on it.
9. Run the existing ladder and bridge assertions unchanged (their fixtures may gain the new required `crouching` field, but no ladder/bridge behavior assertion changes).
10. **Expect**: they pass (SC-003).

## 4. The crouch reads at a glance (User Story 4, P2)

1. Place the idle, walk and crouch poses side by side (stand, walk, then crouch).
2. **Expect**: the crouch is unmistakably lower and distinct.
3. Crawl and watch the pose.
4. **Expect**: it animates rather than sliding on a single frame.
5. Crouch then stand.
6. **Expect**: the crouched pose is replaced cleanly by the standing pose with
   no overlap.

## 5. Every consumer sees the one reduced box (SC-008)

With `?debug=hitboxes` on, while crouched:

1. Walk under a coin/pickup placed in the head band.
2. **Expect**: the taller box would have touched it; the crouched box does not.
3. Stand beside an enemy and crouch.
4. **Expect**: enemy contact/stomp geometry uses the one-tile box (a stomp that
   requires the taller box no longer registers).
5. Crouch on a spike/blast tile.
6. **Expect**: hazard and blast overlap use the one-tile box.
7. Verify the debug head line sits at the crouched head, not the standing head.

## 6. Edge cases and regression checks

1. Hold Down and walk off a ledge.
2. **Expect**: the crouched pose is kept for the fall and on landing.
3. Release Down mid-air.
4. **Expect**: the character stands up before landing.
5. Take a hit while crouched (enemy or hazard) — see section 7 for the full
   check.
6. **Expect**: the hit reaction plays, but the box stays one tile for the whole
   reaction and the character is never forced to stand into a ceiling.
7. Die, respawn, restore a checkpoint, and click Reset Game.
8. **Expect**: the character returns standing at full height every time.
9. Open the journal (pause) while crouched, then resume.
10. **Expect**: it holds the crouch and resumes crouched.
11. Switch to another theme and back.
12. **Expect**: the character spawns standing.
13. Play the whole shipped level start to finish without holding Down.
14. **Expect**: nothing behaves differently from before the feature (the added
    corridor is the only level change).

## 7. A crouched hit never moves the character (FR-011 / FR-016 / SC-009)

Do this on plain ground first, then repeat inside the one-tile corridor.

1. Crouch and stand still, then let an enemy touch you (or step onto a spike /
   take a bomb blast).
2. **Expect**: you lose health and a **red reaction plays on the crouched
   pose** — the character does not stand, and the debug box stays one tile.
3. **Expect**: the character is **not pushed** in any direction — no horizontal
   slide and no upward pop — and it does not change facing.
4. Crouch and crawl while holding a direction, then take a hit.
5. **Expect**: the hit adds no knockback; the character only keeps moving
   because you are still holding the crawl key.
6. Repeat the hit while crouched under the corridor's ceiling.
7. **Expect**: the character never stands into the ceiling and its box never
   overlaps a solid tile during the reaction.
8. Take the same hit while **standing**.
9. **Expect**: the standing hit is unchanged — the existing baked red frame,
   with the usual knockback.
10. Confirm no new red crouch sprite exists: the red is applied to the same
    duck crouch pose the crawl uses (compare frames in the sheet / debug
    view).

## 8. Onboarding (SC-007)

1. Start a fresh session and look at the controls overlay.
2. **Expect**: a Down/crouch caption is visible in the legend, not overlapping
   the other captions, in both English and German.
3. If (and only if) the caption could not be placed without crowding: confirm a
   signpost stands beside the low corridor and reads through the existing
   Up-to-read sign mechanism. The two must never both appear.

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Headroom + resolution | `engine/Crouch.test.ts` | `canStandUp` (open air, one-tile ceiling, block), `resolveCrouching` (entry/retention/auto-stand/`downClaimed`/hit freeze) |
| Movement integration | `engine/Physics.test.ts` | enter crouch grounded, no airborne entry, retain through a fall, crawl speed both ways, jump disabled, Down priority on ladders/bridges, box rows, every return sets `crouching` |
| Shared box + consumers | `engine/Collision.test.ts` | crouched `playerHitbox` geometry; triggers/pickups, enemy/stomp, hazard, floor-spike and blast checks read the crouched box |
| Animation | `entities/Player.test.ts` | `'crouch'` derivation (grounded and airborne), row-8 frame source, stationary freeze, crawling advance |
| Crouched hit state | `entities/Player.test.ts` | `applyHitReactionWithoutKnockback` sets `hitTimer`/`animState` and leaves `vx`/`direction`/`knockbackTimer`/`vy`/`bounceAscending` untouched |
| Crouched hit tint | `engine/Renderer.test.ts` | crouched `hit` draws the crouch row through a tinted layer (`source-atop`); standing `hit` draws the baked frame with no layer; null-context fallback |
| State/reset | `PlatformerState.test.ts` | factories seed `crouching: false`; it never survives `resetGame`/`resetGameProgress` |
| Level | `level/level.test.ts` | the authored corridor is exactly one tile high, marker-free, and adds no new tile kind |
| Onboarding | `components/ControlsOverlay.test.tsx` | the crouch caption renders from i18n alongside the existing captions |
| Game integration | `PlatformerPage.test.tsx` | hold Down → crouch; release → stand; crawl under a ceiling; no jump while crouched; ladder/bridge Down unchanged; a crouched enemy/hazard/blast hit applies damage + `'hit'` with no `vx`/`vy` |
| Sign fallback (only if used) | `level/LevelParser.test.ts` | `7` → `crouch`, `TileChar` sync, `HintId` widening |
