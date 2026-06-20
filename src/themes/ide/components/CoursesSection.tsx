import type { Course } from '@/types/cv';

export const CoursesSection = ({ courses }: { courses: Course[] }) => (
  <>
    {courses.map((course, i) => (
      <div key={i} className="mb-2 text-sm">
        <span className="text-[var(--ide-label-color)]">course: </span>
        <span className="text-[var(--ide-value-color)]">{course.title}</span>
        <span className="text-[var(--ide-date-color)]"> — {course.provider} ({course.year})</span>
        {course.certificate && (
          <a href={course.certificate} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--ide-link-color)] hover:underline text-xs">
            [certificate]
          </a>
        )}
      </div>
    ))}
  </>
);
