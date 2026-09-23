# Phase 0 Research: Platformer Crouch/Duck

The spec's Clarifications session settled six behavioural questions: the
stand-up gate, the stationary pose, the crawl speed, the onboarding fallback,
the **no-knockback crouched hit** (FR-011), and the **render-time red tint**
(FR-016). The decisions below cover the remaining implementation choices,
including the one ambiguity the spec's FR-005/FR-006 wording leaves open (Down
held while crawling out from under a ceiling), the exact geometry the reduced
box uses, and the two newly added requirements' mechanics (D13–D14).

## D1 — Crouch resolution is a pure module, called early inside `stepPlayerPhysics`

**Decision**: Add `engine/Crouch.ts`, a pure, canvas-free, DOM-free module
(mirroring `engine/Lighting.ts` / `level/Terrain.ts`) exporting:

- `CrouchContext` — the plain inputs to the decision.
- `canStandUp(level, blocks, player): boolean` — the headroom test.
- `resolveCrouching(ctx: CrouchContext): boolean` — the next `crouching` value.

`stepPlayerPhysics` calls `resolveCrouching` **before** its horizontal
collision pass, because the crouched box changes which rows the horizontal wall
scan covers (see D4). It then threads the resolved boolean through the box
geometry, speed and jump checks, and writes it back on every return path.

**Rationale**: Crouch is a decision about one frame's movement, so it belongs
in the movement step, not in the renderer or the game-loop orchestration. A
pure module keeps the headroom test and the priority rule exactly unit-testable
with Vitest and no DOM (constitution Principle II;
[docs/TestingGuide.md](../../docs/TestingGuide.md)), and keeps `Physics.ts`
from growing another `switch`.

**Alternatives considered**:

- *Compute crouch in `PlatformerPage.tsx` and pass it into physics* — rejected:
  the headroom test needs the level grid, block placements and the player's
  exact box geometry, all of which physics already owns; the loop would have to
  duplicate the geometry and the ladder/bridge context to decide it correctly.
- *A `Crouch` capability interface like `Moving`/`Damageable`* — rejected:
  crouch is a single boolean plus two pure functions, not an entity family; a
  capability would add indirection with no second implementer.

## D2 — One new stored field: `PlayerState.crouching`

**Decision**: Add `crouching: boolean` to `PlayerState` (required, default
`false`). Both player-state factories set it `false`:
`PlatformerState.ts`'s `playerStateAtTile` and
`editor/gridRenderState.ts`'s `synthesizePlayerState`. All existing test
fixtures that construct a full `PlayerState` literal gain `crouching: false`.

**Rationale**: The state must survive across ticks (a held crouch, a forced
crouch under a ceiling, an airborne crouch retained after walking off a ledge),
so it cannot be derived from a single tick's inputs. Session-scoping falls out
of the existing reset seams: `resetGame()` assigns `respawnPlayerState`, which
is built by `playerStateAtTile`, so a respawn/checkpoint/reset/theme switch
returns `crouching: false` for free (FR-012).

**Alternatives considered**:

- *Make `crouching` optional* — rejected: the codebase's `PlayerState` fields
  are all required, and an optional field would let a new factory silently
  forget it; a required field makes the compiler enumerate every construction
  site.
- *Persist crouch in a signal of its own* — rejected: it is player motion
  state, exactly like `climbing`/`isDroppingThroughBridge`, and belongs on
  `PlayerState`.
- *Represent crouch only as an `animState` value, with no `crouching` flag* —
  rejected: `animState` is presentation-only (which sprite frames to draw) and
  cannot drive the collision box, crawl speed or the jump gate. Worse, a hit
  reaction sets `animState: 'hit'` while the box must stay one tile (FR-011),
  and `death`/`hit` override the animation entirely, so the physics mode would
  be lost. `crouching` is the mode flag and `'crouch'` is the derived pose, the
  same split as `climbing` + `'climb'` (see D7). This split is also what lets
  the renderer tell a crouched hit (`crouching && animState === 'hit'`, D14)
  from a standing one.

## D3 — One shared box geometry; `playerHitbox` and `Physics` both read it

**Decision**: Add to `entities/Player.ts`:

- `PLAYER_CROUCH_BOX_HEIGHT = RENDERED_TILE_SIZE` (32 rendered px).
- `playerHeadPaddingFor(crouching: boolean): number` — `PLAYER_HEAD_PADDING`
  (18) standing, `PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING -
  PLAYER_CROUCH_BOX_HEIGHT` (24) crouched.
