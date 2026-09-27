import type { CollectedFact, CVItemData, SectionId, SkillCategoryFact } from '../types';

/**
 * The one constructor for a `CollectedFact` (FR-006, D5): the
 * `{ id, sectionId, sectionLabel, data, sourceType }` literal that the block,
 * enemy, chest and collectible converters each used to copy. Each mapper keeps
 * its own section→def mapping (which CV section becomes which def kind); only
 * the fact literal is shared.
 */
export function cvFact(
  sectionId: SectionId,
  sectionLabel: string,
  sourceType: CollectedFact['sourceType'],
  id: string,
  data: CVItemData | SkillCategoryFact,
): CollectedFact {
  return { id, sectionId, sectionLabel, data, sourceType };
}
