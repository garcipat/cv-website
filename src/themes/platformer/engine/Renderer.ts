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
import type { CoinPlacement } from '../entities/Coin';

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
 * Draws the heart HUD at a fixed screen position (top-left), unlike
 * `drawTerrain`/`drawPlayer` which take camera-scroll `originX`/`originY` —
 * the HUD must stay put on screen regardless of how far the camera has
 * scrolled into the level.
 */
export function drawHearts(
  ctx: CanvasRenderingContext2D,
  halfHearts: number,
  heartsSheet: HTMLImageElement,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < MAX_HEARTS; i++) {
    const remaining = heartRemaining(halfHearts, i);
    const sx = heartFrameIndex(remaining) * HEART_FRAME_SIZE;
    const x = HUD_MARGIN + i * (HEART_RENDERED_SIZE + HEART_SPACING);
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
 * Draws every coin at the current shared spin frame, offset a few pixels up
 * or down by the current shared bob position (all coins spin and bob in sync
 * — see Coin.ts's coinFrameIndex/coinBobOffset). Same originX/originY
 * convention as drawTerrain/drawPlayer, since coins live in world space and
 * must scroll with the camera; the bob offset is applied on top of that, not
 * instead of it.
 */
export function drawCoins(
  ctx: CanvasRenderingContext2D,
  coins: CoinPlacement[],
  sprite: HTMLImageElement,
  elapsedSeconds: number,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  const frame = coinFrameIndex(elapsedSeconds);
  const { sx, sy } = coinFrameSource(frame);
  const bob = coinBobOffset(elapsedSeconds);

  for (const coin of coins) {
    ctx.drawImage(
      sprite,
      sx,
      sy,
      COIN_FRAME_SIZE,
      COIN_FRAME_SIZE,
      coin.x + originX,
      coin.y + originY + bob,
      COIN_RENDERED_SIZE,
      COIN_RENDERED_SIZE,
    );
  }
}

const COIN_COUNTER_GAP = 12;

/**
 * Draws a "collected/max" text counter at a fixed screen position, to the
 * right of the heart HUD (see drawHearts's HUD_MARGIN/HEART_SPACING). This
 * step always passes `collected = 0` (a static placeholder — coins aren't
 * collectible yet); a later roadmap step wires a real collected count in.
 * Reuses RESTART_PROMPT_FONT_FAMILY (loaded once, in PlatformerPage.tsx's
 * mount effect, for the restart prompt) rather than loading a second pixel
 * font — it's this theme's only registered pixel typeface, and the CSS Font
 * Loading API registers a family globally in `document.fonts` once loaded,
 * so any canvas fillText call can use it. Falls back to monospace if the
 * font hasn't finished loading (or failed to) yet.
 */
export function drawCoinCounter(
  ctx: CanvasRenderingContext2D,
  collected: number,
  max: number,
): void {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `16px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const heartsWidth = MAX_HEARTS * (HEART_RENDERED_SIZE + HEART_SPACING);
  const x = HUD_MARGIN + heartsWidth + COIN_COUNTER_GAP;
  const y = HUD_MARGIN + HEART_RENDERED_SIZE / 2;
  ctx.fillText(`${collected} / ${max}`, x, y);
  ctx.restore();
}
