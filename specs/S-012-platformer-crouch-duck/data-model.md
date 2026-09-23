# Phase 1 Data Model: Platformer Crouch/Duck

This feature adds **one stored field** (`PlayerState.crouching`) and **one new
animation state**, plus **one derived render-time tint descriptor** used only
while a crouched hit reaction is playing. Everything else — the reduced box,
the headroom test, the Down context priority, the no-knockback hit reaction and
the authored low corridor — is **derived** from that field plus the existing
level grid, input, and player state.

## Entity: `PlayerState.crouching`

The only new stored value. A required boolean on the existing `PlayerState`
interface (`entities/Player.ts`).

| Field | Type | Rules |
| --- | --- | --- |
| `crouching` | `boolean` | Default `false`. Set by `stepPlayerPhysics` each tick from `resolveCrouching`. Never persisted; never set by rendering or the game loop. |

**Validation / invariants**:

- Every `PlayerState` factory seeds `false`: `PlatformerState.ts`'s
  `playerStateAtTile` (used by spawn, checkpoint respawn and `resetGame`) and
  `editor/gridRenderState.ts`'s `synthesizePlayerState`.
- `resetGame()` assigns `respawnPlayerState` (a `playerStateAtTile` result), so
  a death/respawn, checkpoint restore, Reset Game, editor Try and theme-switch
  remount all return the character standing (FR-012).
- It is never set true by a hit reaction; it is *frozen* while one is open
  (FR-011; see the transition table and `CrouchedHitReaction`).

## Entity: `CrouchContext` (pure input, `engine/Crouch.ts`)

The plain inputs `resolveCrouching` reads. Not stored.

| Field | Type | Meaning |
| --- | --- | --- |
| `downHeld` | `boolean` | Down/`S` is held this tick (`PlayerInput.dropThroughHeld`). |
| `grounded` | `boolean` | The player was grounded at the start of the tick. |
| `currentlyCrouching` | `boolean` | The player's `crouching` from the previous tick. |
| `downClaimed` | `boolean` | Down is consumed by a higher-priority context this tick (climbing, or grounded on a bridge). |
| `canStand` | `boolean` | `canStandUp(...)`: the full standing box fits in clear space. |
| `inHitReaction` | `boolean` | `isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)`. |

**Derived read**: `resolveCrouching(ctx) → boolean` (the next `crouching`).

## Entity: `CrouchedBox` (derived, not stored)

The reduced collision box and interaction hitbox. Derived from `crouching`
through the shared helpers, so both `Physics.ts` and `Collision.ts` agree.

| Field | Standing | Crouched | Rule |
| --- | --- | --- | --- |
| left | `x + PLAYER_SIDE_PADDING` | same | unchanged |
| width | `PLAYER_RENDERED_SIZE - 2*PLAYER_SIDE_PADDING` = 24 | same | unchanged |
| top | `y + PLAYER_HEAD_PADDING` = `y + 18` | `y + 24` | `playerHeadPaddingFor(crouching)` |
| height | `PLAYER_RENDERED_SIZE - 18 - 8` = 38 | `PLAYER_CROUCH_BOX_HEIGHT` = 32 | `playerBoxHeightFor(crouching)` |
| feet | `y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING` | same | unchanged — the box shrinks upward from the ground line |

For a character resting on a tile top at `feetY`: the standing box spans
`[feetY - 38, feetY)`; the crouched box spans `[feetY - 32, feetY)`, i.e.
exactly the one tile row above the floor.

**Validation / invariants**:

- The crouched box is never taller than `RENDERED_TILE_SIZE` (32) and never
  shorter than the 24 px hitbox width's diagonal needs; it fits a one-tile
  corridor with zero margin.
- Both `Collision.playerHitbox` and `Physics.ts` compute from
  `playerHeadPaddingFor`/`playerBoxHeightFor`, so no consumer can keep the
  standing height (SC-008).
- `DebugOverlay.ts` draws its head line at `playerHeadPaddingFor(crouching)` so
  the debug geometry matches.
- The box stays crouched for the whole hit reaction: `resolveCrouching`'s
  `inHitReaction` branch returns `currentlyCrouching` unchanged (FR-011).

## Entity: `HeadroomTest` (derived, not stored)

`canStandUp(level, blocks, player): boolean` — the single gate on standing.

| Field | Type | Rule |
| --- | --- | --- |
| box | the **standing** box (38 px, standing head padding) | evaluated regardless of the current crouch |
| columns | `floor((x + PLAYER_SIDE_PADDING)/32)` … `floor((x + PLAYER_SIDE_PADDING + 24 - 1)/32)` | every column the hitbox spans |
| rows | `floor((feetY - 38)/32)` … `floor((feetY - 1)/32)` | every row the standing box spans |
| obstruction | `isSolid(tileAt(level,col,row)) \|\| isBlockOccupied(blocks,col,row)` | `bridge` counts as solid; a block counts |

