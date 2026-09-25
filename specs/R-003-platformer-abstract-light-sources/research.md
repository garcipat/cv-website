# Research — Platformer Abstract Light Sources (R-003)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-25

This feature had **no `NEEDS CLARIFICATION` markers** — the spec's Clarifications section already
resolved the design questions (enemy eyes are not a light; `LightSource` lives in
`contracts/lighting.ts`; `radius` is a resolved number; the torch/player adapter homes; the dropped
`worldElapsed`; `t=0` preview; FR-019). Phase 0 therefore records the **implementation decisions**
that turn those answers into concrete module, signature, and data-shape choices, plus the exact
behavior-preservation obligations. The reference import/move map is
[lighting-dependencies.md](./lighting-dependencies.md); the layer rules are
[R-001's layer-boundaries contract](../R-001-platformer-core-contracts/contracts/layer-boundaries.md).

---

## R1 — `LightSource` is a leaf contract in `contracts/lighting.ts`

**Decision**: Create `contracts/lighting.ts` exporting exactly one type:

```ts
export interface LightSource {
  x: number;
  y: number;
  radius: number;        // resolved number, in rendered world px
  color: string;         // opaque base colour, e.g. 'rgb(255, 176, 74)'
  intensity: number;     // overall glow `globalAlpha` multiplier (torch 1, player 0.7)
  glowMidAlpha: number;  // per-light 0.55 gradient stop alpha (torch 0.35, player 0.3)
  punchHole: boolean;    // true erases darkness, false is glow-only
}
```

**Rationale**: `LightSource` is shared render vocabulary like `WorldType`/`geometry`/`DrawContext`,
so it joins the R-001 `contracts/` leaf (spec Clarification Q2, FR-001/FR-011). `color` is the
opaque base and `glowMidAlpha` the per-light mid-stop so one generic glow loop reproduces the
torch and player gradients exactly (FR-006); `intensity` drives only `globalAlpha`.

**Alternatives considered**:
- *Put `LightSource` in `engine/Lighting.ts`* — rejected: `entities/Torch.ts` and
  `entities/Player.ts` must implement it, and an `entities/ → engine/` import violates R-001 FR-010.
- *Put a `lightStrengthAt` helper in `contracts/lighting.ts`* — rejected: `contracts/` may import
  only `contracts/**` and `../types`, so it cannot use `shared/math.smoothstep`; a helper would
  re-inline the falloff. The type/vocabulary stays pure data (see R6).

**Leaf check (FR-011/FR-017)**: `contracts/lighting.ts` imports nothing (no `engine/`,
`entities/`, `level/`, state, or `shared/`). It is erased type-only at build time.

---

## R2 — `TorchLight` and the torch light half move to `entities/Torch.ts`

**Decision**: Move from `engine/Lighting.ts` into `entities/Torch.ts`:

- the `TorchLight` interface (`col`, `row`, `x`, `y`, `strength`),
- `TORCH_LIGHT_RADIUS_PX`, `TORCH_PULSE_AMPLITUDE`, `TORCH_PULSE_PERIOD_SECONDS`,
  `TORCH_GLOW_COLOR`,
- `torchPulseScale(torch, worldElapsed)`, `torchLightRadius(torch, worldElapsed)`,
  `torchGlowStrengthAt(torch, x, y, worldElapsed)`,
- and the new `torchLightSource(torch: TorchLight, worldElapsed: number): LightSource`.

`TorchLight` **declares `x`/`y` inline** instead of `extends Point`: `Point` currently lives in
`engine/Lighting.ts`, and `entities/` may not import `engine/` (R-001). A torch descriptor is
torch vocabulary, so it belongs with the torch anyway.

`torchLightSource` returns `{ ...centre, radius: torchLightRadius(torch, worldElapsed), color:
TORCH_GLOW_COLOR, intensity: 1, glowMidAlpha: 0.35, punchHole: true }` (FR-003). `radius` is
byte-identical to today's `torchLightRadius`, so the calling `worldElapsed` is the frame's clock.

**Rationale**: Finding X5 — the flame module and the torch light half are one concept split across
`entities/` and `engine/`. Moving it here makes the torch whole and removes the last torch-specific
formula from the generic lighting module (FR-010, SC-004). It introduces the new edge
`entities/Torch.ts → contracts/lighting.ts`, which is legal; it keeps reaching only `shared/math`
plus that leaf (FR-017 Story 3 scenario 4).

**Alternatives considered**: Keep `TorchLight` in `engine/Lighting.ts` and re-export — rejected:
`schema/`? No. It would preserve a torch path in `engine/` and add an `entities/ → engine/` import
for `torchLightSource`, violating R-001. Also rejected defining `Point` in `contracts/` at this
time (see R3).

---

## R3 — `Point` stays in `engine/Lighting.ts`

**Decision**: Keep `export interface Point { x: number; y: number }` in `engine/Lighting.ts`. It
remains the parameter type of `fogPeekStrengthAt(x, y, player: Point)` (fog stays in Lighting).
`TorchLight` (R2) and the player geometry/adapters (R4) declare or return their own shapes instead
of importing it.

**Rationale**: `Point` is used only by fog and by the removed light-plumbing; moving it into
`contracts/geometry.ts` would grow the stable `contracts/geometry` surface (its R-001 contract
lists `Direction`/`Rect`/`Box`) for no feature benefit. Keeping it where it is leaves every
existing importer (`Renderer.ts` for fog) unchanged and avoids a scope expansion.

**Alternatives considered**: Add `Point` to `contracts/geometry.ts` — deferred, not needed; this
feature is a behaviour-preserving refactor and should not widen a stable contract.

---

## R4 — The player light adapter and the held-torch geometry live in `entities/Player.ts`

**Decision**: Move into `entities/Player.ts`:

- `PLAYER_LIGHT_RADIUS_PX`, `PLAYER_GLOW_COLOR`, `PLAYER_GLOW_INTENSITY` and
  `playerGlowStrengthAt(x, y, light)` from `engine/Lighting.ts`,
- the held-torch geometry constants (`HELD_TORCH_SCALE`, `HELD_TORCH_OFFSET_X`,
  `HELD_TORCH_OFFSET_Y`, `HELD_TORCH_ALPHA`) from `engine/Renderer.ts` (the alpha stays a draw
  concern; the offsets/scale are the shared geometry),
- one geometry helper, e.g.
  `heldTorchPlacement(player: PlayerState): { centerX: number; topY: number; width: number; height: number }`
  (mirrors with `player.direction`), and
- the new adapter `playerLightSource(player: PlayerState): LightSource`.

`playerLightSource` returns the held torch's centre
`{ x: centerX, y: topY + height / 2, radius: PLAYER_LIGHT_RADIUS_PX, color: PLAYER_GLOW_COLOR,
intensity: PLAYER_GLOW_INTENSITY, glowMidAlpha: 0.3, punchHole: true }` (FR-004). It needs no
`worldElapsed` (steady light).

`engine/Renderer.ts` deletes `heldTorchLightPosition` and rewrites `drawHeldTorch` to consume
`heldTorchPlacement(player)` for `centerX`/`topY`/`width`/`height`, so the drawn flame and its
light cannot drift (FR-004, SC-007).

**Rationale**: The spec's Clarification Q and FR-004 make the player a light emitter owned by the
player module; the held-torch draw already lives in `Renderer.ts`, and both must read one geometry
source. `engine/ → entities/` is legal, so `Renderer` importing the player geometry is allowed
(unlike the reverse).

**Alternatives considered**: Keep the adapter in `Renderer.ts` — rejected by FR-004/SC-007 (the
player light would stay in the renderer). Put the geometry in `contracts/geometry.ts` — rejected:
it needs `PlayerState`/`TORCH_FRAME_*` and would violate `contracts/`'s leaf rule.

---

## R5 — `drawDarkness` becomes two generic loops over `readonly LightSource[]`

**Decision**: New signature:

```ts
export function drawDarkness(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number,
  darknessLevel: number,
  lights: readonly LightSource[] = [],
  originX = 0,
  originY = 0,
  zoom = 1,
): void
```

Drops the `torches` array, `playerLight`, and `worldElapsed` parameters (FR-005). Structure:

1. `darknessLevel <= 0` returns immediately (FR-008 fast path, unchanged).
2. Clear/fill the caller-owned `layer` with `rgba(0, 0, 0, darknessLevel)` (unchanged).
3. **Punch loop** (`destination-out`): for every visible light with `punchHole === true`, a radial
   gradient opaque at the centre → transparent at `light.radius * zoom`.
4. Composite the layer once with `source-over` (unchanged).
5. **Glow loop** (`lighter`): for every visible light, radius `light.radius * zoom * 0.7`,
   `globalAlpha = darknessLevel * light.intensity`, stops
   `0 → light.color`, `0.55 → withAlpha(light.color, light.glowMidAlpha)`, `1 → withAlpha(light.color, 0)`.

Viewport filtering (step 3/5 pre-filter) applies to **all** lights using `light.radius * zoom`;
with torch intensity `1` and player intensity `0.7` the numeric output is identical to today's
four blocks, including the glow-inside-the-hole `× 0.7` ratio and the draw order (all punches →
composite → all glows) (FR-006).

**`withAlpha(color, alpha)`**: since `light.color` is `'rgb(r, g, b)'`, derive
`'rgba(r, g, b, alpha)'` by string substitution. The resulting strings are byte-equal to today's
literals — torch mid `rgba(255, 176, 74, 0.35)`, player mid `rgba(255, 145, 45, 0.3)`, and the
end stop `alpha 0`.

**Rationale**: This is the core abstraction (Story 1). A third light is then data, not a new code
path (SC-003). Keeping the offscreen-layer composite and the viewport filter preserves
performance (FR-008).

**Alternatives considered**: Keep four per-kind branches behind a `kind` discriminator — rejected:
that is the duplication being removed. Add a `drawLightGlow` helper per light — unnecessary; the
loop bodies are already generic.

---

## R6 — `localDarknessAt` is generic and derives strength from `LightSource.radius`

**Decision**: New signature:

```ts
export function localDarknessAt(
  x: number,
  y: number,
  darknessLevel: number,
  lights: readonly LightSource[],
): number
```

Drops `torches`, `worldElapsed`, and `playerLight` (FR-007). It computes each light's contribution
as `radius <= 0 ? 0 : distance >= radius ? 0 : smoothstep(1 - distance / radius)` — the same
falloff shape the old per-kind helpers used — takes the **maximum** over the list, and returns
`Math.max(0, Math.min(darknessLevel, darknessLevel - strongest))`. With no lights it returns
`darknessLevel` unchanged. It ignores `punchHole` (a glow-only light still illuminates; Story 1
scenario 5).

The falloff is a small private helper inside `engine/Lighting.ts` (e.g. `lightStrengthAt(light, x, y)`).
It is **generic over `LightSource`**, not a torch/player formula, so it does not violate FR-010's
"no kind-specific light formula in Lighting.ts".

The relocated kind-specific helpers `torchGlowStrengthAt` (R2) and `playerGlowStrengthAt` (R4)
remain the named per-kind formula owners required by the spec's Key Entities and SC-004; their
existing tests move with them and keep passing. They are no longer on `localDarknessAt`'s hot path
(the generic helper is), which is the intended consequence of unifying the probe.

**Rationale**: FR-007 requires the probe to read the shared list, and FR-005/FR-010 remove the
time dependency once adapters resolve `radius`. Using the maximum (never a sum) preserves the
no-over-brightening rule exactly.

**Alternatives considered**: Remove `torchGlowStrengthAt`/`playerGlowStrengthAt` — rejected: the
spec's FR-010 and Key Entities explicitly relocate them with their subject modules, and FR-016
forbids weakening/removing their tests. Move the generic falloff to `shared/math.ts` — rejected as
scope creep on R-002's math contract for a four-line helper.

---

## R7 — `drawEnemyEyes` consumes the list and keeps `worldElapsed` for the bob

**Decision**: New signature:

```ts
export function drawEnemyEyes(
  ctx: CanvasRenderingContext2D,
  enemies: readonly EnemyState[],
  darknessLevel: number,
  lights: readonly LightSource[],
  worldElapsed: number,
  originX = 0,
  originY = 0,
): void
```

Drops the `torches` + `playerLight` pair and passes `lights` to `localDarknessAt` (FR-009). It
keeps `worldElapsed` solely for `enemyEyeBobOffset` (spec Clarification Q). It stays a separate
post-darkness overlay effect and is never a `LightSource` (FR-009/FR-015).

**Rationale**: Enemy eyes answer "is this enemy visible through the dark", not "does this enemy
emit light"; they must read local darkness from the shared list but render on top of the overlay
(spec Edge Cases). This is the last consumer migrated (Story 4).

---

## R8 — `caveLightingPreview` exposes `lights: LightSource[]`

**Decision**: Change `CaveLightingPreview` to `{ darknessLevel: number; lights: LightSource[] }`
(FR-013). `caveLightingPreview(grid, markers)` builds the list by mapping
`torchLightsFromGrid(grid, markers)` through `torchLightSource(torch, 0)` and, when a spawn exists,
appending `playerLightSource(synthesizePlayerState(grid)!)`. `torchLightsFromGrid` stays (still
returns `TorchLight[]`) because it is the torch-descriptor builder and is independently tested.

`darknessLevel` stays `EDITOR_PREVIEW_DARKNESS` while active; the spawn only supplies the carried
light and never decides *whether* the scene darkens (unchanged). Resolving at `worldElapsed = 0`
keeps the preview frame byte-for-byte static (spec Clarification Q / FR-013).

`EditorCanvas` passes `preview.lights` to both `drawDarkness` (at identity transform, with `zoom`)
and `drawEnemyEyes` (inside the scaled segment), and no longer passes `playerLight` (Story 4
scenario 2).

**Rationale**: One way to describe lights in the whole theme; leaving the preview on the old
`{ torches, playerLight }` pair would keep the two-input shape alive and defeat the abstraction.

---

## R9 — Per-frame assembly and the no-darkness fast path (FR-019)

**Decision**: `PlatformerState.torchPositions` keeps its `TorchLight[]` shape (no time dependency,
so no resolved radius enters a signal) but imports `TorchLight` from `entities/Torch` (FR-012).
`PlatformerPage`'s render loop builds the list **only** when `darknessLevel.value > 0`:

```ts
if (darknessLevel.value > 0) {
  const lights: LightSource[] = [
    ...torchPositions.value.map((t) => torchLightSource(t, worldAnimElapsed)),
    playerLightSource(playerState.value),
  ];
  if (darknessLayerRef.current) {
    drawDarkness(ctx, darknessLayerRef.current, canvas.width, canvas.height,
      darknessLevel.value, lights, originX, originY);
  }
  drawEnemyEyes(ctx, enemyStates.value, darknessLevel.value, lights, worldAnimElapsed,
    originX, originY);
}
```

Dropping the level's `worldElapsed` after the `torchLightSource` mapping is intentional. The
existing `drawHeldTorch` call and all other draw passes are unchanged.

**Rationale**: FR-019 extends the pass-level fast path to the assembly and call site, so a fully
bright level allocates no list and runs no adapter. This is behaviour-preserving because both
passes already no-op at `darknessLevel <= 0`.

**Alternatives considered**: Build the list unconditionally — rejected: pure per-frame waste in
bright levels (FR-019).

---

## R10 — Test migration map

**Decision**: Behaviour-preservation is guarded by the existing suite; only signature/import
changes and file relocation.

| Test file | Change |
| --- | --- |
| `entities/Torch.test.ts` | Absorbs `torchLightRadius`/`torchPulseScale`/`torchGlowStrengthAt` (+ constants that stay meaningful) from `Lighting.test.ts`; adds `torchLightSource` tests (radius byte-equal to `torchLightRadius`, `color`, `glowMidAlpha 0.35`, `intensity 1`, `punchHole true`). |
| `entities/Player.test.ts` | Absorbs `playerGlowStrengthAt` and `heldTorchLightPosition` tests (retargeted to the new adapter/geometry); adds `playerLightSource` tests (`radius`, `color`, `glowMidAlpha 0.3`, `intensity`, `punchHole true`, centre on the held torch) and a "held-torch draw and light share one geometry" test. |
| `engine/Lighting.test.ts` | Drops the moved helper tests; `localDarknessAt` now exercised with `LightSource[]` (max-combine, glow-only light still illuminates, no-lights returns base, clamping). Keeps darkness/fog/eye/probe tests. |
| `engine/Renderer.test.ts` | `drawDarkness`/`drawEnemyEyes` call sites updated to the new argument order; `heldTorchLightPosition` describe block relocated to `Player.test.ts`; two-loop/generic-glow assertions added. |
| `editor/caveLightingPreview.test.ts` | `preview.torches`/`preview.playerLight` become `preview.lights` (torch entries + optional player entry at `t=0`). |
| `EditorCanvas.test.tsx` | `vi.mock('../engine/Renderer')` drops `heldTorchLightPosition` (now owned by `Player`). |
| `PlatformerPage.test.tsx` | Import/mock retargets only. |

**Rationale**: FR-016 — tests change only where a signature changed, never weakened/skipped/
deleted. No test is dropped: moved helpers take their tests to the subject module.

---

## R11 — No `shared/math.ts` change; R-002's fog dedup must not regress

**Decision**: R-003 does not add primitives to `shared/math.ts`. Fog (`fogPuffAt` /
`fogPeekStrengthAt`) already uses `hash2D`/`smoothstep` from R-002 and is untouched (FR-014). The
moved light formulas keep importing `clamp01`/`pulse`/`smoothstep` from `shared/math` — they must
not re-inline them.

**Rationale**: R-002 resolved finding L3; R-003 only verifies no regression. Keeping `shared/math`
fixed keeps R-002's contract stable.

---

## R12 — No data migration, no folder reorganisation

**Decision**: Authored levels, markers, torch strengths, tuning, and `localStorage` keys are
unchanged (FR-018). `entities/Torch.ts`, `entities/Player.ts`, `engine/Lighting.ts`, and
`engine/Renderer.ts` stay in their current folders; only the light code moves between modules. The
`engine/render/` + `features/torch/` reorganisation (F7) and the layer-boundary lint guard (R-014)
are out of scope.

**Rationale**: Spec Assumptions/Out of Scope; smaller diff, easier verification.

---

## Resolved unknowns

| Unknown from Technical Context | Resolution |
| --- | --- |
| Where does `LightSource` live? | `contracts/lighting.ts` (R1). |
| Where do `TorchLight` + torch light math live? | `entities/Torch.ts` (R2). |
| Where does the player light + held-torch geometry live? | `entities/Player.ts` (R4). |
| How does the generic glow reproduce both gradients? | `color` + `glowMidAlpha` + `intensity` (R1/R5). |
| Does the probe still need time? | No — adapters resolve `radius` (R6). |
| Does the preview still expose two inputs? | No — one `lights[]` at `t=0` (R8). |
| Where is the list assembled? | Per frame in `PlatformerPage`, only when dark (R9). |
| Does fog regress? | No — `shared/math` untouched (R11). |

**Output**: All Technical Context entries resolved; no `NEEDS CLARIFICATION` remains.
