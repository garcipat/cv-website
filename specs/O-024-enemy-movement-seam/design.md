# O-024 — Enemy Movement & Animation Seam (+ Bee)

Status: design (pre-spec)
Related: F-017 (Enemies), #66 (Idea: More enemy variants), #70 (O-023 is taken)

## 1. Context

Today every enemy shares one hardcoded movement routine and one hardcoded
animation table:

- `stepEnemyPatrol` (`src/themes/platformer/engine/EnemyAI.ts:62`) is called
  unconditionally for every live, non-`hit` enemy
  (`PlatformerPage.tsx:1174-1181`). There is no per-type movement hook, no
  enemy gravity, and `Moving.vy` (`entities/capabilities.ts:17`) is unused by
  enemies.
- `EnemyAnimState = 'walk' | 'hit'` and the module-level `ENEMY_ANIMATIONS`
  (`entities/enemies/EnemyAnimation.ts:6,11`) are read directly by
  `enemyFrameIndex` (`:25`) and `advanceEnemyAnimation`
  (`entities/Enemy.ts:163`), ignoring each type's own
  `sprite.animations`. `stepEnemyHitReaction` reverts to the literal
  `'walk'` (`EnemyAI.ts:171`).

The per-type abstraction is otherwise already good: `EnemyType<S>`
(`entities/enemies/EnemyType.ts:49`) plus the `ENEMY_TYPES` registry and
`typeOf` dispatcher (`entities/enemies/index.ts:9,26`) isolate state, hit
points, hitbox, drawing and contact meaning per type, and no shared file
switches on enemy kind. Only **movement** and **animation** are still shared.

`specs/F-017-platformer-enemies/spec.md` explicitly scopes out new enemy kinds
and flying/gravity-affected enemies, so this is a new feature.

## 2. Goal

Make *how an enemy moves* and *how it animates* pluggable per type, so future
enemies (bird, bat, mushroom, chaser) can differ in both without touching
shared engine files. Ship one real flying enemy — the **bee** — as the seam's
first consumer and end-to-end validation.

## 3. Non-goals

- No attack state machine (deferred; the movement context carries player
  position so it can be added later without redesign).
- No enemy gravity / falling enemies.
- No chase behavior on any shipped enemy (the bee is fly-patrol only). The
  `chase` strategy ships tested-but-unused, proving the seam can support a
  proximity-reactive enemy later.
- No change to green/purple slime behavior or visuals.
- Bird, bat, mushroom variants remain under #66.

## 4. Architecture

### 4.1 Movement seam

New folder `src/themes/platformer/entities/enemies/movement/`:

```ts
export interface MovementContext {
  level: LevelDef;
  blockedTiles: readonly { col: number; row: number }[];
  /** Player position for proximity strategies; null in headless tests. */
  player: { x: number; y: number; width: number; height: number } | null;
  /** Seconds since level start — for bob/path phases. */
  elapsed: number;
}

export interface MovementStrategy<S extends BaseEnemyState> {
  step(enemy: S, ctx: MovementContext, dt: number): S;
}
```

`EnemyType<S>` gains:

- `movement: MovementStrategy<S>`
- `defaultAnimState: string` — the state at spawn and the state a `hit`
  reaction reverts to (replaces the hardcoded `'walk'`).

`patrolSpeedMultiplier` is removed from `EnemyType`; it becomes patrol config.

The game loop (`PlatformerPage.tsx`) becomes:

```ts
const stepEnemy = (enemy: EnemyState) =>
  enemy.animState === 'hit'
    ? stepEnemyHitReaction(enemy, dt)
    : advanceEnemyAnimation(
        typeOf(enemy).movement.step(enemy, movementCtx, dt),
        dt,
      );
```

`movementCtx` is built once per tick from the current level, live
`blockedTiles`, the player, and `elapsed`.

### 4.2 Concrete strategies

All are pure functions returning new state; all set `animState` explicitly so
the type's animation table drives rendering.

- **`patrolMovement({ speedMultiplier })`** — extracted verbatim from today's
  `stepEnemyPatrol` (wall / `patrol`-tile / ledge reversal, edge snapping,
  narrow-lane stand-still). `animState: 'walk'`. Existing slimes use this, so
  slime behavior is bit-for-bit unchanged.
- **`flyMovement({ speed, bobAmplitude, bobPeriod })`** — horizontal advance
  at `speed` with wall / `patrol`-tile reversal but **no ledge check** (flies
  over gaps), plus a sinusoidal vertical offset around `homeY`; sets `vy`.
  `animState` configurable (default `'fly'`). Used by the bee.
- **`chaseMovement({ speed, detectRange, activeAnimState, idleAnimState })`** —
  idles (`vx: vy: 0`) until the player is within `detectRange`, then moves
  toward them (2D) and sets `direction`. Tested with a non-registered fixture;
  not used by any shipped type yet.

`patrolMovement` and `flyMovement` share the horizontal wall/`patrol`
reversal helper, parameterized on whether to run the ledge check.

### 4.3 Per-type animation

- Each type's `sprite.animations` becomes the source of truth.
  `enemyFrameIndex` and `advanceEnemyAnimation` take the type's descriptor
  (via `typeOf(enemy).sprite`) instead of the module-level `ENEMY_ANIMATIONS`.
- `EnemyAnimState` widens from `'walk' | 'hit'` to `string` (the
  `SelfAnimated.animState` capability is already `string`).
