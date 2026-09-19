# Contract: render passes (darkness, torch glow, enemy eyes)

`engine/Renderer.ts` remains the only module that maps world coordinates to
canvas coordinates. Two new passes are added; both take the camera
`originX`/`originY` in the same convention as `drawTerrain` / `drawPlayer`.

## `drawDarkness(ctx, layer, canvasWidth, canvasHeight, darknessLevel, torches, originX, originY, worldElapsed)`

- `ctx` — the main play canvas 2D context.
- `layer` — a reusable offscreen canvas (owned by `PlatformerPage.tsx`, sized
  on `resize()`); the pass creates/uses its 2D context internally.
- Draws **nothing** when `darknessLevel <= 0` (full-brightness fast path,
  SC-005).
- Otherwise:
  1. Clears `layer` and fills it with `rgba(0, 0, 0, darknessLevel)`.
  2. For each torch whose glow can intersect the viewport, erases a soft
     radial hole with `destination-out` at the torch's screen position,
     radius `TORCH_LIGHT_RADIUS_PX × torchPulseScale`.
  3. Composites `layer` onto `ctx` with `source-over`.
  4. For each such torch, paints an additive (`lighter`) warm radial gradient
     in `TORCH_GLOW_COLOR`, with alpha scaled by `darknessLevel` and radius
     kept inside the erased hole, so the pool reads warm without tinting the
     surrounding darkness.
- Anchors every pool to the torch's **world** position + `originX`/`originY`,
  so it scrolls with the camera (FR-012).
- Restores any `globalCompositeOperation`/`globalAlpha` it changes.

## `drawEnemyEyes(ctx, enemies, darknessLevel, torches, worldElapsed, originX, originY)`

- Draws **nothing** when `darknessLevel <= 0`.
- For each enemy with `alive === true`:
  - Computes `localDarknessAt` at the enemy's own effect anchor.
  - Computes `enemyEyeOpacity(localDarkness)`; skips when `<= 0`.
  - Draws two small, integer-aligned yellow pixel squares near the top of the
    enemy's collision box, offset symmetrically, at that opacity.
- Aligns to each enemy's current position and scrolls with the camera
  (FR-019).
- Never draws a marker for a defeated/removed enemy (FR-017).

## Render order contract

Inside `PlatformerPage.tsx`'s `render()`, immediately after
`drawWaterForeground(...)` and before the hint tooltip:

```
drawWaterForeground(...)        // last world element
drawDarkness(...)               // covers world: background, terrain, player,
                                //   enemies, pickups, water
drawEnemyEyes(...)              // visible THROUGH the darkness
drawSignBubble(...) / effects / counters / debug / HUD / hearts / iris
```

- The overlay MUST NOT be drawn over: hint bubbles, collection flight text,
  puff/sparkle/heal/hit effects, counter popups, debug overlay, hearts, chest/
  key counters, the journal, or any other DOM UI (FR-006).
- During `paused` / `dying` / `awaitingRestart` / `ending-screen`, the tick is
  skipped, so `darknessLevel` and `worldElapsed` hold — the effect freezes with
  the world (spec Edge Case).
