// ---------------------------------------------------------------------------
// Space Theme — Pure utility functions for the circle parade
//
// No React dependency — importable by tests without jsdom.
// All functions are pure: same input → same output, no side effects.
// ---------------------------------------------------------------------------

import type {
  CVData,
  Personality,
  Experience,
  Project,
  SkillCategory,
  Education,
  Course,
  Certificate,
  ContactInfo,
} from '@/types/cv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Identifies which CV section a circle belongs to. */
export type CircleType =
  | 'about'
  | 'experience'
  | 'project'
  | 'skillCategory'
  | 'education'
  | 'course'
  | 'certificate'
  | 'contact';

/** Section identifiers for anchor dot navigation. */
export type SectionId =
  | 'about'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'education'
  | 'courses'
  | 'certificates'
  | 'contact';

/** Exit direction for circles: bottom-left or bottom-right (alternating). */
export type ExitDirection = 'bl' | 'br';

/** A single entry in the circle parade — everything needed to render one circle. */
export interface CircleEntry {
  /** Which type of CV content this circle displays */
  type: CircleType;
  /** The actual CV data for this circle */
  data: Personality | Experience | Project | SkillCategory | Education | Course | Certificate | ContactInfo;
  /** Zero-based index within the flat circle list */
  index: number;
  /** The section identifier for anchor dot grouping */
  sectionId: SectionId;
  /** Scroll offset (in effective-span units) where this circle is centered (midpoint of its span) */
  circleCenter: number;
  /** Scroll span for this circle (in effective-span units) */
  effectiveSpan: number;
  /** Exit direction: 'bl' (bottom-left) or 'br' (bottom-right), alternates per circle */
  exitDirection: ExitDirection;
}

/** Visual transform values for a circle at a given scroll position. */
export interface CircleTransform {
  /** Horizontal offset in vw units */
  translateX: number;
  /** Vertical offset in vh units (negative = above, positive = below) */
  translateY: number;
  /** Scale factor */
  scale: number;
  /** Opacity of the entire circle wrapper */
  wrapperOpacity: number;
  /** Opacity of the inner content (fades separately from the glass shell) */
  contentOpacity: number;
  /** Whether the circle is in the settled display zone (triggers float animation) */
  settled: boolean;
}

/** Summary of a section for anchor dot rendering. */
export interface SectionInfo {
  /** Section identifier */
  id: SectionId;
  /** Display label (from UI translations — populated by component layer) */
  label: string;
  /** Index of the first circle in this section within the flat list */
  firstCircleIndex: number;
  /** Number of circles in this section */
  circleCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed pool size — exactly 7 DOM nodes regardless of CV item count (FR-030) */
export const POOL_SIZE = 7;

/** Default scroll span per circle in vh-equivalent units (1.0 = 100vh). 1.4 = 140vh matches mockup. */
export const DEFAULT_CIRCLE_SPAN = 1.4;

/** Lead-in gap before the first circle (in effective-span units). Gives scroll room for the first circle to drop in from offscreen. */
export const PARADE_LEAD_IN = 1.0;

/** Maximum effective span for a circle with overflowing content (capped at 3.0 = 300vh per FR-011) */
export const MAX_EFFECTIVE_SPAN = 3.0;

// ---------------------------------------------------------------------------
// Easing functions
// ---------------------------------------------------------------------------

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}



// ---------------------------------------------------------------------------
// buildCircleEntries
// ---------------------------------------------------------------------------

/**
 * Flattens CVData into an ordered list of CircleEntry objects.
 *
 * Order per FR-004:
 *   about → experience[] → projects[] → skillCategories[] →
 *   education[] → courses[] → certificates[] → contact
 *
 * Empty arrays produce zero circles. Contact is omitted when undefined or empty (FR-012).
 */
