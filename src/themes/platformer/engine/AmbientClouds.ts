import { BACKGROUND_RENDER_SCALE } from './BackgroundLayers';

/**
 * The ambient cloud layer (O-022): a handful of soft clouds that drift
 * right-to-left across the open sky, so the platformer's backdrop stays alive
 * while the player stands still. Their own drift is camera-independent, but
 * they also pick up a small camera-linked parallax shift matching the painted
 * clouds/hills band, so they read as living at that band's depth.
 *
 * This module is pure and canvas-light — the only DOM type it touches is the
 * 2D context in `drawAmbientClouds`. All geometry is screen-space rendered
 * pixels. The cloud state itself lives as a loop-local value in
 * `PlatformerPage.tsx` (the same pattern as `worldAnimElapsed`); nothing else
 * reads it, so it is deliberately not a signal.
 *
 * The cloud shapes are addressed through explicit source rects rather than a
 * frame grid, because `ambient_clouds.png` is not a uniform grid — the four
 * clouds differ in width. See
 * `specs/O-022-ambient-clouds/research.md` (D3) and
 * `specs/O-022-ambient-clouds/data-model.md`.
 */

/** One authored cloud silhouette within `public/sprites/ambient_clouds.png`
 *  (185x32): the top-left of its opaque bounds plus its native size. */
export interface CloudSourceRect {
  readonly sx: number;
  readonly sy: number;
  readonly width: number;
  readonly height: number;
}

/** One drifting cloud instance. */
export interface AmbientCloud {
  /** Index into `AMBIENT_CLOUD_SOURCE_RECTS` (FR-005). */
  shapeIndex: number;
  /** Vertical slot, `[0, population)`; distinct per cloud, so no two sit on the
   *  same line (FR-003). */
  lane: number;
  /** Left edge in screen-space rendered px; drifts right -> left (FR-002). */
  x: number;
  /** Top edge in screen-space rendered px. */
  y: number;
  /** Rendered px per second, positive (moves right -> left). */
  speed: number;
}

/** The whole ambient layer's state — the only stored value this feature adds. */
export interface CloudField {
  readonly clouds: readonly AmbientCloud[];
  /** Seeded PRNG state, advanced on each respawn (spec Assumption "Variation
   *  is seeded"). */
  readonly rngState: number;
  /** Width the field was built for; drives density and the right-edge respawn x. */
  readonly playAreaWidth: number;
  /** Bottom of the HUD's dark top margin — the open sky's top edge. */
  readonly skyTop: number;
  /** The painted clouds/hills band's top edge — the open sky's bottom edge
   *  (deliberately named differently from `BackgroundBandGeometry.skyBottom`,
   *  which is the sky image's own bottom). */
  readonly openSkyBottom: number;
}

/** The four authored cloud shapes. Measured from the sheet's opaque bounds; all
 *  four are bottom-aligned at sheet row 31 (see research D3). */
export const AMBIENT_CLOUD_SOURCE_RECTS: readonly CloudSourceRect[] = [
  { sx: 0, sy: 16, width: 33, height: 16 },
  { sx: 41, sy: 12, width: 43, height: 20 },
  { sx: 92, sy: 12, width: 43, height: 20 },
  { sx: 143, sy: 0, width: 42, height: 32 },
];

/** The shortest native shape height (16) — the FR-013 fit threshold: a sky
 *  band shorter than `MIN_SHAPE_HEIGHT * BACKGROUND_RENDER_SCALE` cannot hold
 *  even the smallest cloud, so the layer is omitted. */
export const MIN_SHAPE_HEIGHT = Math.min(...AMBIENT_CLOUD_SOURCE_RECTS.map((rect) => rect.height));

/** Rendered px of play-area width per cloud (FR-015). */
export const CLOUD_SPACING_PX = 300;

/** Floor on the population, so a narrow viewport is never empty (FR-015). */
export const MIN_CLOUD_COUNT = 3;

/** Slowest drift, in rendered px/s — visibly moves over seconds (FR-002). */
export const CLOUD_MIN_SPEED_PX_PER_SEC = 3;

/** Fastest drift, in rendered px/s — gives a visible spread of speeds (SC-002). */
export const CLOUD_MAX_SPEED_PX_PER_SEC = 7;

/** Range of the re-entry x offset beyond the right edge (FR-007). */
export const CLOUD_RESPAWN_JITTER_PX = 160;

/** How much of the camera's horizontal movement the ambient layer follows, on
 *  top of its own drift — the same factor the painted clouds/hills band uses
 *  (`CLOUDS_PARALLAX_FACTOR` in `BackgroundLayers.ts`), so the ambient clouds
 *  read as living at that band's depth rather than pasted on the screen
 *  (FR-002). 0 would be fully viewport-fixed; 1 would match the foreground. */
export const AMBIENT_CLOUD_PARALLAX_FACTOR = 0.2;

