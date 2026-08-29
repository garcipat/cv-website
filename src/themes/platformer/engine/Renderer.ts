import {
  isSolid,
  tileAt,
  isTopExposed,
  bridgeRunPosition,
  tileToPixel,
  TILE_SIZE,
  RENDERED_TILE_SIZE,
} from '../level/Terrain';
import type { LevelDef, TileType } from '../level/LevelData';
import {
  PLAYER_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  JUMP_FRAME_SIZE,
  playerFrameSource,
  jumpFrameSource,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import {
  MAX_HEARTS,
  HEART_FRAME_SIZE,
  HEART_RENDERED_SIZE,
  heartRemaining,
  heartFrameIndex,
} from '../entities/Health';
import {
  COIN_FRAME_SIZE,
  COIN_RENDERED_SIZE,
  coinFrameIndex,
  coinFrameSource,
  coinBobOffset,
} from '../entities/Coin';
import { FRUIT_FRAME_SIZE, fruitFrameSource } from '../entities/Fruit';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import {
  ENEMY_FRAME_SIZE,
  ENEMY_RENDERED_SIZE,
  ENEMY_TILE_OFFSET_X,
  ENEMY_TILE_OFFSET_Y,
  enemyFrameSource,
} from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import { flightEffectPosition, sparkleParticles } from './CollectionEffects';
import type { FlightEffect } from './CollectionEffects';

function tileSource(
  level: LevelDef,
  type: TileType,
  col: number,
  row: number,
): { sx: number; sy: number } | null {
  switch (type) {
    case 'groundGrass':
      return isTopExposed(level, col, row)
        ? { sx: 0, sy: 0 }
        : { sx: 0, sy: TILE_SIZE };
    case 'groundRock':
      return isTopExposed(level, col, row)
        ? { sx: TILE_SIZE, sy: 0 }
        : { sx: TILE_SIZE, sy: TILE_SIZE };
    case 'platform':
      return { sx: 0, sy: 0 };
    case 'wall':
      return { sx: 8 * TILE_SIZE, sy: 0 };
    case 'bridge': {
      const position = bridgeRunPosition(level, col, row);
      if (position === 'left') return { sx: 9 * TILE_SIZE, sy: 2 * TILE_SIZE }; // ramp down
      if (position === 'right') return { sx: 11 * TILE_SIZE, sy: 2 * TILE_SIZE }; // ramp up
      return { sx: 10 * TILE_SIZE, sy: 2 * TILE_SIZE }; // low (middle, or a lone single tile)
    }
    case 'empty':
      return null;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Draws the level's terrain. `originX` shifts every tile horizontally and
 * `originY` shifts every tile vertically (e.g. to anchor the level to the
 * bottom of a taller-than-the-level canvas instead of drawing it pinned to
 * the top with empty space below, or to scroll it horizontally with the
 * camera). Both default to 0 (level drawn at its raw grid position,
 * top-left origin).
 */
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const tile = tileAt(level, col, row);
      if (!isSolid(tile)) continue;

      const source = tileSource(level, tile, col, row);
      if (!source) continue;

      const { x, y } = tileToPixel(col, row);
      ctx.drawImage(
        tileset,
        source.sx,
        source.sy,
        TILE_SIZE,
        TILE_SIZE,
        x + originX,
        y + originY,
        RENDERED_TILE_SIZE,
        RENDERED_TILE_SIZE,
      );
    }
  }
}

