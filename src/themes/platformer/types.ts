import type {
  Skill,
  Language,
  Experience,
  Course,
  Education,
  Certificate,
  Project,
  Activity,
  Personality,
} from '@/types/cv';

/**
 * Every top-level CV section that can back a journal bookmark. Matches the
 * property names on `CVData` (src/types/cv.ts) so a `CollectedFact.sectionId`
 * can be used directly to look up the section's data array.
 */
export type SectionId =
  | 'personality'
  | 'experience'
  | 'skills'
  | 'courses'
  | 'education'
  | 'certificates'
  | 'languages'
  | 'projects'
  | 'activities';

/** The union of every CV item shape a single collected fact might carry. */
export type CVItemData =
  | Skill
  | Language
  | Experience
  | Course
  | Education
  | Certificate
  | Project
  | Activity
  | Personality;

/**
 * A whole skill category's worth of skills, collected as one unit (see this
 * plan's "Key design decisions" — the real CV data has too many individual
 * skills to reasonably place one collectible each). `Skill` stays the
 * per-item shape used inside; only the fact wrapping it is category-level.
 */
export interface SkillCategoryFact {
  category: string;
  skills: Skill[];
}

/** Distinguishes a category-level skill fact from every other single-item
 *  `CVItemData` shape at runtime (needed since `data`'s type alone doesn't
 *  narrow reliably — `SkillCategoryFact` and e.g. `Project` are both plain
 *  objects with no shared discriminant field). */
export function isSkillCategoryFact(
  data: CVItemData | SkillCategoryFact,
): data is SkillCategoryFact {
  return (
    typeof data === 'object' &&
    data !== null &&
    'category' in data &&
    'skills' in data &&
    Array.isArray((data as SkillCategoryFact).skills)
  );
}

/**
 * A single discovered CV fact, per spec.md FR-032. `sourceType` distinguishes
 * how it was revealed (coin/enemy/block) even though only 'coin' is reachable
 * until steps 16/20 add enemies and blocks.
 */
export interface CollectedFact {
  id: string;
  sectionId: SectionId;
  sectionLabel: string;
  data: CVItemData | SkillCategoryFact;
  sourceType: 'coin' | 'enemy' | 'block';
}

/**
 * One mapped, not-yet-placed collectible — `CollectibleMapper.ts` produces
 * these from `CVData`; `placeCollectibles` adds x/y to turn each into a
 * `CollectiblePlacement`. `id` is the dedup key `collectedCollectibleIds`
 * (PlatformerState.ts) tracks and MUST equal `fact.id` (FR-020c: collected
 * state is deduplicated by the source collectible's id) — enforced by
 * construction in `CollectibleMapper.ts`, not re-validated here.
 */
export interface CollectibleDef {
  id: string;
  spriteType: 'coin' | 'fruit';
  fact: CollectedFact;
}
