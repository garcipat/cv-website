# Idea: 2D Platformer Theme

## Status: Design Exploration

## Summary

A side-scrolling 2D platformer theme. The entire browser viewport becomes a playable game level. The player controls a character, collecting coins, breaking blocks, and defeating enemies — each revealing a piece of CV information. Discovered info flies into a handwritten journal that can be opened anytime to browse collected facts. Playful, interactive, game-first experience.

---

## Gameplay Flow

### Controls

| Key | Action |
|-----|--------|
| **A** / ← | Move left |
| **D** / → | Move right |
| **Space** | Jump (primary, wide button in overlay) |
| **J** | Toggle journal open/close |

On first load, floating key hints appear near the character (A, D, wide SPACE) — no dark overlay. They fade out on the first movement input.

### Core Loop

1. Player moves through the level → encounters coins, blocks, enemies
2. **Collect coin:** A CV fact pops up near the character, floats briefly, then flies into the journal icon
3. **Break block:** Hit a block from below 5 times — each hit drops a coin, the final break reveals the block's CV entry
4. **Defeat enemy:** Jump on an enemy to reveal its CV entry
5. **Flag pole** at the end of the level — jumping on it triggers the ending screen showing Personality + Contact info (not added to journal, one-time reveal)
6. Press **J** anytime to open the journal and browse collected info

### Game Objects → CV Data Mapping

| Game Object | Interaction | CV Data Revealed |
|---|---|---|
| 🪙 Coins | Touch to collect | Skills (with ★ star ratings 1–5), Languages |
| ❓ Block (destroyable) | Hit 5× from below (drops coin each hit, then breaks) | Experience, Education, Courses |
| 🧱 Bricks (solid) | Indestructible — stand on or bump into | (platform/obstacle only, no CV data) |
| 📦 Crates (solid) | Indestructible — stand on or bump into | (platform/obstacle only, no CV data) |
| 👾 Enemies | Jump on to defeat | Certificates, Projects |
| 🚩 Flag Pole | Jump on it (end of level) — pole + separate sliding flag | Personality + Contact info — shown as ending screen, NOT added to journal |

---

## HUD Layout

Full-viewport game canvas. Only minimal HUD elements:

- **Top-right:** Theme selector + Language selector — always visible on the game screen. Can reuse Space theme's `FloatingControls` component.
- **Bottom-right:** Journal icon button (📓) — opens/closes the notebook (also J key)
- **Start overlay:** A, D, SPACE key hints floating near character — fades on first movement. No dark backdrop, no "press start" message.

---

## Journal Design

The journal is the collected CV information viewer. It opens as an overlay over the paused game.

### Layout

- Opens over the game — game pauses and dims
- **Single page** at a time (not an open book spread)
- **Right-edge bookmarks** extend outward for each CV category — active bookmark is wider with vertical label; inactive bookmarks are thin color slivers
- **White lined paper** with red margin line, stacked pages visible behind for depth
- **Handwriting font** (Caveat or similar) for a playful, personal notebook feel
- **Selectors** (theme + language) are not part of the journal — they float on the game screen at all times, outside the journal
- **J key** toggles journal open/close
- **Page counter** at bottom shows page within the current section (e.g. "2 / 5" means page 2 of 5 in Experience)
- **Mouse wheel** scrolls between pages within the active category section
- Bottom-right of journal shows `[J] close` hint

### Bookmarks (right edge, outward)

Bookmarks are distributed top-to-bottom along the full page edge. Active one is wider with vertical label; inactive ones barely peek out as thin colored slivers.

| Bookmark | Color | CV Content |
|---|---|---|
| Skills | Yellow `#ffd54f` | Skills with ★ ratings, Languages |
| Experience | Orange `#ffb74d` | Work experience entries |
| Education | Green `#a5d6a7` | Education entries |
| Courses | Cyan `#80deea` | Course entries |
| Certificates | Pink `#f48fb1` | Certificate entries |
| Projects | Blue `#90caf9` | Project entries |

