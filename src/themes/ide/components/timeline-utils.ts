import type { Experience, Education, Activity as ActivityData } from '@/types/cv';

export interface Segment {
  startDate: string;
  endDate?: string;
  type: 'experience' | 'education' | 'activity' | 'gap';
  isCurrent: boolean;
  label: string;
  company?: string;
  role?: string;
  institution?: string;
  degree?: string;
  highlights?: string[];
  description?: string;
  location?: string;
  client?: string;
  skills?: string[];
  width: number;
  color: string;
}

interface RawEntry {
  startDate: string;
  endDate?: string;
  type: Segment['type'];
  isCurrent: boolean;
  label: string;
  company?: string;
  role?: string;
  institution?: string;
  degree?: string;
  highlights?: string[];
  description?: string;
  location?: string;
  client?: string;
  skills?: string[];
  color: string;
}

const COLORS = {
  education: 'var(--color-ctp-blue)',
  experience: 'var(--color-ctp-green)',
  currentRole: 'var(--color-ctp-yellow)',
  activity: 'var(--color-ctp-lavender)',
  gap: 'var(--color-ctp-lavender)',
} as const;



function parseYmd(dateStr: string): Date {
  const [y, m] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function parseYmdToMonths(dateStr: string): number {
  const [y, m] = dateStr.split('-').map(Number);
  return y * 12 + (m - 1);
}

export function monthsBetween(a: string, b: string): number {
  const dA = parseYmd(a);
  const dB = parseYmd(b);
  return (dB.getFullYear() - dA.getFullYear()) * 12 + (dB.getMonth() - dA.getMonth());
}

export function todayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function pickColor(type: Segment['type'], isCurrent: boolean): string {
  if (type === 'education') return COLORS.education;
  if (type === 'experience' && isCurrent) return COLORS.currentRole;
  if (type === 'experience') return COLORS.experience;
  return COLORS.activity;
}

function experienceToRaw(exp: Experience): RawEntry {
  const isCurrent = !exp.endDate;
  return {
    startDate: exp.startDate,
    endDate: exp.endDate,
    type: 'experience',
    isCurrent,
    label: exp.company,
    company: exp.company,
    role: exp.role,
    highlights: exp.highlights,
    location: exp.location,
    client: exp.client,
    skills: exp.skills,
    color: pickColor('experience', isCurrent),
  };
}

function educationToRaw(edu: Education): RawEntry {
  return {
    startDate: edu.startDate,
    endDate: edu.endDate,
    type: 'education',
    isCurrent: !edu.endDate,
    label: edu.institution,
    institution: edu.institution,
    degree: edu.degree,
    highlights: edu.description ? edu.description.split('\n').filter(Boolean) : undefined,
    color: pickColor('education', false),
  };
}

function activityToRaw(act: ActivityData): RawEntry {
  return {
    startDate: act.startDate,
    endDate: act.endDate,
    type: 'activity',
    isCurrent: false,
    label: act.name,
    description: act.description,
    color: pickColor('activity', false),
  };
}

export function buildSegments(
  experience: Experience[],
  education: Education[],
  activities: ActivityData[],
): Segment[] {
  const entries: RawEntry[] = [
    ...experience.map(experienceToRaw),
    ...education.map(educationToRaw),
    ...activities.map(activityToRaw),
  ];

  if (entries.length === 0) return [];

  entries.sort((a, b) => parseYmd(a.startDate).getTime() - parseYmd(b.startDate).getTime());

  // resolve overlaps: truncate any entry that overlaps with the previous one
  const resolved: RawEntry[] = [];
  for (const entry of entries) {
    if (resolved.length === 0) {
      resolved.push(entry);
      continue;
    }
    const prev = resolved[resolved.length - 1];
    if (!prev.endDate) {
      resolved.push(entry);
      continue;
    }
    const prevEnd = parseYmdToMonths(prev.endDate);
    const entryStart = parseYmdToMonths(entry.startDate);
    if (entryStart < prevEnd) {
      const adjusted = { ...entry, startDate: prev.endDate };
      const aStart = parseYmdToMonths(adjusted.startDate);
      const aEnd = adjusted.endDate ? parseYmdToMonths(adjusted.endDate) : Infinity;
      if (aEnd > aStart) resolved.push(adjusted);
    } else {
      resolved.push(entry);
    }
  }

  // insert auto-gaps for periods > 3 months
  const withGaps: RawEntry[] = [];
  for (let i = 0; i < resolved.length; i++) {
    withGaps.push(resolved[i]);

    const currentEnd = resolved[i].endDate;
    const nextStart = resolved[i + 1]?.startDate;

    if (currentEnd && nextStart) {
      const gap = monthsBetween(currentEnd, nextStart);
      if (gap > 3) {
        withGaps.push({
          startDate: currentEnd,
          endDate: nextStart,
          type: 'gap',
          isCurrent: false,
          label: 'Gap',
          color: COLORS.gap,
        });
      }
    }

    // trailing gap from last entry to today
    if (i === resolved.length - 1) {
      const entry = resolved[i];
      if (entry.endDate) {
        const gap = monthsBetween(entry.endDate, todayYmd());
        if (gap > 3) {
          withGaps.push({
            startDate: entry.endDate,
            endDate: todayYmd(),
            type: 'gap',
            isCurrent: false,
            label: 'Gap',
            color: COLORS.gap,
          });
        }
      }
    }
  }

  // compute total span
  const overallStart = withGaps[0].startDate;
  const last = withGaps[withGaps.length - 1];
  const overallEnd = last.endDate ?? todayYmd();
  const totalMonths = monthsBetween(overallStart, overallEnd) || 1;

  const raw = withGaps.map((entry) => {
    const entryStart = entry.startDate;
    const entryEnd = entry.endDate ?? todayYmd();
    const entryMonths = monthsBetween(entryStart, entryEnd);
    const width = (entryMonths / totalMonths) * 100;

    const segmentEndDate = entry.isCurrent ? todayYmd() : entry.endDate;
    return {
      startDate: entryStart,
      endDate: segmentEndDate,
      type: entry.type,
      isCurrent: entry.isCurrent,
      label: entry.label,
      company: entry.company,
      role: entry.role,
      institution: entry.institution,
      degree: entry.degree,
      highlights: entry.highlights,
      description: entry.description,
      location: entry.location,
      skills: entry.skills,
      width,
      color: entry.color,
    };
  });

  // normalize widths to sum to 100% (handles residual overlap in edge cases)
  const totalWidth = raw.reduce((sum, s) => sum + s.width, 0);
  if (totalWidth > 0 && Math.abs(totalWidth - 100) > 0.01) {
    raw.forEach((s) => { s.width = (s.width / totalWidth) * 100; });
  }

  return raw;
}

export function resolveSegment(segments: Segment[], position: number): Segment | null {
  if (segments.length === 0 || position < 0 || position > 1) return null;

  let cumulative = 0;
  for (const segment of segments) {
    cumulative += segment.width;
    if (position * 100 <= cumulative) return segment;
  }

  return segments[segments.length - 1] ?? null;
}

export function getNearbyCourses(
  courses: { title: string; provider: string; date: string }[],
  markerDate: string,
  thresholdMonths: number,
): { title: string; provider: string; date: string }[] {
  return courses.filter((c) => Math.abs(monthsBetween(markerDate, c.date)) <= thresholdMonths);
}
