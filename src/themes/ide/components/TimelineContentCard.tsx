import type { Segment } from './timeline-utils';
import { useSignals } from '@preact/signals-react/runtime';
import { currentUI } from '@/state/locale';

interface TimelineContentCardProps {
  segment: Segment;
  nearbyCourses: { title: string; provider: string; date: string }[];
}

export const TimelineContentCard = ({ segment, nearbyCourses }: TimelineContentCardProps) => {
  useSignals();
  return (
    <div className="rounded-[4px] p-4 mt-5 border bg-ctp-surface border-ctp-surface0">
      {segment.type === 'activity' || segment.type === 'gap' ? (
        <>
          <div className="flex items-baseline gap-[10px] mb-[6px]">
            <span className="text-sm font-semibold" style={{ color: segment.color }}>
              {segment.label}
            </span>
            <span className="text-xs text-ctp-subtext0">
              {segment.startDate} - {segment.isCurrent ? 'Present' : segment.endDate}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-[10px] mb-[6px]">
            <span className="text-sm font-semibold" style={{ color: segment.color }}>
              {segment.type === 'education' ? segment.institution : segment.company}
            </span>
            <span className="text-xs text-ctp-subtext0">
              {segment.type === 'education' ? segment.degree : segment.role}
              &nbsp;·&nbsp;
              {segment.startDate} - {segment.isCurrent ? 'Present' : segment.endDate}
            </span>
          </div>
          {segment.location && (
            <div className="text-xs mb-2 text-ctp-subtext0">
              {segment.location}
            </div>
          )}
          {segment.highlights && segment.highlights.length > 0 && (
            <div className="text-xs leading-relaxed text-ctp-text">
              {segment.highlights.map((h, i) => (
                <div key={i}>• {h}</div>
              ))}
            </div>
          )}
        </>
      )}

      {nearbyCourses.length > 0 && (
        <div className="mt-2 pt-2 border-t border-ctp-surface0">
          <div className="text-xs text-ctp-subtext1">
            {currentUI.value.ide.timeline.coursesNearby}
          </div>
          {nearbyCourses.map((c, i) => (
            <div key={i} className="text-xs text-ctp-yellow">
              {c.title} — {c.provider} ({c.date})
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
