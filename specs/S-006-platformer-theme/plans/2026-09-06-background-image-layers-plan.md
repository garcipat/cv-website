# Background Image Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the platformer's procedural sky (`drawSkyBackground`) with a real
illustrated backdrop cropped from `public/sprites/backgrounds.png`, composited as 4
independently-scrolling depth layers (sky, clouds/hills, village/treeline, grass) for a
parallax effect.

**Architecture:** One combined chroma-keyed PNG holds the sky/clouds/village bands
stacked vertically in a known layout — the user separates/arranges these by hand
(already-transparent gaps where the art needs them, e.g. between tree canopies) and
hands over one file; the sky/clouds/village boundary is still magenta-backed at the
outer edges, so it still needs one chroma-key pass. This is addressed by sx/sy sub-rect,
the same one-sheet-many-pieces convention `BackgroundCatalog.ts` already uses for
`terrain_.png` — not 3 separate files. The grass tile stays a second, separate tiny
tileable swatch PNG (already established as its own asset, unrelated to the combined
file). Both are registered as sprite sheets. A new pure-ish canvas-drawing function,
`drawBackgroundLayers`, replaces the `drawSkyBackground` call in `PlatformerPage.tsx`'s
render loop: sky pinned to the top (no scroll), clouds/hills filling the gap between sky
and village (slow parallax), village pinned a fixed distance above the canvas bottom
(medium parallax), and the grass tile filling everything below the village layer down to
the canvas bottom (full camera speed, matching the foreground terrain). The old
`drawSkyBackground`/`recoloredCloudTile` code and its tests are deleted as dead code.

**Tech Stack:** React 19 + TypeScript strict, Vitest + React Testing Library, Canvas 2D
rendering, Python 3 + Pillow (already used by `scripts/chroma_key_sprite.py`) for the
one-time asset export.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-06-background-image-layers-design.md`
(architecture, asset measurements, rationale) and
`specs/S-006-platformer-theme/roadmap.md` (Step 43).

## Global Constraints

- TypeScript `strict: true`, no `any`, no `@ts-ignore` (constitution Principle I / III).
- Tests first (constitution Principle II — TDD, NON-NEGOTIABLE). Test naming for new
  behaviour-specific tests follows `{method}-{Condition}-{ExpectedResult}`.
- Named arrow function exports, props interfaces in the same file, no default exports
  (constitution Principle III).
- Relative imports (`./`, `../`) within `src/themes/platformer/`.
- No new npm dependencies. The one-time asset export uses Python + Pillow, already a
  project dependency for `scripts/chroma_key_sprite.py` — not a runtime/build dependency.
- The 2 new image assets (combined layers sheet + grass tile) are loaded like every
  other sprite (`loadImage`, a `useRef`, rendering degrades gracefully if a load fails)
  — no new asset-loading pattern.
- **Deviation from the design doc:** the design doc says "`EditorCanvas.tsx` gets the
  same background draw call... so the editor preview matches gameplay." That's not
  accurate to the current codebase — `EditorCanvas.tsx` does not call
  `drawSkyBackground` today at all (confirmed by grep: no match). This plan therefore
  does **not** add background-layer rendering to the editor, matching existing behavior
  exactly rather than introducing new editor scope beyond what this feature needs.

---

## File Structure

- **Create** (one-time export, committed static assets like every other sprite):
  - `public/sprites/background_layers.png` — combined sky+clouds+village, chroma-keyed.
  - `public/sprites/background_layer_grass.png` — the small tileable grass swatch,
    chroma-keyed.
- **Create** `src/themes/platformer/engine/BackgroundLayers.ts` — the compositing
  function (`drawBackgroundLayers`), the exported source sub-rects
  (`SKY_SOURCE_RECT`/`CLOUDS_SOURCE_RECT`/`VILLAGE_SOURCE_RECT`), and tunable constants
  (parallax factors, village-to-bottom offset).
- **Create** `src/themes/platformer/engine/BackgroundLayers.test.ts`.
- **Modify** `src/themes/platformer/entities/sprites/sheets.ts` — register the 2 new
  images as `SpriteSheet`s (loading-only registrations, like `TERRAIN_BACKGROUND_SHEET`).
- **Modify** `src/themes/platformer/PlatformerPage.tsx` — 2 new image refs + `loadImage`
  calls, replace the `drawSkyBackground` call with `drawBackgroundLayers`.
- **Modify** `src/themes/platformer/engine/Renderer.ts` — delete `drawSkyBackground`,
  `recoloredCloudTile`, their constants, and the now-unused `recoloredCloudTileCache`.
- **Modify** `src/themes/platformer/engine/Renderer.test.ts` — delete the
  `describe('drawSkyBackground', …)` suite (lines 2471-2638 as of this plan; confirm the
  exact range at implementation time since earlier edits in this file may have shifted
  it).

---

### Task 1: Export the 2 background-layer assets from source art

**Files:**
- Create: `public/sprites/background_layers.png`
- Create: `public/sprites/background_layer_grass.png`
- Reads (unchanged): a combined sky/clouds/village source file the user provides (see
  below), and the pristine `public/sprites/backgrounds.png`.

**Interfaces:**
- Produces: 2 PNG files with transparency, exact pixel dimensions verified in Step 3
  below — later tasks (sheets.ts registration, `BackgroundLayers.ts`'s source rects)
  depend on these exact dimensions.

**Precondition (already satisfied):** `public/sprites/background_village.png` (179×209,
already committed on this branch) has the sky/clouds/village bands separated by the user
with clear ~2-3px magenta gaps between them, specifically to make each band's boundary
unambiguous to detect. Confirmed by pixel-scanning columns x=60/100/150 (all 3 agree
exactly) for magenta/non-magenta transitions:

| Layer | Rows in `background_village.png` (this file's own coordinates) | Height | Content |
|---|---|---|---|
| Sky | y0–23 | 24px | dark-blue accent + light-blue fill |
| *(gap)* | y24–25 | 2px | magenta separator — excluded, not part of any layer |
| Clouds/hills | y26–85 | 60px | white cloud puffs over the cyan hill-wave band |
| *(gap)* | y86–88 | 3px | magenta separator — excluded, not part of any layer |
| Village | y89–145 | 57px | pine treeline + the full original grass/river/bush detail (deliberately kept — this is the one place that detail renders; everything below it is the plain repeating grass tile, not a second copy of this art) |

All 3 bands span the full 160px content width (x8–167 in this file — confirmed
separately; the file's own width is 179px, with the hand-relocated grass-tile fragment
and some padding past x167).

The grass tile is sourced separately from the pristine `backgrounds.png` at the
already-confirmed-seamless rect `x40,y140,7×20` — unrelated to `background_village.png`.

- [ ] **Step 1: Crop the 3 bands (excluding the magenta gap rows) and stack them with no gap**

```bash
mkdir -p .generated
python3 -c "
from PIL import Image

