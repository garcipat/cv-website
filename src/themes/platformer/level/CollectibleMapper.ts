import { tileToPixel } from './Terrain';
import type { CVData, SkillCategory, Skill } from '@/types/cv';
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

/**
 * Flattens CVData into one collectible per skill category (rendered as
 * coin.png) — see this plan's "Key design decisions" for why categories
 * aren't split further. An empty `skills` array simply produces no
 * collectibles.
 *
 * Amended 2026-08-30 (live user feedback during step 21 verification):
 * Languages no longer produce `fruit` collectibles here — the hand-placed
 * `F`-marker fruit pickups were removed from the level entirely now that
 * question-mark blocks spawn their own bonus fruit (see `BlockMapper.ts`'s
 * `certificateToBlock`/`projectToBlock`); `placeCollectibles`'s `fruit`
 * marker queue is left in place as generic, reusable placement
 * infrastructure, just with no def ever produced to fill it today. Where
 * Languages themselves get surfaced instead is still an open design
 * question — not decided as part of this change.
 */
export function mapCVDataToCollectibles(cv: CVData): CollectibleDef[] {
  return cv.skills.map(categoryToCollectible);
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
 * (LevelParser.ts's findCoinTiles) for `coin` defs; `fruit` defs have no
 * level marker anymore (the `F` character was reassigned to the fragileRock
 * block, see LevelParser.ts's ENTITY_CHARS, once the hand-placed fruit
 * marker concept was removed — see this file's top comment), so callers now
 * pass an empty array for `markers.fruit`. Each type is matched to its own
 * marker queue in reading order. The level's marker count decides how many
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
