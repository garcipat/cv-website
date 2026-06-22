import type { Experience } from '@/types/cv';

export interface ExperienceContentProps {
  data: Experience;
}

function formatDateRange(start: string, end?: string): string {
  const fmt = (ym: string) => {
    const [y, m] = ym.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  };
  return `${fmt(start)} – ${end ? fmt(end) : 'Present'}`;
}

export const ExperienceContent = ({ data }: ExperienceContentProps) => {
  return (
    <div className="flex flex-col items-center gap-1.5 max-w-md mx-auto text-center">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {data.role}
      </h3>
      <p className="text-xs font-medium text-[var(--primary)]">
        {data.company}{data.client ? <span className="text-[var(--muted-foreground)]"> @ {data.client}</span> : null}
      </p>
      <p className="text-[10px] text-[var(--muted-foreground)]">
        {formatDateRange(data.startDate, data.endDate)}
        {data.location && <span> &middot; {data.location}</span>}
      </p>
      <ul className="mt-1 space-y-0.5 list-none text-center">
        {data.highlights.map((h, i) => (
          <li key={i} className="text-[10px] leading-relaxed text-[var(--muted-foreground)]">
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
};