src = Image.open('public/sprites/background_village.png')
CONTENT_X0, CONTENT_WIDTH = 8, 160
bands = [
    (0, 24),    # sky
    (26, 86),   # clouds/hills
    (89, 146),  # village
]
crops = [src.crop((CONTENT_X0, y0, CONTENT_X0 + CONTENT_WIDTH, y1)) for y0, y1 in bands]
total_height = sum(c.height for c in crops)
combined = Image.new('RGBA', (CONTENT_WIDTH, total_height))
y = 0
for c in crops:
    combined.paste(c, (0, y))
    y += c.height
combined.save('.generated/background_layers_magenta.png')
print('wrote .generated/background_layers_magenta.png', combined.size)
"
```

Expected output: `wrote .generated/background_layers_magenta.png (160, 141)` (24+60+57=141).
If the printed size differs, open `public/sprites/background_village.png` again — the
band rows or content x-range may have shifted since this plan was written; re-measure
with the same column-scan approach (scan a few x columns for magenta/non-magenta
transitions) before continuing.

- [ ] **Step 2: Chroma-key the combined file and the grass tile**

```bash
python3 scripts/chroma_key_sprite.py .generated/background_layers_magenta.png public/sprites/background_layers.png --no-crop

python3 -c "
from PIL import Image
Image.open('public/sprites/backgrounds.png').crop((40, 140, 47, 160)).save('.generated/bg_grass_magenta.png')
"
python3 scripts/chroma_key_sprite.py .generated/bg_grass_magenta.png public/sprites/background_layer_grass.png --no-crop
```

`--no-crop` is required on both — the default autocrop-to-content would change each
file's dimensions unpredictably (e.g. the village band's jagged treetop silhouette has
transparent gaps at its very top after keying, which autocrop would trim away), and
later tasks rely on exact, known dimensions.

- [ ] **Step 3: Confirm final dimensions and transparency**

```bash
python3 -c "
from PIL import Image
for path in ['public/sprites/background_layers.png', 'public/sprites/background_layer_grass.png']:
    img = Image.open(path)
    print(path, img.size, img.mode)
"
```

Expected: both print `RGBA` mode (transparency present). `background_layers.png` should
be `(160, 141)`; `background_layer_grass.png` should be `(7, 20)`. If either still shows
solid magenta anywhere (open the file and look for pink), lower `--tolerance` on that
file's chroma-key step and re-run.

- [ ] **Step 4: Commit**

```bash
git add public/sprites/background_layers.png public/sprites/background_layer_grass.png
git commit -m "feat(platformer): export chroma-keyed background-layer assets"
```

---

### Task 2: Register the 2 new images as sprite sheets

**Files:**
- Modify: `src/themes/platformer/entities/sprites/sheets.ts`

**Interfaces:**
- Produces: `BACKGROUND_LAYERS_SHEET`, `BACKGROUND_LAYER_GRASS_SHEET` — each a
  `SpriteSheet` with `columns: 1` (loading-only registrations; `BackgroundLayers.ts`
  addresses sub-rects of `BACKGROUND_LAYERS_SHEET`'s image directly by sx/sy, the same
  way `BackgroundCatalog.ts` addresses `TERRAIN_BACKGROUND_SHEET`'s image — this
  registration exists for loading, not addressing).
- Consumes: `SpriteSheet` type from `./SpriteSheet` (already imported in this file).

- [ ] **Step 1: Add the 2 registrations**

Append to `src/themes/platformer/entities/sprites/sheets.ts` (after
`STATIC_OBJECTS_SHEET`, matching the file's existing one-const-per-image pattern). Use
the real dimensions confirmed in Task 1's Step 3 if they differ from the 160×141 assumed
here:

```typescript
/** The combined sky/clouds/village parallax background sheet — sky, clouds/hills,
 *  and village/treeline stacked vertically in that order, cropped and chroma-keyed
 *  from `backgrounds.png`'s day/green scene (see
 *  `specs/S-006-platformer-theme/plans/2026-09-06-background-image-layers-design.md`).
 *  `BackgroundLayers.ts` addresses it through its own sx/sy sub-rects, not by frame
 *  index — like `TERRAIN_BACKGROUND_SHEET`, this registration exists for loading, not
 *  addressing. */
