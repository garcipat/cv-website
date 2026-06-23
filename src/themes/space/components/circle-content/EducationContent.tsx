import type { Education } from '@/types/cv';

export interface EducationContentProps {
  data: Education;
}

function fmtDate(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export const EducationContent = ({ data }: EducationContentProps) => {
  return (
    <div className="flex flex-col items-center gap-1.5 max-w-sm mx-auto text-center">
      <h3 className="text-base font-semibold text-[var(--foreground)]">
        {data.degree}
      </h3>
      <p className="text-sm font-medium text-[var(--primary)]">
        {data.institution}
      </p>
      <p className="text-xs text-[var(--muted-foreground)]">
        {fmtDate(data.startDate)} – {data.endDate ? fmtDate(data.endDate) : 'Present'}
      </p>
      {data.description && (
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)] mt-1">
          {data.description}
        </p>
      )}
    </div>
  );
};