Personality and Contact info are NOT in the journal — they are revealed as a one-time ending screen when the player captures the flag pole.

### Entry Styling

Simple list format on lined paper with handwriting font:

```
🏢 Acme Corp — Senior Eng.
   2020–2023
   built the core platform, led a team of 4
```

Skills entries use star ratings: `TypeScript ★★★★☆`

---

## Visual Style

**Flat vector** — clean geometric shapes, smooth gradients, simple colors. The game world uses:
- Sky gradient background (light blue to darker blue)
- Green ground with brown earth below
- Wooden-style platforms
- Simple geometric character, enemies, coins, blocks

---

## Info Reveal Animation

When a coin/block/enemy is collected:
1. CV fact text floats up from the collection point
2. Hovers briefly near the character
3. Animates (flies) toward the journal icon in the bottom-right
4. Disappears into the journal icon with a small "added" pulse effect

---

## Level Structure

- Continuous side-scrolling level
- Ground with gaps and platforms at varying heights
- Blocks, coins, and enemies distributed throughout the level
- Flag pole at the far right end
- Camera follows the player (horizontal scrolling)

---

## Technical Approach

### Architecture: Hybrid Canvas + React

The theme uses a **split rendering model**:

| Layer | Technology | Purpose |
|---|---|---|
| **Game world** | `<canvas>` + 2D API | Character, enemies, blocks, coins, terrain, background, camera scrolling, particle effects |
| **UI overlay** | React components | HUD (selectors, journal button, start controls hint), journal notebook, info popups, ending screen |

**Why not pure DOM or pure Canvas?**

- Pure DOM (positioning everything with CSS transforms): Works for the Space theme's scroll-driven parade (~30 elements), but a platformer needs continuous physics, collision detection, and a scrolling camera — Canvas handles this far more naturally.
- Pure Canvas: Would need to reimplement text rendering, layout, scrollable journal, and interactive bookmarks from scratch — React already excels at this.
- **Hybrid** gives us smooth 60fps game rendering on canvas, while the journal, HUD, and selectors remain React components we already know how to build.

### Game Loop

A single `requestAnimationFrame` loop drives the game:

```
1. Process input (keyboard state: A, D, Space)
2. Update game objects (apply velocity, gravity, collisions)
3. Render game world to canvas (clear → draw background → terrain → objects → character → particles)
4. Sync state to signals (collected items, block hits, player position)
5. React re-renders overlay UI automatically via signal subscriptions
```

The game loop pauses when the journal is open (`gamePaused` signal).

### State Management (Preact Signals)

All state shared between canvas and React lives in Signals, following the existing project pattern (`src/state/ide.ts`, `src/state/terminal.ts`):

```ts
// src/state/platformer.ts (new file)

// Game state
gamePaused: Signal<boolean>           // true when journal open
playerX: Signal<number>               // player world position
playerY: Signal<number>
playerState: Signal<'idle'|'walk'|'jump'|'fall'>
playerFacing: Signal<'left'|'right'>

// Collection state
collectedItems: Signal<CollectedItem[]>   // all CV facts found
journalOpen: Signal<boolean>              // journal visible
activeCategory: Signal<JournalCategory>   // current bookmark
activePage: Signal<number>               // page within category

// Block state
blockHits: Signal<Map<string, number>>    // blockId → hit count
destroyedBlocks: Signal<Set<string>>      // fully destroyed

// Flag pole
flagCaptured: Signal<boolean>
showEndingScreen: Signal<boolean>
```

### Player Physics Config

Player movement parameters are in a dedicated config interface — easy to tweak without touching game logic:

