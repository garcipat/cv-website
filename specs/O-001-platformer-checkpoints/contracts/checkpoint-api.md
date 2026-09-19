# Contract: Checkpoint Module API

**Feature**: O-001 Platformer Checkpoints
**Consumers**: `PlatformerPage.tsx`, `PlatformerState.ts`,
`engine/Collision.ts`, `engine/Renderer.ts`, `editor/gridRenderState.ts`,
`editor/EditorCanvas.tsx`.

The public surface of the new modules. All functions are pure unless noted;
all state is plain immutable data held in Preact signals. This mirrors the
`entities/*` + `level/*Mapper.ts` conventions in
`docs/themes/platformer/Entities.md`.

---

## `level/CheckpointMapper.ts`

```ts
interface CheckpointPlacement {
  id: string;   // `checkpoint-${col}-${row}`
  col: number;
  row: number;
  x: number;
  y: number;
}

function placeCheckpoints(
  markers: readonly { col: number; row: number }[],
): CheckpointPlacement[];
```
- Preserves the markers' reading order.
- One placement per marker; ids are unique per cell.

---

## `entities/Checkpoint.ts`

```ts
interface CheckpointState extends CheckpointPlacement {
  activated: boolean;
  activatedAt: number | null;   // world-clock snapshot at activation; null while dormant
}

const CHECKPOINT_FRAME_COUNT = 4;
const CHECKPOINT_FRAME_WIDTH = 16;
const CHECKPOINT_FRAME_HEIGHT = 24;
const CHECKPOINT_RAISED_FRAME = 3;
const CHECKPOINT_RAISE_DURATION_SECONDS = 0.4;
const CHECKPOINT_FRAME_STEP_SECONDS = CHECKPOINT_RAISE_DURATION_SECONDS / (CHECKPOINT_FRAME_COUNT - 1);

const CHECKPOINT_FLAG_SHEET: SpriteSheet; // /sprites/checkpoint-flag-strip.png, 16x24, 4 columns

function toCheckpointState(placement: CheckpointPlacement): CheckpointState;
function checkpointBox(state: CheckpointState): Box;          // one rendered tile
function checkpointFrameIndex(state: CheckpointState, worldElapsed: number): 0 | 1 | 2 | 3;
function activateCheckpoint(state: CheckpointState, now: number): CheckpointState;  // activated:true, activatedAt:now
function checkpointEffectAnchor(state: CheckpointState): { x: number; y: number; scale: number };  // scale is always 1
function drawCheckpoint(state: CheckpointState, dc: DrawContext): void;
function drawCheckpointGlow(state: CheckpointState, dc: DrawContext, isActive: boolean): void;
```

**Invariants**
- `toCheckpointState` always yields `activated: false`, `activatedAt: null`.
- `checkpointFrameIndex` is `0` while dormant and `CHECKPOINT_RAISED_FRAME`
  once `worldElapsed - activatedAt` has reached the raise duration; it never
  exceeds the strip's frames. Its step is `CHECKPOINT_FRAME_STEP_SECONDS`, so
  the four frames are spread evenly across the raise and frame 3 is reached
  exactly at `CHECKPOINT_RAISE_DURATION_SECONDS`. It is pure and reads the
  shared world clock — no state is written per frame.
- `activateCheckpoint` writes `activatedAt` exactly once; nothing else mutates it.
- `drawCheckpointGlow` draws nothing when `isActive` is false (FR-021).

---

## `engine/CheckpointLogic.ts`

```ts
function hasSolidGroundBelow(level: LevelDef, col: number, row: number): boolean;
// === isSolid(tileAt(level, col, row + 1))

interface CheckpointResolution {
  states: CheckpointState[];        // same length/order; dormant entries raised
  activeId: string | null;          // the winning id, or unchanged when no contact
  activatedIds: string[];           // dormant->activated this tick, in reading order
}

function resolveCheckpointContacts(
  player: PlayerState,
  placements: readonly CheckpointPlacement[],
  states: readonly CheckpointState[],
  level: LevelDef,
  previousActiveId: string | null,
  now: number,
): CheckpointResolution;
```

