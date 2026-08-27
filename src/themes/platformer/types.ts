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
 * A single discovered CV fact, per spec.md FR-032. `sourceType` distinguishes
 * how it was revealed (coin/enemy/block) even though only 'coin' is reachable
 * until steps 16/20 add enemies and blocks.
 */
export interface CollectedFact {
  id: string;
  sectionId: SectionId;
  sectionLabel: string;
  data: CVItemData;
  sourceType: 'coin' | 'enemy' | 'block';
}
