# Platformer Theme

A side-scrolling 2D platformer theme for the CV site. The browser viewport becomes a
playable game level: the visitor controls a character who collects coins, breaks
blocks, and defeats enemies, each revealing a piece of CV information. Discovered
facts fly into a handwritten journal that can be opened anytime to browse everything
found so far.

This is a durable design reference for the theme — how it's meant to work and why —
independent of any single implementation step. (The formal requirements/roadmap live
in `specs/`; this document is the conceptual companion that outlives any one feature
branch.)

## Documents in this folder

| Document | Covers |
|---|---|
| **README.md** (this file) | The theme itself — controls, core loop, CV-data mapping, journal, movement and collision design |
| [Entities.md](Entities.md) | How every drawable thing is modelled: capability interfaces, the type layer, identity, sprites, contacts and triggers |
| [EntityFollowUps.md](EntityFollowUps.md) | What is not done, and the loose ends worth closing |

## Controls

| Key | Action |
| --- | --- |
| ← / → (Arrow Left/Right) or A/D | Move left / right |
| Space or ↑ (Arrow Up) | Jump |
| ↓ (Arrow Down) or S | Drop through a bridge while standing on one |
| J | Toggle the journal open/closed |

Arrow Up is reserved exclusively for jumping — it doesn't double as a journal
navigation key or any other UI interaction, to avoid ambiguity while playing.

## Core loop

1. The visitor walks through the level and encounters coins, blocks, and enemies.
2. **Collect a coin** — a CV fact appears near the character, floats briefly, then
   flies into the journal icon.
3. **Break a block** — hitting it from below repeatedly cracks it through visible
   stages; the final hit breaks it and reveals its CV fact. Each hit before the last
   also drops a bonus coin.
4. **Defeat an enemy** — jumping on it (a "stomp") reveals its CV fact. Touching an
   enemy any other way costs a heart instead.
5. **Reach the flagpole** at the end of the level — jumping onto it plays a
   celebration and shows an ending screen with the Personality and Contact
   information, which is otherwise never placed on a collectible.
6. Press **J** any time to open the journal and browse everything found so far.

## CV data → game object mapping

| Game object | Interaction | CV data revealed |
| --- | --- | --- |
| 🪙 Coin | Touch to collect | Skills (★ rating), Languages |
| ❓ Destroyable block | Repeated hits from below | Experience, Education, Courses |
| 🧱 Solid terrain / platforms | None — obstacle/traversal only | — |
| 👾 Enemy | Stomp to defeat | Certificates, Projects |
| 🚩 Flagpole | Reach the end of the level | Personality, Contact (ending screen only) |

Every non-empty CV item in a mapped section gets at least one collectible; empty
sections simply produce none and hide their journal bookmark.

## Journal design

The journal is a fullscreen overlay that pauses the game while open. It shows one
page at a time (not a two-page spread), on lined notebook paper in a handwriting
font, with a per-section bookmark tab running down the right edge — the active
bookmark is wide with a vertical label, inactive ones are thin colored slivers.

Suggested bookmark colors, one per CV section:

| Section | Color |
| --- | --- |
| Skills | Yellow `#ffd54f` |
| Experience | Orange `#ffb74d` |
| Education | Green `#a5d6a7` |
| Courses | Cyan `#80deea` |
| Certificates | Pink `#f48fb1` |
| Projects | Blue `#90caf9` |

