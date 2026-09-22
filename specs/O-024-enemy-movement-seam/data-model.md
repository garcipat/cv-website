# Phase 1 Data Model: Enemy Movement & Animation Seam + Bee

This feature adds **no new stored state**. Every new value is either a
per-kind **declaration** (a movement strategy, a resting animation state, a
frame table) or a per-tick **input** (`MovementContext`) computed from state that
already exists. The only new entity instance is the bee, whose state is the
existing `BaseEnemyState` shape.

The authoritative behavior lives in [spec.md](./spec.md); the code-level design
in [design.md](./design.md); the decisions and rejected alternatives in
[research.md](./research.md). The contracts are in [contracts/](./contracts/).

---

## Entity: Enemy kind (`EnemyType<S>`)

The per-kind contract in `entities/enemies/EnemyType.ts`. This feature adds two
members and removes one.

| Field | Type | Rules |
| --- | --- | --- |
| `movement` | `MovementStrategy<S>` | **NEW.** The kind's own movement rule. Required for every registered kind (FR-002/FR-017). The shared game loop applies `typeOf(enemy).movement.step(...)` and nothing else. |
| `defaultAnimState` | `string` | **NEW.** The state a kind shows at spawn, after a `hit` reaction ends, and whenever a requested state is missing from its table (FR-008/FR-009/FR-017). MUST exist in `sprite.animations` (asserted by the contract test). |
| `patrolSpeedMultiplier` | — | **REMOVED.** Becomes the patrol strategy's `speedMultiplier` config. |
| `hitboxPaddingNative` | `{ side: number; top: number; bottom: number }` | **WIDENED.** Gains a `bottom` inset (FR-019) so a kind whose art does not touch the frame bottom (the bee) is boxed and anchored by its visible body. The slimes set `bottom: 0`, leaving their box and anchor unchanged. |
| `key`, `maxHitPoints`, `hitReactionSeconds`, `sprite`, `heldItem`, `create`, `revive`, `box`, `draw`, `onPlayerCollide`, `onTick?` | unchanged | See [docs/themes/platformer/Enemies.md](../../docs/themes/platformer/Enemies.md). |

**Validation** (contract test, SC-006):
- Every entry of `ENEMY_TYPES` has `movement` with a callable `step`.
- Every entry's `defaultAnimState` is a key of its own `sprite.animations`.
- Each module's `key` still equals its registry slot and its state's `type`
  literal (the existing `index.test.ts` invariant).

**State transitions** (one live enemy, per tick):

```text
spawn (animState = defaultAnimState)
   │
   ├─ animState !== 'hit' ──> movement.step(enemy, ctx, dt)   (kind's own rule)
   │                              │
   └─ animState === 'hit' ──> stepEnemyHitReaction(enemy, dt)  (frozen/inert)
                                  │
        (both branches) ──> type.onTick?(enemy, dt) ──> advanceEnemyAnimation(enemy, dt)

stepEnemyHitReaction, once hitReactionSeconds elapses:
   hitPoints > 0  ──> animState = defaultAnimState, frame 0   (resumes its own movement)
   hitPoints <= 0 ──> alive = false                            (defeat puff; stays in the array)

revive ──> animState = defaultAnimState, full hitPoints, homeX/homeY
```

## Value: Movement context (`MovementContext`)

The per-tick inputs a strategy receives. Built once per tick by
`PlatformerPage.tsx` and shared by every enemy that tick; `null` player in
headless tests and the editor.

| Field | Type | Source | Meaning |
| --- | --- | --- | --- |
| `level` | `LevelDef` | `currentLevel.value` | Static terrain (walls, `patrol` tiles, ground). |
| `blockedTiles` | `readonly { col; row }[]` | live `blockStates` (not removed) | Dynamic solid cells (crate/questionMark/fragileRock). |
| `player` | `{ x; y; width; height } \| null` | `playerState.value` | For proximity strategies; `null` when absent. |
| `elapsed` | `number` | `worldAnimElapsed` | Seconds since level start; freezes with the world on pause/death. The fly bob's phase clock. |

**Validation**:
- `blockedTiles` is the same set `stepEnemyPatrol` already receives — no new
  source of truth.
- `elapsed` is the existing shared clock; no second timer is introduced (D8).

## Value: Frame inset and anchoring (`Enemy.ts`, `spriteSheetHitbox.ts`, `drawSpriteSheetEntity.ts`)

The bee's opaque art floats inside its 24×24 cell (measured: side ~3, top ~7, bottom ~3–5 native
px), so the pre-existing "feet touch the frame bottom" assumption breaks. FR-019 generalizes the
per-kind inset to three sides and uses it for both the collision box and the render anchor.