export const BACKGROUND_LAYERS_SHEET: SpriteSheet = {
  src: '/sprites/background_layers.png',
  frameWidth: 160,
  frameHeight: 141,
  columns: 1,
};

/** A small (7x20) tileable grass-texture swatch, separate from
 *  `BACKGROUND_LAYERS_SHEET` since it repeats both horizontally and vertically at a
 *  different scroll speed (full camera speed) than the village layer above it. */
export const BACKGROUND_LAYER_GRASS_SHEET: SpriteSheet = {
  src: '/sprites/background_layer_grass.png',
  frameWidth: 7,
  frameHeight: 20,
  columns: 1,
};
```

- [ ] **Step 2: Verify the file still typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/entities/sprites/sheets.ts
git commit -m "feat(platformer): register background-layer sprite sheets"
```

---

### Task 3: `BackgroundLayers.ts` — the compositing function

**Files:**
- Create: `src/themes/platformer/engine/BackgroundLayers.ts`
- Create: `src/themes/platformer/engine/BackgroundLayers.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks except the asset dimensions (hardcoded as
  constants here, matching Task 1/2's real measured sizes).
- Produces: `BackgroundLayerImages` interface (`{ layers, grass: HTMLImageElement }`),
  `SKY_SOURCE_RECT`/`CLOUDS_SOURCE_RECT`/`VILLAGE_SOURCE_RECT` (each `{ sx, sy, width,
  height }`, exported so tests — and any future caller — address bands by name instead
  of a hardcoded sy), `drawBackgroundLayers(ctx: CanvasRenderingContext2D, images:
  BackgroundLayerImages, canvasWidth: number, canvasHeight: number, cameraX: number):
  void` — consumed by Task 4's `PlatformerPage.tsx` change.

This mirrors `drawSkyBackground`'s own testing convention in `Renderer.test.ts`: a fake
`ctx` object that records every `drawImage`/`fillRect` call's arguments, asserted against
directly (no real `<canvas>`, no real images — `HTMLImageElement` stand-ins are plain
objects cast through `as unknown as HTMLImageElement`, since only their identity and
`.width`/`.height` matter to the code under test). Since sky/clouds/village now share one
image (`images.layers`), tests distinguish which band a `drawImage` call belongs to by
its source `sy` (the call's 3rd argument), matching each exported `*_SOURCE_RECT.sy`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/engine/BackgroundLayers.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  drawBackgroundLayers,
  SKY_SOURCE_RECT,
  CLOUDS_SOURCE_RECT,
  VILLAGE_SOURCE_RECT,
  type BackgroundLayerImages,
} from './BackgroundLayers';

function fakeImage(width: number, height: number): HTMLImageElement {
  return { width, height } as unknown as HTMLImageElement;
}

function fakeImages(): BackgroundLayerImages {
  return {
    layers: fakeImage(160, 104),
    grass: fakeImage(7, 20),
  };
}

function fakeCtx() {
  return {
    imageSmoothingEnabled: true,
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D & { drawImage: ReturnType<typeof vi.fn> };
}

// drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) — argument indices used below.
const ARG = { image: 0, sx: 1, sy: 2, sw: 3, sh: 4, dx: 5, dy: 6, dw: 7, dh: 8 } as const;

function callsForSourceY(calls: unknown[][], image: HTMLImageElement, sy: number) {
  return calls.filter((call) => call[ARG.image] === image && call[ARG.sy] === sy);
}

describe('drawBackgroundLayers', () => {
  it('sky-alwaysDrawnAtOrigin-pinnedToTopRegardlessOfCameraX', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 200, 500);

    const skyCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    expect(skyCalls.length).toBeGreaterThan(0);
    for (const call of skyCalls) {
      expect(call[ARG.dy]).toBe(0);
    }
  });

  it('village-pinnedAboveCanvasBottom-atFixedOffsetRegardlessOfCanvasHeight', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 400, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    expect(villageCalls.length).toBeGreaterThan(0);
    const destY = villageCalls[0][ARG.dy] as number;
    const destHeight = villageCalls[0][ARG.dh] as number;
    expect(destY + destHeight).toBeLessThanOrEqual(400);

    const ctx2 = fakeCtx();
    drawBackgroundLayers(ctx2, images, 320, 250, 0);
    const villageCalls2 = callsForSourceY(ctx2.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const destY2 = villageCalls2[0][ARG.dy] as number;
    const destHeight2 = villageCalls2[0][ARG.dh] as number;
    expect(400 - (destY + destHeight)).toBe(250 - (destY2 + destHeight2));
  });

  it('grass-fillsFromVillageBottomToCanvasBottom-noGapPastEdge', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 300, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageBottom = (villageCalls[0][ARG.dy] as number) + (villageCalls[0][ARG.dh] as number);

    const grassCalls = ctx.drawImage.mock.calls.filter((call) => call[ARG.image] === images.grass);
    expect(grassCalls.length).toBeGreaterThan(0);
    const topmostGrassY = Math.min(...grassCalls.map((call) => call[ARG.dy] as number));
    expect(topmostGrassY).toBeLessThanOrEqual(villageBottom);
    for (const call of grassCalls) {
      const y = call[ARG.dy] as number;
      const h = call[ARG.dh] as number;
      expect(y + h).toBeGreaterThan(300 - 20);
    }
  });

  it('cloudsAndHills-fillTheGapBetweenSkyBottomAndVillageTop-atAnyCanvasHeight', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 500, 0);

    const skyCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    const skyBottom = Math.max(...skyCalls.map((call) => (call[ARG.dy] as number) + (call[ARG.dh] as number)));
    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageTop = Math.min(...villageCalls.map((call) => call[ARG.dy] as number));

    const cloudCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, CLOUDS_SOURCE_RECT.sy);
    expect(cloudCalls.length).toBeGreaterThan(0);
    const cloudTop = Math.min(...cloudCalls.map((call) => call[ARG.dy] as number));
    const cloudBottom = Math.max(...cloudCalls.map((call) => (call[ARG.dy] as number) + (call[ARG.dh] as number)));
    expect(cloudTop).toBeLessThanOrEqual(skyBottom);
    expect(cloudBottom).toBeGreaterThanOrEqual(villageTop);
  });

  it('layers-tileHorizontally-coveringTheFullCanvasWidth', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 500, 200, 0);

    for (const sy of [SKY_SOURCE_RECT.sy, CLOUDS_SOURCE_RECT.sy, VILLAGE_SOURCE_RECT.sy]) {
      const calls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, sy);
      const rightmost = Math.max(...calls.map((call) => (call[ARG.dx] as number) + (call[ARG.dw] as number)));
      expect(rightmost).toBeGreaterThanOrEqual(500);
    }
  });

  it('sky-neverShiftsHorizontally-regardlessOfCameraX', () => {
    const ctxA = fakeCtx();
    const ctxB = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctxA, images, 320, 200, 0);
    drawBackgroundLayers(ctxB, images, 320, 200, 999);

    const skyCallsA = callsForSourceY(ctxA.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    const skyCallsB = callsForSourceY(ctxB.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    expect(skyCallsA.map((call) => call[ARG.dx])).toEqual(skyCallsB.map((call) => call[ARG.dx]));
  });

  it('clouds-shiftLessThanGrass-forCameraXGreaterThanZero', () => {
    const ctxAtZero = fakeCtx();
    const ctxAtOffset = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctxAtZero, images, 320, 200, 0);
    drawBackgroundLayers(ctxAtOffset, images, 320, 200, 100);

    const firstCloudX = (calls: unknown[][]) =>
      Math.min(...callsForSourceY(calls, images.layers, CLOUDS_SOURCE_RECT.sy).map((call) => call[ARG.dx] as number));
    const firstGrassX = (calls: unknown[][]) =>
      Math.min(...calls.filter((call) => call[ARG.image] === images.grass).map((call) => call[ARG.dx] as number));

    const cloudShift = Math.abs(firstCloudX(ctxAtOffset.drawImage.mock.calls) - firstCloudX(ctxAtZero.drawImage.mock.calls));
    const grassShift = Math.abs(firstGrassX(ctxAtOffset.drawImage.mock.calls) - firstGrassX(ctxAtZero.drawImage.mock.calls));

    expect(cloudShift).toBeLessThan(grassShift);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/BackgroundLayers.test.ts`
