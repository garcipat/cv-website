---
description: "Task list for Platformer Abstract Light Sources (R-003)"
---

# Tasks: Platformer Abstract Light Sources (R-003)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)
**Input**: Design documents from `/specs/R-003-platformer-abstract-light-sources/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: REQUIRED. This is a behavior-preserving refactor under constitution Principle II (TDD,
NON-NEGOTIABLE). Existing tests change **only** where a signature changed or a helper moved to its
subject module — never weakened, skipped, or deleted (FR-016). New adapter/pass behavior is TDD'd
first (write the test, watch it fail, then implement).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`…`[US4]`)
- Every task includes exact file paths

## Path Conventions

Single self-contained game theme at the repository root: `src/themes/platformer/`. All paths below
are relative to the repo root. Co-located tests (`*.test.ts` / `*.test.tsx`) live beside their
subject.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Capture the pre-refactor green baseline the behavior-preservation bar is measured
against (FR-016/SC-005). No tooling, dependency, or data change is involved.

- [X] T001 Run `npm test` and record the current green platformer suite as the pre-refactor baseline in `src/themes/platformer/` (no files changed).
- [X] T002 [P] Run `npm run build` and confirm the production build succeeds before any change.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one shared light vocabulary every story consumes. No user story can compile
without it.

**⚠️ CRITICAL**: US1–US4 all import `LightSource`; complete this phase first.

- [X] T003 Create `src/themes/platformer/contracts/lighting.ts` exporting exactly one `LightSource` interface with fields `x: number`, `y: number`, `radius: number`, `color: string`, `intensity: number`, `glowMidAlpha: number`, `punchHole: boolean` — a strict leaf that imports nothing from `engine/`, `entities/`, `level/`, `state`, `shared/`, or pages (FR-001/FR-011). Doc-comment each field per `contracts/lighting-source.md` (radius = resolved number; color = opaque `rgb(r, g, b)` base; glowMidAlpha = the `0.55` stop alpha; punchHole = erase-vs-glow-only). No runtime test is possible for a type-only leaf; TypeScript strict compilation is its guard.

**Checkpoint**: `LightSource` compiled and importable by `engine/` and `entities/`.

---

## Phase 3: User Story 1 - One light list drives the darkness pass (Priority: P1) 🎯 MVP

**Goal**: `drawDarkness` collapses its four near-duplicated punch/glow blocks into exactly one
punch loop and one glow loop over a single `readonly LightSource[]`, and `localDarknessAt` reads
that same list — so a third emitter is data, not a new code path.

**Independent Test**: `drawDarkness` and `localDarknessAt` each take one `readonly LightSource[]`
and no `playerLight`/`worldElapsed`; add a hand-built third `LightSource` literal (not a torch, not
the player) and confirm it is punched, glowed, and counted in local darkness with **no** edit to
either function; a `punchHole: false` light glows and illuminates but erases no darkness.

### Tests for User Story 1 (write first, expect RED)

- [X] T004 [P] [US1] In `src/themes/platformer/engine/Lighting.test.ts`, rewrite the `localDarknessAt` describes (lines ~244 and ~362) to call `localDarknessAt(x, y, darknessLevel, lights: readonly LightSource[])` with hand-built literals — cover max-combine (never a sum), no-lights returns `darknessLevel` unchanged, clamping to `[0, darknessLevel]`, a `punchHole: false` light still illuminating, and a third arbitrary light being counted (FR-007/SC-003). Expect RED until T006.
- [X] T005 [P] [US1] In `src/themes/platformer/engine/Renderer.test.ts`, update every `drawDarkness` call site in the `describe('drawDarkness')` block (~lines 3970–4160) to the new signature (one `lights: readonly LightSource[]`, no `torches`/`worldElapsed`/`playerLight`, `zoom` moved to its new position) and add assertions for exactly one `destination-out` punch loop + one `lighter` glow loop, the glow-inside-hole `× 0.7` ratio, `punchHole: false` glow-only, and a third arbitrary light being punched/glowed with no branch (FR-005/FR-006/SC-001/SC-003). Expect RED until T007.

