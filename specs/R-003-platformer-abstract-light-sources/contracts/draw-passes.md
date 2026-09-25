# Contract — Darkness pass, local-darkness probe, enemy-eye pass, preview

**Feature**: R-003 | **Date**: 2026-09-25
**Modules**: `engine/Renderer.ts` (`drawDarkness`, `drawEnemyEyes`), `engine/Lighting.ts`
(`localDarknessAt`), `editor/caveLightingPreview.ts` (`CaveLightingPreview`).

This is the interface contract the spec's FR-005…FR-010 / FR-013 / FR-019 and SC-001…SC-003,
SC-007, SC-008 define. Every pass takes **one** `readonly LightSource[]`; no pass accepts a
separate torch/player light pair.

---

## 1. `drawDarkness` (in `engine/Renderer.ts`) — FR-005/FR-006/FR-008

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

- **Dropped**: `torches`, `playerLight`, `worldElapsed` (FR-005).
- **Exactly two loops**: one punch loop (`destination-out`), one glow loop (`lighter`) — no
  per-kind blocks (SC-001).
- **Fast path**: `darknessLevel <= 0` returns immediately; the caller-owned `layer` is
  cleared/filled/composited exactly once (FR-008).
- **Viewport filter**: only lights whose `radius * zoom` can intersect the canvas do work.

Preserved numerics (FR-006):

| Aspect | Torch | Player |
| --- | --- | --- |
| Hole radius | `light.radius * zoom` | `light.radius * zoom` |
| Hole colour | `rgba(0,0,0,1)` → `rgba(0,0,0,0)` | same |
| Glow radius | `light.radius * zoom * 0.7` | same |
| Glow `globalAlpha` | `darknessLevel * light.intensity` (= `darknessLevel`) | `darknessLevel * 0.7` |
| Glow stops | `0: rgb(255,176,74)`, `0.55: rgba(255,176,74,0.35)`, `1: rgba(255,176,74,0)` | `0: rgb(255,145,45)`, `0.55: rgba(255,145,45,0.3)`, `1: rgba(255,145,45,0)` |
| Order | all punches → composite → all glows | same list |

`light.color` is opaque `rgb(r, g, b)`; the `0.55`/`1` stops are derived as
`rgba(r, g, b, glowMidAlpha)` / `rgba(r, g, b, 0)` so the strings are byte-equal to today's
literals.

**Hole vs glow**: `punchHole: false` lights are skipped by the punch loop but still emit a glow
(Story 1 scenario 5).

---

## 2. `localDarknessAt` (in `engine/Lighting.ts`) — FR-007

```ts
export function localDarknessAt(
  x: number,
  y: number,
  darknessLevel: number,
  lights: readonly LightSource[],
): number
```

- **Dropped**: `torches`, `worldElapsed`, `playerLight`.
- Computes each light's contribution from `light.radius` via the shared `smoothstep` falloff
  (`1` at centre → `0` at the radius, `0` beyond), takes the **maximum** (never a sum), and returns
  `Math.max(0, Math.min(darknessLevel, darknessLevel - strongest))`.
- With no lights it returns `darknessLevel` unchanged.
- Ignores `punchHole`: a glow-only light still illuminates (Story 1 scenario 5/SC-003).
- The falloff is generic over `LightSource`, so `engine/Lighting.ts` re-derives no kind-specific
  formula (FR-010).

---

## 3. `drawEnemyEyes` (in `engine/Renderer.ts`) — FR-009/FR-015

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

- **Dropped**: the `torches` + `playerLight` pair. **Kept**: `worldElapsed` (eye bob only).
- Reads the same list through `localDarknessAt` to derive each living enemy's local darkness and
  opacity (FR-009).
- Remains a **separate post-darkness overlay** effect drawn after `drawDarkness`; it is not a
  `LightSource` emitter (FR-015; story does not add one to the list).

---

## 4. `CaveLightingPreview` (in `editor/caveLightingPreview.ts`) — FR-013

```ts
export interface CaveLightingPreview {
  darknessLevel: number;          // EDITOR_PREVIEW_DARKNESS while active
  lights: LightSource[];          // wall torches at t=0 + the spawn's carried light, or [] lights when no spawn
}
```

- `caveLightingPreview(grid, markers)` maps `torchLightsFromGrid(...)` through
  `torchLightSource(torch, 0)` and appends `playerLightSource(spawn)` when a spawn exists; otherwise
  the player light is simply absent from the array (no `null` field).
- Resolving at `worldElapsed = 0` keeps the preview a static, byte-identical frame.
- `darknessLevel` is always `EDITOR_PREVIEW_DARKNESS` while the preview is active; the spawn never
  decides *whether* the scene darkens (unchanged).
- `EditorCanvas` passes the one `lights` list to both `drawDarkness` and `drawEnemyEyes` (Story 4
  scenario 2).

---

## 5. Assembly and fast path (FR-012/FR-019) — SC-008

The `LightSource[]` is assembled **per frame at the draw call site**, never stored:

- `PlatformerState.torchPositions` keeps its `TorchLight[]` shape (no time dependency).
- Only when `darknessLevel > 0` does the render loop map torches through
  `torchLightSource(torch, worldElapsed)`, append `playerLightSource(player)`, and call the two
  passes. When `darknessLevel <= 0` no adapter runs, no list is allocated, and neither pass is
  called (FR-019/SC-008).
- No resolved radius enters a signal or store (FR-012).

---

## 6. Invariants

1. **One list, one shape** — `drawDarkness`, `localDarknessAt`, and `drawEnemyEyes` each accept a
   `readonly LightSource[]`; no consumer keeps a `torches` + `playerLight` pair (SC-002).
2. **Behavior preservation** — for the current torch/player inputs the rendered frame, local
   darkness, and eye markers are unchanged (FR-006/SC-005/SC-006).
3. **Purity** — `engine/Lighting.ts` (including `localDarknessAt`) stays pure and DOM-free; no
   `engine/ → state` edge (FR-017).
4. **Third light is data** — adding a non-torch/non-player light changes no branch in the passes
   (SC-003).
