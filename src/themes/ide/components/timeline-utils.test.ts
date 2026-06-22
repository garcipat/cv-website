import { describe, it, expect } from 'vitest';
import {
  buildSegments,
  resolveSegment,
  getNearbyCourses,
  monthsBetween,
  type Segment,
} from './timeline-utils';
import type { Experience, Education, Activity } from '@/types/cv';

const makeExp = (overrides: Partial<Experience> & { company: string; startDate: string }): Experience => ({
  role: 'Engineer',
  endDate: undefined,
  highlights: [],
  ...overrides,
});

const makeEdu = (overrides: Partial<Education> & { institution: string; startDate: string }): Education => ({
  degree: 'B.Sc.',
  endDate: undefined,
  ...overrides,
});

const makeAct = (overrides: Partial<Activity> & { name: string; startDate: string; endDate: string }): Activity => ({
  description: undefined,
  ...overrides,
});

describe('monthsBetween', () => {
  it('returns-months-difference', () => {
    expect(monthsBetween('2020-01', '2020-06')).toBe(5);
  });

  it('returns-negative-for-reversed-dates', () => {
    expect(monthsBetween('2020-06', '2020-01')).toBe(-5);
  });

  it('returns-0-for-same-date', () => {
    expect(monthsBetween('2020-06', '2020-06')).toBe(0);
  });

  it('handles-year-boundaries', () => {
    expect(monthsBetween('2019-12', '2020-01')).toBe(1);
  });
});