```ts
interface PlayerPhysics {
  gravity: number;           // pixels/frame²
  jumpVelocity: number;      // initial upward velocity on jump
  moveSpeed: number;         // horizontal pixels/frame
  maxFallSpeed: number;      // terminal velocity cap
  friction: number;          // horizontal deceleration when no input
  coyoteTime: number;        // ms — grace window to jump after leaving ground
  jumpBufferTime: number;    // ms — grace window to jump if pressed just before landing
}

const DEFAULT_PHYSICS: PlayerPhysics = {
  gravity: 0.6,
  jumpVelocity: -10,
  moveSpeed: 4,
  maxFallSpeed: 12,
  friction: 0.8,
  coyoteTime: 100,
  jumpBufferTime: 100,
};
```

### Game Objects (Pure TypeScript)

Game objects are plain data with no React dependency — testable without jsdom:

```ts
interface GameObject {
  id: string;
  type: 'player' | 'enemy' | 'coin' | 'block' | 'brick' | 'crate' | 'flagpole';
  x: number; y: number;           // world position
  width: number; height: number;   // hitbox dimensions
  vx: number; vy: number;          // velocity
}

interface Player extends GameObject {
  state: 'idle' | 'walk' | 'jump' | 'fall';
  facing: 'left' | 'right';
  spriteFrame: number;             // current animation frame index
  grounded: boolean;
}

interface Block extends GameObject {
  type: 'block';
  hitsRemaining: number;           // 5 → 0, each hit drops a coin
  blockState: 'intact' | 'cracked' | 'broken';
  cvData: CVEntry;                 // the CV info this block reveals
}

interface Enemy extends GameObject {
  type: 'enemy';
  direction: 1 | -1;              // patrol direction
  alive: boolean;
  spriteFrame: number;
  cvData: CVEntry;
}

interface Coin extends GameObject {
  type: 'coin';
  collected: boolean;
  cvData: CVEntry;
}
```

### Typed Level Definition

The level is defined as typed data — a list of entity placements with sprite references and behavior configs. The engine reads this and creates the game objects.

```ts
// src/themes/platformer/level/types.ts

interface SpriteSheet {
  src: string;                    // image path
  frameWidth: number;             // width of one frame
  frameHeight: number;            // height of one frame
  animations: Record<string, AnimationDef>;
}

interface AnimationDef {
  startFrame: number;             // first frame index
  frameCount: number;             // number of frames in this animation
  frameDuration: number;          // ms per frame
  loop: boolean;                  // true = looping, false = play once and hold
}

// Sprite definitions — each game entity type references one of these
interface SpriteDef {
  sheet: SpriteSheet;
  defaultAnim: string;            // animation name shown at rest
}

interface TerrainTile {
  type: 'terrain';
  x: number;                      // world X position
  tileCount: number;              // how many tiles repeated
}

interface Platform {
  type: 'brick' | 'crate';
  x: number;
  y: number;
}

interface Block {
  type: 'block';
  x: number;
  y: number;
  cvIndex: { section: 'experience' | 'education' | 'courses'; index: number };
}

interface Coin {
  type: 'coin';
  x: number;
  y: number;
  cvIndex: { section: 'skills' | 'languages'; index: number };
}

interface Enemy {
  type: 'enemy';
  x: number;
  y: number;
  patrolMin: number;
  patrolMax: number;
  cvIndex: { section: 'certificates' | 'projects'; index: number };
}

interface Flagpole {
  type: 'flagpole';
  x: number;
  groundY: number;
}

interface LevelData {
  width: number;
  startX: number;
  startY: number;
  groundY: number;
  terrain: TerrainTile[];
  platforms: Platform[];
  blocks: Block[];
  coins: Coin[];
  enemies: Enemy[];
  flagpole: Flagpole;
}
```

