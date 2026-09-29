import { frameSource } from '../entities/sprites/SpriteSheet';
import { fruitFrameSource, FRUIT_FRAME_SIZE } from '../entities/pickups/Fruit';
import { COIN_FRAME_SIZE } from '../entities/pickups/Coin';
import { blockFrameSource, BLOCK_FRAME_SIZE } from '../entities/Block';
import { CHEST_CLOSED_WIDTH, CHEST_CLOSED_HEIGHT } from '../entities/chests';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT } from '../entities/pickups/Key';
import {
  COIN_SHEET,
  FRUIT_SHEET,
  SLIME_GREEN_SHEET,
  WORLD_TILESET_SHEET,
  BOMB_SHEET,
  HEARTS_SHEET,
  CHEST_CLOSED_SHEET,
  KEY_SHEET,
} from '../entities/sprites/sheets';
import {
  BOMB_COUNTER_ICON_HEIGHT,
  CHEST_COUNTER_ICON_HEIGHT,
  CHEST_COUNTER_TEXT_GAP,
  KEY_COUNTER_ICON_HEIGHT,
} from '../engine/render/HudLayout';
import type { HudCounterIcon, HudCounterSlot, HudModel } from '../engine/render/HudLayout';
import type { PopupIcon, PopupIconLookup } from '../engine/effects/transientEffect';
import type { CounterPopupLabelKey } from '../contracts/counters';
import type { SpriteLookup } from '../contracts/SpriteLookup';
import { playerState } from './playerStore';
import { chestsOpened } from './deployableItemStore';
import { levelTotals } from './levelTotals';
import { carriedBombs, collectedKeys } from './collectibleStore';

/**
 * One standalone image scaled to a target height — the descriptor shape every
 * permanent counter's icon uses today.
 */
function scaledImageIcon(
  sourceWidth: number,
  sourceHeight: number,
  height: number,
): HudCounterIcon {
  return { kind: 'scaledImage', sourceWidth, sourceHeight, height };
}

/**
 * The four counter-popup icons, resolved from the lookup. A key whose image is
 * absent is omitted entirely — the counter-popup drawer already skips a missing
 * key, so nothing is drawn for a still-loading or failed asset.
 */
function buildPopupIcons(sprites: SpriteLookup): PopupIconLookup {
  const sources: ReadonlyArray<{
    labelKey: CounterPopupLabelKey;
    src: string;
    iconFrame: PopupIcon['iconFrame'];
    iconYOffset?: number;
  }> = [
    {
      labelKey: 'coins',
      src: COIN_SHEET.src,
      iconFrame: { ...frameSource(COIN_SHEET, 0), size: COIN_FRAME_SIZE },
    },
    {
      labelKey: 'fruits',
      src: FRUIT_SHEET.src,
      iconFrame: { ...fruitFrameSource(0), size: FRUIT_FRAME_SIZE },
    },
    {
      labelKey: 'enemies',
      src: SLIME_GREEN_SHEET.src,
      iconFrame: { ...frameSource(SLIME_GREEN_SHEET, 2), size: SLIME_GREEN_SHEET.frameWidth },
      iconYOffset: -6,
    },
    {
      labelKey: 'crates',
      src: WORLD_TILESET_SHEET.src,
      iconFrame: { ...blockFrameSource('crate'), size: BLOCK_FRAME_SIZE },
    },
  ];

  const popupIcons: PopupIconLookup = {};
  for (const source of sources) {
    const icon = sprites[source.src];
    if (!icon) continue;
    popupIcons[source.labelKey] = {
      icon,
      iconFrame: source.iconFrame,
      iconYOffset: source.iconYOffset,
    };
  }
  return popupIcons;
}

/**
 * Builds the whole HUD as plain data for one frame: the hearts row, the frozen
 * chest → key → bomb counter slots and the four popup icons. It reads the state
 * signals here (counts, totals, visibility) and resolves each image out of the
 * passed lookup, so `HudRenderer`/`HudLayout` never touch game state (FR-013).
 *
 * The construction is frozen: icon heights 26/24/24, text gap 12, the same
 * sprite keys and the same visibility gates the page used inline, with
 * `advancesWhenHidden` reproducing today's asymmetric X-chain (the chest
 * advances even while hidden; the key and bomb do not).
 */
export function buildHudModel(sprites: SpriteLookup): HudModel {
  const chestImage = sprites[CHEST_CLOSED_SHEET.src] ?? null;
  const keyImage = sprites[KEY_SHEET.src] ?? null;
  const bombImage = sprites[BOMB_SHEET.src] ?? null;
  const heartsImage = sprites[HEARTS_SHEET.src] ?? null;

  const counters: readonly HudCounterSlot[] = [
    {
      key: 'chests',
      image: chestImage,
      icon: scaledImageIcon(CHEST_CLOSED_WIDTH, CHEST_CLOSED_HEIGHT, CHEST_COUNTER_ICON_HEIGHT),
      count: chestsOpened.value,
      total: levelTotals.value.chests,
      textGap: CHEST_COUNTER_TEXT_GAP,
      visible: chestImage !== null && levelTotals.value.chests > 0,
      advancesWhenHidden: true,
    },
    {
      key: 'keys',
      image: keyImage,
      icon: scaledImageIcon(KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT, KEY_COUNTER_ICON_HEIGHT),
      count: collectedKeys.value,
      textGap: CHEST_COUNTER_TEXT_GAP,
      visible: keyImage !== null && collectedKeys.value > 0,
      advancesWhenHidden: false,
    },
    {
      key: 'bombs',
      image: bombImage,
      icon: scaledImageIcon(
        BOMB_SHEET.frameWidth,
        BOMB_SHEET.frameHeight,
        BOMB_COUNTER_ICON_HEIGHT,
      ),
      count: carriedBombs.value,
      textGap: CHEST_COUNTER_TEXT_GAP,
      visible: bombImage !== null && carriedBombs.value > 0,
      advancesWhenHidden: false,
    },
  ];

  return {
    hearts:
      heartsImage === null ? null : { hitPoints: playerState.value.hitPoints, sprite: heartsImage },
    counters,
    popupIcons: buildPopupIcons(sprites),
  };
}
