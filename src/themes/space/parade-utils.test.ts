// ---------------------------------------------------------------------------
// Space Theme — Unit tests for parade-utils.ts pure functions
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildCircleEntries,
  computeCircleTransform,
  buildSections,
  getActiveSectionIndex,
  totalScrollSpan,
  findClosestCircleIndex,
  POOL_SIZE,
  DEFAULT_CIRCLE_SPAN,
  PARADE_LEAD_IN,
} from './parade-utils';
import type { CVData } from '@/types/cv';

// ---------------------------------------------------------------------------
// Test Data Factory
// ---------------------------------------------------------------------------

function makeCV(overrides: Partial<CVData> = {}): CVData {
  return {
    personality: {
      name: 'Test User',
      tagline: 'Test Tagline',
      summary: 'Test summary.',
    },
    experience: [
      {
        company: 'Test Corp',
        role: 'Developer',
        startDate: '2020-01',
        highlights: ['Did stuff'],
      },
      {
        company: 'Another Corp',
        role: 'Senior Dev',
        startDate: '2018-01',
        endDate: '2020-01',
        highlights: ['Did more stuff'],
      },
    ],
    projects: [
      { name: 'Test Project', description: 'A test project.' },
      { name: 'Another Project', description: 'Another test project.' },
    ],
    skills: [
      { category: 'Frontend', skills: [{ name: 'React', level: 90 }] },
      { category: 'Backend', skills: [{ name: 'Node', level: 70 }] },
    ],
    education: [
      { degree: 'B.Sc.', institution: 'Test University', startDate: '2015-01', endDate: '2018-01' },
    ],
    courses: [
      { title: 'Test Course', provider: 'Test Provider', date: '2023-01' },
    ],
    certificates: [
      { name: 'Test Cert', issuer: 'Test Issuer', date: '2022-01' },
    ],
    languages: [
      { name: 'TestLang', flag: '🏳️', level: 90 },
    ],
    contact: { email: 'test@example.com', location: 'Test City' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildCircleEntries tests
// ---------------------------------------------------------------------------

describe('buildCircleEntries', () => {
  it('returns about circle first', () => {
    const entries = buildCircleEntries(makeCV());
    expect(entries[0].type).toBe('about');
    expect(entries[0].index).toBe(0);
    expect(entries[0].sectionId).toBe('about');
  });

  it('returns all experience entries in order', () => {
    const entries = buildCircleEntries(makeCV());
    const expEntries = entries.filter((e) => e.type === 'experience');
    expect(expEntries).toHaveLength(2);
  });

  it('returns all project entries in order', () => {
    const entries = buildCircleEntries(makeCV());
    const projEntries = entries.filter((e) => e.type === 'project');
    expect(projEntries).toHaveLength(2);
  });

  it('returns all skillCategory entries in order', () => {
    const entries = buildCircleEntries(makeCV());
    const skillEntries = entries.filter((e) => e.type === 'skillCategory');
    expect(skillEntries).toHaveLength(3);
  });

  it('returns all education entries in order', () => {
    const entries = buildCircleEntries(makeCV());
    const eduEntries = entries.filter((e) => e.type === 'education');
    expect(eduEntries).toHaveLength(1);
  });

  it('returns all course and certificate entries', () => {
    const entries = buildCircleEntries(makeCV());
    expect(entries.filter((e) => e.type === 'courseBatch')).toHaveLength(1);
    expect(entries.filter((e) => e.type === 'certificateBatch')).toHaveLength(1);
  });

  it('returns contact circle when contact data is present', () => {
    const entries = buildCircleEntries(makeCV());
    expect(entries.some((e) => e.type === 'contact')).toBe(true);
  });

  it('omits contact circle when contact is undefined', () => {
    const cv = makeCV({ contact: undefined });
    const entries = buildCircleEntries(cv);
    expect(entries.some((e) => e.type === 'contact')).toBe(false);
  });

  it('omits contact circle when contact has no meaningful fields', () => {
    const cv = makeCV({ contact: {} });
    const entries = buildCircleEntries(cv);
    expect(entries.some((e) => e.type === 'contact')).toBe(false);
  });

  it('handles empty arrays for all optional sections', () => {
    const cv = makeCV({
      experience: [],
      projects: [],
      skills: [],
      education: [],
      courses: [],
      certificates: [],
      languages: [],
      contact: undefined,
    });
    const entries = buildCircleEntries(cv);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('about');
  });

  it('handles single-item sections correctly', () => {
    const cv = makeCV({
      experience: [{ company: 'Solo Corp', role: 'Only Dev', startDate: '2020-01', highlights: ['One thing'] }],
      projects: [],
      skills: [],
      education: [],
      courses: [],
      certificates: [],
      languages: [],
      contact: undefined,
    });
    const entries = buildCircleEntries(cv);
    expect(entries).toHaveLength(2);
  });

  it('maintains correct sequential indices', () => {
    const entries = buildCircleEntries(makeCV());
    for (let i = 0; i < entries.length; i++) {
      expect(entries[i].index).toBe(i);
    }
  });

  it('sets default effectiveSpan of 1.4 for all entries', () => {
    const entries = buildCircleEntries(makeCV());
    for (const entry of entries) {
      expect(entry.effectiveSpan).toBe(DEFAULT_CIRCLE_SPAN);
    }
  });

  it('computes circleCenter as midpoint of each span (with lead-in offset)', () => {
    const entries = buildCircleEntries(makeCV());
    const span = DEFAULT_CIRCLE_SPAN;
    expect(entries[0].circleCenter).toBeCloseTo(PARADE_LEAD_IN + span / 2, 5); // 1.7
    expect(entries[1].circleCenter).toBeCloseTo(PARADE_LEAD_IN + span + span / 2, 5); // 3.1
    expect(entries[2].circleCenter).toBeCloseTo(PARADE_LEAD_IN + 2 * span + span / 2, 5); // 4.5
  });

  it('assigns correct sectionId to each circle type', () => {
    const entries = buildCircleEntries(makeCV());
    const typeToSection: Record<string, string> = {};
    for (const e of entries) {
      if (!typeToSection[e.type]) typeToSection[e.type] = e.sectionId;
    }
    expect(typeToSection['about']).toBe('about');
    expect(typeToSection['experience']).toBe('experience');
    expect(typeToSection['education']).toBe('education');
    expect(typeToSection['certificateBatch']).toBe('certificates');
    expect(typeToSection['skillCategory']).toBe('skills');
    expect(typeToSection['courseBatch']).toBe('courses');
    expect(typeToSection['project']).toBe('projects');
    expect(typeToSection['contact']).toBe('contact');
  });

  it('assigns alternating exit directions', () => {
    const entries = buildCircleEntries(makeCV());
    for (let i = 0; i < entries.length; i++) {
      if (i % 2 === 0) {
        expect(entries[i].exitDirection).toBe('bl');
      } else {
        expect(entries[i].exitDirection).toBe('br');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// computeCircleTransform tests
// ---------------------------------------------------------------------------

describe('computeCircleTransform', () => {
  it('returns settled at center (distance = 0)', () => {
    const t = computeCircleTransform(0.7, 0.7, 1.4, 'bl');
    expect(t.translateX).toBe(0);
    expect(t.translateY).toBe(0);
    expect(t.scale).toBe(1);
    expect(t.wrapperOpacity).toBe(1);
    expect(t.contentOpacity).toBe(1);
    expect(t.settled).toBe(true);
  });

  it('returns offscreen above at far distance (dist <= -1)', () => {
    const t = computeCircleTransform(0, 2.1, 1.4, 'br');
    expect(t.translateY).toBe(-75);
    expect(t.scale).toBeCloseTo(0.12, 2);
    expect(t.wrapperOpacity).toBe(0);
    expect(t.contentOpacity).toBe(0);
    expect(t.settled).toBe(false);
  });

  it('returns offscreen at exit corner (dist >= 1)', () => {
    // For 'bl': x should be -65, for 'br': x should be 65
    const tBl = computeCircleTransform(4.2, 2.1, 1.4, 'bl');
    expect(tBl.translateX).toBe(-65);
    expect(tBl.translateY).toBe(75);
    expect(tBl.wrapperOpacity).toBe(0);
    expect(tBl.settled).toBe(false);

    const tBr = computeCircleTransform(4.2, 2.1, 1.4, 'br');
    expect(tBr.translateX).toBe(65);
    expect(tBr.translateY).toBe(75);
    expect(tBr.wrapperOpacity).toBe(0);
    expect(tBr.settled).toBe(false);
  });

  it('drops from top during entry phase', () => {
    // dist near -1: high above, dist near -0.125: near center
    const tFar = computeCircleTransform(0.07, 0.7, 1.4, 'bl'); // dist ~ -0.45
    expect(tFar.translateY).toBeLessThan(0); // still above center
    expect(tFar.translateX).toBe(0);
    expect(tFar.scale).toBeGreaterThan(0.12);
    expect(tFar.scale).toBeLessThan(1);
    expect(tFar.settled).toBe(false);
  });

  it('drifts to corner during exit phase', () => {
    // dist ~ 0.36, well into exit zone
    const tBl = computeCircleTransform(1.2, 0.7, 1.4, 'bl');
    expect(tBl.translateX).toBeLessThan(0); // bl = bottom-left, negative x
    expect(tBl.translateY).toBeGreaterThan(0);
    expect(tBl.scale).toBeLessThan(1);
    expect(tBl.settled).toBe(false);

    const tBr = computeCircleTransform(1.2, 0.7, 1.4, 'br');
    expect(tBr.translateX).toBeGreaterThan(0); // br = bottom-right, positive x
    expect(tBr.settled).toBe(false);
  });

  it('handles zero/negative effectiveSpan gracefully', () => {
    const t = computeCircleTransform(0.7, 0.7, 0, 'bl');
    // Falls back to DEFAULT_CIRCLE_SPAN, at center → settled
    expect(t.translateX).toBe(0);
    expect(t.translateY).toBe(0);
    expect(t.scale).toBe(1);
    expect(t.settled).toBe(true);
  });

  it('content fades in later than wrapper during entry', () => {
    // dist = -0.95 → t = 0.057 < 0.3, so content is still hidden
    // Use circle 1 (center = 2.1): scrollOffset = 2.1 - 0.95 * 1.4 = 0.77
    const span = DEFAULT_CIRCLE_SPAN;
    const center = span + span / 2; // 2.1
    const tVeryEarly = computeCircleTransform(center - 0.95 * span, center, span, 'bl');
    expect(tVeryEarly.wrapperOpacity).toBeGreaterThan(0);
    expect(tVeryEarly.contentOpacity).toBe(0);
  });

  it('content fades out before wrapper during exit', () => {
    // dist needs to be >= 0.405 for content to be fully hidden (t >= 0.3, displayHalf=0.15)
    const tLate = computeCircleTransform(1.27, 0.7, 1.4, 'bl');
    expect(tLate.contentOpacity).toBe(0);
    expect(tLate.wrapperOpacity).toBeLessThan(1);
    expect(tLate.wrapperOpacity).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// SC-002: transition overlap guarantee
// ---------------------------------------------------------------------------

describe('transition overlap (SC-002)', () => {
  it('at most 2 circles have scale >= 0.9 at any scroll position (mockup allows transition overlap)', () => {
    const entries = buildCircleEntries(makeCV());
    for (let offset = 0; offset < totalScrollSpan(entries); offset += 0.05) {
      let count = 0;
      for (const entry of entries) {
        const t = computeCircleTransform(offset, entry.circleCenter, entry.effectiveSpan, entry.exitDirection);
        if (t.scale >= 0.9) count++;
      }
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('at most 2 circles have wrapperOpacity >= 0.9 at any scroll position (mockup allows transition overlap)', () => {
    const entries = buildCircleEntries(makeCV());
    for (let offset = 0; offset < totalScrollSpan(entries); offset += 0.05) {
      let count = 0;
      for (const entry of entries) {
        const t = computeCircleTransform(offset, entry.circleCenter, entry.effectiveSpan, entry.exitDirection);
        if (t.wrapperOpacity >= 0.9) count++;
      }
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('exactly one circle is settled at each integer circle center', () => {
    const entries = buildCircleEntries(makeCV());
    for (const entry of entries) {
      let settledCount = 0;
      for (const other of entries) {
        const t = computeCircleTransform(entry.circleCenter, other.circleCenter, other.effectiveSpan, other.exitDirection);
        if (t.settled) settledCount++;
      }
      expect(settledCount).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// buildSections tests
// ---------------------------------------------------------------------------

describe('buildSections', () => {
  it('returns one SectionInfo per non-empty section', () => {
    const entries = buildCircleEntries(makeCV());
    const sections = buildSections(entries);
    expect(sections).toHaveLength(8);
  });

  it('sections are in parade order', () => {
    const entries = buildCircleEntries(makeCV());
    const sections = buildSections(entries);
    const expectedOrder = ['about', 'experience', 'education', 'certificates', 'skills', 'courses', 'projects', 'contact'];
    expect(sections.map((s) => s.id)).toEqual(expectedOrder);
  });

  it('omits sections with zero circles', () => {
    const cv = makeCV({
      experience: [],
      projects: [],
      skills: [],
      education: [],
      courses: [],
      certificates: [],
      languages: [],
      contact: undefined,
    });
    const entries = buildCircleEntries(cv);
    const sections = buildSections(entries);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('about');
  });

  it('reports correct circleCount per section', () => {
    const entries = buildCircleEntries(makeCV());
    const sections = buildSections(entries);
    expect(sections.find((s) => s.id === 'about')?.circleCount).toBe(1);
    expect(sections.find((s) => s.id === 'experience')?.circleCount).toBe(2);
    expect(sections.find((s) => s.id === 'projects')?.circleCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getActiveSectionIndex tests
// ---------------------------------------------------------------------------

describe('getActiveSectionIndex', () => {
  it('returns 0 for circle index in first section', () => {
    const entries = buildCircleEntries(makeCV());
    const sections = buildSections(entries);
    expect(getActiveSectionIndex(sections, 0)).toBe(0);
  });

  it('returns correct section index for middle sections', () => {
    const entries = buildCircleEntries(makeCV());
    const sections = buildSections(entries);
    expect(getActiveSectionIndex(sections, 1)).toBe(1);
    expect(getActiveSectionIndex(sections, 2)).toBe(1);
  });

  it('returns last section index for out-of-bounds circle index', () => {
    const entries = buildCircleEntries(makeCV());
    const sections = buildSections(entries);
    expect(getActiveSectionIndex(sections, 999)).toBe(sections.length - 1);
  });
});

// ---------------------------------------------------------------------------
// totalScrollSpan tests
// ---------------------------------------------------------------------------

describe('totalScrollSpan', () => {
  it('returns lead-in + sum of all effective spans', () => {
    const entries = buildCircleEntries(makeCV());
    const expected = PARADE_LEAD_IN + entries.length * DEFAULT_CIRCLE_SPAN;
    expect(totalScrollSpan(entries)).toBeCloseTo(expected, 10);
  });

  it('returns 0 for empty entries', () => {
    expect(totalScrollSpan([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// findClosestCircleIndex tests
// ---------------------------------------------------------------------------

describe('findClosestCircleIndex', () => {
  it('returns 0 for empty entries', () => {
    expect(findClosestCircleIndex([], 5)).toBe(0);
  });

  it('returns index of circle nearest to scroll offset', () => {
    const entries = buildCircleEntries(makeCV());
    // First circle center = PARADE_LEAD_IN + span/2 = 1.0 + 0.7 = 1.7
    expect(findClosestCircleIndex(entries, 0)).toBe(0);
    expect(findClosestCircleIndex(entries, entries[0].circleCenter)).toBe(0);
    expect(findClosestCircleIndex(entries, entries[1].circleCenter)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POOL_SIZE constant
// ---------------------------------------------------------------------------

describe('POOL_SIZE', () => {
  it('is exactly 7 per FR-030', () => {
    expect(POOL_SIZE).toBe(7);
  });
});