| Helper | Change | Rule |
| --- | --- | --- |
| `hitboxPaddingNative` | `{ side, top }` → `{ side, top, bottom }` | Per-kind transparent margins, in pre-scale px. Slimes: `bottom: 0`. Bee: measured from the fly frames. |
| `enemyHitboxBottomPadding(type)` (`Enemy.ts`) | **NEW** | `hitboxPaddingNative.bottom * RENDER_SCALE * sprite.renderScale`, mirroring `enemyHitboxSidePadding`/`enemyHitboxTopPadding`. |
| `enemyTileOffsetY(type)` (`Enemy.ts`) | changed | Adds the bottom inset so the frame is shifted down until the **visible** art's bottom sits at the render slot's bottom: `RENDERED_TILE_SIZE - renderedSize + bottomPad`. With `bottom: 0` this is the old formula. |
| `spriteSheetHitbox(...)` | changed | `height = size - topPad - bottomPad`, so the box's bottom edge coincides with the visible art's bottom. `bottom: 0` reproduces today's box exactly. |
| `drawSpriteSheetEntity(...)` | changed | `dy` gains `+ bottomPad`, anchoring the visible art on the placement row. `bottom: 0` reproduces today's draw exactly. Also gains an optional `bodyAlpha` (default `SLIME_BODY_ALPHA` 0.78) so a kind can draw opaque; the bee passes `1`. |

**Validation** (SC-009): a kind with a non-zero bottom inset gets a box whose bottom edge equals its
visible art's bottom edge and is drawn resting on its row; the slimes' box/anchor are bit-identical
to before.

## Entity: Movement behavior (`MovementStrategy<S>`)

A pure function of `(enemy, ctx, dt)` returning a new state. Declared in
`entities/enemies/movement/MovementStrategy.ts`.

```ts
export interface MovementStrategy<S extends BaseEnemyState> {
  readonly kind: 'patrol' | 'fly' | 'chase';
  step(enemy: S, ctx: MovementContext, dt: number): S;
}
```

**Invariants** (asserted per strategy):
- Never mutates `enemy` or `ctx`; returns a new object (or the same reference
  when there is nothing to change).
- Sets `animState` explicitly to a state the kind declares.
- `dt <= 0` is a no-op (returns the input state).
- Deterministic: identical `(enemy, ctx, dt)` always produce an identical result.

## Value: Patrol movement (`kind: 'patrol'`)

The existing ground behavior, extracted verbatim from `stepEnemyPatrol`.

| Config | Type | Default | Meaning |
| --- | --- | --- | --- |
| `speedMultiplier` | `number` | `1` | Multiplier on `PHYSICS_CONFIG.enemyPatrolSpeed` (60 px/s). Green `1`, purple `0.7`. |
| `sprite` | `SpriteDescriptor` | — | The kind's own descriptor; size/offsets/padding derive from it. |
| `hitboxPaddingNative` | `{ side; top; bottom }` | — | The kind's own transparent-margin inset. |
| `animState` | `string` | `'walk'` | The state set while patrolling. |

**Rules** (unchanged from today, FR-003): horizontal only; reverses at a wall,
a `patrol` tile, or a live blocked cell at any row the silhouette spans; reverses
at a ledge (no solid ground ahead on the anchor row); snaps the visible leading
edge exactly to the obstacle; stands still when the lane is narrower than the
sprite on both sides; speed = `enemyPatrolSpeed * speedMultiplier`.

**Validation**: identical position/direction/`vx` sequences to the pre-seam
`stepEnemyPatrol` for every existing case (SC-001).

## Value: Fly movement (`kind: 'fly'`)

The bee's behavior: horizontal patrol with **no ledge check** plus a vertical
bob around the placement row.

| Config | Type | Meaning |
| --- | --- | --- |
| `speed` | `number` | Absolute horizontal speed, px/s. |
| `bobAmplitude` | `number` | Maximum vertical deviation from `homeY`, px. |
| `bobPeriod` | `number` | Seconds for one full bob cycle. |
| `sprite`, `hitboxPaddingNative` | — | As patrol. |
| `animState` | `string` (default `'fly'`) | The state set while flying. |

**Rules** (FR-004/FR-005/FR-006):
- Horizontal: advances at `speed`, reversing at a wall / `patrol` tile / live
  blocked cell (same snapping and narrow-lane stand-still as patrol), **never**
  at a gap. The blocking test anchors on the placement row and the rows the
  silhouette spans; the bob does not change it (D9).
- Vertical: `y = homeY + bobAmplitude * sin(2π * elapsed / bobPeriod)`; `vy` is
  the analytic derivative. At `elapsed = 0` and every whole period, `y = homeY`;
  `|y - homeY| <= bobAmplitude` always.
- `animState` set to the configured state.

**Validation** (SC-002/SC-003): crosses a gap a patrol reverses at; over one
period returns exactly to `homeY`; maximum deviation equals `bobAmplitude`.

## Value: Chase movement (`kind: 'chase'`)

A proximity-reactive pursuit. Ships tested; used by **no registered kind**
(FR-016).

