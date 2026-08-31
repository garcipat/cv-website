# Handoff: Ladder climbing follow-ups (roadmap step 23) — outstanding issue + drafted fix

**Branch:** `worktree-S-006-step23-ladders-climbing` (this worktree)
**Status:** Original 9-task plan complete and reviewed. Nine follow-up fixes (Tasks 11-19) landed from live user play-testing after the plan's own manual verification began. Working tree is clean — everything below is committed. One follow-up (Task 19) has NOT been reviewed yet (session interrupted before dispatch), and the user found a real bug in it during live testing. A full fix is already designed and ready to hand to a fresh implementer — see "Task 20" below.

## What this branch delivers

Roadmap step 23: a climbable `'ladder'` tile type, vertical camera follow, and a climbable shaft added to `level1`. The original plan (`specs/S-006-platformer-theme/plans/2026-08-30-ladders-climbing-camera.md`) is fully implemented and reviewed (9 tasks). Since then, live browser play-testing with the user surfaced a series of real bugs and design refinements, each implemented and reviewed via the same subagent-driven-development process (implementer → reviewer, per `.superpowers/sdd/2026-08-30-ladders-climbing-camera/progress.md`'s ledger — that file is git-ignored scratch, but still present on disk in this worktree; this document is the durable, committed summary).

## Follow-up history (Tasks 11-19), briefly

1. **Task 11** — finalized ladder tile artwork (hand-tuned pixel art after live iteration with the user); moved the ladder to sit beside the pre-existing floating platform (column 15) instead of one row above it, so standing on the platform doesn't require jumping to start climbing; added a cosmetic snap-to-center on fresh climb entry.
2. **Task 12** — mirrored the "beside not above" fix at the top of the shaft (landing platform beside the ladder's top tile, not stacked above it); added a small camera overscroll past the level's top edge so vertical scroll doesn't hard-stop abruptly.
3. **Task 13** — clamped climbing so holding Up at the level's topmost row can't overshoot into out-of-bounds space and fall through the (non-solid) shaft.
4. **Task 14** — froze the climb animation while stationary (was looping forever); fixed a race where jump-cancelling off a ladder got immediately undone by re-grabbing it one frame later.
5. **Task 15** — (superseded by Task 18) tried making the row above the ladder solid; didn't feel right to the user (level-design mismatch — a separate solid tile stacked above the ladder).
6. **Task 17** — (superseded by Task 18) tried retyping the ladder's own top tile to `'bridge'` (reusing bridge's existing solid-on-top/passable-from-below mechanics); reviewer independently verified the mechanism was architecturally sound, but the user decided against it — didn't want any tile type substitution, just the plain ladder.
7. **Task 18** — reverted 15 and 17: restored the plain `'ladder'`-tile-beside-`'platform'` layout at the top (mirroring the bottom), per the user's explicit preference. **This is the current, final level-layout state** — do not reopen the Task 15/17 designs unless the user asks again.
8. **Task 19** — **(committed, NOT yet reviewed)** added the actual physics fix needed given Task 18's plain layout: since nothing in the ladder's own column is genuinely solid, `stepPlayerPhysics` now has an explicit branch that lands the player standing (`grounded: true`) once they've climbed as far as possible with nothing further above. **The user found a real bug in this while live-testing** — see below.

## Outstanding bug (Task 19) + drafted fix (Task 20)

**Symptom (user's words):** "the player is hovering on the last tile upwards... he should still climb but be able to climb out on top into the air tile where he then can stand on top of the ladder."

**Root cause (diagnosed, not yet implemented):** Task 19's landing condition checks `!columnsAreClimbable(feetRow - 1)`, using `feetRow` from *before* this frame's movement. Walking through the sequence: while feet are still one row below the ladder's topmost row, `feetRow - 1` points at the topmost row (climbable) — condition false, keeps climbing normally. But the very next frame, once feet cross into the topmost row itself, `feetRow - 1` becomes `-1` (out of bounds) — the condition becomes `true` **immediately**, before the player has climbed through any of that row. They land with feet still near the *bottom* of the top row, not its top edge — hence "hovering on the last tile" instead of genuinely standing on top of it.

There's a second, compounding off-by-one: Task 13's clamp (`minClimbY = -PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING + 1`) was calibrated to keep `feetRow >= 0`, but "resting exactly on top of row 0" actually requires `feetRow === -1` (one further) — the clamp currently stops the player one tile-fraction short of where they'd need to be for a clean landing anyway.

**The fix — both parts needed together (fully designed, ready to implement):**
1. Change Task 13's clamp from `-PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING + 1` to `-PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING` (remove the `+ 1`) — lets the player's climb genuinely reach the row's top edge instead of stopping one step short.
2. Change Task 19's landing trigger from checking `!columnsAreClimbable(feetRow - 1)` to checking `feetRow < 0` directly (i.e., "continuation just failed because we're vertically out of bounds while trying to go up", not "the row above isn't climbable") — this only becomes true once the corrected clamp has actually let the player climb all the way through the top row, not the instant they enter it.

The complete, ready-to-dispatch brief for this fix (exact code, exact tests, self-review checklist) is already written at:
```
.superpowers/sdd/2026-08-30-ladders-climbing-camera/task20-brief.md
```
(git-ignored scratch, but present on disk in this worktree — read it directly, it's a complete implementer brief, not just notes.) If a fresh session can't find that file for any reason, the summary above has everything needed to reconstruct it.

**Once Task 20 is implemented:** dispatch a task reviewer against both Task 19 and Task 20 together (Task 19 was never reviewed due to a session interruption) — treat them as one combined diff to review, base = `48933d1` (the commit before Task 19), head = Task 20's final commit. Use the same subagent-driven-development pattern the rest of this branch followed (implementer → reviewer → ledger entry in `.superpowers/sdd/2026-08-30-ladders-climbing-camera/progress.md`).

## How to manually verify in the browser

The dev server needs to run from **this worktree** specifically (not the main checkout) — confirm by checking `level1.height` via the browser console (`import('/src/themes/platformer/level/level1.ts').then(m => console.log(m.level1.height))` — should be 23, not 6). Unlock the platformer theme via `localStorage.setItem('platformerPrototypeUnlocked', 'true')` and `localStorage.setItem('theme', JSON.stringify('platformer'))`, then reload. Append `?debug=hitboxes` to the URL for a debug overlay with Kill/Respawn buttons and hitbox outlines — very useful for this kind of pixel-precision work.

## Everything else

The rest of the original 9-task plan and Tasks 11-14/18 are reviewed and solid — no known issues there. Only Task 19's premature-landing bug (fix drafted as Task 20 above) is outstanding.