```ts
// src/themes/platformer/level/level-data.ts (example)

const level: LevelData = {
  width: 4000,
  startX: 100,
  startY: 400,
  groundY: 440,
  terrain: [
    { type: 'terrain', x: 0, tileCount: 35 },
    { type: 'terrain', x: 1300, tileCount: 8 },
    { type: 'terrain', x: 1800, tileCount: 30 },
  ],
  platforms: [
    { type: 'brick', x: 400, y: 370 },
    { type: 'brick', x: 450, y: 370 },
    { type: 'crate', x: 700, y: 320 },
  ],
  blocks: [
    { type: 'block', x: 500, y: 300, cvIndex: { section: 'experience', index: 0 } },
    { type: 'block', x: 800, y: 260, cvIndex: { section: 'education', index: 0 } },
  ],
  coins: [
    { type: 'coin', x: 200, y: 400, cvIndex: { section: 'skills', index: 0 } },
    { type: 'coin', x: 620, y: 280, cvIndex: { section: 'skills', index: 1 } },
  ],
  enemies: [
    { type: 'enemy', x: 900, y: 410, patrolMin: 800, patrolMax: 1000, cvIndex: { section: 'projects', index: 0 } },
  ],
  flagpole: { type: 'flagpole', x: 3700, groundY: 440 },
};
```

### Animation & State Handling

Each sprite sheet defines its animations. The engine drives state transitions based on game events:

```ts
// Sprite registry — maps entity type to its sprite sheet + animations
const SPRITES = {
  hero: {
    sheet: {
      src: 'images/platformer-hero-spritesheet.jpg',
      frameWidth: 32, frameHeight: 48,
      animations: {
        idle:    { startFrame: 0, frameCount: 1, frameDuration: 0, loop: false },
        walk:    { startFrame: 1, frameCount: 2, frameDuration: 150, loop: true },
        jump:    { startFrame: 3, frameCount: 1, frameDuration: 0, loop: false },
      },
    },
    defaultAnim: 'idle',
  },
  enemy: {
    sheet: {
      src: 'images/platformer-enemy-spritesheet.jpg',
      frameWidth: 32, frameHeight: 32,
      animations: {
        walk:    { startFrame: 0, frameCount: 2, frameDuration: 200, loop: true },
        defeat:  { startFrame: 2, frameCount: 2, frameDuration: 300, loop: false },
      },
    },
    defaultAnim: 'walk',
  },
  block: {
    sheet: {
      src: 'images/platformer-block-spritesheet.jpg',
      frameWidth: 32, frameHeight: 32,
      animations: {
        intact:  { startFrame: 0, frameCount: 1, frameDuration: 0, loop: false },
        crack1:  { startFrame: 1, frameCount: 1, frameDuration: 0, loop: false },
        crack2:  { startFrame: 2, frameCount: 1, frameDuration: 0, loop: false },
        broken:  { startFrame: 3, frameCount: 1, frameDuration: 0, loop: false },
      },
    },
    defaultAnim: 'intact',
  },
} as const satisfies Record<string, SpriteDef>;
```

**State transitions** happen in the game loop — objects don't need to know about rendering:

```
Player moving left/right  →  animation switches to 'walk', frame cycles automatically
Player in air             →  animation switches to 'jump'
Player idle on ground     →  animation switches to 'idle'

Block hit 1-2 times       →  'intact'   (sprite frame 0)
Block hit 3 times         →  'crack1'   (sprite frame 1)
Block hit 4 times         →  'crack2'   (sprite frame 2)
Block hit 5 times         →  'broken'   (sprite frame 3), then removed from world

Enemy walking              →  'walk', frame cycles while alive
Enemy stomped              →  'defeat', plays once (non-looping), then removed
```

The renderer just draws `spriteSheet[object.currentAnim][object.spriteFrame]` at the object's position — it doesn't care why the animation changed.

### Collision Detection

Simple **AABB (Axis-Aligned Bounding Box)** collision:

```ts
function collides(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}
```

- Player vs coin: collect on overlap
- Player vs enemy (from above): defeat enemy
- Player vs enemy (from side): player takes damage (or just gets bumped back)
- Player vs block (from below): increment hit counter
- Player vs terrain/bricks/crates: stop movement (solid collision)

### Sprite Animation

Sprite sheets are loaded as `Image` objects. Frame cycling in the game loop:

