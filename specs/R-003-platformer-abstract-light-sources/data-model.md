# Data Model — Platformer Abstract Light Sources (R-003)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

This is a refactor of pure functions and TypeScript types — there is no persistence, no JSON, and
no state-shape change (FR-018). The "data model" is therefore the set of light-related types,
constants, and adapter/pass signatures, their homes after R-003, and the import edges they create
or remove.

---

## 1. Core type — `LightSource`

**Home**: `contracts/lighting.ts` (new; a strict leaf — imports nothing).

| Field | Type | Meaning | Torch value | Player value |
| --- | --- | --- | --- | --- |
| `x` | `number` | World-space centre X (rendered px) | torch centre | held-torch centre |
| `y` | `number` | World-space centre Y (rendered px) | torch centre | held-torch centre |
| `radius` | `number` | **Resolved** light radius (rendered px) | `torchLightRadius(torch, t)` | `PLAYER_LIGHT_RADIUS_PX` |
| `color` | `string` | Opaque base colour, `'rgb(r, g, b)'` | `'rgb(255, 176, 74)'` | `'rgb(255, 145, 45)'` |
| `intensity` | `number` | Overall glow `globalAlpha` multiplier | `1` | `0.7` |
| `glowMidAlpha` | `number` | Alpha of the `0.55` gradient stop | `0.35` | `0.3` |
| `punchHole` | `boolean` | `true` erases darkness; `false` is glow-only | `true` | `true` |

**Validation/invariants** (enforced by construction and tests, not runtime):

- `radius` is a plain resolved number, never a function; time lives in the adapter (FR-002).
- `color` is always an opaque `rgb(...)` string; the pass derives `rgba(..., alpha)` for the
  `0.55` and `1` gradient stops from `color` + `glowMidAlpha`/`0` (FR-006).
- `punchHole === false` still contributes to `localDarknessAt` (illuminates) but is skipped by the
  punch loop (Story 1 scenario 5).
- No field stores time or a signal; `LightSource` is plain data the draw pass and the probe read
  directly.

---

## 2. Torch descriptor — `TorchLight`

**Home after R-003**: `entities/Torch.ts` (moved from `engine/Lighting.ts`; X5).

| Field | Type | Notes |
| --- | --- | --- |
| `col` | `number` | Grid column — drives `torchPhase` (pulse phase). |
| `row` | `number` | Grid row — drives `torchPhase`. |
| `x` | `number` | World-space centre X (rendered px). |
| `y` | `number` | World-space centre Y (rendered px). |
| `strength` | `TorchStrength` | `0`–`9`; scales the radius via `torchLightScale`. |

Declares `x`/`y` inline rather than `extends Point` so `entities/Torch.ts` never imports
`engine/Lighting.ts` (research R2). The generic `LightSource` cannot express the pulse phase
(`col`/`row`) or `strength`, so `TorchLight` is retained as the adapter input (spec Assumptions).

**Producers**: `PlatformerState.torchPositions` (`TorchLight[]`), `caveLightingPreview.torchLightsFromGrid`
(`TorchLight[]`), level marker lookups.

---

## 3. Light-kind modules after R-003

### `shared/math.ts` (MODIFIED — one falloff implementation)

Adds `radialFalloffAt(x, y, centerX, centerY, radius): number` — the single falloff
(`radius <= 0 → 0`, `distance >= radius → 0`, else `smoothstep(1 - distance/radius)`) consumed by
`localDarknessAt`, `torchGlowStrengthAt`, and `playerGlowStrengthAt`, so no per-kind copy of the
formula survives (FR-010). It is a leaf primitive alongside `smoothstep`/`hash2D`.

### `entities/Torch.ts` (MODIFIED — absorbs finding X5)

