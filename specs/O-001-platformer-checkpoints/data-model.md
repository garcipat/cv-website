# Phase 1 Data Model: Platformer Checkpoints

**Feature**: O-001 Platformer Checkpoints
**Spec**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)

All types are plain, immutable data (no classes), consistent with
`docs/themes/platformer/Entities.md`. Positions are in rendered world pixels
(`RENDERED_TILE_SIZE = 32`); a placement's `col`/`row` are the level-grid
coordinates it was parsed from.

---

## 1. Checkpoint marker (level format)

| Field | Type | Source | Notes |
| --- | --- | --- | --- |
| character | `'C'` | `ENTITY_CHARS` | Uppercase C (U+0043), unused by every other map; the overlap guard enforces uniqueness |
| kind | `'checkpoint'` | `EntityKind` | resolved by `parseLevel` to `'empty'` terrain |
| position | `{ col, row }` | `findCheckpointTiles(layout)` | reading order (top→bottom, left→right) |

**Validation / rules**
- A `C` cell is `'empty'` terrain; the checkpoint is non-solid (FR-002).
- Zero or more checkpoints per level; the level may hold any number (FR-001).
- A checkpoint is inert unless `isSolid(tileAt(level, col, row + 1))` (FR-004).
- `LEVEL_1_LAYOUT` / the shipped `main` level gains no `C` (spec Out of Scope).

---

## 2. `CheckpointPlacement` (static, from the level)

```ts
interface CheckpointPlacement {
  id: string;   // `checkpoint-${col}-${row}` — unique per cell
  col: number;  // level grid column (ground check)
  row: number;  // level grid row
  x: number;    // rendered world x (tileToPixel)
  y: number;    // rendered world y
}
```

Produced by `placeCheckpoints(markers)` in `level/CheckpointMapper.ts`, in
reading order. Recomputes whenever `currentLayout` changes (editor "Try"),
via `CHECKPOINT_TILES` → `checkpointPlacements` (a `computed`).

---

## 3. `CheckpointState` (live, per instance)

```ts
interface CheckpointState extends CheckpointPlacement {
  activated: boolean;          // flag raised; permanent for the run
  activatedAt: number | null;  // world-clock snapshot at activation; null while dormant
}
```

Seeded from `checkpointPlacements` by `toCheckpointState` (dormant,
`activatedAt: null`). Held in the `checkpointStates` signal.

