# Phase 0 Research: Enemy Movement & Animation Seam + Bee

The spec and [design.md](./design.md) already settled the behavior: how the bee
flies, that it stomps like a green slime and pays nothing, that movement and
animation become per-kind, and that a proximity-reactive behavior ships tested
but unused. What remains are the implementation choices that turn that behavior
into code without changing a slime. These decisions were taken by reading the
current enemy modules (`EnemyType.ts`, `EnemyAnimation.ts`, `shared.ts`,
`Enemy.ts`, `engine/EnemyAI.ts`, `level/EnemyMapper.ts`, `editor/`) and the
project conventions in [docs/Architecture.md](../../docs/Architecture.md) and
[docs/TestingGuide.md](../../docs/TestingGuide.md).

There are **no outstanding NEEDS CLARIFICATION** items. Three design notes are
deliberately corrected below (D2, D8 and D12) because the spec's Success Criteria
and the actual sprite art are stricter than the design's sketch.

---

## D1 — The movement seam lives inside `entities/enemies/`, and geometry is passed in, not imported

**Decision**: Add `entities/enemies/movement/` with:

```ts
export interface MovementContext {
  level: LevelDef;
  blockedTiles: readonly { col: number; row: number }[];
  /** Player box for proximity strategies; null in headless tests / the editor. */
  player: { x: number; y: number; width: number; height: number } | null;
  /** Seconds since level start — the bob's phase clock. */
  elapsed: number;
}

export interface MovementStrategy<S extends BaseEnemyState> {
  readonly kind: 'patrol' | 'fly' | 'chase';
  step(enemy: S, ctx: MovementContext, dt: number): S;
}
```

Each strategy is a factory taking its own tuning **plus the kind's sprite and
hitbox padding**:

```ts
patrolMovement({ speedMultiplier: 1, sprite, hitboxPaddingNative })
flyMovement({ speed, bobAmplitude, bobPeriod, sprite, hitboxPaddingNative })
chaseMovement({ speed, detectRange, activeAnimState, idleAnimState })
```

The strategy computes rendered size, tile offsets and hitbox insets from the
`SpriteDescriptor` + padding it was handed — exactly the convention
`spriteSheetHitbox.ts` and `drawSpriteSheetEntity.ts` already use.