### Implementation for User Story 1

- [X] T006 [US1] Add the shared falloff primitive `radialFalloffAt(x, y, centerX, centerY, radius): number` to `src/themes/platformer/shared/math.ts` (the single implementation: `radius <= 0 ? 0 : distance >= radius ? 0 : smoothstep(1 - distance/radius)`) with `shared/math.test.ts` coverage, then rewrite `localDarknessAt` in `src/themes/platformer/engine/Lighting.ts` to `localDarknessAt(x, y, darknessLevel, lights: readonly LightSource[]): number` — drop `torches`/`worldElapsed`/`playerLight`; add a private generic `lightStrengthAt(light, x, y)` that delegates to `radialFalloffAt`; max-combine over the list; return `Math.max(0, Math.min(darknessLevel, darknessLevel - strongest))`; ignore `punchHole` (FR-007/FR-010; import `LightSource` from `../contracts/lighting`).
- [X] T007 [US1] Rewrite `drawDarkness` in `src/themes/platformer/engine/Renderer.ts` to `drawDarkness(ctx, layer, canvasWidth, canvasHeight, darknessLevel, lights: readonly LightSource[] = [], originX = 0, originY = 0, zoom = 1)` (FR-005): keep the `darknessLevel <= 0` early return, the single clear/fill/composite of the caller-owned `layer`, and the per-light viewport filter on `light.radius * zoom`; replace the four per-kind blocks with **one** punch loop (`destination-out`, black radial at `light.radius * zoom`, only `punchHole === true`) and **one** glow loop (`lighter`, radius `light.radius * zoom * 0.7`, `globalAlpha = darknessLevel * light.intensity`, stops `color` / `withAlpha(color, glowMidAlpha)` / `withAlpha(color, 0)`). Add the private `withAlpha(color: string, alpha: number): string` helper deriving `rgba(r, g, b, α)` from an `rgb(r, g, b)` base so the stop strings are byte-equal to today's literals (`rgba(255, 176, 74, 0.35)`, `rgba(255, 145, 45, 0.3)`, `alpha 0`) (FR-006/FR-008). In the same edit drop the now-unused `TorchLight`/`Point`/`torchLightRadius`/`PLAYER_LIGHT_RADIUS_PX`/`PLAYER_GLOW_COLOR`/`PLAYER_GLOW_INTENSITY`/`TORCH_GLOW_COLOR` imports from `./Lighting` (the last moves to `entities/Torch`), keeping only the imports the surviving `Renderer.ts` code still uses (FR-010/FR-017).

**Checkpoint**: US1 testable with hand-built `LightSource` literals; no torch/player input pair remains in `drawDarkness`/`localDarknessAt`.

---

## Phase 4: User Story 2 - Torch and player light are adapters onto `LightSource` (Priority: P1)

**Goal**: Each shipped light is expressed as a `LightSource` adapter owned by its subject — the
torch adapter in `entities/Torch.ts` and the player adapter plus shared held-torch geometry in
`entities/Player.ts` — so both feed the one list US1 consumes.

**Independent Test**: `torchLightSource(torch, t).radius` equals today's
`torchLightRadius(torch, t)`; `playerLightSource(player)` equals the old `heldTorchLightPosition`
centre with radius `PLAYER_LIGHT_RADIUS_PX`, color `rgb(255, 145, 45)`, glowMidAlpha `0.3`,
intensity `PLAYER_GLOW_INTENSITY`, `punchHole: true`; the player adapter lives in the player module
and `engine/Renderer.ts` no longer owns the player light.

> **Note**: The torch adapter cannot live in `entities/Torch.ts` while its formula lives in
> `engine/Lighting.ts` (an `entities/ → engine/` import would violate R-001), so the torch light
> half moves with the adapter here. T010–T014 must trim `engine/Lighting.ts`'s now-unused imports so
> it still compiles; the residual surface cleanup is T015 (US3).

### Tests for User Story 2 (write first, expect RED)

