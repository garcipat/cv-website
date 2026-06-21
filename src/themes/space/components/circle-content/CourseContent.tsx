import type { Course } from '@/types/cv';

export interface CourseContentProps {
  data: Course;
}

function fmtDate(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export const CourseContent = ({ data }: CourseContentProps) => {
  return (
    <div className="flex flex-col items-center gap-1.5 max-w-sm mx-auto text-center">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {data.title}
      </h3>
      <p className="text-xs text-[var(--primary)]">
        {data.provider}
      </p>
      <p className="text-[10px] text-[var(--muted-foreground)]">
        {fmtDate(data.date)}
      </p>
      {data.certificate && (
        <a
          href={data.certificate}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[var(--accent)] hover:underline mt-1"
        >
          View Certificate
        </a>
      )}
    </div>
  );
};
