# Contract: crouch pose and animation

FR-008: the crouch MUST be visually distinct from idle/walk, MUST animate while
crawling, and MUST use a dedicated four-frame duck row appended to the knight
sheet (drawn low/horizontal, constant head height) so no existing animation's
frames are altered.

## `PlayerAnimState`

```ts
export type PlayerAnimState = 'idle' | 'walk' | 'jump' | 'climb' | 'crouch' | 'hit' | 'death';
```

## `ANIM_CONFIG.crouch`

```ts
crouch: { frameCount: 4, frameDuration: 0.12, sy: PLAYER_FRAME_SIZE * 8 },
```

- `sy = PLAYER_FRAME_SIZE * 8` is the sheet's **9th** row (0-indexed 8), the
  dedicated DUCK row appended below DEATH. The sheet is 256×288 (9 uniform 32px
  rows); the duck frames sit with their feet 4px above the cell bottom, matching
  every other row.
- `frameCount = 4` makes `frame % 4` loop `0 → 1 → 2 → 3 → 0` — the four crawl
  frames (FR-008). The pose is held on its current frame while stationary.
- `frameDuration = 0.12` s is a starting tune between `walk` (0.08) and `idle`
  (0.15); it is tunable in one place.

## `updatePlayerAnimState`

Derivation order (the existing `hit`-stickiness early return stays first):

```
hit (sticky while invulnerable)
 └─ climb
     └─ crouch      ← new: whenever player.crouching
         └─ jump (airborne)
             └─ walk / idle
```

- `crouch` is checked **before** the airborne check so a crouched character that
  walks off a ledge keeps the crouched pose for the fall (spec Edge Case).
- Entering `crouch` resets `animFrame`/`animTimer` to 0 via the existing
  state-change branch, so no stale frame carries over.

## `advancePlayerAnimation`

```ts
if (player.animState === 'crouch' && player.vx === 0) return player;
```

- Mirrors the existing `climb` freeze (`vy === 0`): the duck pose is held still
  while stationary and advances only while crawling left or right (FR-008).
- While crouched, `vx` is set to `±PHYSICS_CONFIG.crouchSpeed` by
  `stepPlayerPhysics` on any tick a direction is held, so the crawl animates
  in both directions.

## `Renderer.drawPlayer` — one edit, for the crouched hit tint (FR-016)

For a normal crouch, `crouch` falls through to the existing
`playerFrameSource(player.animState, player.animFrame)` call with
`PLAYER_FRAME_SIZE` and the primary `knight.png` sheet, drawing the DUCK-row
frame in the same 64×64 render slot at the same position (feet unchanged).

The renderer **does** need one edit, for the crouched red reaction. When
`player.crouching && player.animState === 'hit'`:

- the frame source is `playerFrameSource('crouch', player.animFrame)` — the
  DUCK-row crawl pose — **not** the baked `hit` row (`sy =
  PLAYER_FRAME_SIZE * 6`) a standing hit draws;
- the pose is tinted at render time by `drawTintedSprite` (below), mirrored
  through the same `save`/`translate`/`scale` path when facing left. The tint
  **pulses on the standing hit's own cadence** — applied only when
  `hitFrameFromTimer(player.hitTimer) === HIT_RED_FRAME_INDEX` (the `hit` row's
  red frame, 0.1s out of every 0.3s) — so the crouch does not stay solid red for
  the whole reaction window;
- if no tint layer is passed (e.g. the editor preview), or the current hit frame
  is not the red one, it falls back to a plain draw of the same crouch pose, so
  the wrong row is never drawn.

The standing hit path (`crouching: false`) is byte-for-byte unchanged: it still
draws the sheet's baked red frame from `hitFrameFromTimer`. FR-016 deliberately
does not unify the two — replacing the shipped S-010 frame would be more code
and would change existing behaviour and tests.

## `drawTintedSprite` — reusable offscreen tint (FR-016)

```ts
export function drawTintedSprite(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  sheet: CanvasImageSource,
  sx: number, sy: number, frameSize: number,
  destX: number, destY: number, destSize: number,
  tint: string,
): void
```

1. `layer.getContext('2d')`; if `null`, fall back to a plain `ctx.drawImage`
   of the frame at the destination.
2. Clear the layer to `destSize`; draw the frame scaled to `destSize` with
   `globalCompositeOperation = 'source-over'`.
3. Set `globalCompositeOperation = 'source-atop'`, `fillStyle = tint`,
   `fillRect(0, 0, destSize, destSize)` — only the sprite's opaque pixels are
   recoloured, never a rectangle.
4. `ctx.drawImage(layer, 0, 0, destSize, destSize, destX, destY, destSize,
   destSize)`; restore `source-over` on the layer.

The scratch `layer` is **caller-owned and reused**, exactly like the lighting
layer `drawDarkness` takes: `PlatformerPage.tsx` keeps one 64×64
`hitTintLayerRef`, created once in `resize()`, and passes it to `drawPlayer` as
an eighth optional parameter (`tintLayer = null`). This allocates nothing per
frame and keeps the helper testable with a fake layer, DOM-free.

## `DebugOverlay.drawDebugOverlay`

- The cyan head line MUST use `player.y + playerHeadPaddingFor(player.crouching)`
  so the debug geometry matches the crouched box.
- The yellow side-padded rect and magenta foot line are unchanged (the feet line
  does not move).

## Held torch (deliberate non-change)

`drawHeldTorch` draws only for `animState === 'walk' | 'idle'`. A crouched
character is neither, so the held torch is not drawn while crouched/crawling.
This is left as-is: the torch's fixed offset is tuned to the upright pose, and
the spec makes crouch a pose/collision change with no lighting requirement.
Recorded here so the behaviour is a decision, not an accident.

## Invariants (asserted by `Player.test.ts` / `Renderer.test.ts`)

1. `playerFrameSource('crouch', 0)`, `('crouch', 1)` and `('crouch', 2)` return
   `sy = PLAYER_FRAME_SIZE * 8` and distinct `sx` values; `('crouch', 4)` wraps
   to the first frame.
2. `updatePlayerAnimState` returns `animState: 'crouch'` for a grounded,
   `crouching: true` player with `vx: 0`, and also for a `crouching: true`,
   `grounded: false` player (the falling crouch).
3. `updatePlayerAnimState` still returns `'hit'` while invulnerable, even with
   `crouching: true`.
4. `advancePlayerAnimation` returns the same reference for a stationary crouch,
   and advances the frame for a crawling crouch.
5. `ANIM_CONFIG` covers every `PlayerAnimState` member (compile-time), and no
   two states share a row index **within the same sheet** (`idle`, `jump` and
   `climb` all use `sy: 0`, but `jump`/`climb` draw from the separate
   `knight2.png` sheet).
6. `drawPlayer` with `crouching: true, animState: 'hit'` and a fake tint layer
   resolves the frame from the `crouch` row (`sy = PLAYER_FRAME_SIZE * 8`) and
   composites the tinted layer onto the main context **only on the red hit
   frame** (`hitFrameFromTimer === HIT_RED_FRAME_INDEX`); on any other hit frame
   it draws the crouch pose plainly. With `crouching: false, animState: 'hit'`
   it still draws the baked `hit` frame (`sy = PLAYER_FRAME_SIZE * 6`) directly,
   with no layer.
7. `drawTintedSprite` sets `source-atop` on the layer while filling the tint and
   restores `source-over` afterwards; with a layer whose `getContext` returns
   `null` it falls back to a plain `ctx.drawImage` and never throws.
