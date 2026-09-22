# Contract: `movement/fly.ts` (`kind: 'fly'`)

The bee's behavior: **horizontal patrol with no ledge check** plus a **vertical
bob** around the placement row (FR-004/FR-005/FR-006). Shares the horizontal
wall/`patrol`-tile reversal helper with patrol, parameterized on whether the
ledge check runs (research D9).

## Factory

```ts
export interface FlyMovementConfig {
  /** Absolute horizontal speed, px/s. */
  speed: number;
  /** Maximum vertical deviation from homeY, px. */
  bobAmplitude: number;
  /** Seconds for one full bob cycle. */
  bobPeriod: number;
  sprite: SpriteDescriptor;
  hitboxPaddingNative: { side: number; top: number; bottom: number };
  /** State set while flying; defaults to 'fly'. */
  animState?: string;
}

export function flyMovement<S extends BaseEnemyState>(
  config: FlyMovementConfig,
): MovementStrategy<S>;
```

## Behavior

**Horizontal** — identical to patrol's horizontal half except the ledge test is
**skipped**:

- Advance by `±speed * dt` in `enemy.direction`.
- Reverse at a static solid tile, a `'patrol'` tile, or a live `ctx.blockedTiles`
  cell at any row the silhouette spans from the **placement row**
  (`Math.round(enemy.homeY / RENDERED_TILE_SIZE)`), snapping the visible leading
  edge exactly to the obstacle. The bob does **not** change the row used for the
  blocking test. Concretely, fly calls the shared
  `stepHorizontal({ speed, checkLedges: false, sprite, hitboxPaddingNative, anchorY: enemy.homeY })`;
  patrol passes `anchorY: enemy.y`. The `anchorY` input is what lets one helper
  serve both a bobbed and a non-bobbed kind.
- **Never** reverse at a gap in the ground: no "no ground ahead" test.
- Narrow lane on both sides → stand still, same as patrol.

**Vertical** — a pure function of the shared clock:

```text
y  = homeY + bobAmplitude * sin(2π * elapsed / bobPeriod)
vy = bobAmplitude * (2π / bobPeriod) * cos(2π * elapsed / bobPeriod)
```

- At `elapsed = 0` and every whole period, `y = homeY` exactly — the bob returns
  to the placement row each cycle instead of drifting (FR-006).
- `|y - homeY| <= bobAmplitude` for all `elapsed` (SC-003).
- Because the phase comes from `elapsed` (the world clock), a bee frozen by a
  hit resumes on the same phase afterwards rather than restarting (spec edge
  case).

`animState` is set to `config.animState ?? 'fly'`.

## Invariants (asserted by `movement/fly.test.ts`)

1. Over open ground, moving right/left: `x` advances by `±speed * dt`.
2. A gap in the ground ahead: **keeps moving** — unlike patrol, which reverses
   (`stepHorizontal` with `checkLedges: false`).
3. A wall / `patrol` tile / live blocked cell ahead: reverses and snaps like
   patrol.
4. At `elapsed = 0`, `y === homeY`; at `elapsed = bobPeriod`, `y === homeY`
   again (within floating-point tolerance).
5. Over a full period sampled every tick, `|y - homeY| <= bobAmplitude` and the
   maximum equals `bobAmplitude` at the quarter-period (SC-003).
6. `vy` equals the analytic derivative at sampled points (or, at minimum, has
   the right sign and returns to zero at the extremes).
7. `dt <= 0` returns the input state; `ctx.player` is ignored.
