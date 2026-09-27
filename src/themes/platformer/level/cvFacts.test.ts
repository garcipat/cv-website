import { describe, it, expect } from 'vitest';
import { cvFact } from './cvFacts';

describe('cvFact', () => {
  it('allFields-given-returnsTheCollectedFactLiteral', () => {
    const data = { degree: 'B.Sc.', institution: 'TU Berlin', startDate: '2016-10' };
    expect(cvFact('education', 'Education', 'block', 'block-edu-b-sc-tu-berlin', data)).toEqual({
      id: 'block-edu-b-sc-tu-berlin',
      sectionId: 'education',
      sectionLabel: 'Education',
      data,
      sourceType: 'block',
    });
  });

  it('aSkillCategoryFact-data-isCarriedVerbatim', () => {
    const data = { category: 'Frontend', skills: [{ name: 'React', level: 90 }] };
    expect(cvFact('skills', 'Skills', 'coin', 'coin-frontend', data)).toEqual({
      id: 'coin-frontend',
      sectionId: 'skills',
      sectionLabel: 'Skills',
      data,
      sourceType: 'coin',
    });
  });
});