**Derived values**
- `checkpointFrameIndex(state, worldElapsed)`:
  - `activatedAt === null` → `0` (dormant frame)
  - otherwise → `min(3, floor(max(0, worldElapsed - activatedAt) / frameStep))`,
    which holds on frame 3 once
    `worldElapsed - activatedAt >= CHECKPOINT_RAISE_DURATION_SECONDS` (FR-005).
    `frameStep = CHECKPOINT_RAISE_DURATION_SECONDS / (CHECKPOINT_FRAME_COUNT - 1)`
    — the four frames are spread evenly across the raise, so frame 3 is reached
    exactly at the raise duration. Derived at draw time from the shared clock —
    no per-frame state write, and the raise freezes with the rest of the world
    during death/pause (the same convention as `Coin.ts`'s `coinFrameIndex`).
- `checkpointBox(placement)` → one rendered tile
  (`{ x, y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE }`), the
  trigger used for footprint overlap (FR-004), mirroring `signBox`.

**Transitions**

| From | Event | To | Effects |
| --- | --- | --- | --- |
| dormant | footprint overlaps cell **and** solid ground below | activated (`activatedAt` = current world clock, written once) | raise animation begins; puff started once; label started once; becomes active respawn target if it wins the tick |
| dormant | overlap but no solid ground below | dormant (inert) | none |
| activated | overlap again (not active) | activated | becomes active respawn target (glow moves); **no** raise/burst/label (FR-008) |
| activated | overlap again (already active) | unchanged | none (FR-006) |
| any | death / respawn (`resetGame`) | unchanged | none — state survives (FR-015) |
| any | Reset Game (`resetGameProgress`) | dormant, `activatedAt: null` | active id cleared (FR-016) |

---

## 4. Active respawn target

```ts
const activeCheckpointId = signal<string | null>(null);
```

At most one id, or `null`. Set by the tick resolver to the winning checkpoint
(FR-007/FR-009). Persists across death/respawn; cleared only by
`resetGameProgress` (FR-015/FR-016).

**Tick resolution** (`resolveCheckpointContacts`, pure):

```
overlaps = reading-ordered checkpoints whose box overlaps playerHitbox
           AND have solid ground directly below
if overlaps is empty            -> no change
dormant = overlaps.filter(not activated)
raise every dormant in overlaps -> activated: true, activatedAt: now
activeId = dormant[0] ?? overlaps[0]        // reading order; dormant wins
```

`now` is the current value of the shared world clock, passed in as a parameter
so the resolver stays pure and deterministic.

`dormant[0]` is the first dormant in reading order; `overlaps[0]` is the first
entered raised one. Deterministic and reproducible (FR-009). Re-touching an
already-raised, non-active checkpoint sets `activeId` to it without raising or
replaying (FR-008).

---

## 5. Activation moment effects

### 5a. Flag raise (derived, write-once)
`activatedAt` on `CheckpointState` is a snapshot of the shared world clock taken
once at activation; the frame is derived at draw time by
`checkpointFrameIndex(state, dc.worldElapsed)`. There is no per-frame tick and
no separate effect object — the raise advances with the same clock that spins
coins and freezes with it during death/pause.

### 5b. Particle burst (reused)
Reuses `PuffEffect` / `activePuffs` / `startPuffEffect` / `drawPuffEffects`
already in `engine/CollectionEffects.ts` and `engine/Renderer.ts`. One puff per
dormant→activated transition, at the tile; removed when
`elapsed > SPARKLE_DURATION_SECONDS` (FR-005/FR-006). It is started from
`checkpointEffectAnchor(state)` — the tile's world position with `scale: 1`
(a checkpoint is a single tile, the same anchor scale a block uses).

### 5c. Fading text (new, generic)
```ts
interface FadeOutTextEffect {
  id: string;       // source id (e.g. the checkpoint id) — at most one per source
  x: number;        // world x
  y: number;        // world y
  text: string;     // the already-localized string to draw
  elapsed: number;  // seconds
}
```
- `startFadeOutTextEffect(id, x, y, text)` — `elapsed: 0`
- `tickFadeOutTextEffect(effect, dt)` — advances; caller drops it once
  `elapsed >= FADE_OUT_TEXT_DURATION_SECONDS` (`0.6` seconds)
- `fadeOutTextOpacity(elapsed)` — 1, then linear fade to 0 over the duration
- Held in `activeFadeOutTexts` signal; drawn by `drawFadeOutTexts(ctx, effects)`,
  each effect using its own `text`. Fades in place — never travels (FR-022),
  never replays (FR-006). Deliberately generic: the checkpoint label is its
  first user, not its only one, so the type carries its own text and the draw
  pass takes no string argument.

---

## 6. Respawn position

Derived, not stored — and exposed as `computed` signals, not plain functions,
so the respawn point reacts to the active target the same way every other piece
of derived state in the app does (`docs/Architecture.md`'s signals convention):

```ts
function playerStateAtTile(col, row): PlayerState            // pure spawn maths, not reactive on its own
const activeRespawnPlacement: Computed<CheckpointPlacement | null>;  // active checkpoint's placement, else null
const respawnPlayerState: Computed<PlayerState>;             // playerStateAtTile(active) else spawnPlayerState()
const respawnCenter: Computed<{ x: number; y: number }>;     // visual centre of respawnPlayerState.value
```

`playerStateAtTile` is a pure helper mirroring `spawnPlayerState` exactly:
horizontally centred over the cell, feet on the cell's bottom edge (the ground
surface FR-004 guarantees), motion cleared, `grounded: false` then settled by
physics, `lastGroundedX/Y` seeded to the position (FR-011), full health,
`alive: true`, `hitTimer` at the end of the refractory window (immediately
vulnerable, FR-014). `activeRespawnPlacement` derives from
`activeCheckpointId` + `checkpointStates`; `respawnPlayerState` and
`respawnCenter` derive from it. On death restart, `resetGame()` reads
`respawnPlayerState.value`, and the camera snaps to `respawnCenter.value`
(FR-010/FR-012/FR-013). With no active checkpoint,
`respawnPlayerState.value` equals `spawnPlayerState()` (FR-010, SC-003).

---

## 7. Signal inventory (deltas in `PlatformerState.ts`)

| Signal | Type | Seeded from | `resetGame` (death) | `resetGameProgress` (Reset Game) |
| --- | --- | --- | --- | --- |
| `checkpointPlacements` | computed | `CHECKPOINT_TILES` | recomputed from layout | recomputed from layout |
| `checkpointStates` | signal | `checkpointPlacements` | **untouched** (raised flags persist) | **rebuilt** dormant |
| `activeCheckpointId` | signal | `null` | **untouched** | **cleared to `null`** |
| `activeFadeOutTexts` | signal | `[]` | cleared (no frozen label) | cleared |
| `activeRespawnPlacement` | computed | `activeCheckpointId` + `checkpointStates` | recomputed (unchanged) | recomputed (`null`) |
| `respawnPlayerState` | computed | `activeRespawnPlacement` | recomputed (checkpoint, else spawn) | recomputed (spawn) |
| `respawnCenter` | computed | `respawnPlayerState` | recomputed | recomputed |

`resetGameProgress` clears `activeCheckpointId` / `checkpointStates` /
`activeFadeOutTexts` **before** calling `resetGame()`, so the respawn
computation sees no active checkpoint and returns the character to spawn
(FR-016).

---

## 8. Camera additions

```ts
function initialCameraX(playerX, playerWidth, viewportWidth, levelPixelWidth): number
```
Centres the player horizontally, clamped to `[0, levelPixelWidth - viewportWidth]`
— the horizontal mirror of `initialCameraY`. Used once per spawn/respawn by
`snapCameraToRespawn()` (FR-012).
