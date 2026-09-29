import { describe, it, expect } from 'vitest';
import { slugify, slugId } from './ids';

describe('slugify', () => {
  it('aLabelWithPunctuationAndSpaces-lowercasesAndHyphenates', () => {
    expect(slugify('DevOps & Tools')).toBe('devops-tools');
  });

  it('aLabelWithLeadingAndTrailingSeparators-trimsThem', () => {
    expect(slugify(' Frontend / React ')).toBe('frontend-react');
  });

  it('anEmptyLabel-returnsAnEmptyString', () => {
    expect(slugify('--')).toBe('');
  });
});

describe('slugId', () => {
  it('aSinglePart-prefixesTheSluggedPart', () => {
    expect(slugId('qmark-cert', 'AWS Solutions Architect')).toBe(
      'qmark-cert-aws-solutions-architect',
    );
  });

  it('multipleParts-joinsThemBeforeSluggingSoTheResultStaysOneSlugRun', () => {
    expect(slugId('block-edu', 'B.Sc. Computer Science', 'TU Berlin')).toBe(
      'block-edu-b-sc-computer-science-tu-berlin',
    );
    expect(slugId('chest-exp', 'Staff Engineer', 'Acme Inc.')).toBe(
      'chest-exp-staff-engineer-acme-inc',
    );
  });
});
