import { isSkillCategoryFact } from './types';
import type { SkillCategoryFact } from './types';
import type { Skill } from '@/types/cv';

describe('isSkillCategoryFact', () => {
  it('skillCategoryShape-returns-true', () => {
    const data: SkillCategoryFact = {
      category: 'DevOps & Tools',
      skills: [{ name: 'Docker', level: 90 }],
    };
    expect(isSkillCategoryFact(data)).toBe(true);
  });

  it('singleSkillShape-returns-false', () => {
    const data: Skill = { name: 'TypeScript', level: 90 };
    expect(isSkillCategoryFact(data)).toBe(false);
  });

  it('languageShape-returns-false', () => {
    expect(isSkillCategoryFact({ name: 'German', flag: '🇩🇪', level: 100 })).toBe(false);
  });
});
