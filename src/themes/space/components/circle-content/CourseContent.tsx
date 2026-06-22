import type { CourseBatch } from '../../parade-utils';
import type { Course } from '@/types/cv';

export interface CourseContentProps {
  data: CourseBatch;
}

function fmtDate(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function CourseEntry({ course }: { course: Course }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <h4 className="text-xs font-semibold text-[var(--foreground)] leading-tight text-center">
        {course.title}
      </h4>
      <p className="text-[10px] text-[var(--primary)]">
        {course.provider}
      </p>
      <p className="text-[9px] text-[var(--muted-foreground)]">
        {fmtDate(course.date)}
      </p>
    </div>
  );
}

export const CourseContent = ({ data }: CourseContentProps) => {
  return (
    <div className="flex flex-col gap-3 px-5 py-3 max-w-md mx-auto w-full">
      <h3 className="text-sm font-semibold text-[var(--primary)] text-center">
        Courses
      </h3>
      {data.courses.map((course, i) => (
        <div key={i}>
          {i > 0 && <div className="border-t border-[var(--border)] my-2 opacity-30" />}
          <CourseEntry course={course} />
        </div>
      ))}
    </div>
  );
};