**Contract**
- Overlap uses `overlappingTriggers` + `checkpointBox` + `playerHitbox`.
- Only overlaps with `hasSolidGroundBelow` count (FR-004).
- `now` is the shared world clock; each dormant winner is stamped
  `activatedAt: now` in the returned states.
- `activatedIds` is exactly the dormant winners, in reading order; the caller
  starts one puff and one label per id (FR-005/FR-006). The raise itself needs
  no start call — it is derived from `activatedAt`.
- `activeId` = first dormant winner, else first entered raised checkpoint,
  else `previousActiveId` when there were no eligible overlaps (FR-007/FR-008/
  FR-009).
- Re-entering an already-raised checkpoint never appears in `activatedIds`
  (FR-008).
- The function is pure: it returns new arrays and never mutates its inputs.

---

## `engine/CollectionEffects.ts` (additions)

```ts
const FADE_OUT_TEXT_DURATION_SECONDS = 0.6; // seconds

interface FadeOutTextEffect { id: string; x: number; y: number; text: string; elapsed: number; }

function startFadeOutTextEffect(id: string, x: number, y: number, text: string): FadeOutTextEffect;
function tickFadeOutTextEffect(effect: FadeOutTextEffect, dt: number): FadeOutTextEffect;
function fadeOutTextOpacity(elapsed: number): number; // 1 -> 0 over the duration
```

**Contract**: a world-anchored text that fades in place; it carries no flight
target and is never routed through `FlightEffect` (FR-022). It is generic — the
effect carries its own already-localized `text`, so any future in-place fading
text reuses it without a rename. The checkpoint label is the first user.

---

## `engine/Renderer.ts` (additions)

```ts
function drawCheckpoints(
  ctx: CanvasRenderingContext2D,
  states: readonly CheckpointState[],
  image: HTMLImageElement | null,
  activeCheckpointId: string | null,
  dc: DrawContext,
): void;

function drawFadeOutTexts(
  ctx: CanvasRenderingContext2D,
  effects: readonly FadeOutTextEffect[],
  dc: DrawContext,
): void;
```
- `drawCheckpoints` skips nothing (a checkpoint is never removed) and draws the
  active target's glow before its flag.
- `drawFadeOutTexts` draws each effect's own `text`, using the shared
  `RESTART_PROMPT_FONT_FAMILY` and `fadeOutTextOpacity`.

---

## `PlatformerState.ts` (additions)

```ts
const checkpointPlacements: Computed<CheckpointPlacement[]>;   // from CHECKPOINT_TILES
const checkpointStates: Signal<CheckpointState[]>;
const activeCheckpointId: Signal<string | null>;
const activeFadeOutTexts: Signal<FadeOutTextEffect[]>;

const activeRespawnPlacement: Computed<CheckpointPlacement | null>;  // active target's placement
const respawnPlayerState: Computed<PlayerState>;                     // checkpoint tile, else spawn
const respawnCenter: Computed<{ x: number; y: number }>;             // visual centre of the above

function playerStateAtTile(col: number, row: number): PlayerState;   // pure helper, not reactive
```

**Lifecycle contract**
- The respawn point is derived state, exposed as `computed` signals so it
  reacts to `activeCheckpointId` / `checkpointStates` like every other derived
  value in the app — not recomputed ad hoc by a plain function.
- `resetGame()` places the character at `respawnPlayerState.value` and snaps
  the camera to `respawnCenter.value`; it does **not** touch
  `checkpointStates` / `activeCheckpointId` (FR-015).
- `resetGameProgress()` clears `activeCheckpointId`, rebuilds
  `checkpointStates` dormant, and clears `activeFadeOutTexts` **before**
  calling `resetGame()`, so Reset Game respawns at spawn (FR-016).

---

## `engine/Camera.ts` (addition)

```ts
function initialCameraX(
  playerX: number,
  playerWidth: number,
  viewportWidth: number,
  levelPixelWidth: number,
): number;
```
Clamped to `[0, max(0, levelPixelWidth - viewportWidth)]`. Horizontal mirror of
`initialCameraY`; used once per spawn/respawn (FR-012).
