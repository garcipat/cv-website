# Quickstart: Platformer Checkpoints

**Feature**: O-001 Platformer Checkpoints
**Spec**: [spec.md](./spec.md)

How to run and manually verify the feature once implemented. The automated
suite is the first gate; the browser checks are the second, because the
constitution requires a manual visual verification for any visible behaviour.

---

## Prerequisites

- Node + npm installed.
- The branch `O-001-platformer-checkpoints` checked out (see the plan's
  Constitution Check — the current working branch is a chore branch).
- `public/sprites/checkpoint-flag-strip.png` present (it is already in the
  repo; 64×24, four 16×24 frames).

## Automated checks

```bash
npm test          # Vitest single run
npm run build     # TypeScript strict + Vite production build
```

Expected: all tests pass; the new unit tests for `CheckpointMapper`,
`Checkpoint`, `CheckpointLogic`, the checkpoint label effect and
`initialCameraX` pass, and the `PlatformerPage` integration tests for
activation / re-touch / death-respawn / Reset Game pass.

## Run the game

```bash
npm run dev
```

Open the Platformer theme. Two routes are useful:

- `/platformer` — the play view. Append `?debug` to get the debug panel
  (Kill / Respawn / Hitboxes / Editor).
- `/platformer/editor` — the level editor, to place checkpoints.

---

## Manual verification

### 1. Author a checkpoint

1. Open `/platformer/editor`.
2. In the Entities group, find **Checkpoint**. Confirm its tooltip describes
   the finished-level behaviour and its icon shows the **raised gold** flag
   (FR-017).
3. Paint a `C` into a cell with solid ground directly below it.
4. Confirm the editor canvas shows a dormant (grey, limp) checkpoint at that
   cell.
5. Press **Try** to play the edited level.

### 2. Activation happens once, visually

1. Walk the character onto the dormant checkpoint.
2. Confirm: the flag rises (4-frame animation), a particle burst plays once,
   and a short localized "Checkpoint" label appears and fades **in place**
   (FR-005/FR-022).
3. Keep standing on it, walk off and back on. Confirm nothing replays — no
   raise, no burst, no label (FR-006/FR-008).
4. Confirm the flag stays raised, now with a subtle glow (FR-007/FR-021).

### 3. Mid-air checkpoints are inert

1. In the editor, paint a `C` in mid-air with no solid ground below.
2. Try it: the character passes through and nothing activates; the flag stays
   limp (FR-004).

### 4. Death returns to the last checkpoint

1. Activate a checkpoint, walk well away from it.
2. Use the debug **Kill** button (or fall until hearts reach zero).
3. Press any button to restart. Confirm the character appears **on the
   checkpoint**, with all three hearts full, the camera already at the
   checkpoint, and all collected facts / keys / chests preserved
   (FR-010/FR-011/FR-012/FR-013/FR-014).
4. Activate a second checkpoint (B) after A. Confirm A stays raised, B glows,
   and a death now respawns at B (FR-007/SC-006).
5. Step back onto A. Confirm A becomes the glowing active target again, with
   no raise or burst replay (FR-008).

### 5. No checkpoint means unchanged behaviour

1. Reset Game, or reload, so no checkpoint is active.
2. Die. Confirm the character returns to the level's spawn point exactly as
   before (FR-010/SC-003).

### 6. Reset Game clears checkpoints

1. Activate one or more checkpoints.
2. Open the journal and choose **Reset Game**.
3. Confirm every flag is dormant again, no glow remains, and a subsequent
   death returns to the level's spawn (FR-015/FR-016/SC-005).

### 7. Pit falls are unchanged

1. Activate a checkpoint.
2. Fall into a pit away from it. Confirm the fall costs half a heart and the
   character recovers at the last safe ground, **not** the checkpoint
   (FR-020/SC-008).
3. Immediately after a checkpoint respawn, fall into a pit. Confirm recovery
   is at the checkpoint's own ground (FR-011/FR-020).

### 8. Localization

1. Switch the site language to German (DE).
2. Activate a checkpoint. Confirm the label reads the German word
   ("Kontrollpunkt"), not English (FR-022).

### 9. Shipped level untouched

1. Load the default `main` level. Confirm it contains no checkpoint (the spec
   ships the tile only; placing one in the shipped level is out of scope).

---

## What good looks like

- Activation reads as a single, obvious event, then the flag simply stays
  raised.
- Exactly one flag glows at a time; the glow moves the instant another
  checkpoint is touched.
- A death after a checkpoint never sends the visitor back to the level start.
- Reset Game wipes checkpoint memory along with the rest of the run.
- The pit-fall "last safe ground" rule is untouched.