export function buildCircleEntries(cv: CVData): CircleEntry[] {
  const entries: CircleEntry[] = [];

  const push = (
    type: CircleType,
    data: CircleEntry['data'],
    sectionId: SectionId,
  ) => {
    entries.push({
      type,
      data,
      index: entries.length,
      sectionId,
      circleCenter: 0,
      effectiveSpan: DEFAULT_CIRCLE_SPAN,
      exitDirection: (entries.length % 2 === 0 ? 'bl' : 'br') as ExitDirection,
    });
  };

  // 1. About / Personality (always present)
  push('about', cv.personality, 'about');

  // 2. Experience entries
  for (const exp of cv.experience) push('experience', exp, 'experience');

  // 3. Projects
  for (const proj of cv.projects) push('project', proj, 'projects');

  // 4. Skill categories
  for (const skillCat of cv.skills) push('skillCategory', skillCat, 'skills');

  // 5. Education
  for (const edu of cv.education) push('education', edu, 'education');

  // 6. Courses
  for (const course of cv.courses) push('course', course, 'courses');

  // 7. Certificates
  for (const cert of cv.certificates) push('certificate', cert, 'certificates');

  // 8. Contact — omitted if undefined or has no meaningful fields (FR-012)
  if (cv.contact && hasContactData(cv.contact)) {
    push('contact', cv.contact, 'contact');
  }

  // Compute circle centers: midpoint of each span (matching mockup)
  recomputeCenters(entries);

  return entries;
}

/** Re-compute circleCenter for all entries: midpoint of each span, with a lead-in gap before the first circle. */
function recomputeCenters(entries: CircleEntry[]): void {
  let offset = PARADE_LEAD_IN;
  for (const entry of entries) {
    entry.circleCenter = offset + entry.effectiveSpan / 2;
    offset += entry.effectiveSpan;
  }
}

/** Check if contact data has at least one meaningful field. */
function hasContactData(contact: ContactInfo): boolean {
  return !!(contact.email || contact.phone || contact.location || contact.website || contact.linkedin || contact.github);
}

// ---------------------------------------------------------------------------
// computeCircleTransform
// ---------------------------------------------------------------------------

/**
 * Computes the visual transform for a circle at a given scroll position.
 *
 * Matches the mockup's computeTransform:
 *   - Entry: drops from top (translateY: -75vh → 0)
 *   - Center: fully visible, settled, content fades in
 *   - Exit: drifts to bottom-left or bottom-right corner
 *
 * @param scrollOffset  Current scroll position in effective-span units
 * @param circleCenter  The scroll offset where this circle is perfectly centered
 * @param effectiveSpan The scroll span for this circle (in effective-span units)
 * @param exitDirection 'bl' for bottom-left exit, 'br' for bottom-right exit
 *
 * SC-002 guarantee: at most one circle has scale >= 0.9 and opacity >= 0.9
 * at any scroll position within the active parade region.
 */