/** Default PRNG seed — makes a session's variation reproducible (spec
 *  Assumption "Variation is seeded"). */
export const AMBIENT_CLOUD_SEED = 0x9e3779b9;

/** The widest native shape width, used to spread initial placement across
 *  `[-MAX_SHAPE_WIDTH, playAreaWidth)` so no cloud starts mid-sky (FR-008). */
const MAX_SHAPE_WIDTH = Math.max(...AMBIENT_CLOUD_SOURCE_RECTS.map((rect) => rect.width));

/** The mulberry32 PRNG step: returns the next state and a float in `[0, 1)`.
 *  A four-line, dependency-free generator — enough for decorative variation,
 *  and deterministic so tests can assert an exact sequence (research D4). */
function nextRandom(state: number): { readonly value: number; readonly state: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: nextState };
}

/** How many clouds a play area of `playAreaWidth` should hold: one per
 *  `CLOUD_SPACING_PX`, floored at `MIN_CLOUD_COUNT` (FR-015, SC-007). */
export function cloudPopulationFor(playAreaWidth: number): number {
  return Math.max(MIN_CLOUD_COUNT, Math.round(playAreaWidth / CLOUD_SPACING_PX));
}

/** The shapes whose rendered height fits inside a region of `regionHeight` px.
 *  A short sky that cannot hold even the smallest cloud yields an empty list,
 *  which both `createCloudField` and `stepCloudField` treat as "no layer". */
function shapesFitting(regionHeight: number): readonly CloudSourceRect[] {
  return AMBIENT_CLOUD_SOURCE_RECTS.filter(
    (rect) => rect.height * BACKGROUND_RENDER_SCALE <= regionHeight,
  );
}

/** The top edge for a cloud in `lane`, given the region and the shape's native
 *  height: derived from its lane's bottom, then clamped inside
 *  `[skyTop, openSkyBottom]` so it never spills over another band (FR-010). */
function laneTop(
  skyTop: number,
  openSkyBottom: number,
  population: number,
  lane: number,
  shapeHeight: number,
): number {
  const regionHeight = openSkyBottom - skyTop;
  const laneBottom = skyTop + (regionHeight * (lane + 1)) / population;
  const renderedHeight = shapeHeight * BACKGROUND_RENDER_SCALE;
  const maxTop = openSkyBottom - renderedHeight;
  return Math.max(skyTop, Math.min(laneBottom - renderedHeight, maxTop));
}

/**
 * Builds a fresh cloud field for the given play area and open sky region.
 *
 * - Population is `cloudPopulationFor(playAreaWidth)`.
 * - Each cloud owns its own lane and a distinct initial speed drawn from
 *   `[CLOUD_MIN_SPEED_PX_PER_SEC, CLOUD_MAX_SPEED_PX_PER_SEC]` (FR-003), so at
 *   least three distinct speeds/heights appear at the default population.
 * - Initial `x` is spread across `[-MAX_SHAPE_WIDTH, playAreaWidth)` so the sky
 *   is populated immediately without any cloud appearing mid-sky (FR-006,
 *   FR-008).
 * - Shapes cycle through the four authored silhouettes, so more than one is
 *   present (FR-005).
 * - Returns an **empty** field when the region is too short for the shortest
 *   shape (FR-013).
 * - `seed` defaults to `AMBIENT_CLOUD_SEED`; the same seed and inputs yield an
 *   equal field (spec Assumption "Variation is seeded").
 */
export function createCloudField(
  playAreaWidth: number,
  skyTop: number,
  openSkyBottom: number,
  seed: number = AMBIENT_CLOUD_SEED,
): CloudField {
  const population = cloudPopulationFor(playAreaWidth);
  const regionHeight = openSkyBottom - skyTop;
  const fittingShapes = shapesFitting(regionHeight);

  if (fittingShapes.length === 0) {
    return { clouds: [], rngState: seed, playAreaWidth, skyTop, openSkyBottom };
  }

  let rngState = seed;
  const clouds: AmbientCloud[] = [];

  for (let lane = 0; lane < population; lane++) {
    const shape = fittingShapes[lane % fittingShapes.length];
    const shapeIndex = AMBIENT_CLOUD_SOURCE_RECTS.indexOf(shape);

    // Spread the base speed by lane, then jitter within that lane's slot — the
    // slots stay strictly ordered, so the speeds are distinct by construction
    // (guaranteeing SC-002's "at least three distinct speeds").
    const speedDraw = nextRandom(rngState);
    rngState = speedDraw.state;
    const speed =
      CLOUD_MIN_SPEED_PX_PER_SEC +
      (CLOUD_MAX_SPEED_PX_PER_SEC - CLOUD_MIN_SPEED_PX_PER_SEC) *
        ((lane + 0.15 + speedDraw.value * 0.7) / population);

    const xDraw = nextRandom(rngState);
    rngState = xDraw.state;
    const x = -MAX_SHAPE_WIDTH + xDraw.value * (playAreaWidth + MAX_SHAPE_WIDTH);

    clouds.push({
      shapeIndex,
      lane,
      x,
      y: laneTop(skyTop, openSkyBottom, population, lane, shape.height),
      speed,
    });
  }

  return { clouds, rngState, playAreaWidth, skyTop, openSkyBottom };
}