/**
 * Draws the player sprite. `originX` and `originY` shift it horizontally and
 * vertically by the same amounts as `drawTerrain`'s `originX`/`originY`, so
 * the player stays aligned with the terrain (bottom-anchored, camera-scrolled,
 * or both). When `player.facing` is `'left'`, the sprite is mirrored
 * horizontally around its own bounding box — the sheet only needs to depict
 * the character facing one direction. `jumpSpriteSheet` is a separate,
 * higher-resolution sheet used only while `animState === 'jump'` (the
 * placeholder primary sheet has no jump row); if it hasn't loaded yet, this
 * falls back to the primary sheet's current frame rather than drawing
 * nothing.
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  spriteSheet: HTMLImageElement,
  originX = 0,
  originY = 0,
  jumpSpriteSheet: HTMLImageElement | null = null,
): void {
  ctx.imageSmoothingEnabled = false;

  const useJumpSheet = player.animState === 'jump' && jumpSpriteSheet !== null;
  const frameSize = useJumpSheet ? JUMP_FRAME_SIZE : PLAYER_FRAME_SIZE;
  const sheet = useJumpSheet ? jumpSpriteSheet : spriteSheet;
  const { sx, sy } = useJumpSheet
    ? jumpFrameSource(player.vy, player.animFrame)
    : playerFrameSource(player.animState, player.animFrame);

  if (player.facing === 'left') {
    ctx.save();
    ctx.translate(player.x + originX + PLAYER_RENDERED_SIZE, player.y + originY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      sheet,
      sx,
      sy,
      frameSize,
      frameSize,
      0,
      0,
      PLAYER_RENDERED_SIZE,
      PLAYER_RENDERED_SIZE,
    );
    ctx.restore();
    return;
  }

  ctx.drawImage(
    sheet,
    sx,
    sy,
    frameSize,
    frameSize,
    player.x + originX,
    player.y + originY,
    PLAYER_RENDERED_SIZE,
    PLAYER_RENDERED_SIZE,
  );
}

const HUD_MARGIN = 16;
const HEART_SPACING = 4;

/**
 * Reserves room at the HUD's top-left for the journal icon button (a DOM
 * `<img>`/`<button>`, not canvas-drawn — see `PlatformerPage.tsx`) so the
 * heart HUD doesn't render underneath it. 40 is the icon button's size
 * (`size-10` in Tailwind), 8 is the gap between it and the first heart —
 * both must stay in sync with `PlatformerPage.tsx`'s icon button sizing if
 * either changes.
 */
export const HEARTS_START_X = HUD_MARGIN + 40 + 8;

/**
 * Draws the heart HUD at a fixed screen position (top-left by default),
 * unlike `drawTerrain`/`drawPlayer` which take camera-scroll
 * `originX`/`originY` — the HUD must stay put on screen regardless of how
 * far the camera has scrolled into the level. `startX` defaults to
 * `HUD_MARGIN` (the original, unshifted position) so existing callers are
 * unaffected; `PlatformerPage.tsx` passes `HEARTS_START_X` explicitly to
 * make room for the journal icon button.
 */
export function drawHearts(
  ctx: CanvasRenderingContext2D,
  halfHearts: number,
  heartsSheet: HTMLImageElement,
  startX: number = HUD_MARGIN,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < MAX_HEARTS; i++) {
    const remaining = heartRemaining(halfHearts, i);
    const sx = heartFrameIndex(remaining) * HEART_FRAME_SIZE;
    const x = startX + i * (HEART_RENDERED_SIZE + HEART_SPACING);
    ctx.drawImage(
      heartsSheet,
      sx,
      0,
      HEART_FRAME_SIZE,
      HEART_FRAME_SIZE,
      x,
      HUD_MARGIN,
      HEART_RENDERED_SIZE,
      HEART_RENDERED_SIZE,
    );
  }
}

/**
 * Paints solid black over the whole canvas except a circular hole of
 * `radius` centered on (centerX, centerY), using the canvas 2D API's
 * even-odd fill rule on two subpaths (the full-canvas rect, then the
 * circle) instead of an offscreen buffer + composite-operation punch —
 * simpler and avoids an extra canvas. `centerX`/`centerY` are screen-space
 * (caller adds the camera originX/originY, matching drawTerrain/drawPlayer's
 * convention). `radius <= 0` draws solid black with no hole at all — the
 * `awaitingRestart` phase and the very start of a death both rely on this.
 */
export function drawIrisOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  if (radius > 0) {
    ctx.moveTo(centerX + radius, centerY);
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
  }
  ctx.fill('evenodd');
  ctx.restore();
}

const RESTART_PROMPT_TEXT = 'Press any button to restart';

/**
 * Family name registered with `document.fonts` by engine/FontLoader.ts's
 * `loadFont` call (see PlatformerPage.tsx's mount effect) for
 * `RESTART_PROMPT_FONT_URL`. Kept alongside the draw call that uses it so
 * the loaded family name and the drawn family name can't drift apart.
 */
export const RESTART_PROMPT_FONT_FAMILY = 'ByteBounce';

/** Public path to the font file loaded for RESTART_PROMPT_FONT_FAMILY. */
export const RESTART_PROMPT_FONT_URL = '/fonts/bytebounce.medium.ttf';

/** Draws the death-screen restart prompt, centered on the canvas. Only ever
 *  drawn on top of a fully-closed drawIrisOverlay (radius 0), so no
 *  background/contrast handling is needed here. Falls back to the
 *  sans-serif stack if RESTART_PROMPT_FONT_FAMILY hasn't finished loading
 *  (or failed to) by the time this is drawn. */