Personality and Contact aren't bookmarked sections with counters — they're added to
the journal only after the flagpole ending screen, each with its own bookmark but no
"N/M" counter (there's only ever one fact in each).

Entries use a simple bullet-list style, one section-appropriate icon per entry (e.g.
🏢 for experience, 🎓 for education):

```
🏢 Acme Corp — Senior Eng.
   2020–2023
   built the core platform, led a team of 4
```

Skills entries show a star rating instead of prose, e.g. `TypeScript ★★★★☆`.

## Visual style

Pixel-art sprites (character, enemies, terrain, coins, blocks) rendered on a
`<canvas>` with nearest-neighbor scaling, so the pixel-art look stays crisp at any
zoom level rather than blurring.

## Reveal animation

When a coin/block/enemy is collected: the fact text floats up from the collection
point, hovers briefly near the character, then animates toward the journal icon and
disappears into it with a small "added" pulse.

## Movement

### Model: constant speed, instant direction change

The character moves horizontally at a **constant speed** — no ramp-up or ramp-down.
Holding a direction applies full speed immediately; releasing it (or holding both
directions) drops speed to zero immediately. Reversing direction snaps straight to
the opposite direction, with no skid or deceleration phase.

**Why**: several well-regarded platformers (Celeste, Mega Man) use instant ground
speed rather than momentum, because it makes movement feel tight and predictable —
useful when the character mostly needs to stop precisely on platforms and land on
enemies, not slide around. It's also simpler to tune and reason about than an
acceleration curve, which has more edge cases to get right (does releasing coast or
stop dead? does reversing decelerate through zero or snap?).

**Decision**: start with constant speed, evaluate the feel once it's playable, and
only add acceleration if it demonstrably feels worse.

### Reference research: Super Mario Bros. (NES) ground physics

If acceleration is ever added, this is a source-grounded starting point rather than a
guess — Nintendo hasn't published these values, but the original NES ROM has been
disassembled and its physics tables are public and well-documented in the
ROM-hacking/speedrunning community.

**Source**: ["A Comprehensive Super Mario Bros. Disassembly"](https://gist.github.com/1wErt3r/4048722)
(gist by `1wErt3r`, widely cited/mirrored — see also the
[6502disassembly.com port](https://6502disassembly.com/nes-smb/) and
[Super Mario Bros. speedrunning (Wikipedia)](https://en.wikipedia.org/wiki/Super_Mario_Bros._speedrunning)
for corroborating max-speed figures). Relevant routines: `GetXPhy` (selects the active
speed cap and friction rate) and `ImposeFriction` (applies it every frame).

**How it works in the original game**:

- Horizontal speed (`Player_X_Speed`) is stored in units of 1/16 pixel/frame.
- Max speed is a hard cap selected by state: walking = 24 units (**1.5 px/frame**),
  running (B button held) = 40 units (**2.5 px/frame**). (Separate, slower caps exist
  for underwater and the pipe-intro cutscene — not relevant here.)
- Acceleration isn't a flat per-frame add to speed — it's an 8-bit fractional
  accumulator (`Player_X_MoveForce`) that gains a small amount every frame and carries
  into the integer speed register on overflow, giving a fine ramp. The three tuned
  friction-table bytes convert to roughly **0.037–0.056 px/frame²** depending on
  state (walk / run / skid).
- **Direction-reversal doubling**: when the held direction is opposite the direction
  Mario is currently facing, the accumulator step is bit-shifted (doubled) — so
  turning around decelerates roughly twice as fast as normal acceleration builds up.
  This is the classic "skid" feel and stop.

**In native NES pixel/frame units** (the NES ran at ~60 FPS NTSC — that's a fact
about the source data, not a requirement for whatever consumes this reference; redo
the scale conversion for whatever pixel/tile size and target frame rate actually
apply):

| Quantity | NES value |
| --- | --- |
| Max walk speed | 1.5 px/frame |
| Max run speed | 2.5 px/frame |
| Acceleration | 0.037–0.056 px/frame² |
| Direction-reversal deceleration | ~2× the acceleration value above |

### If acceleration is added later

- Keep a single tunable "walk acceleration" value, and optionally a separate, larger
  "skid deceleration" for the direction-reversal case, rather than scattering new
  magic numbers.
- Decide explicitly whether releasing a direction key coasts to a stop or halts
  immediately — the "instant direction change" model above stops immediately, which
  is the simpler behavior to preserve unless there's a specific reason to change it.
- Any test suite covering constant-speed movement will need its assertions rewritten
  from "velocity snaps to targetSpeed in one step" to "velocity ramps toward
  targetSpeed over multiple steps, capped at the max."

### Jump feel — concepts worth considering

Two small forgiveness windows are common in well-tuned platformers and worth
evaluating when jump is implemented:

- **Coyote time** — a short grace window (~100ms) after walking off a ledge during
  which a jump still succeeds, so a slightly-late jump press doesn't feel unfair.
- **Jump buffering** — a short grace window (~100ms) before landing during which a
  jump press is remembered and fires the instant the character touches ground,
  instead of being dropped if pressed a few frames too early.

Both are pure quality-of-feel additions with no gameplay-rules impact — they can be
added independently of the base jump mechanic and tuned by feel.

## Collision: bridges are one-way platforms

Every solid terrain type is solid from every direction — except `bridge`. A rope/
plank bridge is the one terrain type where "passable from below, solid from above"
reads as natural rather than surprising (you duck under and climb up through it,
rather than a stone platform mysteriously having no underside). This only becomes
testable once jump exists, so it's its own roadmap step placed right after jump.

**Drop-through, implemented at roadmap step 7**: a down-arrow/`S` key lets the
character deliberately fall off a bridge they're resting on, rather than only
being able to leave it by walking off an edge. This was originally deferred —
the base one-way behavior doesn't require it, and `level1`'s original bridge
just spanned a ground-level pit with nothing to reach underneath. It was added
once `level1` gained a platform-bridge-platform arrangement (row 0, columns
8-14) with two rows of clearance and reachable ground below, giving the
mechanic a real purpose: reaching the ground-level area under the elevated
platforms without walking all the way around, and a template for use when the
final level is designed.