/**
 * Advances the field by `dtSeconds`.
 *
 * - Under `reducedMotion`, returns the field unchanged — the clouds stay drawn
 *   but stationary (FR-014).
 * - Otherwise moves every cloud `x -= speed * dtSeconds` (right -> left,
 *   FR-002).
 * - A cloud fully past the left edge respawns at the right edge with a new
 *   speed, a **different** shape and its `y` re-fit to that shape's height
 *   (FR-005/FR-006/FR-007/FR-008).
 * - Pure: returns a new field and never mutates the input.
 */
export function stepCloudField(
  field: CloudField,
  dtSeconds: number,
  reducedMotion: boolean,
): CloudField {
  if (reducedMotion || field.clouds.length === 0) return field;

  const population = field.clouds.length;
  const regionHeight = field.openSkyBottom - field.skyTop;
  const fittingShapes = shapesFitting(regionHeight);

  let rngState = field.rngState;

  const clouds = field.clouds.map((cloud) => {
    const shape = AMBIENT_CLOUD_SOURCE_RECTS[cloud.shapeIndex];
    const renderedWidth = shape.width * BACKGROUND_RENDER_SCALE;
    const x = cloud.x - cloud.speed * dtSeconds;

    // Still on screen (or only partly off the left edge): just drift.
    if (x + renderedWidth >= 0) {
      return { ...cloud, x };
    }

    // Fully past the left edge — respawn from the right with a new speed.
    const speedDraw = nextRandom(rngState);
    rngState = speedDraw.state;
    const speed =
      CLOUD_MIN_SPEED_PX_PER_SEC +
      (CLOUD_MAX_SPEED_PX_PER_SEC - CLOUD_MIN_SPEED_PX_PER_SEC) * speedDraw.value;

    // A different silhouette from the one that just left, so the procession
    // does not visibly repeat (FR-005/FR-007).
    const shapeDraw = nextRandom(rngState);
    rngState = shapeDraw.state;
    const alternatives = fittingShapes.filter(
      (rect) => AMBIENT_CLOUD_SOURCE_RECTS.indexOf(rect) !== cloud.shapeIndex,
    );
    const pool = alternatives.length > 0 ? alternatives : fittingShapes;
    const nextShape = pool[Math.floor(shapeDraw.value * pool.length) % pool.length];
    const shapeIndex = AMBIENT_CLOUD_SOURCE_RECTS.indexOf(nextShape);

    const xDraw = nextRandom(rngState);
    rngState = xDraw.state;
    const respawnX = field.playAreaWidth + xDraw.value * CLOUD_RESPAWN_JITTER_PX;

    return {
      shapeIndex,
      lane: cloud.lane,
      x: respawnX,
      y: laneTop(field.skyTop, field.openSkyBottom, population, cloud.lane, nextShape.height),
      speed,
    };
  });

  return { ...field, clouds, rngState };
}

/**
 * Draws the ambient layer at the backdrop's own `BACKGROUND_RENDER_SCALE`
 * (FR-004) with `imageSmoothingEnabled` off and each dest x rounded to a whole
 * pixel (FR-009). The layer carries its own right->left drift, plus a small
 * camera-linked parallax shift (`cameraX * AMBIENT_CLOUD_PARALLAX_FACTOR`) that
 * matches the painted clouds/hills band, so it reads as living at that depth
 * (FR-002). It is still drawn behind everything else (FR-011).
 *
 * Returns immediately when `image` is null (FR-012) or the field is empty
 * (FR-013), so a failed load or a too-short sky simply omits the layer without
 * breaking the frame. The caller draws everything else after it (FR-011).
 */
export function drawAmbientClouds(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  field: CloudField,
  cameraX: number,
): void {
  if (image === null || field.clouds.length === 0) return;

  ctx.imageSmoothingEnabled = false;

  for (const cloud of field.clouds) {
    const shape = AMBIENT_CLOUD_SOURCE_RECTS[cloud.shapeIndex];
    if (!shape) continue;
    ctx.drawImage(
      image,
      shape.sx,
      shape.sy,
      shape.width,
      shape.height,
      Math.round(cloud.x - cameraX * AMBIENT_CLOUD_PARALLAX_FACTOR),
      cloud.y,
      shape.width * BACKGROUND_RENDER_SCALE,
      shape.height * BACKGROUND_RENDER_SCALE,
    );
  }
}