export function drawRestartPrompt(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `24px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(RESTART_PROMPT_TEXT, canvasWidth / 2, canvasHeight / 2);
  ctx.restore();
}

/**
 * Draws every not-yet-collected placement — coins spin (Coin.ts's
 * coinFrameIndex/coinFrameSource) from `coinSprite`, fruits stay on one
 * fixed icon frame (Fruit.ts's fruitFrameSource, keyed by a stable index
 * derived from the placement's position among all fruit-type placements —
 * good enough for visual variety without needing to store a chosen index
 * per placement, and stable regardless of which fruits have been collected)
 * from `fruitSprite`. Both bob (Coin.ts's coinBobOffset, shared — bobbing
 * isn't coin-specific). Same originX/originY convention as
 * drawTerrain/drawPlayer.
 *
 * `coinSprite`/`fruitSprite` may each independently be `null` (e.g. that
 * sprite's image failed to load) — that type's collectibles are simply
 * skipped for the frame rather than the whole call being skipped, so a
 * missing fruit sprite never hides coins and vice versa.
 */
export function drawCollectibles(
  ctx: CanvasRenderingContext2D,
  placements: CollectiblePlacement[],
  coinSprite: HTMLImageElement | null,
  fruitSprite: HTMLImageElement | null,
  collectedIds: ReadonlySet<string>,
  elapsedSeconds: number,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  const coinFrame = coinFrameIndex(elapsedSeconds);
  const coinSource = coinFrameSource(coinFrame);
  const bob = coinBobOffset(elapsedSeconds);

  let fruitIndex = 0;
  for (const placement of placements) {
    if (placement.spriteType === 'coin') {
      if (collectedIds.has(placement.id) || !coinSprite) continue;
      ctx.drawImage(
        coinSprite,
        coinSource.sx,
        coinSource.sy,
        COIN_FRAME_SIZE,
        COIN_FRAME_SIZE,
        placement.x + originX,
        placement.y + originY + bob,
        COIN_RENDERED_SIZE,
        COIN_RENDERED_SIZE,
      );
    } else {
      const { sx, sy } = fruitFrameSource(fruitIndex);
      fruitIndex += 1;
      if (collectedIds.has(placement.id) || !fruitSprite) continue;
      ctx.drawImage(
        fruitSprite,
        sx,
        sy,
        FRUIT_FRAME_SIZE,
        FRUIT_FRAME_SIZE,
        placement.x + originX,
        placement.y + originY + bob,
        COIN_RENDERED_SIZE,
        COIN_RENDERED_SIZE,
      );
    }
  }
}

/**
 * Draws every enemy at its current state position, direction, and animation
 * frame. Each enemy carries its own animState and animFrame (updated per
 * frame during patrol movement — Tasks 5+), so this reads per-enemy state
 * rather than a shared clock. spriteType picks which sheet: slimeGreen for
 * Certificates, slimePurple for Projects. Either sprite sheet may
 * independently be null (not yet loaded); that type's enemies are simply
 * skipped for the frame, same convention as drawCollectibles's
 * coinSprite/fruitSprite handling. Left-facing enemies are mirrored via
 * save/translate/scale(-1,1)/restore pattern, matching drawPlayer's
 * left-facing behavior. Same originX/originY convention as
 * drawTerrain/drawPlayer/drawCollectibles.
 */
export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: EnemyState[],
  slimeGreenSprite: HTMLImageElement | null,
  slimePurpleSprite: HTMLImageElement | null,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  for (const enemy of enemies) {
    const sprite = enemy.spriteType === 'slimeGreen' ? slimeGreenSprite : slimePurpleSprite;
    if (!sprite) continue;

    const { sx, sy } = enemyFrameSource(enemy.animState, enemy.animFrame);
    const dx = enemy.x + ENEMY_TILE_OFFSET_X + originX;
    const dy = enemy.y + ENEMY_TILE_OFFSET_Y + originY;

    if (enemy.direction === 'left') {
      // Mirrors drawPlayer's left-facing flip: translate to the sprite's
      // right edge, then scale(-1, 1) so drawImage's own (0, 0) origin lands
      // where the mirrored sprite's top-left should visually appear.
      ctx.save();
      ctx.translate(dx + ENEMY_RENDERED_SIZE, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(
        sprite,
        sx,
        sy,
        ENEMY_FRAME_SIZE,
        ENEMY_FRAME_SIZE,
        0,
        0,
        ENEMY_RENDERED_SIZE,
        ENEMY_RENDERED_SIZE,
      );
      ctx.restore();
      continue;
    }

    ctx.drawImage(
      sprite,
      sx,
      sy,
      ENEMY_FRAME_SIZE,
      ENEMY_FRAME_SIZE,
      dx,
      dy,
      ENEMY_RENDERED_SIZE,
      ENEMY_RENDERED_SIZE,
    );
  }
}

const COLLECTION_EFFECT_FONT_SIZE = 28;
const COLLECTION_EFFECT_ICON_FONT_SIZE = 20;
const COLLECTION_EFFECT_ICON_GAP = 6;
const SPARKLE_RADIUS_PX = 3;

/** Draws every active collection-effect's fact text at its current
 *  hover/flight position and opacity (see CollectionEffects.ts), plus a
 *  sparkle burst anchored at the collection point (effect.startX/startY —
 *  not the current hover/flying position; the burst happens once, right
 *  where the collectible was, not following the text as it flies). Positions
 *  are already screen-space (no originX/originY here — unlike
 *  drawCollectibles, this doesn't scroll with the camera; see
 *  CollectionEffects.ts's FlightEffect doc comment). */
export function drawCollectionEffects(ctx: CanvasRenderingContext2D, effects: FlightEffect[]): void {
  for (const effect of effects) {
    const { x, y, opacity } = flightEffectPosition(effect);
    if (opacity > 0) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#fff';
      ctx.font = `${COLLECTION_EFFECT_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(effect.text, x, y);

      // Drawn as a SEPARATE fillText, in a plain system font (not the pixel
      // font above) — a custom @font-face has no emoji glyphs, and canvas
      // text doesn't fall back to a system emoji font mid-string the way
      // DOM text does, so an emoji baked into `effect.text` silently didn't
      // render. Positioned just left of the text using the text's measured
      // half-width, rather than baked into one centered string.
      if (effect.icon) {
        const textHalfWidth = ctx.measureText(effect.text).width / 2;
        ctx.font = `${COLLECTION_EFFECT_ICON_FONT_SIZE}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(effect.icon, x - textHalfWidth - COLLECTION_EFFECT_ICON_GAP, y);
      }
      ctx.restore();
    }

    for (const sparkle of sparkleParticles(effect.elapsed)) {
      ctx.save();
      ctx.globalAlpha = sparkle.opacity;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(effect.startX + sparkle.dx, effect.startY + sparkle.dy, SPARKLE_RADIUS_PX, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Matches HEART_RENDERED_SIZE so the coin/fruit counter icons read as the
// same HUD "row height" as the hearts, not a smaller secondary element.
const COUNTER_ICON_SIZE = HEART_RENDERED_SIZE;
const COUNTER_TEXT_GAP = 6;

/**
 * Draws one "[icon] collected / max" counter at a caller-chosen fixed screen
 * position — generalized from step 11's single hardcoded-position
 * drawCoinCounter so PlatformerPage.tsx (Task 8) can place a coin counter
 * and a fruit counter side by side, each with its own sprite icon so it's
 * visually unambiguous which counter measures what.
 */
export function drawCollectibleCounter(
  ctx: CanvasRenderingContext2D,
  icon: HTMLImageElement,
  iconFrame: { sx: number; sy: number; size: number },
  collected: number,
  max: number,
  x: number,
  y: number,
  // Nudges only the icon (never the text) vertically from its default
  // centered position — coin.png/fruit.png's artwork is already centered
  // within its native frame, but Enemy.ts's slime frames are bottom-anchored
  // (no transparent padding below the feet, per ENEMY_TILE_OFFSET_Y's doc
  // comment), which reads as sitting too low once scaled into this counter's
  // fixed-size icon box. Defaults to 0 (coin/fruit's existing behavior,
  // unchanged); the enemy-defeated counter (PlatformerPage.tsx) passes a
  // small negative value to compensate.
  iconYOffset = 0,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    icon,
    iconFrame.sx,
    iconFrame.sy,
    iconFrame.size,
    iconFrame.size,
    x,
    y - COUNTER_ICON_SIZE / 2 + iconYOffset,
    COUNTER_ICON_SIZE,
    COUNTER_ICON_SIZE,
  );

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${collected} / ${max}`, x + COUNTER_ICON_SIZE + COUNTER_TEXT_GAP, y);
  ctx.restore();
}
