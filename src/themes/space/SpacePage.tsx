import { useRef, useMemo, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV, currentUI } from '@/state/locale';
import { cn } from '@/lib/utils';
import { CircleParade } from './components/CircleParade';
import { SpaceParade } from './components/SpaceParade';
import { Nebula } from './components/space-elements/Nebula';
import { Sun } from './components/space-elements/Sun';
import { AnchorDots } from './components/AnchorDots';
import { FloatingControls } from '@/components/FloatingControls';
import { scrollOffset, showPoster } from './SpaceState';
import {
  buildCircleEntries,
  buildSections,
  totalScrollSpan,
  type SectionInfo,
  type CircleEntry,
  type CourseBatch,
  type CertificateBatch,
} from './parade-utils';

export const SpacePage = () => {
  useSignals();

  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const entries = useMemo<CircleEntry[]>(
    () => buildCircleEntries(currentCV.value),
    [],
  );

  const paradeTotalSpan = useMemo(
    () => Math.max(entries.length * 1.4 + 1.0, 5.0),
    [entries.length],
  );

  const totalSpan = totalScrollSpan(entries);

  const sections = useMemo<SectionInfo[]>(
    () => buildSections(entries),
    [entries],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Scroll handler ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      scrollOffset.value = container.scrollTop / window.innerHeight;
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // ── Hide poster on first scroll ──
  useEffect(() => {
    const unsub = scrollOffset.subscribe((val) => {
      if (val > 0) showPoster.value = false;
    });
    return unsub;
  }, []);

  // ── Scroll to circle (anchor dot click) ──
  const scrollToCircle = (circleIndex: number) => {
    const container = containerRef.current;
    if (!container || circleIndex < 0 || circleIndex >= entries.length) return;
    if (typeof container.scrollTo !== 'function') return;

    const entry = entries[circleIndex];
    container.scrollTo({
      top: entry.circleCenter * window.innerHeight,
      behavior: 'smooth',
    });
    showPoster.value = false;
  };

  return (
    <div
      className="min-h-screen w-full overflow-hidden relative"
      style={{ background: 'var(--background)' }}
    >
      <Starfield />
      <Nebula />
      <Sun />
      <div
        className="fixed inset-0 pointer-events-none z-0"
        data-testid="space-ambient-glow"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, var(--primary) 0%, transparent 70%)',
          opacity: 0.08,
        }}
      />

      <FloatingControls variant="glass" />

      {!prefersReducedMotion && (
        <SpaceParade totalSpan={paradeTotalSpan} />
      )}

      {prefersReducedMotion ? (
        <div className="relative z-10 flex flex-col items-center gap-16 py-24 px-4">
          {entries.map((entry) => (
            <div
              key={entry.index}
              className="w-full max-w-lg bg-[var(--card)] backdrop-blur-xl border border-[var(--border)] rounded-[40px] shadow-lg shadow-black/20 p-8"
              data-testid="space-static-card"
            >
              <ReducedMotionCircle entry={entry} />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-10 h-screen w-full">
          <div
            ref={containerRef}
            className="h-screen w-full overflow-y-scroll"
            style={{ scrollbarWidth: 'none' }}
            data-testid="space-scroll-container"
          >
            <div
              data-testid="space-scroll-spacer"
              style={{
                height: `${totalSpan * 100}vh`,
                pointerEvents: 'none',
              }}
            />
          </div>

          <CircleParade entries={entries} />

          <AnchorDots
            sections={sections}
            onDotClick={scrollToCircle}
          />
        </div>
      )}

      {showPoster.value && !prefersReducedMotion && (
        <div
          className={cn(
            'fixed inset-0 z-100 flex flex-col items-center justify-center',
            'pointer-events-none transition-opacity duration-500',
          )}
          data-testid="space-poster"
        >
          <h1 className="text-[clamp(1.3rem,2.5vw,1.8rem)] font-bold text-[var(--foreground)] mb-2">
            {currentUI.value.space.posterTitle}
          </h1>
          <p className="text-[var(--muted-foreground)] text-[clamp(0.75rem,1.1vw,0.9rem)]">
            {currentUI.value.space.posterSubtitle}
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

function generateStars() {
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 3,
    duration: Math.random() * 3 + 2,
  }));
}

function Starfield() {
  const stars = useMemo(() => generateStars(), []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" data-testid="starfield">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white star-twinkle"
          data-testid="starfield-star"
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

import type { Personality, Experience, Project, SkillCategory, Education, ContactInfo } from '@/types/cv';

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
          <h2 className="text-2xl font-bold text-[var(--foreground)]">{d.name}</h2>
          <p className="text-base text-[var(--primary)] mt-1">{d.tagline}</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2 whitespace-pre-line">{d.summary}</p>
          {d.favoriteQuote && <p className="text-sm italic text-[var(--accent)] mt-2">&ldquo;{d.favoriteQuote.text}&rdquo; <span className="not-italic text-[var(--muted-foreground)]">&mdash; {d.favoriteQuote.author}</span></p>}
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
    case 'courseBatch': {
      const d = entry.data as CourseBatch;
      const ui = currentUI.value;
      return (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.sections.courses}</h3>
          {d.courses.map((c, i) => (
            <div key={i}>
              {i > 0 && <hr className="border-[var(--border)] opacity-30 my-1" />}
              <p className="text-xs text-[var(--foreground)]">{c.title}</p>
              <p className="text-[10px] text-[var(--primary)]">{c.provider}</p>
              <p className="text-[9px] text-[var(--muted-foreground)]">{c.date}</p>
            </div>
          ))}
        </div>
      );
    }
    case 'certificateBatch': {
      const d = entry.data as CertificateBatch;
      const ui = currentUI.value;
      return (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.sections.certificates}</h3>
          {d.certificates.map((c, i) => (
            <div key={i}>
              {i > 0 && <hr className="border-[var(--border)] opacity-30 my-1" />}
              <p className="text-xs text-[var(--foreground)]">{c.name}</p>
              <p className="text-[10px] text-[var(--primary)]">{c.issuer}</p>
              <p className="text-[9px] text-[var(--muted-foreground)]">{c.date}</p>
            </div>
          ))}
        </div>
      );
    }
    case 'contact': {
      const d = entry.data as ContactInfo;
      const ui = currentUI.value;
      return (
        <>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.sections.contact}</h3>
          {d.email && <p className="text-[10px] text-[var(--muted-foreground)]">{d.email}</p>}
          {d.location && <p className="text-[10px] text-[var(--muted-foreground)]">{d.location}</p>}
        </>
      );
    }
    default:
      return null;
  }
}