- `playerBoxHeightFor(crouching: boolean): number` — 38 standing, 32 crouched.

`Collision.ts`'s `playerHitbox(player)` uses these with `player.crouching`;
`Physics.ts`'s horizontal/ceiling/ground scans use them with the *resolved*
`crouching` for the tick; `DebugOverlay.ts`'s head line uses
`playerHeadPaddingFor(player.crouching)`.

**Rationale**: The spec's SC-008 demands that *every* consumer of the player's
box see the crouched height and none keep the standing height. The only way to
guarantee that is a single source of truth for the two numbers. Today
`Collision.playerHitbox` and `Physics.ts` independently recompute the same box
from the same constants; crouch is the first change that could make them
diverge, so the shared helpers are introduced now. The feet line
(`y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING`) is deliberately **not**
part of the helper: it is unchanged by crouch (spec Assumption: the feet do not
move), and every existing feet-row computation stays valid.

**Alternatives considered**:

- *Change only `playerHitbox` and leave `Physics.ts` alone* — rejected: the
  terrain collision box would stay 38 px tall, so the character could not fit
  under a one-tile ceiling at all; the feature would not work.
- *Change only `Physics.ts` and leave `playerHitbox` alone* — rejected:
  triggers/pickups/enemies/hazards/stomp/blast would keep using the 38 px box,
  violating FR-002/SC-008.
- *Put a `playerCollisionBox(player): Box` in `Player.ts`* — rejected: `Box` is
  declared in `Collision.ts`, and `Collision.ts` already imports from
  `Player.ts`; importing `Box` back would create a cycle. Two scalar helpers
  avoid it.

## D4 — Crouched geometry: 32 px tall, feet fixed, top offset 24

**Decision**: While crouched, the box is `PLAYER_RENDERED_SIZE`-independent:
top at `feetY - 32`, height 32, width unchanged (`PLAYER_RENDERED_SIZE -
2 * PLAYER_SIDE_PADDING` = 24). Concretely, for a character standing on a tile
top at `y_feet`: standing box spans `[y_feet - 38, y_feet)`; crouched box spans
`[y_feet - 32, y_feet)`. The crouched box therefore occupies exactly the single
tile row directly above the floor, and the standing box additionally reaches
into the row above that.

**Rationale**: This is the pixel-level meaning of the spec's "one tile tall"
and "the feet do not move", and it makes the stand-up gate arithmetic exact:
under a corridor whose ceiling is exactly one tile above the floor, the
crouched box fits with no overlap while the standing box overlaps the ceiling
row. It also leaves the feet-row/`prevFeetY`/`lastGrounded`/ground-collision
maths completely untouched, so S-008 ladders and bridge drop-through cannot be
perturbed by the change.

**Alternatives considered**:

- *Shrink the render slot instead of the box* — rejected: the sprite is drawn
  at the render slot's top-left (`Renderer.drawPlayer`), and moving it would
  move the feet; the spec requires the feet to stay put.
- *A 32 px box anchored at the render-slot top* — rejected: it would lift the
  feet by 6 px and break every ground/ledge interaction.

## D5 — The headroom test: the full *standing* box, checked per frame

**Decision**: `canStandUp(level, blocks, player)` returns true only when the
**full standing box** (38 px, `playerHeadPaddingFor(false)` /
`playerBoxHeightFor(false)`) overlaps no solid terrain tile and no live block
across every column the hitbox spans. It uses `isSolid` (so a `bridge` counts as
an obstruction) and `isBlockOccupied`, and is evaluated once per tick against
the pre-step position.

**Rationale**: The spec's clarification explicitly says a one-tile gap is not
enough, and the standing box is taller than one tile — so the test must use the
standing box, not "is there a tile of space". `isSolid` is the same predicate
terrain collision uses, so "no solid overlap" is unambiguous. `bridge` is
included because the standing box must not be allowed to overlap a bridge tile
either; the low corridor's ceiling is ordinary ground, so this is conservative
but correct. Evaluating once against the pre-step position is the standard
discrete-collision convention used everywhere else in `Physics.ts`, and it can
never stand the character into a solid tile: the horizontal scan blocks a
standing box from entering a ceiling row, and the ceiling scan blocks a standing
head from rising into one.

**Alternatives considered**:

- *Test only the single tile directly above the head* — rejected: the standing
  box is 38 px, spanning more than one row; a one-tile gap would pass and the
  character would overlap the ceiling.
- *Use `isSolidExcludingBridge`* — rejected: a bridge above the head is still a
  tile the standing box would overlap; treating it as clear space would let the
  box intersect it.
- *Re-check after the vertical move and stand post-move* — rejected as
  unnecessary: it complicates the box used for the tick and can only differ by
  one frame from the pre-step check.

## D6 — Down priority: ladder descent > bridge drop-through > crouch

**Decision**: `input.dropThroughHeld` (Down / `S`) keeps its two existing
meanings and gains crouch as the **lowest-priority** third. Before resolving
crouch, `stepPlayerPhysics` computes a `downClaimed` flag from the existing
context checks against the pre-step position:

1. already climbing (`player.climbing`); or the feet row is climbable **while
   airborne** (a fall past a ladder); or grounded with the row below the feet
   climbable (the S-008 re-enter case);
2. grounded and the standing foot row holds a `bridge` under the hitbox columns
   (the existing drop-through trigger).

Note the "already crouched" exclusion: a crouched character keeps Down as
crouch. The bridge drop-through and `downClaimed`'s bridge term both require
`!player.crouching`, so crawling onto a bridge stays crouched instead of popping
the character up and dropping it. Standing on a bridge and pressing Down still
drops (the state at press time is standing). Releasing Down to stand, then
pressing again, drops from a crouch. This is the same "crouch is sticky while
held" idea as the ladder-base fix below.

Note the grounded-overlap exclusion: a grounded player whose body merely
overlaps a ladder tile — standing at the ladder's base, or crawling past it —
has solid ground below the feet, not a ladder, so it does **not** claim Down
(FR-009). The climb branch's fresh-entry condition is tightened the same way
(grounded + Down requires a ladder below), so the two agree and the character
crouches instead of grabbing the ladder. This was a bug fix: the original
`downClaimed`/entry claimed Down on any feet-row ladder overlap, so holding Down
to crawl past a ladder popped the character out of the crouch and into a climb.

If `downClaimed`, Down does not request a crouch. The ladder and bridge branches
keep their timing, speed and priority; the only behavioural change is the
fresh-entry guard above (grounded + Down needs a ladder below), which fixes the
crawl-past-a-ladder bug without touching the descend/ascend mechanics themselves
(SC-003).

**Rationale**: The spec's User Story 3 and FR-009 make this ordering
non-negotiable. Reusing the existing `dropThroughHeld` input and the existing
context predicates keeps one definition of each Down meaning and means no new
key, no new input field, and no change to `Input.ts`/`PlatformerPage.tsx`'s
input wiring. Computing the context flags early (from the pre-step position) is
required because the crouch decision precedes the horizontal collision pass;
using the pre-step position is correct because the character is already on the
ladder/bridge before the tick begins.

**Alternatives considered**:

- *Resolve crouch after the horizontal pass* — rejected: the horizontal wall
  scan would then use the standing box while crouched under a ceiling, blocking
  the very crawl the feature exists to allow.
- *A new `crouchHeld` input field bound to the same key* — rejected: it
  duplicates the key binding and would need a second place to keep in sync;
  `dropThroughHeld` already means "Down is held".

## D7 — Entry, retention, and the FR-005/FR-006 interpretation

**Decision**: `resolveCrouching` is:

```
if (inHitReaction)              return currentlyCrouching;   // FR-011 freeze (D8/D13)
const requested = downHeld
  && (grounded || currentlyCrouching)
  && !downClaimed;                                          // FR-001/FR-009/FR-010
return requested || (!canStand && currentlyCrouching);      // FR-005/FR-006
```

The `&& currentlyCrouching` term on the forced branch matters: `!canStand` can
only *keep* an existing crouch, never start one. A crouch is always entered via
Down (FR-001); a standing character whose standing box is obstructed (an
unreachable state in practice, since the horizontal/ceiling scans prevent
entering such a spot standing) is not silently forced down.

Resulting behaviour:

- **Fresh entry** needs `grounded` (FR-010): holding Down mid-air with no prior
  crouch does nothing.
- **Retention while airborne**: once crouched, holding Down keeps the crouch
  through a fall and the landing (spec Edge Case), because `currentlyCrouching`
  satisfies the `grounded || currentlyCrouching` term.
