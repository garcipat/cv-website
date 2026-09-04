import { tileToPixel } from './Terrain';
import type { CVData, SkillCategory, Skill } from '@/types/cv';
import type { CollectedFact } from '../types';

/** Lowercases and hyphenates a label into a stable id fragment (e.g.
 *  "DevOps & Tools" -> "devops-tools"). Not full slugify (no unicode
 *  normalization) — CV category/language names are plain ASCII today. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function categoryToSkillFact(category: SkillCategory): CollectedFact {
  const skills: Skill[] = [
    ...category.skills,
    ...(category.sections?.flatMap((s) => s.skills) ?? []),
  ];
  return {
    id: `coin-${slugify(category.category)}`,
    sectionId: 'skills',
    sectionLabel: 'Skills',
    data: { category: category.category, skills },
    sourceType: 'coin',
  };
}

/**
 * The ordered pool of skill-category facts a coin can reveal, one per
 * CVData skill category, in CVData's own order.
 *
 * Unlike every other reward source (a crate/question-mark/enemy/chest each
 * carries ONE specific CV item it alone reveals), a coin is a plain
 * position — see `CollectiblePlacement` below — with no fact bound to it at
 * creation. This is deliberate — which physical coin maps to which skill
 * category was never meaningful to a player, so binding them at placement
 * time only bought fragility (the level's coin-marker count had to exactly
 * match CVData's skill count, or a coin-pot's leftover-defs bookkeeping
 * could silently run dry).
 *
 * HOW MANY of this pool's entries have been revealed as of a given
 * collected-coin count — and therefore which entry a specific pickup
 * reveals — is resolved dynamically at collection time
 * (`PlatformerPage.tsx`), via `level/SkillFactPacing.ts`'s
 * `revealedFactCountFor`: see that function's doc comment for the exact
 * proportional-fill rule (it spreads this pool's entries evenly across
 * every coin the level has, so a level with more coins than skill
 * categories never has a coin that reveals nothing, and a level with fewer
 * still reaches every category by the time everything is collected).
 */
export function mapCVDataToSkillFactPool(cv: CVData): CollectedFact[] {
  return cv.skills.map(categoryToSkillFact);
}

/**
 * A placed coin or fruit collectible — purely positional (see
 * `mapCVDataToSkillFactPool`'s doc comment for why a coin carries no fact of
 * its own). `id` is derived from its marker position, stable and unique,
 * used only for `collectedCollectibleIds` dedup — it has no relationship to
 * which fact a pickup ends up revealing.
 */
export interface CollectiblePlacement {
  id: string;
  spriteType: 'coin' | 'fruit';
  x: number;
  y: number;
}

/** Hand-authored marker positions for each collectible type, keyed the
 *  same way `CollectiblePlacement.spriteType` is — see `placeCollectibles`
 *  below. */
export interface CollectibleMarkerPositions {
  coin: readonly { col: number; row: number }[];
  fruit: readonly { col: number; row: number }[];
}

/**
 * Places one plain collectible per hand-authored marker — `C` markers
 * (LevelParser.ts's findCoinTiles) for coins; `fruit` has no level marker of
 * its own today (a hit question-mark spawns its own bonus fruit instead —
 * see BlockMapper.ts's certificateToBlock/projectToBlock), so callers pass
 * an empty array for `markers.fruit`. There is no auto-placement: a
 * collectible's position is always exactly where a level author put its
 * marker, mirroring EnemyMapper.ts's placeEnemies/BlockMapper.ts's
 * placeBlocks.
 */
export function placeCollectibles(markers: CollectibleMarkerPositions): CollectiblePlacement[] {
  const placements: CollectiblePlacement[] = [];

  markers.coin.forEach(({ col, row }) => {
    const { x, y } = tileToPixel(col, row);
    placements.push({ id: `coin-${col}-${row}`, spriteType: 'coin', x, y });
  });

  markers.fruit.forEach(({ col, row }) => {
    const { x, y } = tileToPixel(col, row);
    placements.push({ id: `fruit-${col}-${row}`, spriteType: 'fruit', x, y });
  });

  return placements;
}