```ts
// Each sprite sheet has N frames horizontally
const FRAME_CONFIGS = {
  hero: { frames: 4, width: 32, height: 48 },
  enemy: { frames: 4, width: 32, height: 32 },
  block: { frames: 4, width: 32, height: 32 },
};

// Advance frame every ~150ms while moving
if (player.vx !== 0 && frameTimer > 150) {
  player.spriteFrame = (player.spriteFrame + 1) % 4;
  frameTimer = 0;
}
```

Canvas draws the correct frame with `ctx.drawImage(spriteSheet, frameIndex * frameWidth, 0, frameWidth, frameHeight, x, y, width, height)`.

### File Structure

Following the existing theme pattern (`src/themes/ide/`, `src/themes/space/`):

```
src/themes/platformer/
├── PlatformerPage.tsx          # Root layout: canvas + React overlay
├── components/
│   ├── GameCanvas.tsx          # <canvas> element, game loop entry point
│   ├── Journal.tsx             # Notebook overlay (bookmarks, pages, entries)
│   ├── JournalPage.tsx         # Single page content (category entries)
│   ├── JournalBookmark.tsx     # Individual bookmark tab
│   ├── StartControls.tsx       # A/D/Space key hints (fades on first move)
│   ├── InfoPopup.tsx           # Floating CV fact text
│   ├── EndingScreen.tsx        # Flag pole completion screen
│   └── HudOverlay.tsx          # Wraps selectors + journal button + popups
├── engine/
│   ├── game-loop.ts            # requestAnimationFrame loop
│   ├── physics.ts              # Gravity, velocity, collision detection
│   ├── input.ts                # Keyboard state tracking
│   ├── renderer.ts             # Canvas drawing (background, tiles, sprites)
│   ├── camera.ts               # Follow-player scrolling camera
│   └── objects.ts              # GameObject factory functions
├── level/
│   └── level-data.ts           # Level layout: positions of all objects
├── state.ts                    # Preact Signals for game + collection state
└── sprite-config.ts            # Sprite sheet frame definitions
```

### How It Fits the Existing Architecture

- `src/state/platformer.ts` — same pattern as `src/state/ide.ts` and `src/state/terminal.ts`
- `src/themes/platformer/PlatformerPage.tsx` — registered in `App.tsx` alongside `IdePage`, `SpacePage`, `TerminalPage`
- `src/styles/themes/platformer.css` — theme-scoped CSS under `[data-theme="platformer"]`
- Reuses: `FloatingControls` from Space theme, `currentCV`/`currentUI` signals, `createLocalStorageSignal`

### Performance Considerations

- Canvas clears and redraws every frame — keep draw calls minimal (no per-pixel operations)
- Only render objects within camera viewport (culling)
- Sprite sheets preloaded as `Image` objects at mount time
- Game loop throttles to 60fps via `requestAnimationFrame`
- Journal (React) only re-renders when `collectedItems` or page/bookmark signals change

---

## Mockups & Assets

Mockups are saved in `specs/S-006-platformer-theme/`:
- `journal-mockup.html` — Journal layout with bookmarks
- `entry-styles-mockup.html` — Entry styling options (simple list chosen)

Game asset images in `specs/S-006-platformer-theme/images/`:
- `platformer-hero-spritesheet.jpg` — Hero: idle, walk1, walk2, jump (4 frames)
- `platformer-enemy-spritesheet.jpg` — Enemy: idle, walk1, walk2, defeated (4 frames)
- `platformer-block-spritesheet.jpg` — Block: intact, cracked, heavy crack, broken (4 frames)
- `platformer-coin.jpg` — Collectible coin
- `platformer-brick.jpg` — Solid indestructible brick
- `platformer-crate.jpg` — Solid indestructible crate
- `platformer-terrain.jpg` — Ground tile (grass + dirt)
- `platformer-pole.jpg` + `platformer-flag.jpg` — Flag pole (separate parts)