- **Release mid-air** stands the character up before it lands (FR-010): the
  `requested` term goes false and `canStand` is true in open air.
- **Stuck under a ceiling**: `!canStand` keeps the crouch even with Down
  released, until headroom returns (FR-005).
- **Auto-stand**: the frame `canStandUp` first returns true, `!canStand` goes
  false and the character stands without any Down release being required
  (FR-006).

**Documented interpretation of FR-006's "whether or not Down is still held"**:
if Down is *still held* when headroom returns, FR-001 ("crouch while grounded
and Down is held") keeps the character crouched rather than popping to standing
and instantly re-crouching. This is the only reading that satisfies both FR-001
and FR-006 simultaneously without a one-frame height flicker; every acceptance
scenario in the spec passes under it (US2.2's auto-stand is the Down-not-held
case, US2.3 is the still-under-ceiling case). It is recorded here rather than
left implicit.

**Rationale**: The rule is a two-term boolean, so it is trivially unit-testable
and has no hidden state machine. Splitting "requested" (voluntary, needs
grounded) from "forced" (`!canStand`) is what lets the airborne-retention and
stuck-crouch rules coexist.

**Alternatives considered**:

- *A literal FR-006 reading that auto-stands even while Down is held* —
  rejected: it produces a visible stand/re-crouch pop on open ground and
  contradicts FR-001's unconditional "crouch while Down is held".
- *A latch that ignores Down until it is released after an auto-stand* —
  rejected: extra state with no spec requirement, and it would make a held Down
  behave inconsistently at different ceilings.

## D8 — Hit reactions freeze the crouch (FR-011)

**Decision**: While the player's post-hit refractory window is open
(`isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)`, which covers both a
directional knockback and a pit fall's `beginPitFallReaction`), `resolveCrouching`
returns `currentlyCrouching` unchanged. The crouch box is therefore kept for
the whole reaction and can never be forced open into a ceiling by a hit.

**Rationale**: FR-011 and the "Taking a hit while crouched" edge case require
the one-tile box for the duration of the reaction. Freezing on the existing
invulnerability window needs no new timer and is exactly the reaction's
duration; `hit`'s sprite flash/blink is unaffected because it is driven by
`hitTimer`/`animState`, not by `crouching`. D13 supplies the matching
no-knockback helper that *starts* that window for a crouched directional hit,
so the freeze and the no-knockback rule share one `hitTimer` source of truth.

**Alternatives considered**:

- *Re-evaluate crouch normally during a hit* — rejected: a knockback that moves
  the character out from under a ceiling would stand it mid-reaction, violating
  FR-011's "the one-tile collision box is kept for the whole reaction".
- *A dedicated `crouchLockTimer`* — rejected: duplicates the reaction window.

## D9 — Crawl speed and jump disable

**Decision**: Add `crouchSpeed: 120` to `PHYSICS_CONFIG`. In
`stepPlayerPhysics`, the input-driven horizontal speed is
`crouching ? PHYSICS_CONFIG.crouchSpeed : PHYSICS_CONFIG.walkSpeed`; knockback
still overrides both. The jump trigger gains `&& !crouching`, so Jump does
nothing while crouched (FR-004).

**Rationale**: The spec's clarification fixes ~120 px/s (60% of 200). 120 is
already the established "deliberate pace" value (`climbSpeed`), and the
tunneling invariant holds (`120 * (1/30) = 4 < 32`), matching the documented
contract on every velocity constant in `PhysicsConfig.ts`. Disabling the jump
in the movement step (rather than the loop) keeps the rule next to the box that
causes it.

**Alternatives considered**:

- *Scale `walkSpeed` by a multiplier at the call site* — rejected: a named
  `crouchSpeed` matches how `climbSpeed`/`enemyPatrolSpeed` are expressed and
  keeps tuning in one file.

## D10 — Animation: a `'crouch'` state on a dedicated DUCK row

**Decision**: Add `'crouch'` to `PlayerAnimState`, with
`ANIM_CONFIG.crouch = { frameCount: 4, frameDuration: 0.12, sy:
PLAYER_FRAME_SIZE * 8 }`. `updatePlayerAnimState` derives `'crouch'` whenever
`player.crouching` (after the `hit` stickiness and the `climb` check, before
the airborne/walk/idle checks). `advancePlayerAnimation` freezes `'crouch'`
while `player.vx === 0` (mirroring its existing freeze of `climb` while
`vy === 0`), so the duck pose is held still while stationary and loops its four
frames only while crawling (FR-008). `Renderer.drawPlayer` now needs **one**
edit rather than none: when `player.crouching && player.animState === 'hit'` it
must draw this same `'crouch'` frame source through the render-time tint (see
D14). For every other state the existing primary-sheet `playerFrameSource` path
with `PLAYER_FRAME_SIZE` is unchanged.

**Rationale**: The first attempt reused the sheet's unused ROLL row (row 5),
but in the browser those tucked/ball frames read as standing and bobbed (their
heights differ). A dedicated four-frame duck row — drawn low and horizontal
with a constant head/torso height — reads unmistakably as a duck/crawl. It is
appended as the sheet's 9th row (row 8, sheet now 256×288) so no existing
animation's frames change; the frames sit with feet 4px above the cell bottom,
matching every other row. `frameCount` 4 loops 0→1→2→3. Putting `crouch` before
the airborne check is what keeps the crouched pose during a fall (spec Edge
Case). `frameDuration` 0.12 is a starting tune between `walk`'s 0.08 and `idle`'s
0.15. `updatePlayerAnimState`'s existing `hit` stickiness still wins while the
reaction window is open, so a crouched hit's `animState` stays `'hit'`; the
renderer uses the orthogonal `crouching` flag to choose the crouch pose, which
is exactly why D2 kept the two as separate fields.

**Alternatives considered**:

- *Drive the crouch frame from a separate counter / `worldElapsed`* —
  rejected: the `animFrame`/`animTimer` pair already exists and is reset by
  `updatePlayerAnimState` on every state change, so a state switch never
  carries a stale frame.
- *Freeze the crawl animation entirely* — rejected: FR-008 requires the pose to
  animate while crawling.

## D11 — Onboarding: the legend caption is primary; the sign is a documented fallback

**Decision**: Add `controlsOverlay.crouch` to `en.json`/`de.json` and render a
second caption inside the arrow cluster's own width in
`ControlsOverlay.tsx` (the `move` caption shifts left to make room), following
the file's existing absolutely-positioned caption pattern. If the browser check
shows the caption crowds the legend in either locale, the fallback is the
existing S-009 sign mechanism: add `crouch` to `platformer.hints`, map sign
character `7` to it in `LevelParser.ts`'s `SIGN_CHARS`/`TileChar`, and place a
`7` marker beside the low corridor. The two placements are alternatives, never
both (FR-015, SC-007).

**Rationale**: The spec's clarification picks the legend caption as the primary
teaching surface and reserves the sign for genuine crowding. Adding a JSON key
to `en.json` automatically widens `Translation`/`HintId` (`translations.ts`
derives them from `en.json`), and `de.json` must be updated to match because it
is typed as `Translation`.

**Alternatives considered**:

- *Always add a sign instead of touching the legend* — rejected by the
  clarification (the legend is the preferred surface, and it already pictures
  the arrow cluster including Down).
- *Append "Crouch" to the existing `move` caption* — rejected: FR-015 calls for
  the Down/crouch caption specifically; a separate caption is clearer and keeps
  the two independently translatable.

## D12 — The low corridor is authored, not a new tile kind

**Decision**: Edit `LEVEL_1_LAYOUT` to add a short (~6 tile) one-tile-high
corridor, formed by writing `groundGrass` ceiling tiles at **0-based layout
array row 8** over a stretch whose **row 9** is empty (the corridor) and
**row 10** is already solid `groundGrass` (the floor). All row/column numbers
here are 0-based array indices, matching `LEVEL_1_LAYOUT` and the tests. The
recommended stretch is **columns 89–94** (this is the authored configuration:
row 8 empty, row 9 empty, row 10 solid `G`; it avoids the question-mark marker
at row 7 / col 88 and the bee marker at row 8 / col 95). No new `TileType`, no
new `TERRAIN_CHARS` entry, no `LevelParser` change (FR-013, SC-005).

**Rationale**: A one-tile corridor needs only a ceiling tile above an existing
floor; both are already `groundGrass`. The chosen columns are a clean surface
run that does not sit under an existing block marker (a `?` block must stay
reachable from below) or on a bridge. The exact columns are re-validated in the
Level Editor during implementation, but the *shape* of the change is fixed:
ceiling `groundGrass` added, corridor row left empty, existing floor reused.

**Alternatives considered**:

- *A new tile kind for low corridors* — explicitly forbidden by FR-013.
- *Carving the corridor into a cave gallery* — rejected: base-level placement
  keeps it on the main route and simple to verify; a cave corridor is a
  level-design follow-up, not a requirement.

## D13 — A crouched directional hit: damage + window + `'hit'` pose, no knockback (FR-011, SC-009)

**Decision**: Add a pure helper to `entities/Player.ts` (later consolidated with
the pre-existing `applyKnockback` — see "Consolidation" below):

```ts
/**
 * Starts the shared red `hit` reaction (hitTimer 0, animState 'hit', frame
 * reset). With a `knockback` argument it also sets vx/direction/knockbackTimer;
 * with none it leaves vx, direction, knockbackTimer, vy and bounceAscending
 * untouched.
 */
export function applyHitReaction(player: PlayerState, knockback?: HitKnockback): PlayerState
```

`PlatformerPage.tsx` branches on `player.crouching` at the three directional
damage sites, and never changes the standing path:

| Site | Standing (unchanged) | Crouched (new) |
| --- | --- | --- |
| Enemy contact (~L1741) | `applyHitReaction(player, knockback)`; then `awayAndUp` sets `vy` + `bounceAscending` | `applyHitReaction(player)`; **skip** the `awayAndUp` `vy` |
| Non-floor-spike hazard (~L1819) | `applyHitReaction(player, knockback)` | `applyHitReaction(player)` |
| Bomb blast (~L2163) | `applyHitReaction(player, knockback)` | `applyHitReaction(player)` |

The floor-spike hazard uses `applyHitReaction(player)` too — the same red
reaction with no knockback (a follow-up change; see "Consolidation"). Only a pit
fall blinks (`beginPitFallReaction`).

**Rationale**: One pure function is unit-testable and keeps each of the three
call sites a one-line branch, instead of repeating the exact field set three
times inline. Setting `hitTimer: 0` does double duty: it opens the
invulnerability window (the damage gate and `isInvulnerable` both read it), and
— through D8's freeze — keeps `crouching` true for the whole reaction, so the
one-tile box can never be forced open into a ceiling. Setting
`animState: 'hit'` preserves the existing sticky-hit derivation and
`PlatformerPage`'s `playerVisible` rule (a `hit` state is always visible, never
blinked), so the red reaction still shows; the renderer then draws it on the
crouch pose rather than the baked hit row (D14). Leaving `vx` untouched means
"no knockback", not "no movement": a held crawl key keeps crawling, which is
the player's own input, not a hit impulse.

**Alternatives considered**:

- *Inline `if (crouching) { ... } else { applyHitReaction(...) }` at each of the
  three sites* — rejected: it duplicates the field set three times and leaves
  the no-knockback rule untestable in isolation.
- *Reuse `beginPitFallReaction` (the pit-fall helper)* — rejected: it only resets
  `hitTimer`, so the character would blink rather than show the red reaction
  the spec requires while crouched.
- *Zero `vx`/`vy` in the helper* — rejected: the spec asks for no knockback,
  not a movement lock; held input should still crawl, and `vy` is governed by
  gravity and the ground/ceiling collision that already keeps the box valid.
- *Change the floor-spike path to also show red while crouched* — initially
  rejected as an out-of-scope change to a shipped mechanic (FR-014). **Later
  adopted** (see Consolidation): the floor spike showing the pit-fall blink was
  an accident of it being the only no-knockback helper at the time, not a
  deliberate visual.

### Consolidation (post-implementation)

Two browser-review fixes turned the "crouched no-knockback" helper and the
pre-existing `applyKnockback` into one function, so the *visual* (the red `hit`
reaction) and the *knockback* are separate concerns:

- `applyHitReaction(player, knockback?)` — always starts the red reaction;
  knockback is optional. `applyKnockback` was folded into it (its knockback
  becomes the argument).
- The floor spike switched from `beginHitReaction` (blink) to
  `applyHitReaction(player)` (red, still no knockback), so every attacker hit
  looks the same.
- `beginHitReaction` was renamed `beginPitFallReaction` — now the only
  blink-only path, and the only deliberate exception.

## D14 — The crouched red reaction is a reusable render-time tint (FR-016)

**Decision**: Add to `engine/Renderer.ts` a reusable helper:

```ts
export function drawTintedSprite(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  sheet: CanvasImageSource,
  sx: number, sy: number, frameSize: number,
  destX: number, destY: number, destSize: number,
  tint: string,
): void
```

which (1) gets `layer.getContext('2d')`, falling back to a plain `ctx.drawImage`
if null; (2) clears the layer to `destSize`, draws the frame scaled to
`destSize` with `source-over`; (3) sets
`globalCompositeOperation = 'source-atop'` and fills the layer with `tint`
(so only the sprite's opaque pixels are recoloured, not a rectangle); (4)
draws the layer onto `ctx` at `(destX, destY)` and restores `source-over`.

`drawPlayer` gains an eighth optional parameter
`tintLayer: HTMLCanvasElement | null = null`. When
`player.crouching && player.animState === 'hit'`:

- the frame source is `playerFrameSource('crouch', player.animFrame)` — the
  DUCK-row crawl pose — **not** the baked hit row;
- if `tintLayer` is provided, the frame is drawn through `drawTintedSprite`
  with `CROUCH_HIT_TINT`, mirrored through the same `save`/`translate`/`scale`
  path when facing left;
- if no layer is provided (e.g. the editor preview, where the player never
  crouches), it falls back to a plain draw of the same crouch pose, so the
  wrong row is never drawn.

`PlatformerPage.tsx` owns one reusable 64×64 `hitTintLayerRef` canvas, created
in `resize()` beside `darknessLayerRef`, and passes it to `drawPlayer`. The
standing hit path (`crouching: false`) is byte-for-byte unchanged, so the
shipped S-010 baked red frame and its tests are untouched.

**Rationale**: `drawDarkness` already establishes the exact pattern this
needs — the caller owns one reusable offscreen canvas and the renderer
composites into it (Renderer.ts ~L321), so the tint follows an existing,
testable convention and allocates nothing per frame. `source-atop` is the
correct composite: it paints only where the sprite already has alpha. Keeping
the layer caller-owned (rather than a module singleton) preserves DOM-free
testability with a fake layer, exactly like the `drawDarkness` tests. Choosing
`player.crouching && animState === 'hit'` as the trigger is what makes the
reaction "the crouch pose, tinted red" without authoring a frame.

**Alternatives considered**:

- *Author dedicated red-tinted crouch frames* — rejected by FR-016.
- *Replace the standing hit row with the same tint* — rejected by the spec
  (FR-016: the standing hit's existing red frame is deliberately left
  unchanged; unifying it would be more code and would change shipped S-010
  behaviour and tests).
- *A module-level lazily-created scratch canvas* — rejected: hidden global
  state, harder to fake in Vitest, and inconsistent with the caller-owned layer
  the renderer already takes.
- *`ctx.filter` / CSS filters* — rejected: unsupported/expensive in the 2D
  pipeline and non-deterministic across browsers.
- *An overlay `fillRect` with reduced alpha* — rejected: it tints the whole
  destination rectangle, not just the sprite silhouette.

## Dependencies (existing code this builds on)

- **S-008 Platformer Ladders & Climbing** — supplies `climbing`, the
  `dropThroughHeld` ladder-descent entry, `isClimbable`/`isStandableLadderTop`,
  and the feet-row convention. Crouch is added strictly below it in the Down
  priority and changes none of it (SC-003).
- **S-009 Platformer Onboarding** — supplies the `ControlsOverlay` key legend,
  the sign marker mechanism (`SIGN_CHARS`, `HintId`, `checkSignOverlap`,
  `HintTooltip`) used as the fallback.
- **S-010 Platformer Health & Hit Reaction** — supplies `applyHitReaction`,
  `beginPitFallReaction`, `PLAYER_HIT_REACTION_SECONDS`, `hitFrameFromTimer`, the
  baked `hit` row and the invulnerability blink. This feature adds the
  no-knockback sibling (`applyHitReaction`, D13) and the
  render-time tint (D14) without altering any of it.
- **F-015 / F-016 / F-017 / F-018 / O-005 / O-012 / O-020 / O-021** — supply the
  movement/gravity/solid collision, health/hit reaction, enemy contact, block
  contact, hazard, blast and floor-spear paths whose boxes all flow through
  `playerHitbox`/`Physics.ts`, so the one shared-box change covers them
  (FR-014, SC-008).
- **O-001 Platformer Checkpoints / the theme-switch mount reset** — supply the
  `playerStateAtTile` factory used by every respawn path, which is where
  `crouching: false` is seeded (FR-012).