describe('buildSegments', () => {
  it('returns-empty-array-for-empty-data', () => {
    expect(buildSegments([], [], [])).toEqual([]);
  });

  it('merges-experience-and-education-sorted-by-date', () => {
    const segments = buildSegments(
      [makeExp({ company: 'B Inc', startDate: '2020-01', endDate: '2020-06' })],
      [makeEdu({ institution: 'A Univ', startDate: '2019-01', endDate: '2019-12' })],
      [],
    );
    expect(segments[0].label).toBe('A Univ');
    expect(segments[1].label).toBe('B Inc');
    const last = segments[segments.length - 1];
    expect(last.type).toBe('gap');
    expect(last.label).toBe('Gap');
  });

  it('includes-activity-segments-in-order', () => {
    const segments = buildSegments(
      [makeExp({ company: 'Job', startDate: '2020-06', endDate: '2020-12' })],
      [],
      [makeAct({ name: 'Travel', startDate: '2020-01', endDate: '2020-05' })],
    );
    expect(segments[0].label).toBe('Travel');
    expect(segments[0].type).toBe('activity');
    expect(segments[1].label).toBe('Job');
  });

  it('inserts-auto-gap-for-periods-over-3-months', () => {
    const segments = buildSegments(
      [makeExp({ company: 'First', startDate: '2020-01', endDate: '2020-02' })],
      [makeEdu({ institution: 'Second', startDate: '2020-08', endDate: '2020-12' })],
      [],
    );
    const gap = segments.find((s) => s.type === 'gap');
    expect(gap).toBeDefined();
    expect(gap!.label).toBe('Gap');
  });

  it('does-not-insert-gap-for-periods-3-months-or-less', () => {
    const segments = buildSegments(
      [makeExp({ company: 'First', startDate: '2020-01', endDate: '2020-04' })],
      [makeEdu({ institution: 'Second', startDate: '2020-05', endDate: '2020-12' })],
      [],
    );
    // First ends 2020-04, Second starts 2020-05 → only 1 month gap, no auto-gap
    expect(segments.find((s, i) => i > 0 && s.type === 'gap' && segments[i-1].label === 'First')).toBeUndefined();
  });

  it('handles-present-positions-extends-to-current-date', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const todayStr = `${y}-${m}`;
    const segments = buildSegments(
      [makeExp({ company: 'Current Inc', startDate: '2020-01' })],
      [],
      [],
    );
    expect(segments[0].isCurrent).toBe(true);
    expect(segments[0].endDate).toBe(todayStr);
    expect(segments.length).toBe(1);
  });

  it('renders-activities-when-no-work-or-education', () => {
    const segments = buildSegments(
      [],
      [],
      [makeAct({ name: 'Travel', startDate: '2020-01', endDate: '2020-06' })],
    );
    expect(segments[0].type).toBe('activity');
    expect(segments[0].label).toBe('Travel');
    const last = segments[segments.length - 1];
    expect(last.type).toBe('gap');
    expect(last.label).toBe('Gap');
  });

  it('assigns-correct-widths-proportionally', () => {
    const segments = buildSegments(
      [makeExp({ company: 'A', startDate: '2020-01', endDate: '2020-06' })],
      [makeEdu({ institution: 'B', startDate: '2020-06', endDate: '2020-11' })],
      [],
    );
    // A: 5mo, B: 5mo, trailing: gap from 2020-11 to today
    expect(segments[0].width).toBeGreaterThan(0);
    expect(segments[1].width).toBeGreaterThan(0);
    const total = segments.reduce((s, seg) => s + seg.width, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('assigns-colors-correctly', () => {
    const segments = buildSegments(
      [makeExp({ company: 'ExpCo', startDate: '2020-01', endDate: '2020-06' })],
      [makeEdu({ institution: 'EduCo', startDate: '2020-07', endDate: '2020-12' })],
      [makeAct({ name: 'Travel', startDate: '2019-01', endDate: '2019-06' })],
    );
    expect(segments.find((s) => s.type === 'activity')!.color).toBe('var(--color-ctp-lavender)');
    expect(segments.find((s) => s.type === 'education')!.color).toBe('var(--color-ctp-blue)');
    expect(segments.find((s) => s.type === 'experience')!.color).toBe('var(--color-ctp-green)');
  });

  it('uses-yellow-for-current-role', () => {
    const segments = buildSegments(
      [makeExp({ company: 'CurrentCo', startDate: '2020-01' })],
      [],
      [],
    );
    const current = segments.find((s) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current!.color).toBe('var(--color-ctp-yellow)');
  });
});

describe('resolveSegment', () => {
  const segments: Segment[] = [
    { startDate: '2020-01', type: 'experience', isCurrent: false, label: 'A', width: 50, color: '#a6e3a1' },
    { startDate: '2020-07', type: 'education', isCurrent: false, label: 'B', width: 50, color: '#89b4fa' },
  ];

  it('returns-first-segment-for-position-0', () => {
    expect(resolveSegment(segments, 0)?.label).toBe('A');
  });

  it('returns-second-segment-for-position-0-51', () => {
    expect(resolveSegment(segments, 0.51)?.label).toBe('B');
  });

  it('returns-last-segment-for-position-0-99', () => {
    expect(resolveSegment(segments, 0.99)?.label).toBe('B');
  });

  it('returns-null-for-empty-segments', () => {
    expect(resolveSegment([], 0.5)).toBeNull();
  });

  it('returns-null-for-position-outside-range', () => {
    expect(resolveSegment(segments, -0.1)).toBeNull();
    expect(resolveSegment(segments, 1.1)).toBeNull();
  });
});

describe('getNearbyCourses', () => {
  const courses = [
    { title: 'React', provider: 'FM', date: '2020-06' },
    { title: 'TypeScript', provider: 'Egghead', date: '2020-03' },
    { title: 'CSS', provider: 'CSS Tricks', date: '2019-12' },
  ];

  it('returns-courses-within-threshold', () => {
    const nearby = getNearbyCourses(courses, '2020-05', 4);
    expect(nearby).toHaveLength(2);
    expect(nearby.map((c) => c.title)).toContain('React');
    expect(nearby.map((c) => c.title)).toContain('TypeScript');
  });

  it('returns-empty-array-when-no-courses-nearby', () => {
    const nearby = getNearbyCourses(courses, '2021-01', 1);
    expect(nearby).toHaveLength(0);
  });

  it('handles-threshold-of-0', () => {
    const nearby = getNearbyCourses(courses, '2020-06', 0);
    expect(nearby).toHaveLength(1);
    expect(nearby[0].title).toBe('React');
  });
});