**Validation / invariants**:

- Returns `false` for a one-tile gap: the standing box (38 px) spans into the
  ceiling row even though the crouched box (32 px) does not.
- Returns `true` in open air (no solid in the spanned rows/columns).
- Never throws; out-of-bounds reads resolve to `'empty'` via `tileAt`, and the
  block lookup is the same one `Physics.ts` already uses.

## Entity: `DownContext` (derived, not stored)

The resolution of the one Down key into exactly one behaviour. Priority order
(FR-001, FR-009):

```
Down held
  ├─ climbing (player.climbing), or feet row climbable, or grounded with the
  │   row below the feet climbable          → ladder descent (unchanged, S-008)
  ├─ grounded and standing foot row has a bridge under the hitbox columns
  │                                          → bridge drop-through (unchanged)
  └─ otherwise                              → crouch request (new, lowest priority)
```

`downClaimed` is true for the first two cases; `resolveCrouching` ignores the
Down request when it is set.

## Entity: `CrouchPose` (derived, not stored)

The `'crouch'` `PlayerAnimState` entry.

| Field | Value | Rule |
| --- | --- | --- |
| `animState` | `'crouch'` | Derived by `updatePlayerAnimState` when `player.crouching` (after `hit` stickiness and `climb`, before airborne/walk/idle). |
| `sy` | `PLAYER_FRAME_SIZE * 8` (256) | The knight sheet's dedicated DUCK row, appended below DEATH (FR-008). |
| `frameCount` | `4` | The four crawl frames loop `0 → 1 → 2 → 3 → 0`. |
| `frameDuration` | `0.12` s (tunable) | Advanced only while `vx !== 0`; frozen while stationary. |

**Validation / invariants**:

- No existing `ANIM_CONFIG` row index is reused (`idle`=0, `walk`=2, `hit`=6,
  `death`=7; `jump`/`climb` use `knight2.png`; the duck row is a new 9th row),
  so no shipped animation changes.
- `Renderer.drawPlayer` resolves it through the existing
  `playerFrameSource`/`PLAYER_FRAME_SIZE` path for a normal crouch, and through
  the tint branch (below) when a hit reaction is playing — see
  `CrouchedHitReaction`.

## Entity: `CrouchedHitReaction` (derived, not stored) — FR-011 / FR-016 / SC-009

The state a directional hit produces while crouched. It reuses the existing
`Damageable.hitTimer` and the `'hit'` `animState`; it introduces no new stored
field.

| Aspect | Value | Rule |
| --- | --- | --- |
| damage | applied by the caller before the helper | `takeDamage` is unchanged; a crouched hit still costs health |
| invulnerability window | `hitTimer = 0` | `isInvulnerable` reads `hitTimer < PLAYER_HIT_REACTION_SECONDS`, so the window opens exactly as for a standing hit |
| reaction pose | `animState = 'hit'` | keeps the sticky-hit derivation and `playerVisible` rule; the *drawn* pose is the crouch row (below) |
| knockback | **none** | `vx`, `direction`, `knockbackTimer`, `vy` and `bounceAscending` are left untouched (FR-011, SC-009) |
| collision box | the one-tile `CrouchedBox` for the whole window | guaranteed by `resolveCrouching`'s `inHitReaction` freeze (D8) |

**Producer**: `applyHitReaction(player, knockback?)` on `entities/Player.ts` —
the shared hit-reaction helper (always the red pose; knockback optional):

```ts
// always:
{ ...player, hitTimer: 0, animState: 'hit', animFrame: 0, animTimer: 0 }
```

Called with no `knockback` argument at the three directional damage sites in
`PlatformerPage.tsx` when `player.crouching` (enemy contact, non-floor-spike
hazard, bomb blast). The floor-spike hazard uses it with no argument too (red,
no knockback). Only a pit fall blinks (`beginPitFallReaction`).

**Render descriptor** (derived only while `crouching && animState === 'hit'`):

| Field | Value | Rule |
| --- | --- | --- |
| pose | `playerFrameSource('crouch', player.animFrame)` | the DUCK-row crawl pose, not the baked `hit` row |
| tint | `CROUCH_HIT_TINT` (a red `rgba`) | applied by `drawTintedSprite` via `source-atop`, so only the sprite silhouette is recoloured |
| scratch layer | caller-owned 64×64 `hitTintLayerRef` | created once in `PlatformerPage.tsx`'s `resize()`; no per-frame allocation |

**Validation / invariants**:

- The standing hit path is byte-for-byte unchanged: when `crouching` is false,
  `animState: 'hit'` still draws the baked red frame at
  `sy = PLAYER_FRAME_SIZE * 6` (FR-016).
