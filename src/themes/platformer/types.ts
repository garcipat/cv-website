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
import type { Translation } from '@/i18n/translations';

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
 * how it was revealed (coin/enemy/block/chest) even though only 'coin' is reachable
 * until steps 16/20 add enemies and blocks.
 */
export interface CollectedFact {
  id: string;
  sectionId: SectionId;
  sectionLabel: string;
  data: CVItemData | SkillCategoryFact;
  sourceType: 'coin' | 'enemy' | 'block' | 'chest';
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

/**
 * One mapped, not-yet-placed enemy — `EnemyMapper.ts` produces these from
 * `CVData`; `placeEnemies` adds x/y to turn each into an `EnemyPlacement`.
 * Deliberately a separate type from `CollectibleDef` rather than widening
 * its `spriteType` union: an enemy's sprite type ('slimeGreen'/'slimePurple')
 * has no meaning for a coin/fruit collectible, and enemies don't join
 * `collectedCollectibleIds` until roadmap step 18 gives them a defeat
 * mechanic.
 */
export interface EnemyDef {
  id: string;
  spriteType: 'slimeGreen' | 'slimePurple';
  /** Absent for a "plain" enemy — a level-author-placed marker beyond
   *  CVData's course count for that color (see `EnemyMapper.ts`'s
   *  `placeEnemies`). Enemies are no longer capped at CVData's length: only
   *  the first N markers of each color (N = that color's course count)
   *  reveal a fact on defeat; any further marker is still a normal,
   *  killable enemy, it just carries no CV reward. Mirrors `BlockDef.fact`'s
   *  optionality for question-mark/fragileRock blocks. */
  fact?: CollectedFact;
}

/**
 * One mapped, not-yet-placed block — `BlockMapper.ts` produces crate defs
 * from CVData (`fact` present); `placeBlocks` also synthesizes
 * question-mark and fragileRock defs directly from level markers (`fact` absent —
 * they carry no CV mapping, spec.md FR-021's amendment). `placeBlocks` adds
 * x/y to turn each into a `BlockPlacement`.
 */
export interface BlockDef {
  id: string;
  blockKind: 'crate' | 'questionMark' | 'fragileRock';
  /** Present only when `blockKind === 'crate'` — question-mark and fragileRock
   *  blocks reveal no CV fact. */
  fact?: CollectedFact;
}

/**
 * One mapped, not-yet-placed chest — `ChestMapper.ts`'s `mapCVDataToChests`
 * produces these from CVData (one per Experience entry, spec.md FR-023);
 * `placeChests` adds x/y to turn each into a `ChestPlacement`. Mirrors
 * `EnemyDef`'s shape (always carries a `fact`, no visual-state field here —
 * live open/closed state is `entities/Chest.ts`'s `ChestState`, layered on
 * top the same way `BlockState` layers hit-count/animation onto
 * `BlockPlacement`).
 */
export interface ChestDef {
  id: string;
  fact: CollectedFact;
}

/**
 * Every hint id a hand-authored sign can show — derived directly from the
 * i18n JSON's own keys (`platformer.hints.<hintId>` in en.json/de.json) so a
 * typo or a stale hintId reference fails to compile instead of silently
 * resolving to `undefined` at runtime.
 */
export type HintId = keyof Translation['platformer']['hints'];

/**
 * A hand-authored hint sign (roadmap step 26, FR-037). Unlike CollectibleDef/
 * EnemyDef/BlockDef/ChestDef, a sign carries no CV mapping at all — no
 * `fact`, no `cvSection`/`cvIndex` — its only content is `hintId`, which
 * `SignMapper.ts`'s `placeSigns` turns into a `SignPlacement` (adds x/y),
 * mirroring every other Def/Placement pair in this codebase.
 */
export interface SignDef {
  id: string;
  hintId: HintId;
}
