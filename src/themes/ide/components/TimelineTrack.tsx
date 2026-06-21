import { useRef, useCallback } from 'react';
import { monthsBetween, todayYmd, parseYmdToMonths } from './timeline-utils';
import type { Segment } from './timeline-utils';

interface TimelineTrackProps {
  segments: Segment[];
  markerPosition: number;
  onMarkerChange: (position: number) => void;
  courses: { title: string; provider: string; date: string }[];
}

function getOpacity(type: Segment['type'], isActive: boolean): number {
  if (type === 'activity') return isActive ? 0.8 : 0.3;
  if (type === 'gap') return isActive ? 0.6 : 0.2;
  return isActive ? 1.0 : 0.35;
}

export const TimelineTrack = ({
  segments,
  markerPosition,
  onMarkerChange,
  courses,
}: TimelineTrackProps) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const overallStart = segments.length > 0 ? segments[0].startDate : '';
  const lastSeg = segments[segments.length - 1];
  const overallEnd = lastSeg?.endDate ?? todayYmd();
  const totalMonths = monthsBetween(overallStart, overallEnd) || 1;

  const activeSegment = (() => {
    let cum = 0;
    for (const s of segments) {
      cum += s.width;
      if (markerPosition * 100 <= cum) return s;
    }
    return segments[segments.length - 1] ?? null;
  })();

  const markerDate = (() => {
    if (!activeSegment) return '';
    const markerMonthOffset = Math.round(markerPosition * totalMonths);
    const overallStartMonths = parseYmdToMonths(overallStart);
    const markerMonths = overallStartMonths + markerMonthOffset;
    const y = Math.floor(markerMonths / 12);
    const m = markerMonths % 12 + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  })();

  const setMarkerFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pos = Math.max(0, Math.min(1, x / rect.width));
      onMarkerChange(pos);
    },
    [onMarkerChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setMarkerFromPointer(e.clientX);
      const handleMove = (ev: PointerEvent) => setMarkerFromPointer(ev.clientX);
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [setMarkerFromPointer],
  );

  const overallStartMonths = parseYmdToMonths(overallStart);
  const overallEndMonths = parseYmdToMonths(overallEnd);
  const startYear = parseInt(overallStart.split('-')[0], 10);
  const endYear = parseInt(overallEnd.split('-')[0], 10);
  const yearTicks: { label: string; pct: number }[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const yearStart = parseYmdToMonths(`${y}-01`);
    const pct = ((yearStart - overallStartMonths) / totalMonths) * 100;
    if (pct >= 0 && pct <= 100) {
      yearTicks.push({ label: String(y), pct });
    }
  }

  const coursePositions = courses
    .map((c) => {
      const courseMonths = parseYmdToMonths(c.date);
      const startMonths = parseYmdToMonths(overallStart);
      const pct = ((courseMonths - startMonths) / totalMonths) * 100;
      return { ...c, pct };
    })
    .filter((c) => c.pct >= 0 && c.pct <= 100);

  return (
    <div className="select-none">
      {markerDate && (
        <div className="flex justify-center mb-4">
          <div className="px-4 py-1 rounded-[3px] text-sm font-semibold border bg-ctp-surface0 text-ctp-yellow border-ctp-surface1">
            {formatBadgeDate(markerDate)}
          </div>
        </div>
      )}

      <div className="flex flex-col w-full">
        <div className="relative w-full text-xs h-4 text-ctp-subtext1">
          {yearTicks.map((t) => (
            <span key={t.label} className="absolute -translate-x-1/2" style={{ left: `${t.pct}%` }}>
              {t.label}
            </span>
          ))}
        </div>

        <div className="relative w-full h-[36px] cursor-pointer" ref={trackRef} onPointerDown={handlePointerDown}>
          <div className="flex h-[12px] w-full absolute top-1/2 -translate-y-1/2">
            {segments.map((s, i) => {
              const isActive = s === activeSegment;
              const isFirst = i === 0;
              const isLast = i === segments.length - 1;
              const corner = isFirst && isLast ? 'rounded-[6px]' : isFirst ? 'rounded-l-[6px]' : isLast ? 'rounded-r-[6px]' : '';
              return (
                <div
                  key={i}
                  className={`relative ${corner}`}
                  style={{
                    width: `${s.width}%`,
                    backgroundColor: s.color,
                    opacity: getOpacity(s.type, isActive),
                    boxShadow: isActive ? 'inset 0 0 12px rgba(255,255,255,0.12)' : undefined,
                  }}
                />
              );
            })}
          </div>

          {yearTicks.map((t) => (
            <div
              key={t.label}
              className="absolute top-1/2 -translate-y-1/2 w-[1px] h-4 bg-ctp-surface2"
              style={{ left: `${t.pct}%` }}
            />
          ))}

          {coursePositions.map((c, i) => (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${c.pct}%`, zIndex: 1 }}
            >
              <div className="w-[7px] h-[7px] rotate-45 bg-ctp-yellow border border-ctp-mantle" />
            </div>
          ))}

          <div
            className="absolute pointer-events-none"
            style={{
              left: `${markerPosition * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
            }}
          >
            <div className="w-[10px] h-[10px] rotate-45 mx-auto mb-[2px] bg-ctp-red border-2 border-ctp-yellow" />
            <div className="w-[1px] h-6 mx-auto bg-ctp-red/70" />
          </div>
        </div>

        <div className="flex w-full text-xs mt-2 text-ctp-subtext1">
          {segments.map((s, i) => {
            const isActive = s === activeSegment;
            return (
              <div
                key={i}
                className={isActive ? '' : 'truncate'}
                style={{
                  width: `${s.width}%`,
                  color: isActive ? s.color : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  overflow: isActive ? 'visible' : undefined,
                  whiteSpace: isActive ? 'nowrap' : undefined,
                }}
              >
                {isActive ? s.label : ''}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function formatBadgeDate(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[m - 1]} ${y}`;
}
