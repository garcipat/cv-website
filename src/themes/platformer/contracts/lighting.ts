/**
 * The one light shape the platformer's darkness pass, local-darkness probe,
 * and enemy-eye pass all consume (R-003 FR-001/FR-011).
 *
 * A strict leaf: it imports nothing from `engine/`, `entities/`, `level/`,
 * state, `shared/`, or the app pages, so both `engine/` and `entities/` can
 * depend down on it without a cycle. It is type-only and erased at build.
 *
 * A light is expressed as plain data — the per-kind adapters (the torch's in
 * `entities/Torch.ts`, the player's carried light in `entities/Player.ts`)
 * resolve every time-dependent value before handing it to a pass, so a third
 * emitter is data in the list rather than a new code path (SC-003).
 */
export interface LightSource {
  /** World-space centre X, in rendered pixels. */
  x: number;
  /** World-space centre Y, in rendered pixels. */
  y: number;
  /**
   * The light's **resolved** radius, in rendered pixels — computed by the
   * per-kind adapter at the caller's `worldElapsed` (FR-002). A constant-radius
   * light (the player's carried light) and a pulsing one (a torch) both fit;
   * time lives in the adapter, never on the light or in the passes.
   */
  radius: number;
  /**
   * The light's opaque base colour, as `'rgb(r, g, b)'`. The darkness pass
   * derives the `rgba(r, g, b, α)` gradient stops from it (via `glowMidAlpha`
   * and `0`) so the exact base stop is preserved (FR-006).
   */
  color: string;
  /**
   * The overall glow `globalAlpha` multiplier (torch `1`, player `0.7`). Drives
   * only the pass's overall alpha — it does not alter the gradient stops
   * (FR-001).
   */
  intensity: number;
  /**
   * The alpha of the `0.55` gradient stop (torch `0.35`, player `0.3`) — per
   * light, so one generic glow loop reproduces each light's exact gradient
   * (FR-006).
   */
  glowMidAlpha: number;
  /**
   * `true` → the punch loop erases darkness under this light; `false` → it is
   * glow-only. Either way it still illuminates `localDarknessAt` (FR-001).
   */
  punchHole: boolean;
}