| Symbol | Kind | Origin |
| --- | --- | --- |
| `TorchStrength`, `TORCH_FRAME_*`, `torchPhase`, `torchFrameIndex`, `torchLightScale`, strength helpers | existing | stays |
| `TorchLight` | type | moved from `engine/Lighting.ts` |
| `TORCH_LIGHT_RADIUS_PX`, `TORCH_PULSE_AMPLITUDE`, `TORCH_PULSE_PERIOD_SECONDS`, `TORCH_GLOW_COLOR` | constants | moved from `engine/Lighting.ts` |
| `torchPulseScale(torch, worldElapsed)` | function | moved from `engine/Lighting.ts` |
| `torchLightRadius(torch, worldElapsed)` | function | moved from `engine/Lighting.ts` |
| `torchGlowStrengthAt(torch, x, y, worldElapsed)` | function | moved from `engine/Lighting.ts` |
| `torchLightSource(torch, worldElapsed): LightSource` | function | **new adapter** (FR-003) |

### `entities/Player.ts` (MODIFIED)

| Symbol | Kind | Origin |
| --- | --- | --- |
| `PlayerState`, animation/physics player helpers | existing | stays |
| `PLAYER_LIGHT_RADIUS_PX`, `PLAYER_GLOW_COLOR`, `PLAYER_GLOW_INTENSITY` | constants | moved from `engine/Lighting.ts` |
| `playerGlowStrengthAt(x, y, light: Point)` | function | moved from `engine/Lighting.ts`; delegates to `shared/math.ts`'s `radialFalloffAt` |
| `HELD_TORCH_SCALE`, `HELD_TORCH_OFFSET_X`, `HELD_TORCH_OFFSET_Y` | constants | moved from `engine/Renderer.ts` (draw-only `HELD_TORCH_ALPHA` stays there) |
| `heldTorchPlacement(player): { centerX; topY; width; height }` | function | **new shared geometry** (FR-004); `centerX` = mirrored flame centre, `width`/`height` from `TORCH_FRAME_WIDTH`/`TORCH_FRAME_HEIGHT` (`./Torch`) |
| `playerLightSource(player): LightSource` | function | **new adapter** (FR-004), replaces `heldTorchLightPosition` |

`HELD_TORCH_ALPHA` is **not** part of the shared geometry — it is a draw-only concern and remains in
`engine/Renderer.ts`.

### `engine/Lighting.ts` (MODIFIED — keeps only non-kind math)

| Symbol | Kind | Change |
| --- | --- | --- |
| `MAX_DARKNESS`, `DARKNESS_FADE_SECONDS`, `nextDarknessLevel` | existing | stays |
| `Cell`, `Point`, `isCellDarkening`, `playerOccupiedCell` | existing | stays (`Point` still used by fog) |
| `FOG_*`, `cellHash01`, `fogPuffAt`, `fogPeekStrengthAt` | existing | stays (uses `shared/math`; no regression) |
| `ENEMY_EYE_*`, `enemyEyeOpacity`, `enemyEyeBobOffset` | existing | stays |
| `localDarknessAt(x, y, darknessLevel, lights)` | function | **signature change** — generic over `LightSource[]`; drops `torches`/`worldElapsed`/`playerLight` |
| `torchPulseScale`/`torchLightRadius`/`torchGlowStrengthAt`/`playerGlowStrengthAt` | functions | **moved out** (R2/R4) |
| `TorchLight`, `PLAYER_LIGHT_*`, `TORCH_LIGHT_*`, `TORCH_PULSE_*`, `TORCH_GLOW_COLOR` | type/constants | **moved out** (R2/R4) |

### `engine/Renderer.ts` (MODIFIED)

| Symbol | Change |
| --- | --- |
| `drawDarkness(ctx, layer, w, h, darknessLevel, lights, originX, originY, zoom)` | **generic two-loop rewrite**; drops `torches`, `worldElapsed`, `playerLight` (FR-005) |
| `drawEnemyEyes(ctx, enemies, darknessLevel, lights, worldElapsed, originX, originY)` | **signature change**; drops `playerLight` (FR-009) |
| `drawHeldTorch(...)` | body reads `heldTorchPlacement(player)` from `entities/Player` (FR-004) |
| `heldTorchLightPosition` | **deleted** (replaced by `playerLightSource`) |

