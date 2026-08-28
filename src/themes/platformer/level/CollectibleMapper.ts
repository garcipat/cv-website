import { tileToPixel } from './Terrain';
import type { CVData, SkillCategory, Skill, Language } from '@/types/cv';
import type { CollectibleDef } from '../types';

/** Lowercases and hyphenates a label into a stable id fragment (e.g.
 *  "DevOps & Tools" -> "devops-tools"). Not full slugify (no unicode
 *  normalization) — CV category/language names are plain ASCII today. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function categoryToCollectible(category: SkillCategory): CollectibleDef {
  const skills: Skill[] = [
    ...category.skills,
    ...(category.sections?.flatMap((s) => s.skills) ?? []),
  ];
  const id = `coin-${slugify(category.category)}`;
  return {
    id,
    spriteType: 'coin',
    fact: {
      id,
      sectionId: 'skills',
      sectionLabel: 'Skills',
      data: { category: category.category, skills },
      sourceType: 'coin',
    },
  };
}

function languageToCollectible(language: Language): CollectibleDef {
  const id = `fruit-${slugify(language.name)}`;
  return {
    id,
    spriteType: 'fruit',
    fact: {
      id,
      sectionId: 'languages',
      sectionLabel: 'Languages',
      data: language,
      sourceType: 'coin', // FR-009: languages are "coin" collectibles too — spriteType is the visual-only split
    },
  };
}

/**
 * Flattens CVData into one collectible per skill category (rendered as
 * coin.png) and one per language (rendered as fruit.png) — see this plan's
 * "Key design decisions" for why categories aren't split further. Empty
 * `skills`/`languages` arrays simply produce no collectibles of that kind
 * (matches FR-013's "empty CV sections produce no collectibles").
 */
export function mapCVDataToCollectibles(cv: CVData): CollectibleDef[] {
  return [
    ...cv.skills.map(categoryToCollectible),
    ...(cv.languages ?? []).map(languageToCollectible),
  ];
}

export interface CollectiblePlacement extends CollectibleDef {
  x: number;
  y: number;
}

/** Hand-authored marker positions for each collectible type, keyed the
 *  same way `CollectibleDef.spriteType` is — see `placeCollectibles` below. */
export interface CollectibleMarkerPositions {
  coin: readonly { col: number; row: number }[];
  fruit: readonly { col: number; row: number }[];
}

/**
 * Places collectible defs at hand-authored marker positions — `C` markers
 * (LevelParser.ts's findCoinTiles) for `coin` defs, `F` markers
 * (findFruitTiles) for `fruit` defs, each type matched to its own marker
 * queue in reading order. The level's marker count decides how many
 * collectibles actually appear, not CVData's length: a marker is a slot on
 * the map, and each slot draws the next available fact from `defs` (in
 * `mapCVDataToCollectibles`'s Skills-then-Languages order) as its reward.
 * If a level has fewer markers of a type than CVData has facts of that
 * type, the excess facts simply have no collectible yet — not an error,
 * mirroring EnemyMapper.ts's placeEnemies. There is no auto-placement: a
 * collectible's position is always exactly where a level author put its
 * marker.
 */
export function placeCollectibles(
  defs: CollectibleDef[],
  markers: CollectibleMarkerPositions,
): CollectiblePlacement[] {
  let coinIndex = 0;
  let fruitIndex = 0;
  const placements: CollectiblePlacement[] = [];

  for (const def of defs) {
    const isCoin = def.spriteType === 'coin';
    const queue = isCoin ? markers.coin : markers.fruit;
    const index = isCoin ? coinIndex : fruitIndex;

    if (index >= queue.length) continue; // no marker left for this fact — not placed yet

    if (isCoin) coinIndex++;
    else fruitIndex++;

    const { col, row } = queue[index];
    const { x, y } = tileToPixel(col, row);
    placements.push({ ...def, x, y });
  }

  return placements;
}
