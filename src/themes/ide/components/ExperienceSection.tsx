import type { Experience } from '@/types/cv';

export const ExperienceSection = ({ experience }: { experience: Experience[] }) => (
  <>
    {experience.map((exp, i) => (
      <div key={i} className="mb-4">
        <div>
          <span className="text-[var(--ide-label-color)]">company: </span>
          <span className="text-[var(--ide-value-color)] font-medium">{exp.company}</span>
        </div>
        <div>
          <span className="text-[var(--ide-label-color)]">role: </span>
          <span className="text-[var(--ide-value-color)]">{exp.role}</span>
        </div>
        <div className="text-[var(--ide-date-color)] text-sm">
          <span>{exp.startDate} – {exp.endDate ?? 'Present'}</span>
          {exp.location && <span> · {exp.location}</span>}
        </div>
        <div className="ml-4 mt-1 space-y-0.5">
          {exp.highlights.map((h, j) => (
            <div key={j} className="text-[var(--ide-value-color)] text-sm">
              {h}
            </div>
          ))}
        </div>
      </div>
    ))}
  </>
);
