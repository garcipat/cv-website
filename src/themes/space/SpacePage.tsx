import { useRef, useState, useCallback, useMemo } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV } from '@/state/locale';
import { cn } from '@/lib/utils';
import { CircleParade, type CircleParadeHandle } from './components/CircleParade';
import { AnchorDots } from './components/AnchorDots';
import { FloatingControls } from './components/FloatingControls';
import {
  buildCircleEntries,
  buildSections,
  getActiveSectionIndex,
  type SectionInfo,
  type CircleEntry,
} from './parade-utils';

/**
 * Space Theme — Circle Parade root layout.
 *
 * Full-viewport page with deep-space background and a starfield.
 * Circles drop in from top, settle at center, then drift to bottom corners.
 * Falls back to a static vertical stack when prefers-reduced-motion is active.
 */
export const SpacePage = () => {
  useSignals();

  // Detect reduced motion preference
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Build circle entries from the reactive CV data signal
  const entries = useMemo<CircleEntry[]>(
    () => buildCircleEntries(currentCV.value),
    [currentCV.value],
  );

  // Build section info for anchor dots
  const sections = useMemo<SectionInfo[]>(
    () => buildSections(entries),
    [entries],
  );

  // Active section tracking
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  // Poster visibility — hidden once user scrolls
  const [showPoster, setShowPoster] = useState(true);

  // Ref to CircleParade for scroll control
  const paradeRef = useRef<CircleParadeHandle>(null);

  // Handle active circle changes from CircleParade
  const handleActiveCircleChange = useCallback(
    (circleIndex: number) => {
      const sectionIdx = getActiveSectionIndex(sections, circleIndex);
      setActiveSectionIndex(sectionIdx);
    },
    [sections],
  );

  // Hide poster when user scrolls
  const handleUserScroll = useCallback(() => {
    if (showPoster) setShowPoster(false);
  }, [showPoster]);

  // Scroll to a specific circle (for anchor dot clicks)
  const handleDotClick = useCallback(
    (circleIndex: number) => {
      paradeRef.current?.scrollToCircle(circleIndex);
      setShowPoster(false);
    },
    [],
  );

  return (
    <div
      className="min-h-screen w-full overflow-hidden relative"
      style={{ background: 'var(--background)' }}
    >
      {/* Starfield background */}
      <Starfield />
      {/* Deep space radial glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, var(--primary) 0%, transparent 70%)',
          opacity: 0.08,
        }}
      />

      {/* Floating controls: theme + language (top-right) */}
      <FloatingControls />

      {prefersReducedMotion ? (
        /* Reduced-motion fallback: static vertical stack (FR-025, FR-026) */
        <div className="relative z-10 flex flex-col items-center gap-16 py-24 px-4">
          {entries.map((entry) => (
            <div
              key={entry.index}
              className="w-full max-w-lg bg-[var(--card)] backdrop-blur-xl border border-[var(--border)] rounded-[40px] shadow-lg shadow-black/20 p-8"
            >
              <ReducedMotionCircle entry={entry} />
            </div>
          ))}
        </div>
      ) : (
        /* Full circle parade */
        <div className="relative z-10 h-screen w-full">
          <CircleParade
            ref={paradeRef}
            entries={entries}
            onActiveCircleChange={handleActiveCircleChange}
            onUserScroll={handleUserScroll}
          />

          {/* Anchor dots: right-edge section navigation */}
          <AnchorDots
            sections={sections}
            activeSectionIndex={activeSectionIndex}
            onDotClick={handleDotClick}
          />
        </div>
      )}

      {/* Initial poster overlay with scroll hint */}
      {showPoster && !prefersReducedMotion && (
        <div
          className={cn(
            'fixed inset-0 z-100 flex flex-col items-center justify-center',
            'pointer-events-none transition-opacity duration-500',
          )}
        >
          <h1 className="text-[clamp(1.3rem,2.5vw,1.8rem)] font-bold text-[var(--foreground)] mb-2">
            Circle Parade
          </h1>
          <p className="text-[var(--muted-foreground)] text-[clamp(0.75rem,1.1vw,0.9rem)]">
            Scroll — circles drop in from top, drift out to the corners
          </p>
          <span className="text-2xl text-[var(--primary)] mt-4 animate-bounce">&darr;</span>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Starfield background
// ---------------------------------------------------------------------------

const STAR_COUNT = 100;

function Starfield() {
  const stars = useMemo(() => {
    return Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      delay: Math.random() * 3,
      duration: Math.random() * 3 + 2,
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white star-twinkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            ['--star-duration' as string]: `${s.duration}s`,
            ['--star-delay' as string]: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reduced-motion fallback inline renderer
// ---------------------------------------------------------------------------

import type { Personality, Experience, Project, SkillCategory, Education, Course, Certificate, ContactInfo } from '@/types/cv';

function ReducedMotionCircle({ entry }: { entry: CircleEntry }) {
  const content = renderStaticContent(entry);
  return <div className="text-center">{content}</div>;
}

function renderStaticContent(entry: CircleEntry): React.ReactNode {
  switch (entry.type) {
    case 'about': {
      const d = entry.data as Personality;
      return (
        <>
          <h2 className="text-xl font-bold text-[var(--foreground)]">{d.name}</h2>
          <p className="text-sm text-[var(--primary)] mt-1">{d.tagline}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-2 whitespace-pre-line">{d.summary}</p>
          {d.favoriteQuote && <p className="text-xs italic text-[var(--accent)] mt-2">&ldquo;{d.favoriteQuote}&rdquo;</p>}
        </>
      );
    }
    case 'experience': {
      const d = entry.data as Experience;
      return (
        <>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{d.role}</h3>
          <p className="text-xs text-[var(--primary)]">{d.company}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">{d.startDate} – {d.endDate ?? 'Present'}</p>
          <ul className="list-disc list-inside text-[10px] text-[var(--muted-foreground)] mt-1">
            {d.highlights.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </>
      );
    }
    case 'project': {
      const d = entry.data as Project;
      return (
        <>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{d.name}</h3>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{d.description}</p>
        </>
      );
    }
    case 'skillCategory': {
      const d = entry.data as SkillCategory;
      return (
        <>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{d.category}</h3>
          <div className="flex flex-wrap gap-1 justify-center mt-2">
            {d.skills.map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--primary)]">{s.name} {s.level}%</span>
            ))}
          </div>
        </>
      );
    }
    case 'education': {
      const d = entry.data as Education;
      return (
        <>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{d.degree}</h3>
          <p className="text-xs text-[var(--primary)]">{d.institution}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">{d.startDate} – {d.endDate ?? 'Present'}</p>
          {d.description && <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{d.description}</p>}
        </>
      );
    }
    case 'course': {
      const d = entry.data as Course;
      return (
        <>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{d.title}</h3>
          <p className="text-xs text-[var(--primary)]">{d.provider}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">{d.date}</p>
        </>
      );
    }
    case 'certificate': {
      const d = entry.data as Certificate;
      return (
        <>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{d.name}</h3>
          <p className="text-xs text-[var(--primary)]">{d.issuer}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">{d.date}</p>
        </>
      );
    }
    case 'contact': {
      const d = entry.data as ContactInfo;
      return (
        <>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Contact</h3>
          {d.email && <p className="text-[10px] text-[var(--muted-foreground)]">{d.email}</p>}
          {d.location && <p className="text-[10px] text-[var(--muted-foreground)]">{d.location}</p>}
        </>
      );
    }
    default:
      return null;
  }
}