Expected: FAIL — `Cannot find module './BackgroundLayers'`.

- [ ] **Step 3: Implement `BackgroundLayers.ts`**

Use the real dimensions confirmed in Task 1's Step 3/Task 2 if the combined sheet's
actual layout differs from the 160×104 (48/40/16 band heights) assumed below.

```typescript
// src/themes/platformer/engine/BackgroundLayers.ts

/**
 * The parallax background: a combined sky/clouds/village sheet plus a
 * separate small tileable grass swatch — see
 * `specs/S-006-platformer-theme/plans/2026-09-06-background-image-layers-design.md`.
 */
export interface BackgroundLayerImages {
  layers: HTMLImageElement;
  grass: HTMLImageElement;
}

interface SourceRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/** Sub-rects within `BACKGROUND_LAYERS_SHEET`'s image (see `sheets.ts`) — sky,
 *  clouds/hills, and village/treeline stacked vertically in that order, each
 *  spanning the sheet's full 160px width. Exported so tests (and any future
 *  caller) address a band by name instead of a hardcoded sy. */
export const SKY_SOURCE_RECT: SourceRect = { sx: 0, sy: 0, width: 160, height: 48 };
export const CLOUDS_SOURCE_RECT: SourceRect = { sx: 0, sy: 48, width: 160, height: 40 };
export const VILLAGE_SOURCE_RECT: SourceRect = { sx: 0, sy: 88, width: 160, height: 16 };

/** How far the village layer's bottom edge sits above the canvas bottom, in
 *  native (unscaled) pixels — chosen so typical foreground terrain height
 *  doesn't fully hide it. Tuned visually against a real level; see the
 *  design doc's Open items. */
const VILLAGE_BOTTOM_OFFSET = 64;

/** Parallax speed factors: 0 = fixed to the viewport, 1 = full camera speed
 *  (matches the foreground terrain exactly). Clouds/hills scroll slowest,
 *  village faster than clouds but still slower than the foreground, grass
 *  matches the foreground exactly since it reads as a continuation of the
 *  same ground. */
const CLOUDS_PARALLAX_FACTOR = 0.2;
const VILLAGE_PARALLAX_FACTOR = 0.5;
const GRASS_PARALLAX_FACTOR = 1;

/** Draws one source rect tiled horizontally across `canvasWidth`, at native
 *  size, with its top-left at `destY`, offset by `cameraX * parallaxFactor`
 *  (wrapped to the rect's own width so the tiling never visibly seams). */
function drawTiledRow(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: SourceRect,
  destY: number,
  canvasWidth: number,
  cameraX: number,
  parallaxFactor: number,
): void {
  const { sx, sy, width, height } = source;
  const rawOffset = -(cameraX * parallaxFactor) % width;
  // JS `%` can return a negative result; normalize into [-width, 0] so the
  // very first tile always starts at or to the left of x=0.
  const offset = rawOffset > 0 ? rawOffset - width : rawOffset;

  for (let x = offset; x < canvasWidth; x += width) {
    ctx.drawImage(image, sx, sy, width, height, x, destY, width, height);
  }
}

/** Draws one source rect tiled across both axes, filling from `top` to
 *  `bottom` (inclusive of any partial tile at the bottom edge) and across the
 *  full canvas width. */
function drawTiledArea(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: SourceRect,
  top: number,
  bottom: number,
  canvasWidth: number,
  cameraX: number,
  parallaxFactor: number,
): void {
  for (let y = top; y < bottom; y += source.height) {
    drawTiledRow(ctx, image, source, y, canvasWidth, cameraX, parallaxFactor);
  }
}

/**
 * Draws the 4-layer parallax background, replacing the old procedural
 * `drawSkyBackground`. Fixed to the viewport (no `originX`/`originY`
 * level-camera convention — same reasoning as the old sky) except that each
 * layer scrolls horizontally at its own fraction of `cameraX` for a parallax
 * depth effect:
 *
 * - **Sky**: pinned to y=0, never scrolls (`cameraX` ignored).
 * - **Clouds/hills**: tiles to fill the gap between the sky's bottom edge and
 *   the village layer's top edge — this gap grows/shrinks with canvas height.
 *   Slow parallax.
 * - **Village/treeline**: pinned `VILLAGE_BOTTOM_OFFSET` px above the canvas
 *   bottom. Medium parallax.
 * - **Grass**: tiles both axes, filling from the village layer's bottom edge
 *   down to the canvas bottom. Drawn last, so it covers any seam at the
 *   village layer's own bottom edge. Full camera speed — matches the
 *   foreground terrain's own scroll exactly.
 */
export function drawBackgroundLayers(
  ctx: CanvasRenderingContext2D,
  images: BackgroundLayerImages,
  canvasWidth: number,
  canvasHeight: number,
  cameraX: number,
): void {
  ctx.imageSmoothingEnabled = false;

  drawTiledRow(ctx, images.layers, SKY_SOURCE_RECT, 0, canvasWidth, cameraX, 0);

  const villageTop = canvasHeight - VILLAGE_BOTTOM_OFFSET - VILLAGE_SOURCE_RECT.height;
  const villageBottom = villageTop + VILLAGE_SOURCE_RECT.height;
  drawTiledArea(
    ctx, images.layers, CLOUDS_SOURCE_RECT,
    SKY_SOURCE_RECT.height, villageTop, canvasWidth, cameraX, CLOUDS_PARALLAX_FACTOR,
  );

  drawTiledRow(ctx, images.layers, VILLAGE_SOURCE_RECT, villageTop, canvasWidth, cameraX, VILLAGE_PARALLAX_FACTOR);

  const grassSource: SourceRect = { sx: 0, sy: 0, width: images.grass.width, height: images.grass.height };
  drawTiledArea(ctx, images.grass, grassSource, villageBottom, canvasHeight, canvasWidth, cameraX, GRASS_PARALLAX_FACTOR);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/BackgroundLayers.test.ts`