| Config | Type | Meaning |
| --- | --- | --- |
| `speed` | `number` | Pursuit speed, px/s. |
| `detectRange` | `number` | Distance (px) within which the enemy pursues. |
| `activeAnimState` | `string` | State while pursuing. |
| `idleAnimState` | `string` | State while idle. |

**Rules**:
- `ctx.player === null` or distance > `detectRange` → idle: `vx = vy = 0`,
  `animState = idleAnimState`.
- In range → move toward the player (2D, normalized, `speed * dt`), set
  `direction` from the horizontal sign, `animState = activeAnimState`.

**Validation**: idles with no player / out of range; moves toward and faces the
player once in range (FR-016).

## Entity: Bee (`EnemyType<BeeState>`, key `'bee'`)

A flying enemy. One new module, one registry line.

| Field | Value | Rule |
| --- | --- | --- |
| `key` / `type` | `'bee'` | Must match its registry slot (existing invariant). |
| `maxHitPoints` | `1` | A single stomp defeats it (FR-010). |
| `hitReactionSeconds` | `ENEMY_HIT_REACTION_SECONDS` (0.4) | Same reaction/refractory window as a green slime (FR-012). |
| `movement` | `flyMovement({...})` | FR-004/FR-005/FR-006. |
| `defaultAnimState` | `'fly'` | Present in its own table; the reaction falls back to it (FR-009). |
| `hitboxPaddingNative` | `{ side: 3, top: 7, bottom: 5 }` | Measured from the fly frames (row 5: art x=3..21, y=7..18 in the 24×24 cell); `side` is a single **symmetric** value, so the larger measured side is used (the left/right asymmetry is not representable, by design); tuned in implementation. Insets the collision box to the visible bee and anchors it by the art's bottom (FR-019/SC-009). |
| `sprite` | `{ sheet: BEE_SHEET, renderScale: 1, animations: BEE_ANIMATIONS }` | The cell is 48 px on screen; the visible bee is ~38 px wide, ~24 px tall. |
| `heldItem` | `null` | Drops nothing (FR-013). |
| `create` / `revive` | `baseEnemyState`/`baseRevive` + `type: 'bee'` | Seeds `animState: 'fly'` and the fly-loop stagger. |
| `box` / `draw` | `spriteSheetHitbox` / `drawSpriteSheetEntity(..., 'fly', 1)` | The shared helpers, with the fly fallback; `bodyAlpha: 1` so the bee draws fully opaque rather than at the slimes' `SLIME_BODY_ALPHA` (0.78). |
| `onPlayerCollide` | identical to `SlimeGreen` | `isInvulnerable \|\| hitPoints <= 0` → `{}`; `top` → `takeHit` + `stompBounceVelocity`; else `damagePlayer: 1, knockback: 'away'` (FR-010/FR-011/FR-012). |
| `fact` | none | Reveals no CV fact (FR-013). |

**Animation table**:

```ts
BEE_ANIMATIONS = {
  fly: { frames: [32, 33, 34, 35, 36, 37, 38, 39], frameDuration: 0.12 },
  // no `hit` row: FR-009's fallback reuses `fly` during the reaction
};
```

**Validation**:
- Registered in `ENEMY_TYPES`; `EnemyTypeKey`/`EnemyState` widen automatically.
- `defaultAnimState` (`'fly'`) exists in `BEE_ANIMATIONS` (contract test).
- The bee is **not** counted by `levelTotals.enemies` or `enemiesDefeated`
  (both already filter `type === 'slimeGreen'`); a level with bees reports the
  same totals/completion as the same level with them removed (SC-008).

## Entity: Bee placement marker (`EntityKind = 'enemyBee'`, char `q`)

A plain, position-derived placement — no CV pool, no reward.

| Field | Value | Rule |
| --- | --- | --- |
| `EntityKind` | `'enemyBee'` | New member of the union. |
| `ENTITY_CHARS['q']` | `'enemyBee'` | Must not collide with any terrain/sign/hazard char (module-load guard). |
| `TileChar` | `'q'` | Kept in sync with the maps by the existing sync test. |
| `findBeeTiles(layout)` | `{ col; row }[]` | Reading order, like every other finder. |
| `BEE_TILES` | `computed(...)` | `currentLayout`'s `q` markers. |
| `EnemyMarkerPositions.bee` | `readonly { col; row }[]` | Feeds `placeEnemies`. |
| `placeBees(markers)` | `EnemyPlacement[]` | `{ id: 'enemy-bee-<col>-<row>', type: 'bee', x, y }` — no `fact`. |
| palette `q` | sprite crop + label `'Bee'` + description | FR-015. |
| editor synthesis | one bee `EnemyState` per `q` | `gridRenderState.synthesizeEnemyStates`. |
| shipped layout | one `q` over Zone D's open pit | So a visitor meets one (D11). |

**Validation**:
- `q` appears in `ENTITY_CHARS` and `TileChar`; the sync test covers the latter.
- A bee placement carries no `fact` and joins no fact-bearing array.
- Level save/load round-trips the `q` unchanged (FR-015).
