import { tileToPixel, isSolid, tileAt } from './Terrain';
import type { LevelDef } from './LevelData';
import type { CVData, SkillCategory, Skill, Language } from '@/types/cv';
import type { CollectibleDef } from '../types';

/** Lowercases and hyphenates a label into a stable id fragment (e.g.
 *  "DevOps & Tools" -> "devops-tools"). Not full slugify (no unicode
 *  normalization) — CV category/language names are plain ASCII today. */
function slugify(label: string): string {
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

/**
 * Auto-distributes collectibles across the level's solid-ground columns —
 * for each column left to right, place the next collectible one tile above
 * the first solid tile in that column, skipping columns with no solid tile
 * at all (pits) and spacing placements COLLECTIBLE_SPACING_COLS apart so
 * they don't crowd. Wraps to reuse columns if there are more collectibles
 * than spaced columns — level1 isn't designed with a specific collectible
 * count in mind yet (see this plan's "Key design decisions"), so this needs
 * to degrade gracefully rather than throw.
 */
const COLLECTIBLE_SPACING_COLS = 3;

export function placeCollectibles(
  defs: CollectibleDef[],
  level: LevelDef,
): CollectiblePlacement[] {
  const candidateCols: number[] = [];
  for (let col = 0; col < level.width; col++) {
    for (let row = 0; row < level.height - 1; row++) {
      if (!isSolid(tileAt(level, col, row)) && isSolid(tileAt(level, col, row + 1))) {
        candidateCols.push(col);
        break; // first empty-above-solid row in this column is enough
      }
    }
  }

  const spacedCols = candidateCols.filter((_, i) => i % COLLECTIBLE_SPACING_COLS === 0);
  const pool = spacedCols.length > 0 ? spacedCols : candidateCols;

  return defs.map((def, i) => {
    const col = pool[i % pool.length];
    // Re-derive the row for this column (cheap; candidateCols doesn't carry
    // row along, and a column can only match once per the break above).
    let row = 0;
    for (let r = 0; r < level.height - 1; r++) {
      if (!isSolid(tileAt(level, col, r)) && isSolid(tileAt(level, col, r + 1))) {
        row = r;
        break;
      }
    }
    // When wrapping past the pool once, offset onto a second candidate row
    // in the same column isn't tracked — instead nudge vertically by one
    // extra tile per full wrap so repeated columns don't stack exactly.
    const wrapOffset = Math.floor(i / pool.length);
    const { x, y } = tileToPixel(col, row - wrapOffset);
    return { ...def, x, y };
  });
}