Expected: PASS (all 7 tests).

If `cloudsAndHills-fillTheGapBetweenSkyBottomAndVillageTop…` fails because
`drawTiledArea`'s loop draws one tile that starts before `top` isn't clamped — that's
fine and expected (the last row before `villageTop` may overhang slightly past it,
harmless since the village layer draws on top of it next); the test only asserts the
gap is *covered*, not pixel-exact. If a different assertion fails, re-read the failure
message against the function above before changing the test.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/BackgroundLayers.ts src/themes/platformer/engine/BackgroundLayers.test.ts
git commit -m "feat(platformer): add drawBackgroundLayers compositing function"
```

---

### Task 4: Wire `drawBackgroundLayers` into the real game

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`

**Interfaces:**
- Consumes: `drawBackgroundLayers`, `BackgroundLayerImages` (Task 3);
  `BACKGROUND_LAYERS_SHEET`, `BACKGROUND_LAYER_GRASS_SHEET` (Task 2); `loadImage`
  (already imported in this file, existing signature `(src: string) =>
  Promise<HTMLImageElement>`); `cameraPositionX.value` (already used at line 453 as
  `-cameraPositionX.value` for `originX` — pass `cameraPositionX.value` itself, not
  negated, to `drawBackgroundLayers`'s `cameraX` param).

- [ ] **Step 1: Add 2 new image refs**

In `src/themes/platformer/PlatformerPage.tsx`, near the existing refs (around line
184-186):

```typescript
  const backgroundLayersRef = useRef<HTMLImageElement | null>(null);
  const backgroundLayerGrassRef = useRef<HTMLImageElement | null>(null);
```

- [ ] **Step 2: Update the import list**

Replace `drawSkyBackground` in this file's import from `./engine/Renderer` (around line
32) — remove it, since it no longer exists after Task 5. Add a new import:

```typescript
import { drawBackgroundLayers } from './engine/BackgroundLayers';
```

Add the 2 sheet constants to this file's existing import from
`./entities/sprites/sheets`:

```typescript
import {
  // ...existing imports...
  BACKGROUND_LAYERS_SHEET,
  BACKGROUND_LAYER_GRASS_SHEET,
} from './entities/sprites/sheets';
```

- [ ] **Step 3: Replace the render-loop call**

Replace (around line 458):

```typescript
        drawSkyBackground(ctx, tilesetRef.current, canvas.width, canvas.height, backgroundColor);
```

with:

```typescript
        if (backgroundLayersRef.current && backgroundLayerGrassRef.current) {
          drawBackgroundLayers(
            ctx,
            { layers: backgroundLayersRef.current, grass: backgroundLayerGrassRef.current },
            canvas.width,
            canvas.height,
            cameraPositionX.value,
          );
        }
```

This sits outside the surrounding `if (tilesetRef.current)` block (the old sky draw was
inside it only because it happened to take `tilesetRef.current` as its own `tileset`
argument — the new layers don't depend on `world_tileset.png` at all). Place it
immediately before that `if (tilesetRef.current) { ... }` block so the background still
draws first, same relative draw order as before (background → background-tile-layer →
terrain → signs → entities).

- [ ] **Step 4: Load the 2 new images**

Add alongside the existing `loadImage(...)` calls (near line 1531's
`TERRAIN_BACKGROUND_SHEET` load):

```typescript
    loadImage(BACKGROUND_LAYERS_SHEET.src)
      .then((img) => {
        if (cancelled) return;
        backgroundLayersRef.current = img;
        render();
      })
      .catch(() => {
        // The background simply won't render if this asset fails to load;
        // the plain fillRect fallback still shows so the page isn't blank.
      });
    loadImage(BACKGROUND_LAYER_GRASS_SHEET.src)
      .then((img) => {
        if (cancelled) return;
        backgroundLayerGrassRef.current = img;
        render();
      })
      .catch(() => {
        // Same fallback as the layers sheet above.
      });
```

- [ ] **Step 5: Typecheck and run the existing test suite**

Run: `npx tsc --noEmit`
Expected: no errors (in particular, no leftover reference to `drawSkyBackground` in this
file — if `tsc` still finds one, an edit in Step 2 or 3 was missed).

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS. If any existing test asserted on `drawSkyBackground` being called,
update it to assert `drawBackgroundLayers` is called instead (search this test file for
`drawSkyBackground` first — if no match, no update needed here).

- [ ] **Step 6: Manual verification in the browser**

Start the dev server and open the platformer route with `?debug` (per this repo's
existing dev-route convention). Confirm:
- The illustrated background (blue sky, white clouds, green treeline, grass) renders
  instead of the old flat-color-plus-cloud-tile sky.
- Walking left/right shows clouds/village shifting slower than the foreground terrain,
  and grass shifting at the same speed as the foreground.
- No visible seam/gap between any two layers, and no leftover magenta anywhere.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx
git commit -m "feat(platformer): render the 4-layer parallax background in the game"
```

---

### Task 5: Delete the old procedural sky (dead code removal)

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: nothing (pure deletion).
- Produces: nothing new — `drawSkyBackground`, `recoloredCloudTile`,
  `recoloredCloudTileCache`, `SKY_TILE_SX`, `SKY_WHITE_SY`, `SKY_CLOUD_SY`,
  `SKY_WHITE_ROW_COUNT`, `CLOUD_TILE_SCALE`, `CLOUD_TILE_WHITE_THRESHOLD` all cease to
  exist. Confirmed by grep (see this plan's investigation) that none of these names are
  referenced anywhere outside `Renderer.ts`/`Renderer.test.ts` except
  `PlatformerPage.tsx` (already updated in Task 4).

By this point Task 4 is committed and the game no longer calls `drawSkyBackground` —
this task only removes now-unreachable code, it does not change behavior.

- [ ] **Step 1: Delete the dead code in `Renderer.ts`**

Delete lines 109-230 of `src/themes/platformer/engine/Renderer.ts` (as of this plan —
confirm the exact range by searching for the block starting at the comment `/** Sky
tiles live in \`world_tileset.png\` column 0…` and ending at the closing `}` of
`drawSkyBackground`, right before the `/** Water tiles live in \`world_tileset.png\`
column 4…` comment that begins the next section). This removes:
`SKY_TILE_SX`, `SKY_WHITE_SY`, `SKY_CLOUD_SY`, `SKY_WHITE_ROW_COUNT`,
`CLOUD_TILE_SCALE`, `CLOUD_TILE_WHITE_THRESHOLD`, `recoloredCloudTileCache`,
`recoloredCloudTile`, and `drawSkyBackground`.

- [ ] **Step 2: Delete the dead test suite in `Renderer.test.ts`**

Delete the `describe('drawSkyBackground', () => { ... })` block (lines 2471-2638 as of
this plan — confirm the exact range the same way: search for `describe('drawSkyBackground'`
and delete through its matching closing `});`, which sits immediately before
`describe('drawWaterForeground', ...)`).

- [ ] **Step 3: Remove now-unused imports**

Search `Renderer.test.ts` for any import used only by the deleted suite (e.g. a
`fakeTileset`/canvas-mock helper defined solely for these tests — check whether
`drawWaterForeground`'s or `drawBackgroundTiles`'s tests reuse the same helper before
deleting it; if they do, keep it).

- [ ] **Step 4: Typecheck and run the full platformer test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run src/themes/platformer`
Expected: PASS, with the total test count reduced by exactly the number of tests deleted
in Step 2 (no other test should reference the deleted names — if `tsc` or `vitest`
surfaces one, that reference was missed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "refactor(platformer): remove the old procedural sky (drawSkyBackground)"
```

---

### Task 6: Animate the river (2-frame overlay on the village layer)

**Files:**
- Create: `public/sprites/background_layer_river.png`
- Modify: `src/themes/platformer/entities/sprites/sheets.ts`
- Modify: `src/themes/platformer/engine/BackgroundLayers.ts`
- Modify: `src/themes/platformer/engine/BackgroundLayers.test.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx`

**Interfaces:**
- Consumes: `BackgroundLayerImages` (Task 3, gains a `river` field);
  `worldAnimElapsed` (already tracked in `PlatformerPage.tsx`'s render loop for the coin
  spin/idle timer — reused here, not a new timer).
- Produces: `BACKGROUND_LAYER_RIVER_SHEET` (sheets.ts); `drawBackgroundLayers` gains a
  6th parameter, `worldElapsedMs: number`.

Two wave-line frames, measured from the pristine `backgrounds.png` at
`x16,y200,160×60` overall (confirmed by pixel-scan: content starts at y196, a gap, more
content to y239 — split into two equal 30px-tall frames for simplicity, since this is
thin decorative line art, not a precision-critical asset): frame 0 at `y200,160×30`,
frame 1 at `y230,160×30`. Both chroma-keyed and stacked into one file (frame 0 on top,
frame 1 below), same "no-crop" convention as Task 1.

This renders as a plain **overlay**: drawn at the exact same tiled position and
parallax speed as the village layer (`VILLAGE_PARALLAX_FACTOR`), immediately after it,
so it reads as water animating within the village art rather than a separate layer.

- [ ] **Step 1: Export the 2-frame river asset**

```bash
python3 -c "
from PIL import Image

src = Image.open('public/sprites/backgrounds.png')
frame0 = src.crop((16, 200, 176, 230))
frame1 = src.crop((16, 230, 176, 260))
combined = Image.new('RGBA', (160, 60))
combined.paste(frame0, (0, 0))
combined.paste(frame1, (0, 30))
combined.save('.generated/background_river_magenta.png')
print('wrote .generated/background_river_magenta.png', combined.size)
"
python3 scripts/chroma_key_sprite.py .generated/background_river_magenta.png public/sprites/background_layer_river.png --no-crop
python3 -c "
from PIL import Image
img = Image.open('public/sprites/background_layer_river.png')
print(img.size, img.mode)
"
```

Expected: `(160, 60) RGBA`.

- [ ] **Step 2: Register the sheet**

Append to `src/themes/platformer/entities/sprites/sheets.ts`:

```typescript
/** Two 30px-tall wave-line animation frames stacked vertically (frame 0 on
 *  top, frame 1 below), cropped and chroma-keyed from `backgrounds.png`.
 *  Overlaid on the village layer by `BackgroundLayers.ts`, alternating over
 *  time — not addressed by frame index here either, same loading-only
 *  registration convention as the other background-layer sheets. */
export const BACKGROUND_LAYER_RIVER_SHEET: SpriteSheet = {
  src: '/sprites/background_layer_river.png',
  frameWidth: 160,
  frameHeight: 30,
  columns: 1,
};
```

- [ ] **Step 3: Write the failing test for the animated overlay**

Add to `src/themes/platformer/engine/BackgroundLayers.test.ts` (extend `fakeImages()` to
include `river: fakeImage(160, 60)`, and update every existing `drawBackgroundLayers(...)`
call in this file to pass a 6th argument, `0`, for `worldElapsedMs` — existing tests don't
care about river animation, so a fixed `0` keeps them deterministic):

```typescript
  it('river-alternatesFrame-basedOnWorldElapsedMs', () => {
    const ctx0 = fakeCtx();
    const ctx1 = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx0, images, 320, 200, 0, 0);
    drawBackgroundLayers(ctx1, images, 320, 200, 0, RIVER_FRAME_DURATION_MS);

    const riverCalls0 = ctx0.drawImage.mock.calls.filter((call) => call[ARG.image] === images.river);
    const riverCalls1 = ctx1.drawImage.mock.calls.filter((call) => call[ARG.image] === images.river);
    expect(riverCalls0.length).toBeGreaterThan(0);
    expect(riverCalls1[0][ARG.sy]).not.toBe(riverCalls0[0][ARG.sy]);
  });

  it('river-drawnAtSamePositionAndSpeedAsVillage', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 400, 250, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const riverCalls = ctx.drawImage.mock.calls.filter((call) => call[ARG.image] === images.river);
    expect(riverCalls[0][ARG.dy]).toBe(villageCalls[0][ARG.dy]);
    expect(riverCalls[0][ARG.dx]).toBe(villageCalls[0][ARG.dx]);
  });
