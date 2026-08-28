import { tileToPixel, groundColumns, groundRowForColumn } from './Terrain';
import type { LevelDef } from './LevelData';
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

/**
 * Auto-distributes collectibles across the level's solid-ground columns —
 * for each column left to right, place the next collectible one tile above
 * the first solid tile in that column, skipping columns with no solid tile
 * at all (pits) and spacing placements COLLECTIBLE_SPACING_COLS apart so
 * they don't crowd. Falls back to the full (unspaced) candidate column list
 * — every entry independently verified as empty-above-solid — if there are
 * more collectibles than spaced columns, cycling through it via modulo;
 * level1 isn't designed with a specific collectible count in mind yet (see
 * this plan's "Key design decisions"), so this needs to degrade gracefully
 * rather than throw or fabricate an unverified row.
 */
const COLLECTIBLE_SPACING_COLS = 3;

export function placeCollectibles(
  defs: CollectibleDef[],
  level: LevelDef,
): CollectiblePlacement[] {
  const candidateCols = groundColumns(level);

  const spacedCols = candidateCols.filter((_, i) => i % COLLECTIBLE_SPACING_COLS === 0);
  // Prefer even spacing while there's room; once defs exceed the spaced
  // pool, fall back to the denser (but still always-valid) full candidate
  // list rather than fabricating new rows by subtracting an offset — every
  // entry in candidateCols is a real, verified empty-tile-above-solid
  // position, so cycling through it can never place on an invalid tile.
  const pool =
    defs.length <= spacedCols.length && spacedCols.length > 0 ? spacedCols : candidateCols;

  return defs.map((def, i) => {
    const col = pool[i % pool.length];
    const row = groundRowForColumn(level, col) ?? 0; // pool only ever contains verified ground columns
    const { x, y } = tileToPixel(col, row);
    return { ...def, x, y };
  });
}