- [X] T008 [P] [US2] In `src/themes/platformer/entities/Torch.test.ts`, add a `torchLightSource` describe — radius byte-equal to `torchLightRadius(torch, worldElapsed)`, `color === TORCH_GLOW_COLOR` (`rgb(255, 176, 74)`), `glowMidAlpha === 0.35`, `intensity === 1`, `punchHole === true`, `x`/`y` = torch centre — and absorb the moved `torchPulseScale`/`torchLightRadius`/`torchGlowStrengthAt` + `TORCH_*` constant tests from `engine/Lighting.test.ts` (FR-003; R10). Expect RED until T011/T012.
- [X] T009 [P] [US2] In `src/themes/platformer/entities/Player.test.ts`, add `playerLightSource` tests (radius `PLAYER_LIGHT_RADIUS_PX`, color `PLAYER_GLOW_COLOR`, glowMidAlpha `0.3`, intensity `PLAYER_GLOW_INTENSITY`, `punchHole: true`, centre = held torch) and `heldTorchPlacement` tests (offsets/scale, mirrors with `player.direction`) whose expected `centerX` is the **mirrored flame/image centre** (`player.x + PLAYER_RENDERED_SIZE/2 ± width/2`, matching the old `heldTorchLightPosition().x`) and whose `width`/`height` equal `TORCH_FRAME_WIDTH`/`TORCH_FRAME_HEIGHT × HELD_TORCH_SCALE`, and absorb the moved `playerGlowStrengthAt` + `heldTorchLightPosition` describes retargeted to the new adapter/geometry — including a "held-torch draw and light share one geometry" assertion (a left-facing player's `playerLightSource().x` equals the drawn flame's centre, and the renderer's draw origin is derived from the same `centerX`) (FR-004/SC-007; R10). Expect RED until T012/T013/T014.

### Implementation for User Story 2

- [X] T010 [US2] Move the torch light half out of `src/themes/platformer/engine/Lighting.ts` into `src/themes/platformer/entities/Torch.ts`: the `TorchLight` interface (`col`, `row`, `x`, `y`, `strength: TorchStrength` — declare `x`/`y` inline, **not** `extends Point`), `TORCH_LIGHT_RADIUS_PX`, `TORCH_PULSE_AMPLITUDE`, `TORCH_PULSE_PERIOD_SECONDS`, `TORCH_GLOW_COLOR`, and the helpers `torchPulseScale`/`torchLightRadius`/`torchGlowStrengthAt`, rewriting `torchGlowStrengthAt` to compute `torchLightRadius(...)` and then delegate to `shared/math.ts`'s `radialFalloffAt` (no inlined falloff). Import `LightSource` from `../contracts/lighting`; keep reaching only `shared/math` + that leaf (FR-003/FR-010; R2).
- [X] T011 [US2] Add `torchLightSource(torch: TorchLight, worldElapsed: number): LightSource` to `src/themes/platformer/entities/Torch.ts`, returning `{ x: torch.x, y: torch.y, radius: torchLightRadius(torch, worldElapsed), color: TORCH_GLOW_COLOR, intensity: 1, glowMidAlpha: 0.35, punchHole: true }` (FR-003).
- [X] T012 [US2] Move the player light half + held-torch geometry out of `engine/Lighting.ts`/`engine/Renderer.ts` into `src/themes/platformer/entities/Player.ts`: `PLAYER_LIGHT_RADIUS_PX`, `PLAYER_GLOW_COLOR`, `PLAYER_GLOW_INTENSITY`, `playerGlowStrengthAt` (rewritten to delegate to `shared/math.ts`'s `radialFalloffAt` — no inlined falloff), `HELD_TORCH_SCALE`, `HELD_TORCH_OFFSET_X`, `HELD_TORCH_OFFSET_Y`, and `heldTorchPlacement(player: PlayerState): { centerX: number; topY: number; width: number; height: number }` (mirrors with `player.direction`; `centerX` is the **mirrored flame/image centre**, and `width`/`height` come from `TORCH_FRAME_WIDTH`/`TORCH_FRAME_HEIGHT` imported from `./Torch`, adding the legal `entities/Player.ts → entities/Torch.ts` edge). Leave `HELD_TORCH_ALPHA` in `engine/Renderer.ts` (a draw concern, **not** part of the shared geometry) (FR-004; R4).
- [X] T013 [US2] Add `playerLightSource(player: PlayerState): LightSource` to `src/themes/platformer/entities/Player.ts` centred on `heldTorchPlacement(player)` (`x = centerX`, `y = topY + height / 2`) with `radius: PLAYER_LIGHT_RADIUS_PX`, `color: PLAYER_GLOW_COLOR`, `intensity: PLAYER_GLOW_INTENSITY`, `glowMidAlpha: 0.3`, `punchHole: true`; no `worldElapsed` needed (FR-004).
- [X] T014 [US2] In `src/themes/platformer/engine/Renderer.ts`, rewrite `drawHeldTorch` to consume `heldTorchPlacement(player)` for `centerX`/`topY`/`width`/`height`, delete `heldTorchLightPosition` and the moved geometry constants, and import the player geometry/adapters from `../entities/Player` (FR-004/SC-007). **Geometry semantics (do not drift):** `heldTorchPlacement.centerX` is the flame/image centre, so `drawHeldTorch` must derive its draw origin as `centerX + width / 2` for a right-facing player and `centerX - width / 2` (mirrored) for a left-facing one — removing the old local `centerX` (which was the player render-slot centre and already included the offset). The drawn flame and `playerLightSource().x` must remain pixel-identical to today.

**Checkpoint**: Both adapters return the pre-refactor values; the player light and the drawn flame share one geometry source.

---

## Phase 5: User Story 3 - The torch module owns its own light (Priority: P2)

**Goal**: Finish finding X5 — `entities/Torch.ts` is the sole home of the torch light formula and
`engine/Lighting.ts` keeps only what is not torch-specific.

**Independent Test**: Searches show the torch radius/pulse/glow formula only in
`entities/Torch.ts` and the player light formula only in `entities/Player.ts`;
`engine/Lighting.ts` exports only `nextDarknessLevel`, `Cell`, `Point`, `isCellDarkening`,
`playerOccupiedCell`, fog, enemy-eye math, and `localDarknessAt`, and remains pure/DOM-free.

> **Dependency**: The definition move happens in US2 (T010–T014) because the adapter must live with
> its subject. US3 owns the residual cleanup and the guarantee that `engine/Lighting.ts` re-derives
> no kind-specific formula.

- [X] T015 [US3] Remove the moved symbols and now-unused imports from `src/themes/platformer/engine/Lighting.ts` — `TorchLight`, `TORCH_LIGHT_RADIUS_PX`, `TORCH_PULSE_AMPLITUDE`, `TORCH_PULSE_PERIOD_SECONDS`, `TORCH_GLOW_COLOR`, `torchPulseScale`, `torchLightRadius`, `torchGlowStrengthAt`, `PLAYER_LIGHT_RADIUS_PX`, `PLAYER_GLOW_COLOR`, `PLAYER_GLOW_INTENSITY`, `playerGlowStrengthAt`, and the now-unused `torchPhase`/`torchLightScale`/`TORCH_FRAME_COUNT` imports from `../entities/Torch`. **Keep** `PLAYER_RENDERED_SIZE`/`PLAYER_FOOT_PADDING` (still used by `playerOccupiedCell`) and the `Cell`/`Point` types (still used by the probe/fog) — so the module keeps only darkness easing/clamping, `Cell`, `Point`, `isCellDarkening`, `playerOccupiedCell`, fog, enemy-eye math, and the generic `localDarknessAt` (FR-010/SC-004).
- [X] T016 [US3] Update `src/themes/platformer/PlatformerState.ts` (line ~59) to import `TorchLight` from `./entities/Torch` instead of `./engine/Lighting`; the `torchPositions` signal keeps its `TorchLight[]` shape (FR-012).
- [X] T017 [US3] Remove the moved-helper describes from `src/themes/platformer/engine/Lighting.test.ts` (`torchPulseScale`, `torchGlowStrengthAt`, `playerGlowStrengthAt`, and the `TorchLight`/`PLAYER_*` constant assertions, ~lines 194–361) now that they are owned by `Torch.test.ts`/`Player.test.ts`, keeping darkness/fog/eye/probe coverage intact (FR-016; R10).

**Checkpoint**: One home per light formula; `engine/Lighting.ts` surface matches the target graph in `lighting-dependencies.md`.

---

## Phase 6: User Story 4 - Enemy eyes and the editor preview consume the shared list (Priority: P2)

**Goal**: `drawEnemyEyes`, `caveLightingPreview`, `EditorCanvas`, and the `PlatformerPage` render
loop stop taking separate torch/player inputs and route through the single `LightSource[]`.

**Independent Test**: `drawEnemyEyes` and `caveLightingPreview` expose no `torches` + `playerLight`
pair; the editor dark-mode preview still darkens a cave grid, shows identical torch pools and the
spawn's carried light at `t=0`; at `darknessLevel <= 0` the page builds no list and calls neither
pass.

### Tests for User Story 4 (write first, expect RED)

- [X] T018 [P] [US4] In `src/themes/platformer/engine/Renderer.test.ts`, update the `describe('drawEnemyEyes')` block (~lines 4280–4346) to the new signature (one `lights` list, no `playerLight`) and relocate the `describe('heldTorchLightPosition')` block (~lines 4238–4278) to `entities/Player.test.ts` retargeted to `heldTorchPlacement`/`playerLightSource` (FR-009; R10). Expect RED until T021.
- [X] T019 [P] [US4] In `src/themes/platformer/editor/caveLightingPreview.test.ts`, replace the `preview.torches`/`preview.playerLight` assertions (lines ~24/~31) with `preview.lights` — torch entries at `t=0` plus an optional player entry, and `[]` when there is no spawn/torch (FR-013). Expect RED until T022.
- [X] T020 [P] [US4] Retarget the `heldTorchLightPosition` mock in **all three** editor test files that declare it — `src/themes/platformer/editor/EditorCanvas.test.tsx` (line ~36), `src/themes/platformer/editor/EditorToolbar.test.tsx` (line ~47), and `src/themes/platformer/editor/LevelEditorPage.test.tsx` (line ~77): drop it from each `vi.mock('../engine/Renderer')` factory (it now lives on `Player` as `playerLightSource`, and the imported geometry is `heldTorchPlacement`), and update any light-call expectations in `EditorCanvas.test.tsx` (FR-004; R10). Expect RED until T023.

### Implementation for User Story 4

- [X] T021 [US4] Rewrite `drawEnemyEyes` in `src/themes/platformer/engine/Renderer.ts` to `drawEnemyEyes(ctx, enemies: readonly EnemyState[], darknessLevel, lights: readonly LightSource[], worldElapsed, originX = 0, originY = 0)` — drop the `torches` + `playerLight` pair, keep `worldElapsed` solely for `enemyEyeBobOffset`, pass `lights` to `localDarknessAt`, and keep it a separate post-darkness overlay effect (never a `LightSource`) (FR-009/FR-015).
- [X] T022 [US4] Change `CaveLightingPreview` in `src/themes/platformer/editor/caveLightingPreview.ts` to `{ darknessLevel: number; lights: LightSource[] }`: map `torchLightsFromGrid(grid, markers)` through `torchLightSource(torch, 0)` and append `playerLightSource(synthesizePlayerState(grid)!)` when a spawn exists (no `null` field); `darknessLevel` stays `EDITOR_PREVIEW_DARKNESS`; keep `torchLightsFromGrid` returning `TorchLight[]`. Retarget the imports: `TorchLight` (and `LightSource`) from `../entities/Torch`/`../contracts/lighting` (no longer `../engine/Lighting`), `playerLightSource` from `../entities/Player`, and drop the now-unused `Point`/`heldTorchLightPosition` imports (FR-013; R8).
- [X] T023 [US4] Update `src/themes/platformer/editor/EditorCanvas.tsx` (call sites ~lines 930–960) to pass `preview.lights` to `drawDarkness` at identity transform (with `zoom`) and to `drawEnemyEyes` inside the scaled segment, removing `preview.torches`/`preview.playerLight` (FR-013/US4 scenario 2).
- [X] T024 [US4] Update `src/themes/platformer/PlatformerPage.tsx`'s render loop (~lines 871–899): delete the `heldTorchLightPosition` local; when `darknessLevel.value > 0` build `const lights: LightSource[] = [...torchPositions.value.map((t) => torchLightSource(t, worldAnimElapsed)), playerLightSource(playerState.value)]` and pass it to `drawDarkness` **and** `drawEnemyEyes`; when bright, build nothing and call neither pass; retarget imports to `entities/Torch`/`entities/Player` (FR-012/FR-019/SC-008).

**Checkpoint**: Exactly one way to describe lights in the whole theme; no consumer keeps the old two-input pair.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Prove behavior preservation end to end.

- [X] T025 [P] Run the quickstart.md §3 static inspections — one `LightSource` definition; `drawDarkness` has one punch + one glow loop; torch formula only in `entities/Torch.ts`; player formula only in `entities/Player.ts`; `heldTorchLightPosition` has no matches; `contracts/lighting.ts` prints no imports; no `entities/ → engine/`, `level/ → engine/`, or `engine/ → state` edges; fog-hash must NOT match in `Lighting.ts`; the `darknessLevel.value > 0` guard wraps the assembly + passes — and fix any mismatch (SC-001/SC-002/SC-004/FR-014/FR-017/FR-019). Also confirm FR-018 (no data migration): `src/themes/platformer/level/levels/**` and marker/tuning files are untouched by the diff.
- [X] T026 [P] Run `npm test` and confirm the full suite passes with no test deleted, skipped, or weakened (FR-016/SC-005).
- [X] T027 [P] Run `npm run build` and confirm it succeeds with no new dependency (FR-016/SC-005).
- [ ] T028 Perform the quickstart.md §4 manual browser pass on a cave level — torch pools/strengths/pulse, player carried light aligned to the drawn flame (both facings), fog, enemy-eye position/opacity/bob, a fully bright level, and the editor dark-mode preview at `t=0` — and confirm no visible or behavioural difference (SC-005/SC-006).
- [X] T029 Update `docs/Features.md`: prefix the `R003` node label with `✅ ` and add `class R003 done` alongside its existing category class in the dependency diagram (AGENTS.md feature-tracking rules). Do not commit.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (`LightSource` is imported by every story).
- **US1 (Phase 3)**: Depends on Foundational. Independent of US2–US4 (tested with hand-built `LightSource` literals).
- **US2 (Phase 4)**: Depends on Foundational. Independent of US1 for the adapters themselves, but the page migration in US4 consumes both.
- **US3 (Phase 5)**: Depends on US2 — it removes from `engine/Lighting.ts` what US2 moved to the subjects.
- **US4 (Phase 6)**: Depends on US1 (`localDarknessAt`) and US2 (`torchLightSource`/`playerLightSource`, `heldTorchPlacement`); `EditorCanvas` depends on the new `caveLightingPreview` result.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependency on other stories.
- **US2 (P1)**: Can start after Foundational — no dependency on US1; touches different files (`entities/Torch.ts`, `entities/Player.ts`, `engine/Renderer.ts`'s held-torch draw).
- **US3 (P2)**: Depends on US2 (the definition move).
- **US4 (P2)**: Depends on US1 + US2.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principle II).
- Contracts/types before models; models before services; core before integration.
- Story complete and independently testable before moving to the next priority.

### Parallel Opportunities

- Setup: T001 and T002 can run in parallel.
- Foundational: T003 is single-file.
- US1: T004 (`Lighting.test.ts`) and T005 (`Renderer.test.ts`) are [P].
- US2: T008 (`Torch.test.ts`) and T009 (`Player.test.ts`) are [P].
- US4: T018 (`Renderer.test.ts`), T019 (`caveLightingPreview.test.ts`), T020 (`EditorCanvas.test.tsx`) are [P].
- Polish: T025–T027 are [P] (inspection, tests, build).

---

## Parallel Example: User Story 1

```bash
# Launch both failing test updates together (different files):
Task: "Rewrite localDarknessAt describes to LightSource[] in src/themes/platformer/engine/Lighting.test.ts"
Task: "Update drawDarkness call sites + two-loop assertions in src/themes/platformer/engine/Renderer.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch both adapter test files together (different files):
Task: "Add torchLightSource + moved torch helper tests in src/themes/platformer/entities/Torch.test.ts"
Task: "Add playerLightSource/heldTorchPlacement + moved helper tests in src/themes/platformer/entities/Player.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (`LightSource` contract).
3. Complete Phase 3: US1.
4. **STOP and VALIDATE**: confirm `drawDarkness` is two loops over one list and a third light is pure data.
5. Deploy/demo if ready — US1 alone delivers the abstraction.

### Incremental Delivery

1. Setup + Foundational → contract ready.
2. US1 → generic passes (MVP).
3. US2 → both adapters produce the pre-refactor values.
4. US3 → torch module whole; `engine/Lighting.ts` kind-free.
5. US4 → every consumer on the single list.
6. Polish → inspections, full suite, build, browser pass, Features.md.

### Parallel Team Strategy

With multiple developers, after Foundational:
- Developer A: US1 (engine passes + their tests).
- Developer B: US2 (entity adapters + their tests).
- Then US3 completes A/B's move; US4 has one owner (consumer migration) once US1+US2 land.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks.
- `[Story]` label maps each task to its user story for traceability.
- Tests change only where a signature changed or a helper moved; none are deleted, skipped, or weakened (FR-016).
- The torch/player move (US2) and the `engine/Lighting.ts` surface cleanup (US3) are two halves of finding X5; keep the tree compiling by trimming unused imports as part of the US2 edits.
- Commit after each task or logical group — only when the user explicitly requests it (no auto-commits).
- Avoid: vague tasks, same-file conflicts within a parallel batch, cross-story dependencies that break independence.
- The falloff formula has **one** implementation (`shared/math.ts`'s `radialFalloffAt`); `localDarknessAt`, `torchGlowStrengthAt`, and `playerGlowStrengthAt` all delegate to it (FR-010) — never re-inline `smoothstep(1 - distance/radius)`.
- `heldTorchLightPosition` is mocked in three editor tests (`EditorCanvas.test.tsx`, `EditorToolbar.test.tsx`, `LevelEditorPage.test.tsx`); all three retarget in T020 — not just the canvas test.
- `HELD_TORCH_ALPHA` stays in `engine/Renderer.ts` (a draw concern); only the offset/scale geometry moves to `entities/Player.ts`.

---

## Completion Report

**Generated**: `specs/R-003-platformer-abstract-light-sources/tasks.md`

- **Total tasks**: 29
- **Per user story**: Setup 2 · Foundational 1 · US1 4 · US2 7 · US3 3 · US4 7 · Polish 5
- **Parallel opportunities**: T001/T002; T004/T005; T008/T009; T018/T019/T020; T025/T026/T027
- **Independent test criteria**:
  - US1 — one punch loop + one glow loop over one `readonly LightSource[]`; a hand-built third light is data; a `punchHole: false` light glows only.
  - US2 — `torchLightSource`/`playerLightSource` return the exact pre-refactor radius/color/alpha/intensity and centre; the player adapter lives in `entities/Player.ts`.
  - US3 — torch formula only in `entities/Torch.ts`, player formula only in `entities/Player.ts`; `engine/Lighting.ts` keeps only non-kind math and stays pure.
  - US4 — no `torches` + `playerLight` pair remains; preview/frame unchanged at `t=0`; no list built and no pass called when `darknessLevel <= 0`.
- **Suggested MVP scope**: US1 only (Phases 1–3).
- **Format validation**: ✅ every task is `- [ ] T### [P?] [Story?] description with file path`; story labels appear only in US phases, and Setup/Foundational/Polish carry none.