```

Also add `river: fakeImage(160, 60)` to `fakeImages()`, and import `RIVER_FRAME_DURATION_MS`
alongside the other named imports from `./BackgroundLayers`.

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/BackgroundLayers.test.ts`
Expected: FAIL — `drawBackgroundLayers` doesn't accept a 6th argument yet, and
`RIVER_FRAME_DURATION_MS` doesn't exist.

- [ ] **Step 5: Implement the overlay**

In `src/themes/platformer/engine/BackgroundLayers.ts`:

```typescript
// Add to BackgroundLayerImages:
export interface BackgroundLayerImages {
  layers: HTMLImageElement;
  grass: HTMLImageElement;
  river: HTMLImageElement;
}

/** How long each of the river's 2 wave-line frames stays on screen before
 *  swapping to the other — a plain alternating flipbook, not a scroll. */
export const RIVER_FRAME_DURATION_MS = 500;
const RIVER_FRAME_HEIGHT = 30;
```

Update the `drawBackgroundLayers` signature and body:

```typescript
export function drawBackgroundLayers(
  ctx: CanvasRenderingContext2D,
  images: BackgroundLayerImages,
  canvasWidth: number,
  canvasHeight: number,
  cameraX: number,
  worldElapsedMs: number,
): void {
  ctx.imageSmoothingEnabled = false;

  drawTiledRow(ctx, images.layers, SKY_SOURCE_RECT, 0, canvasWidth, cameraX, 0);

  const villageTop = canvasHeight - VILLAGE_BOTTOM_OFFSET - VILLAGE_SOURCE_RECT.height;
  const villageBottom = villageTop + VILLAGE_SOURCE_RECT.height;
  drawTiledArea(
    ctx, images.layers, CLOUDS_SOURCE_RECT,
    SKY_SOURCE_RECT.height, villageTop, canvasWidth, cameraX, CLOUDS_PARALLAX_FACTOR,
  );

  drawTiledRow(ctx, images.layers, VILLAGE_SOURCE_RECT, villageTop, canvasWidth, cameraX, VILLAGE_PARALLAX_FACTOR);

  const riverFrameIndex = Math.floor(worldElapsedMs / RIVER_FRAME_DURATION_MS) % 2;
  const riverRect: SourceRect = { sx: 0, sy: riverFrameIndex * RIVER_FRAME_HEIGHT, width: 160, height: RIVER_FRAME_HEIGHT };
  drawTiledRow(ctx, images.river, riverRect, villageTop, canvasWidth, cameraX, VILLAGE_PARALLAX_FACTOR);

  const grassSource: SourceRect = { sx: 0, sy: 0, width: images.grass.width, height: images.grass.height };
  drawTiledArea(ctx, images.grass, grassSource, villageBottom, canvasHeight, canvasWidth, cameraX, GRASS_PARALLAX_FACTOR);
}
```