**Rationale**: `Enemy.ts` imports `ENEMY_TYPES` from `entities/enemies/index.ts`,
so any module under `entities/enemies/` that imported `Enemy.ts` (for
`enemyRenderedSize`/`enemyHitboxSidePadding`/…) or `ENEMY_TYPES` would close a
load-order cycle: `index.ts -> SlimeGreen.ts -> movement/patrol.ts -> Enemy.ts
-> index.ts`. Passing the descriptor in avoids the cycle entirely, keeps each
strategy a pure function of its inputs (the spec's testability assumption), and
mirrors the existing shared helpers' documented reason for computing geometry
locally.

**Alternatives considered**:
- *Put the strategies in `engine/enemyMovement/` (outside the enemies folder)* —
  rejected: the design places them with the kinds they belong to, and the
  engine folder already owns the type-independent hit-reaction step. Keeping
  per-kind behavior under `entities/enemies/` preserves the current "everything
  type-specific is here" split.
- *Read geometry from `ENEMY_TYPES[enemy.type]` inside the strategy* — rejected:
  same cycle, and it would make a strategy reach back into the registry it is
  registered in.
- *Add geometry to `MovementContext` instead of the config* — rejected: the
  context is per-tick data, geometry is per-kind constant; mixing them would
  force the game loop to re-derive geometry it does not otherwise need.

## D2 — `stepEnemyPatrol` is retained as a compatibility wrapper so the existing patrol tests pass unedited

**Decision**: `engine/EnemyAI.ts` keeps exporting `stepEnemyPatrol(enemy, level,
dt, blockedTiles)` with its exact current signature, reimplemented as a thin
adapter that builds a `MovementContext` (`player: null`, `elapsed: 0`) and calls
`typeOf(enemy).movement.step(enemy, ctx, dt)`. The game loop no longer calls it.
Its doc comment says it exists so the pre-seam patrol characterization
(`engine/EnemyAI.test.ts`) keeps passing without edits, and that the shared loop
now dispatches through the seam.

**Rationale**: The spec's **SC-001** explicitly requires "the existing patrol
tests pass without edits". The design's §8 says to migrate them, which would
edit them. The spec is the contract and the design is its code-level plan, so
where they conflict the spec wins. Delegating to the kind's movement makes the
wrapper produce exactly the old results for both slimes — including the purple
slime's `0.7` multiplier test — because each slime's movement **is** patrol.

**Alternatives considered**:
- *Migrate `EnemyAI.test.ts` into `movement/patrol.test.ts` (the design's §8)* —
  rejected as the primary path because it fails SC-001's literal wording. The
  same assertions and reference values are **also** added to
  `movement/patrol.test.ts`, so the parity is covered twice and the wrapper can
  be deleted later without losing coverage.
- *Keep the patrol body duplicated in both `EnemyAI.ts` and `movement/patrol.ts`*
  — rejected: two sources of truth for the exact behavior SC-001 pins.

## D3 — Per-kind animation resolution with a resting-state fallback

**Decision**: A kind's `sprite.animations` is the single source of truth.

- `EnemyAnimState` widens from `'walk' | 'hit'` to `string` (the
  `SelfAnimated.animState` capability is already `string`). The alias is kept
  for continuity with existing imports.
- `EnemyAnimation.ts` gains a resolver:
  `resolveAnimation(sprite, state, fallbackState)` returning
  `sprite.animations[state] ?? sprite.animations[fallbackState]`, and
  `enemyFrameIndex(sprite, state, frame, fallbackState)` built on it.
- `drawSpriteSheetEntity(enemy, dc, sprite, fallbackState)` resolves the frame
  through the kind's descriptor, using the kind's `defaultAnimState` as the
  fallback.
- `advanceEnemyAnimation(enemy, dt)` reads
  `resolveAnimation(typeOf(enemy).sprite, enemy.animState, typeOf(enemy).defaultAnimState)`
  and keeps its existing signature.
- `stepEnemyHitReaction` reverts to `typeOf(enemy).defaultAnimState` instead of
  the literal `'walk'`.

**Rationale**: FR-007/FR-008/FR-009. A kind that never authors a dedicated
reaction row (the bee, per the spec's assumption) must still render during its
reaction — so the fallback has to live on the **draw** path, not only on the
per-tick advance path (a freshly hit enemy is drawn before the next tick's
`advanceEnemyAnimation`). Passing the fallback explicitly keeps the resolver
honest about which kind it is resolving for.

**Alternatives considered**:
- *Store `defaultAnimState` on `SpriteDescriptor`* — rejected: the descriptor is
  a generic sprite concept shared by pickups/blocks/chests; a kind-level default
  belongs on `EnemyType`.
- *Fall back inside `advanceEnemyAnimation` only* — rejected: the editor preview
  and the first post-hit frame draw before any advance runs.
- *Keep `enemyFrameIndex(animState, frame)` reading `ENEMY_ANIMATIONS`* —
  rejected: that is exactly the shared-table behavior this feature removes.

## D4 — `baseEnemyState`/`baseRevive` take the kind's default state and animations

**Decision**: Change `shared.ts` to:

```ts
export interface EnemyBaseConfig {
  maxHitPoints: number;
  hitReactionSeconds: number;
  defaultAnimState: string;
  animations: SpriteDescriptor['animations'];
}
baseEnemyState(placement, index, config): Omit<BaseEnemyState, 'type'>
baseRevive(enemy, config): Omit<BaseEnemyState, 'type'>
```

`animState` is seeded to `config.defaultAnimState`; the per-enemy animation
stagger is `index % config.animations[config.defaultAnimState].frames.length`
and `(index * 0.05) % frameDuration`. `walkAnimFrameCount()` becomes unused and
is removed (with its `Enemy.ts` re-export); `WALK_FRAME_DURATION` stays as the
slime table's frame duration.

**Rationale**: The current stagger is hardcoded to the `walk` loop. The bee's
resting loop is `fly` with a different frame count; seeding `walk` and
staggering by the walk length would both be wrong for it. Threading the kind's
own state/table through keeps one stagger implementation for every kind.

**Alternatives considered**:
- *Add `defaultAnimState` but keep staggering by `walk`* — rejected: a kind
  without a `walk` row would break, and it silently assumes every kind walks.
- *Have each kind compute its own initial frame in `create`* — rejected: it
  duplicates the stagger formula per kind, which is the coupling this seam
  removes.

## D5 — Bee tuning defaults (game feel, adjustable in implementation)

**Decision**: Ship the bee with:

| Knob | Value | Reason |
| --- | --- | --- |
| `sprite.renderScale` | `1` | The cell is `24px * RENDER_SCALE(2) * 1 = 48px`; the visible bee is ~38×24 px, smaller than a slime's silhouette, so the render scale may be raised after the browser check. |
| `animations.fly.frames` | `[32, 33, 34, 35, 36, 37, 38, 39]` | Row 5 of the 8×7 bee sheet = the neutral flight loop (design §5). |
| `animations.fly.frameDuration` | `0.12` | Flutter faster than a slime's 0.15 walk; game feel. |
| `speed` | `70` px/s | A little faster than a slime's 60; game feel. |
| `bobAmplitude` | `6` px | ~⅕ tile — clearly visible, never leaves the lane. |
| `bobPeriod` | `1.4` s | One slow, readable cycle. |
| `hitboxPaddingNative` | `{ side: 3, top: 7, bottom: 5 }` | Measured from the fly frames (row 5: art x=3..21, y=7..18 in the 24×24 cell); an insect reads tighter than a slime, and the bottom inset anchors the floating art (FR-019). |
| `bodyAlpha` | `1` | The bee is opaque; the shared blit's slime alpha (0.78) exists so a held key shows through, which the bee has no reason to inherit. |

No `hit` row is authored: FR-009's fallback makes the bee reuse `fly` during its
reaction (the spec's stated assumption). If the sheet turns out to have usable
reaction frames during implementation, a `hit` row is a one-line addition to the
bee's `animations` and nothing else changes.

**Rationale**: The spec explicitly defers tuning to implementation ("Bee tuning
is game feel"). Pinning starting values keeps the plan concrete while leaving the
numbers in one config object to adjust after the manual browser check.

**Alternatives considered**:
- *Reuse the green slime's `hitboxPaddingNative`* — rejected: the bee's fly
  frames have different transparent margins; padding is a measured per-sheet
  value (see `EnemyType.hitboxPaddingNative`'s existing doc comment).
- *A dedicated `hit` row from the sheet* — deferred, not rejected: the fallback
  covers it, and the sheet's rows are still being confirmed (design §9).

## D6 — The bee's level marker is `q`

**Decision**: `ENTITY_CHARS['q'] = 'enemyBee'`, `EntityKind += 'enemyBee'`,
`TileChar += 'q'`, `findBeeTiles`, `BEE_TILES`. `q` is free across all maps
(`TERRAIN_CHARS`, `ENTITY_CHARS`, `SIGN_CHARS`, `HAZARD_CHARS`,
`BACKGROUND_CHARS`); `b` is already the bomb pot (O-012), as the spec's
assumption notes.

**Rationale**: FR-014 requires only that the character collides with nothing —
the module-load guard in `LevelParser.ts` would throw if it did. The author chose
`q` because its glyph reads as a bee (the tail suggests a stinger), and it keeps
every existing character untouched.

**Alternatives considered**:
- *`z` (the next free lowercase letter)* — rejected by the author: it reads as
  nothing in particular, whereas `q` suggests the insect.
- *`Z` (uppercase)* — rejected: uppercase letters are visually reserved for the
  "big" entities (spawn, chest, checkpoint); lowercase reads as a minor pickup
  or enemy, matching `m`/`o`/`u`/`p`/`b`.
- *Renaming the bomb pot off `b`* — rejected: out of scope and a breaking
  level-format change for no benefit.

## D7 — `EnemyDef['type']` widens to the registry key via a type-only import

**Decision**: `types.ts` declares

```ts
import type { EnemyTypeKey } from './entities/enemies';
export interface EnemyDef { id: string; type: EnemyTypeKey; fact?: CollectedFact; }
```

and `BaseEnemyState.type` / `EnemyPlacement.type` inherit the widened union.

**Rationale**: Today `EnemyDef['type']` is the literal union
`'slimeGreen' | 'slimePurple'`, which would reject the bee's placement before
the registry even sees it. Deriving the union from `ENEMY_TYPES` means a new
kind never edits `types.ts` again — one less per-kind cost, directly serving
FR-018. The import is `import type`, so it is erased at compile time and creates
no runtime edge from `types.ts` back into the registry (the cycle would be
`types -> enemies/index -> SlimeGreen -> EnemyType -> types`, all of which are
type-only except the registry's own runtime exports, which `types.ts` never
loads).

**Alternatives considered**:
- *Hand-widen the union to `'slimeGreen' | 'slimePurple' | 'bee'`* — rejected:
  it is exactly the per-kind edit FR-018 wants to eliminate, and it can silently
  drift from the registry.
- *Type `EnemyDef.type` as `string`* — rejected: it discards the compile-time
  guarantee that a placement names a registered kind.

## D8 — The game loop keeps `onTick` + `advanceEnemyAnimation` for hit enemies too

**Decision**: The per-enemy step becomes:

```ts
const movementCtx: MovementContext = {
  level: currentLevel.value,
  blockedTiles,
  player: playerState.value,
  elapsed: worldAnimElapsed,
};

const stepEnemy = (enemy: EnemyState): EnemyState => {
  const moved =
    enemy.animState === 'hit'
      ? stepEnemyHitReaction(enemy, dt)
      : typeOf(enemy).movement.step(enemy, movementCtx, dt);
  return advanceEnemyAnimation(typeOf(moved).onTick?.(moved, dt) ?? moved, dt);
};
```

i.e. the existing pipeline (reaction-or-patrol, then `onTick`, then animation) is
preserved exactly, with only the "patrol" slot replaced by the kind's movement.

**Rationale**: The design's §4.1 snippet drops `onTick` and
`advanceEnemyAnimation` from the hit branch. That would stop a purple slime's
spike cooldown and freeze the hit-reaction animation mid-flash — a behavior
change the spec forbids (SC-001, "slimes are unchanged"). The design's snippet is
a sketch; this plan keeps the real pipeline.

`movementCtx.player` is the live player box (`x/y/width/height`), so the chase
strategy is reactive; headless tests pass `null`. `elapsed` is the existing
`worldAnimElapsed` counter that already freezes with the world during
pause/death — so the bee's bob freezes with everything else and resumes on the
same phase, satisfying the spec's "the bob's rhythm continues from elapsed time
rather than restarting" edge case.

**Alternatives considered**:
- *Follow the design snippet literally* — rejected: it regresses slime behavior.
- *A per-tick `elapsed` signal* — rejected: `worldAnimElapsed` already exists,
  is already frozen on pause, and is read by the renderer; a second clock would
  invite drift.

## D9 — Where the fly strategy checks walls, and why it does not check ledges

**Decision**: `flyMovement` shares one horizontal helper with `patrolMovement`
(`stepHorizontal({ speed, checkLedges, sprite, hitboxPaddingNative, anchorY })`):
the same wall / `patrol`-tile / live-blocked-tile reversal and edge snapping,
parameterized on whether the "no solid ground ahead" test runs and on which world
Y the row test anchors to. Patrol passes `anchorY: enemy.y` and `checkLedges:
true`; fly passes `anchorY: enemy.homeY` and `checkLedges: false`. The horizontal
test anchors on the **placement row** (`Math.round(homeY / RENDERED_TILE_SIZE)`)
and checks every row the silhouette spans from that anchor — the bob never
changes which tiles block the bee.

**Rationale**: FR-004/FR-005/FR-006. Sharing the helper is what makes SC-001's
"identical turn points" true for slimes (the patrol branch is the old body
verbatim). Anchoring on the placement row keeps the flight lane stable: deriving
the row from the bobbed `y` would make a wall at the top of the arc block the
bee only at certain phases, which reads as erratic and is untestable as a
"reverse at a wall" rule. The bee is non-solid and its bob never affects
terrain collision (spec assumption), so a wall tile above the placement row is
not a barrier.

**Alternatives considered**:
- *Anchor the horizontal check on the current bobbed row* — rejected: phase-
  dependent blocking, as above.
- *Check ledges anyway but only for the placement row* — rejected: that is the
  ledge check; FR-005 requires the bee to cross gaps.

## D10 — Editor wiring for the bee is the existing per-kind cost

**Decision**: `editor/paletteTiles.ts` gains a `q` entry (a bee fly-frame crop,
`PALETTE_TILE_LABELS['q'] = 'Bee'`, a description); `gridRenderState.ts` adds
bee synthesis from `q`; `EditorCanvas.tsx`'s `EditorImages` gains `bee` and the
draw context's `sprites` map gains `[BEE_SHEET.src]: images.bee`;
`EditorCanvasPane.tsx` gains `EMPTY_IMAGES.bee` and an `IMAGE_SOURCES` entry.
The palette *button* needs no code — `Palette.tsx` derives its entity section
from `ENTITY_CHARS`.

**Rationale**: FR-015 and SC-007. These are the same files every prior marker
kind touched (see [docs/themes/platformer/Enemies.md](../../docs/themes/platformer/Enemies.md)'s
"Required — the editor palette"); no new editor mechanism is introduced.

**Alternatives considered**:
- *Load the bee sheet through a generic `ENEMY_TYPES` walk in the editor* —
  rejected: the editor already hand-maps its images for testability and jsdom;
  changing that is a separate editor feature, out of scope.

## D11 — The shipped level gains exactly one bee, over a gap

**Decision**: Add one `q` marker to `LEVEL_1_LAYOUT` over the open pit in Zone D
(the `...` gap in the base ground row), two rows above the ground so the bee
flies across the gap a slime would turn at. Update the layout's own marker
legend comment (`z 1 bee`) and `level.ts`'s doc comment.

**Rationale**: User Story 1 is a visitor *meeting* a bee over a gap, and the
constitution requires a manual browser check for visible behavior — neither is
possible if no shipped level contains one. One marker is the minimum that makes
the feature observable end-to-end; more is level design, not this feature.

**Alternatives considered**:
- *Ship no bee, verify only in the editor* — rejected: the editor preview is
  static (`worldElapsed = 0`), so it cannot show the bob or the flight, and the
  browser check would have nothing to look at.
- *Place several bees across zones* — rejected: scope; the spec asks for "a bee",
  and tuning is better done against one.

## D12 — The enemy frame inset gains a bottom margin (FR-019)

**Decision**: Widen `hitboxPaddingNative` from `{ side, top }` to
`{ side, top, bottom }`, add `enemyHitboxBottomPadding(type)` in `Enemy.ts`, and use
the bottom inset in both `spriteSheetHitbox` (box bottom = visible art bottom) and
`drawSpriteSheetEntity` / `enemyTileOffsetY` (shift the frame down so the visible art
rests on the placement row). The slimes declare `bottom: 0`, which reproduces today's
box and draw exactly.

**Rationale**: Measured against the sheets, the slimes' art is bottom-anchored
(bottom gap 0), but the bee's art floats in its cell (bottom gap ~3–5 native px on the
fly row). Without a bottom inset the bee's collision box would extend below its visible
body — hitting the player with empty space — and the bee would render ~10 px above its
placement row. FR-019/SC-009 make the box and anchor track the visible art for every
kind.

**Alternatives considered**:
- *Repack `bee.png` so its art is bottom-anchored like the slimes* — rejected by the
  author: the sprite stays as authored, and the engine should not assume every sheet
  packs art to the frame edge.
- *Add a per-kind `renderOffsetY`/content inset to `SpriteDescriptor`* — rejected: the
  transparent margin is already `hitboxPaddingNative`; splitting the anchor from the box
  would let them drift apart.
- *Keep `{ side, top }` and shrink the box from the top only* — rejected: the box's
  bottom edge is fixed at the frame bottom, so it cannot be pulled up to the art's
  bottom without a bottom inset.

---

## Testing decisions (Phase 0 → Phase 1 boundary)

- **Patrol parity** is asserted twice: `engine/EnemyAI.test.ts` unchanged
  (SC-001) and the same reference values in `movement/patrol.test.ts` against the
  strategy directly.
- **Fly** is asserted for the three spec-visible properties: bounded amplitude,
  periodicity returning to `homeY`, wall/`patrol` reversal with snapping, and
  **no reversal over a gap** (SC-002/SC-003).
- **Chase** is asserted idle with `player: null` / out of range and pursuing +
  facing when in range (FR-016).
- **Animation** is asserted for per-kind frames and the `defaultAnimState`
  fallback (FR-007/FR-009), including a kind whose table lacks the requested row.
- **Frame inset / anchoring** is asserted for a non-zero bottom inset (box bottom
  edge = visible art bottom edge; the sprite is drawn anchored on its row) and for
  slime parity at `bottom: 0` (SC-009).
- **Contract** (`movement/contract.test.ts`) asserts every `ENEMY_TYPES` entry
  declares a `movement` and a `defaultAnimState` present in its own table
  (FR-017/SC-006), and exercises a **fixture `EnemyType`** with its own movement
  and animation through the shared pipeline (movement step → `onTick` →
  `advanceEnemyAnimation` → `drawSpriteSheetEntity`) to prove FR-018/SC-005.
- **Bee combat** is asserted against the same outcomes `EnemyContact.contract.test.ts`
  pins for a green slime (stomp bounce, side damage + knockback, inert while
  reacting), and the shared contract file is left unchanged.
- **Authoring** is asserted in `LevelParser.test.ts` (char + finder + `TileChar`
  sync), `EnemyMapper.test.ts` (plain placement), `paletteTiles.test.ts`,
  `gridRenderState.test.ts`, and `EditorCanvas.test.tsx`.
- **Progress exclusion** is asserted in `PlatformerState.test.ts`
  (`levelTotals.enemies` / `enemiesDefeated` unchanged by a bee) and in
  `PlatformerPage.test.tsx` (SC-008).
