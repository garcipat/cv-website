import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV, currentUI } from '@/state/locale';
import {
  buildSegments,
  resolveSegment,
  getNearbyCourses,
  monthsBetween,
  todayYmd,
  type Segment,
} from './timeline-utils';
import { TimelineTrack } from './TimelineTrack';
import { TimelineContentCard } from './TimelineContentCard';

const NEARBY_THRESHOLD_MONTHS = 6;

export const TimelineSection = () => {
  useSignals();

  const cv = currentCV.value;
  const experience = cv.experience ?? [];
  const education = cv.education ?? [];
  const activities = cv.activities ?? [];
  const courses = cv.courses ?? [];

  const segments: Segment[] = buildSegments(experience, education, activities);

  const [markerPosition, setMarkerPosition] = useState(0);

  const activeSegment = resolveSegment(segments, markerPosition);

  const overallStart = segments.length > 0 ? segments[0].startDate : '';
  const last = segments[segments.length - 1];
  const overallEnd = last?.endDate ?? todayYmd();

  const markerDate = (() => {
    if (!overallStart || !activeSegment) return '';
    const totalMonths = monthsBetween(overallStart, overallEnd) || 1;
    const markerMonthOffset = Math.round(markerPosition * totalMonths);
    const startY = parseInt(overallStart.split('-')[0], 10);
    const startM = parseInt(overallStart.split('-')[1], 10);
    const markerMonths = startY * 12 + (startM - 1) + markerMonthOffset;
    const y = Math.floor(markerMonths / 12);
    const m = markerMonths % 12 + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  })();

  const nearbyCourses = markerDate
    ? getNearbyCourses(courses, markerDate, NEARBY_THRESHOLD_MONTHS)
    : [];

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-ctp-subtext)]">
        <p className="text-sm">{currentUI.value.ide.timeline.empty}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
        <div className="text-xs mb-3 text-ctp-subtext0">
          {currentUI.value.ide.timeline.comment}
        </div>

        <TimelineTrack
          segments={segments}
          markerPosition={markerPosition}
          onMarkerChange={setMarkerPosition}
          courses={courses}
        />

        {activeSegment && (
          <TimelineContentCard
            segment={activeSegment}
            nearbyCourses={nearbyCourses}
          />
        )}

        <div className="flex gap-4 mt-4 text-xs text-ctp-subtext1">
          <div className="flex items-center gap-1">
            <span className="inline-block w-[8px] h-[8px] rounded-[2px] bg-ctp-blue/60" />
            {currentUI.value.ide.timeline.legend.education}
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-[8px] h-[8px] rounded-[2px] bg-ctp-lavender/60" />
            {currentUI.value.ide.timeline.legend.activity}
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-[8px] h-[8px] rounded-[2px] bg-ctp-green/60" />
            {currentUI.value.ide.timeline.legend.experience}
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-[5px] h-[5px] rotate-45 bg-ctp-yellow" />
            {currentUI.value.ide.timeline.legend.course}
          </div>
        </div>
      </div>
  );
};