- A crouched hit never changes `x`, `y`, `vx`, `direction` or `vy` at the
  moment it lands; a held crawl key may continue moving the character as its
  own input, but the hit itself imparts no displacement (SC-009).
- No red-tinted crouch frame is authored; `ANIM_CONFIG.crouch` is unchanged by
  the tint (FR-016).

## Entity: `LowCorridor` (authored level geometry, not a new tile kind)

| Field | Value | Rule |
| --- | --- | --- |
| floor | existing `groundGrass` at 0-based layout row 10 | reused, unchanged |
| corridor | 0-based layout row 9, left empty | one tile high |
| ceiling | new `groundGrass` at 0-based layout row 8 | authored over the corridor columns |
| columns | recommended 89–94 (0-based) | chosen to avoid existing markers (FR-013, SC-005) |

**Validation / invariants**:

- No `TileType`, `TERRAIN_CHARS`, `ENTITY_CHARS`, `SIGN_CHARS` or `HAZARD_CHARS`
  entry is added; no level-format change.
- The corridor row and ceiling columns contain no existing marker; the corridor
  is passable crouched and blocked standing (SC-001).

## State transitions (`crouching`, per tick, `playing` phase only)

```
                    downHeld && grounded && !downClaimed
   standing ───────────────────────────────────────────────▶ crouched
      ▲                                                         │
      │  !downHeld && canStand                                  │ downHeld (keeps crouch)
      │  (release in open ground)                               │ OR !canStand (stuck / airborne)
      │                                                         │
      └─────────────────────────────────────────────────────────┘

   crouched ──!downHeld, !canStand──▶ crouched   (stuck under ceiling, FR-005)
   crouched ──canStandUp becomes true──▶ standing (auto-stand, FR-006)
   any      ──hit reaction opens──────▶ crouching frozen for the window (FR-011);
                                          a directional hit while crouched shows the
                                          red tint on the crouch pose and applies no
                                          knockback (FR-011/FR-016/SC-009)
```

- **Fresh entry requires grounded** (FR-010); a held Down mid-air does nothing.
- **Already crouched + held Down** stays crouched through a fall and landing
  (spec Edge Case); releasing Down mid-air stands before landing.
- **Down on a ladder or bridge never crouches** — `downClaimed` wins (FR-009).
- **No persistence**: every respawn/reset factory seeds `false` (FR-012).
- **Crouched hit is a no-op on motion state**: only `hitTimer`/`animState` are
  written, so the crouch freeze keeps the one-tile box and the hit adds no
  knockback (FR-011, SC-009).

## Relationships

```
PlayerInput.dropThroughHeld ──┐
player.grounded / .climbing ──┤
player.crouching (prev) ──────┼──▶ CrouchContext ──▶ resolveCrouching ──▶ PlayerState.crouching
level / blocks / player pos ──┘         ▲                                        │
                                        │                                        ├──▶ CrouchedBox (Physics + Collision.playerHitbox)
                              canStandUp ┘                                        │        └──▶ triggers / enemies / hazards / stomp / blast
                                                                                  ├──▶ Crawl speed (PHYSICS_CONFIG.crouchSpeed) + jump disable
                                                                                  └──▶ CrouchPose (animState 'crouch', row 8)
                                                                                           ▲
   crouching && animState === 'hit' ──▶ CrouchedHitReaction ─────────────────────────────┘
        (applyHitReaction: hitTimer 0 + 'hit' pose, no knockback)
                                              │
                                              └──▶ drawTintedSprite (crouch pose + CROUCH_HIT_TINT)
```

## Constants (single source of truth)

| Constant | Location | Value | Meaning |
| --- | --- | --- | --- |
| `PLAYER_CROUCH_BOX_HEIGHT` | `entities/Player.ts` | `RENDERED_TILE_SIZE` (32) | The crouched box's height (FR-002). |
| `playerHeadPaddingFor(crouching)` | `entities/Player.ts` | 18 / 24 | Box top offset from `y`. |
| `playerBoxHeightFor(crouching)` | `entities/Player.ts` | 38 / 32 | Box height. |
| `ANIM_CONFIG.crouch` | `entities/Player.ts` | row 8, 4 frames, 0.12 s | The dedicated duck/crawl pose (FR-008). |
| `PHYSICS_CONFIG.crouchSpeed` | `engine/PhysicsConfig.ts` | `120` | Crawl speed, px/s (FR-003). |
| `PLAYER_HIT_REACTION_SECONDS` | `entities/Player.ts` | `0.8` (existing) | The window during which crouch is frozen and knockback is suppressed (FR-011). |
| `CROUCH_HIT_TINT` | `engine/Renderer.ts` | `rgba(230, 40, 40, 0.6)` (tunable) | The render-time red applied to the crouch pose (FR-016). |
| `hitTintLayerRef` | `PlatformerPage.tsx` | 64×64 canvas | The reusable offscreen scratch layer for `drawTintedSprite`. |
