# Contract: Rendering, editor and onboarding

Covers the new draw passes, sprite registrations, editor entries, i18n strings
and the shipped-level change.

## Sprite sheets (`entities/sprites/sheets.ts`)

```ts
/** bomb.png — a 96x16 strip of six 16x16 frames: 0 = unlit bomb (HUD icon and
 *  world pickup), 1-3 = lit fuse burning down, 4 = pulse partner,
 *  5 = orange pre-detonation glow. */
export const BOMB_SHEET: SpriteSheet = {
  src: '/sprites/bomb.png', frameWidth: 16, frameHeight: 16, columns: 6,
};

/** explosion.png — a 384x48 strip of eight 48x48 frames (the spiky, comic-style
 *  burst; the round-fireball candidate was dropped). */
export const EXPLOSION_SHEET: SpriteSheet = {
  src: '/sprites/explosion.png', frameWidth: 48, frameHeight: 48, columns: 8,
};
```

- `BOMB_SHEET` is the primary sprite of `PICKUP_TYPES.bomb`, so the registry walk
  in `PlatformerPage.tsx` loads it automatically.
- Both explosion sheets are no type's primary sprite, so they stay hand-listed
  `loadImage(...)` exceptions (like `crack_overlay.png`); loading both keeps the
  `EXPLOSION_SHEET` swap to a single line.

## `engine/CollectionEffects.ts`

```ts
export const EXPLOSION_DURATION_SECONDS: number;   // e.g. 9 frames * 0.05s
export const EXPLOSION_FRAME_COUNT: number;        // EXPLOSION_SHEET.columns

export interface ExplosionEffect {
  id: string;
  x: number;        // world px, blast centre
  y: number;
  elapsed: number;
}

export function startExplosionEffect(id, x, y): ExplosionEffect;
export function tickExplosionEffect(effect, dt): ExplosionEffect;
export function explosionFrameIndex(effect): number;   // 0..count-1, once, in order
```

- The caller filters the effect out once `elapsed >= EXPLOSION_DURATION_SECONDS`.
- It is purely cosmetic; it is never a hazard (FR-023).

## `engine/Renderer.ts`

```ts
export function drawBombPickups(ctx, bombs: readonly BombPickupState[], dc: DrawContext): void;
export function drawPlacedBombs(
  ctx, bombs: readonly PlacedBombState[], dc: DrawContext,
): void;
export function drawExplosions(
  ctx, explosions: readonly ExplosionEffect[], dc: DrawContext,
): void;
```

- `drawBombPickups` iterates `PICKUP_TYPES.bomb.draw` — same shape as
  `drawHeartPickups`.
- `drawPlacedBombs` draws `bombFuseFrame(bomb.fuseElapsed)` from `BOMB_SHEET`,
  scaled by `frame.scale` about the tile centre; a bomb still falling is drawn at
  its current `y`.
- `drawExplosions` draws `EXPLOSION_SHEET`'s frame
  `explosionFrameIndex(effect)` at `renderScale 2`, centred on `(x, y)`.
- All three are added to the render pass in `PlatformerPage.tsx`: placed bombs
  after `drawBlocks`, bomb pickups after `drawHeartPickups`, explosions above the
  world effects and below the HUD.

## `PlatformerPage.tsx` wiring

- Load `EXPLOSION_SHEET.src` via `loadImage` (hand-listed).
- Tick: advance `placedBombs` (fall + fuse), detonate those with `hasDetonated`,
  remove those that `checkBombFellOut`, advance/expire `activeExplosions`.
- Collision: `checkBombPickupCollisions` → increment `carriedBombs` (clamped) and
  remove the collected pickups; the cap is enforced by the helper.
- Input: `input.consumePress('KeyB')` drives placement (see
  [bomb-inventory.md](./bomb-inventory.md)).
- HUD: `drawBombCounter` only when `carriedBombs.value > 0`, positioned by
  `bombCounterX`.

## Editor (`editor/paletteTiles.ts`, `editor/gridRenderState.ts`)

| Char | Sprite | Label | Description |
| --- | --- | --- | --- |
| `b` | `world_tileset.png` row 8 col 0 | "Bomb Pot" | "Bomb-pot; land on it from above to break it and drop a bomb you can place" |
| `6` | `world_tileset.png` row 3 col 8 (sign) | "Sign 6" | "Hint sign; click it again on the canvas to cycle its hint" |

- `PALETTE_TILE_SPRITES`/`PALETTE_TILE_LABELS`/`PALETTE_TILE_DESCRIPTIONS` are
  exhaustive `Record<TileChar, …>`, so adding `b`/`6` to `TileChar` forces all
  three entries (a compile-time guarantee).
- `synthesizeBlockStates` maps `b` → `'bombPot'`, so the editor canvas merges the
  blue pot with neighbours via the already-wired `computePotRenderPlan`
  (FR-030/SC-011).
- **No** placed-bomb or explosion palette entry exists (FR-031).

## i18n (`src/i18n/locales/en.json`, `de.json`)

Add to `platformer.hints`:

| Key | en | de |
| --- | --- | --- |
| `bomb` | "Press B to place a bomb." | "Drücke B, um eine Bombe zu platzieren." |
| `noBombs` | "I have no bombs." | "Ich habe keine Bomben." |

`HintId` derives from these keys, so a typo in the sign mapping fails to compile.
The `noBombs` bubble reuses `HintTooltipState`/`drawSignBubble` with an optional
`transient: true` that auto-begins its exit after a short dwell, since a `B`
press has no sign overlap to leave.

## Shipped level (`level/level.ts`)

- Add one `b` (bomb pot) on solid ground and one adjacent `6` (bomb hint sign) to
  `LEVEL_1_LAYOUT`, chosen so the pot is reachable early and the sign sits beside
  it (FR-034/FR-035).
- Update the layout's marker legend comment to document `b` and `6`.
- The controls overlay (`components/ControlsOverlay.tsx`) is **unchanged**
  (FR-012/SC-014).

## Invariants

1. A placed bomb never renders `bomb.png` frame 0.
2. The explosion effect plays each frame once, in order, then disappears.
3. The editor preview of a `b` pot is pixel-identical to the game's, including
   bunch merging.
4. No editor palette entry can place a bomb or an explosion.
5. The shipped level contains at least one `b` and one `6`.