---

## 4. Consumer / pass model

| Consumer | Before | After |
| --- | --- | --- |
| `PlatformerPage` render loop | `torchPositions` + `heldTorchLightPosition`; calls passes separately | builds one `LightSource[]` per frame when dark; passes it to both passes (FR-012/FR-019) |
| `PlatformerState.torchPositions` | `TorchLight[]` from `engine/Lighting` | `TorchLight[]` from `entities/Torch` (shape unchanged) |
| `caveLightingPreview` | `{ darknessLevel, torches, playerLight }` | `{ darknessLevel, lights: LightSource[] }` at `t=0` (FR-013) |
| `EditorCanvas` | `preview.torches` + `preview.playerLight` | `preview.lights`; `drawDarkness` `zoom`-only (Story 4) |
| `localDarknessAt` | max over `torches` + `playerLight` | max over `lights` (FR-007) |
| `drawEnemyEyes` | `torches` + `playerLight` | `lights`; still a post-darkness overlay (FR-009/FR-015) |

### Per-frame assembly (owner: `PlatformerPage`)

```
torchPositions: TorchLight[]  ──map(torchLightSource, worldElapsed)──┐
                                                                      ├──► LightSource[] ──► drawDarkness
playerState ──playerLightSource───────────────────────────────────────┘                  └─► drawEnemyEyes
                                     (only when darknessLevel > 0)
```

No resolved radius is stored in a signal; `worldElapsed` stays out of state (FR-012).

---

## 5. State transitions

None. `LightSource` is derived per frame and stored nowhere; `torchPositions` is a `computed`
signal unchanged in shape; no signal, level, or marker data is added or migrated.

---

## 6. Import-edge delta (R-001 layer invariants)

| Edge | Direction | Status |
| --- | --- | --- |
| `entities/Torch.ts → contracts/lighting.ts` | down | **new**, legal |
| `entities/Player.ts → contracts/lighting.ts` | down | **new**, legal |
| `entities/Player.ts → entities/Torch.ts` | same layer | **new** (`TORCH_FRAME_WIDTH`/`TORCH_FRAME_HEIGHT` for `heldTorchPlacement`), legal |
| `entities/Player.ts → shared/math.ts` | down | **new** (`playerGlowStrengthAt` → `radialFalloffAt`), legal |
| `engine/Lighting.ts → shared/math.ts` | down | **new** (`localDarknessAt` → `radialFalloffAt`), legal |
| `engine/Lighting.ts → contracts/lighting.ts` | down | **new**, legal |
| `engine/Renderer.ts → entities/Player.ts` | down | **new** (held-torch geometry), legal |
| `engine/Lighting.ts → entities/Torch.ts` | down | **removed** (torch formula left); the reverse (`entities/ → engine/`) is forbidden and never introduced |
| `app/editor → entities/Torch.ts` / `entities/Player.ts` | down | **new** (adapters), legal |
| `contracts/lighting.ts → anything` | — | none (strict leaf) |

Forbidden edges that must stay absent: `contracts/ → engine|entities|level|state`; `entities/ →
engine/`; `level/ → engine/`; `engine/ → state`. Verified by the R-001 inspection commands
(see [quickstart.md](./quickstart.md) §3).

---

## 7. Behavior-preservation guarantees

- Torch/player radii, colours, mid-stop alphas, overall alphas, hole/glow radii, and draw order
  are numerically identical (FR-006/SC-005).
- `localDarknessAt` result is unchanged for the current inputs: max-combine, no sum, clamped
  `[0, darknessLevel]` (FR-007).
- Enemy-eye markers keep their position, opacity, and bob (SC-006).
- Editor preview frame is byte-for-byte identical at `t=0` (FR-013).
- Fog uses the same `shared/math` primitives (FR-014).
- No level/marker/tuning change (FR-018).