The river overlay is drawn at `villageTop` — the same destination y the village row
itself uses — and with `VILLAGE_PARALLAX_FACTOR`, so `drawTiledRow`'s internal x-offset
math produces identical x positions to the village row's own tiles; that's what Step 3's
`river-drawnAtSamePositionAndSpeedAsVillage` test checks.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/BackgroundLayers.test.ts`
Expected: PASS (all tests, including the 2 new ones).

- [ ] **Step 7: Wire into `PlatformerPage.tsx`**

Add a ref, load the image, and pass `worldAnimElapsed` (this file's existing per-frame
timer, already updated each tick for the coin spin/idle animation — reused here as the
"world elapsed" clock, not a second timer):

```typescript
  const backgroundLayerRiverRef = useRef<HTMLImageElement | null>(null);
```

```typescript
    loadImage(BACKGROUND_LAYER_RIVER_SHEET.src)
      .then((img) => {
        if (cancelled) return;
        backgroundLayerRiverRef.current = img;
        render();
      })
      .catch(() => {
        // The river simply won't animate if this asset fails to load; the
        // rest of the background still shows.
      });
```

Update the render-loop call from Task 4 to include the river image and pass
`worldAnimElapsed`:

```typescript
        if (
          backgroundLayersRef.current &&
          backgroundLayerGrassRef.current &&
          backgroundLayerRiverRef.current
        ) {
          drawBackgroundLayers(
            ctx,
            {
              layers: backgroundLayersRef.current,
              grass: backgroundLayerGrassRef.current,
              river: backgroundLayerRiverRef.current,
            },
            canvas.width,
            canvas.height,
            cameraPositionX.value,
            worldAnimElapsed,
          );
        }
```

Add `BACKGROUND_LAYER_RIVER_SHEET` to the existing `sheets.ts` import list.

- [ ] **Step 8: Typecheck, run tests, manual verification**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npx vitest run src/themes/platformer` — expected: PASS.

In the browser (`?debug` route), confirm the river visibly alternates between its two
wave frames every half second, at the same screen position as the village art's own
river drip, scrolling at the same speed as the treeline.

- [ ] **Step 9: Commit**

```bash
git add public/sprites/background_layer_river.png src/themes/platformer/entities/sprites/sheets.ts src/themes/platformer/engine/BackgroundLayers.ts src/themes/platformer/engine/BackgroundLayers.test.ts src/themes/platformer/PlatformerPage.tsx
git commit -m "feat(platformer): animate the river as a 2-frame overlay on the village layer"
```

---

## After this plan

Update `specs/S-006-platformer-theme/roadmap.md`: move this feature from "Unscheduled
additions" into the numbered roadmap as **Step 43**, checked off, per this repo's
existing convention (see the entries for steps 32-42). Open a PR per the branch
strategy in `roadmap.md` (`S-006-step43-background-image-layers` → `main`).
