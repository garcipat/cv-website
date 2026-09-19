# Contract: render passes (darkness, torch glow, enemy eyes)

`engine/Renderer.ts` remains the only module that maps world coordinates to
canvas coordinates. Two new passes are added; both take the camera
`originX`/`originY` in the same convention as `drawTerrain` / `drawPlayer`.

## `drawDarkness(ctx, layer, canvasWidth, canvasHeight, darknessLevel, torches, originX, originY, worldElapsed, playerLight?)`

- `ctx` — the main play canvas 2D context.
- `layer` — a reusable offscreen canvas (owned by `PlatformerPage.tsx`, sized
  on `resize()`); the pass creates/uses its 2D context internally.
- `playerLight` — the player's own carried light position in world space, or
  `null`/omitted for none.
- Draws **nothing** when `darknessLevel <= 0` (full-brightness fast path,
  SC-005).
- Otherwise:
  1. Clears `layer` and fills it with `rgba(0, 0, 0, darknessLevel)`.
  2. For each torch whose glow can intersect the viewport, erases a soft
     radial hole with `destination-out` at the torch's screen position,
     radius `TORCH_LIGHT_RADIUS_PX × torchPulseScale`.
  3. When `playerLight` is given, erases one more, smaller hole at the
     player's screen position with radius `PLAYER_LIGHT_RADIUS_PX`.
  4. Composites `layer` onto `ctx` with `source-over`.
  5. For each such torch, paints an additive (`lighter`) warm radial gradient
     in `TORCH_GLOW_COLOR`, with alpha scaled by `darknessLevel` and radius
     kept inside the erased hole, so the pool reads warm without tinting the
     surrounding darkness.
  6. When `playerLight` is given, paints one more, smaller warm gradient for
     it (FR-023/FR-024).
- Anchors every pool to the light's **world** position + `originX`/`originY`,
  so it scrolls with the camera (FR-012).
- Restores any `globalCompositeOperation`/`globalAlpha` it changes.

## `drawHeldTorch(ctx, player, torchSheet, darknessLevel, originX, originY, worldElapsed)`

- Draws **nothing** when `torchSheet` is null, when `darknessLevel <= 0`
  (FR-027), or when the player's `animState` is neither `walk` nor `idle`
  (FR-026).
- Otherwise draws one small torch frame (the wall torch's own frames,
  `frameSource(TORCH_SHEET, torchFrameIndex(0, 0, worldElapsed))`) at the
  player's hand, at `HELD_TORCH_SCALE`, mirrored horizontally when the player
  faces left (FR-025/FR-028).
- Drawn with the player (before the darkness overlay), so the player's own
  light reveals it.

## `heldTorchLightPosition(player): Point`

- Returns the held torch's world-space centre, mirroring with the player's
  facing, so the player's carried light is centered on the flame (FR-023).

## `drawEnemyEyes(ctx, enemies, darknessLevel, torches, worldElapsed, originX, originY, playerLight?)`

- Draws **nothing** when `darknessLevel <= 0`.
- For each enemy with `alive === true`:
  - Computes `localDarknessAt` at the enemy's own effect anchor, including the
    player light when given.
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