export function computeCircleTransform(
  scrollOffset: number,
  circleCenter: number,
  effectiveSpan: number,
  exitDirection: ExitDirection,
): CircleTransform {
  // Display zone: how much scroll range around center keeps the circle fully visible.
  // Larger = more solo time, less overlap.
  const DISPLAY_ZONE = 0.3;
  const displayHalf = DISPLAY_ZONE / 2; // 0.15

  // Guard against zero/negative span
  const span = effectiveSpan <= 0 ? DEFAULT_CIRCLE_SPAN : effectiveSpan;
  const dist = (scrollOffset - circleCenter) / span;

  // Offscreen above (dist <= -1): hidden at top
  if (dist <= -1) {
    return { translateX: 0, translateY: -75, scale: 0.12, wrapperOpacity: 0, contentOpacity: 0, settled: false };
  }

  // Offscreen below (dist >= 1): at exit corner
  if (dist >= 1) {
    const cx = exitDirection === 'bl' ? -65 : 65;
    return { translateX: cx, translateY: 75, scale: 0.12, wrapperOpacity: 0, contentOpacity: 0, settled: false };
  }

  // ── Entry phase: dist ∈ (-1, -displayHalf] ──
  // Circle drops from top, grows, content fades in
  if (dist <= -displayHalf) {
    const t = (dist + 1) / (1 - displayHalf); // 0 → 1 during entry
    const et = easeOutCubic(t);
    // Content starts fading in at 30% through entry
    const ct = t < 0.3 ? 0 : (t - 0.3) / 0.7;
    return {
      translateX: 0,
      translateY: -75 * (1 - et),
      scale: 0.12 + 0.88 * et,
      wrapperOpacity: et,
      contentOpacity: ct,
      settled: false,
    };
  }

  // ── Exit phase: dist ∈ [displayHalf, 1) ──
  // Circle drifts to corner, shrinks, content fades out
  // easeOut: leaves quickly at start, slows as it reaches the corner
  if (dist >= displayHalf) {
    const t = (dist - displayHalf) / (1 - displayHalf); // 0 → 1 during exit
    const et = easeOutCubic(t);
    const cx = exitDirection === 'bl' ? -65 : 65;
    // Content fades out in first 30% of exit
    const ct = t < 0.3 ? 1 - (t / 0.3) : 0;
    return {
      translateX: cx * et,
      translateY: 75 * et,
      scale: 1 - 0.88 * et,
      wrapperOpacity: 1 - et,
      contentOpacity: ct,
      settled: false,
    };
  }

  // ── Display phase: dist ∈ (-displayHalf, displayHalf) ──
  return {
    translateX: 0,
    translateY: 0,
    scale: 1,
    wrapperOpacity: 1,
    contentOpacity: 1,
    settled: true,
  };
}

// ---------------------------------------------------------------------------
// buildSections & getActiveSectionIndex
// ---------------------------------------------------------------------------

/**
 * Groups circle entries by SectionId for anchor dot navigation.
 * Returns one SectionInfo per non-empty section, in parade order.
 */
export function buildSections(entries: CircleEntry[]): SectionInfo[] {
  const sectionMap = new Map<SectionId, { firstIndex: number; count: number }>();

  for (const entry of entries) {
    const existing = sectionMap.get(entry.sectionId);
    if (existing) {
      existing.count++;
    } else {
      sectionMap.set(entry.sectionId, {
        firstIndex: entry.index,
        count: 1,
      });
    }
  }

  // Build sections in the order they appear in the parade
  const seen = new Set<SectionId>();
  const sections: SectionInfo[] = [];

  for (const entry of entries) {
    if (seen.has(entry.sectionId)) continue;
    seen.add(entry.sectionId);

    const info = sectionMap.get(entry.sectionId);
    if (info) {
      sections.push({
        id: entry.sectionId,
        label: entry.sectionId,
        firstCircleIndex: info.firstIndex,
        circleCount: info.count,
      });
    }
  }

  return sections;
}

/**
 * Determine which section's dot should be active given the current
 * active circle index (the circle nearest to the center of the viewport).
 */
export function getActiveSectionIndex(
  sections: SectionInfo[],
  activeCircleIndex: number,
): number {
  for (let i = sections.length - 1; i >= 0; i--) {
    if (activeCircleIndex >= sections[i].firstCircleIndex) {
      return i;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Effective span helpers
// ---------------------------------------------------------------------------

/**
 * Compute total scroll distance for the entire parade (lead-in + sum of all effective spans).
 * Used to set the spacer div height in CircleParade.
 */
export function totalScrollSpan(entries: CircleEntry[]): number {
  if (entries.length === 0) return 0;
  return PARADE_LEAD_IN + entries.reduce((sum, e) => sum + e.effectiveSpan, 0);
}

/**
 * Find the closest circle index to a given scroll offset.
 * Used by the CircleParade pool manager to determine the active circle.
 */
export function findClosestCircleIndex(
  entries: CircleEntry[],
  scrollOffset: number,
): number {
  if (entries.length === 0) return 0;

  let closest = 0;
  let minDistance = Infinity;

  for (let i = 0; i < entries.length; i++) {
    const dist = Math.abs(scrollOffset - entries[i].circleCenter);
    if (dist < minDistance) {
      minDistance = dist;
      closest = i;
    }
  }

  return closest;
}