- `stepEnemyHitReaction` reverts to `typeOf(enemy).defaultAnimState`.
- Slimes keep `walk` / `hit`; the bee declares `fly` / `hit`.
- `drawSpriteSheetEntity` reads the current frame through the type's
  descriptor.
- Fallback: if `animState` is absent from a type's table, fall back to
  `defaultAnimState` rather than throw (keeps a type from needing a dedicated
  hit row).

## 5. The bee (validating enemy)

- **Sprite**: `public/sprites/bee.png` — 192×168, an 8-column × 7-row grid of
  24×24 frames (56 frames). Frame index = `(row-1)*8 + col`. Row 5 (index 4,
  frames 32–39) is the neutral fly/idle loop (edited so the stinger is
  permanently slightly out). Exact hit row and frame range are an open
  question (§9).
- **New module** `entities/enemies/Bee.ts` with `BeeState` and the `bee`
  `EnemyType`.
- **Movement**: `flyMovement` (horizontal patrol + vertical bob, no ledge
  check). No chase.
- **Combat**: stompable like the green slime — top contact stomps (bounce),
  side/bottom contact damages the player. `maxHitPoints: 1`. Uses the same
  `onPlayerCollide` shape as `SlimeGreen` so the shared enemy contact contract
  holds.
- **Reward**: none — `heldItem: null`, no `fact`.
- **Registration**: one line in `ENEMY_TYPES` (`entities/enemies/index.ts`),
  plus its sheet in `entities/sprites/sheets.ts`.
- **Asset loading** is registry-driven and needs no change.

## 6. Level & editor wiring

Bees are level-marker only (no CV fact, no reward). This is the existing
per-kind cost for a placeable enemy:

- `level/LevelParser.ts`: add `'enemyBee'` to `EntityKind`, a character (e.g.
  `b`) to `ENTITY_CHARS`, `TileChar`, and a `findBeeTiles` finder.
- `level/level.ts`: add a computed marker list.
- `level/EnemyMapper.ts`: add `bee` to `EnemyMarkerPositions`, a placement
  function, and wire it into `placeEnemies`.
- `types.ts`: widen `EnemyPlacement.type` / `BaseEnemyState.type` from
  `EnemyDef['type']` to the registry's `EnemyTypeKey`, so placements are no
  longer limited to CV-mapped, fact-carrying types.
- `PlatformerState.ts`: include bee placements in `enemyPlacements`.
- Editor: `editor/gridRenderState.ts` (`synthesizeEnemyStates`),
  `editor/paletteTiles.ts` (sprites/labels/descriptions),
  `editor/EditorCanvas.tsx` (`EditorImages`), `editor/EditorCanvasPane.tsx`
  (image load).
- Docs: `docs/themes/platformer/Enemies.md`, `LevelFormat.md`, palette docs.

Bees do **not** count toward `levelTotals.enemies` or `enemiesDefeated`
(those filter `type === 'slimeGreen'`), so completion is unaffected.

## 7. Files touched

New:

- `entities/enemies/movement/MovementStrategy.ts`
- `entities/enemies/movement/patrol.ts`
- `entities/enemies/movement/fly.ts`
- `entities/enemies/movement/chase.ts`
- `entities/enemies/Bee.ts`
- tests alongside each

Modified:

- `entities/enemies/EnemyType.ts`, `SlimeGreen.ts`, `SlimePurple.ts`,
  `index.ts`
- `entities/enemies/EnemyAnimation.ts`, `drawSpriteSheetEntity.ts`,
  `shared.ts`
- `entities/Enemy.ts`, `entities/sprites/sheets.ts`
- `engine/EnemyAI.ts` (keep `stepEnemyHitReaction`; remove/relocate patrol)
- `PlatformerPage.tsx`
- `level/LevelParser.ts`, `level/level.ts`, `level/EnemyMapper.ts`,
  `types.ts`, `PlatformerState.ts`
- editor files listed in §6
- docs listed in §6

## 8. Testing

- **Strategy units**: `patrol` parity (migrate the existing
  `engine/EnemyAI.test.ts` cases), `fly` bob timing / wall reversal /
  no-ledge-reversal, `chase` proximity activation and idle.
- **Contract**: extend `entities/WorldType.test.ts` (or a new movement
  contract test) to assert every `ENEMY_TYPES` entry has a `movement` and a
  `defaultAnimState` present in its `sprite.animations`.
- **Animation**: per-type frame resolution; fallback to `defaultAnimState`.
- **Bee**: create/revive, box, stomp vs. side contact, fly integration through
  the real step loop.
- **Regression**: existing `PlatformerPage.test.tsx`,
  `PlatformerState.test.ts`, `EnemyContact.contract.test.ts` pass unchanged
  (slime behavior identical).
- **Chase**: fixture enemy exercises the seam end-to-end for the unused
  strategy.

## 9. Open questions

- Bee `hit` animation: dedicated row vs. reuse the fly row via the fallback.
- Exact bee fly frame range (assumed row 5 = frames 32–39).
- Bee tuning: speed, bob amplitude/period, render scale (assumed 1, 48px).
- Bee level marker character (`b`?).

## 10. Follow-ups

- #66: bird, bat, mushroom variants; possibly bee chase behavior (angry row).
- Attack state machine once a concrete attacker exists.
