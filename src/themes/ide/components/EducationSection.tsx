import type { Education } from '@/types/cv';

export const EducationSection = ({ education }: { education: Education[] }) => (
  <>
    {education.map((edu, i) => (
      <div key={i} className="mb-4">
        <div>
          <span className="text-[var(--ide-label-color)]">degree: </span>
          <span className="text-[var(--ide-value-color)]">{edu.degree}</span>
        </div>
        <div>
          <span className="text-[var(--ide-label-color)]">institution: </span>
          <span className="text-[var(--ide-value-color)]">{edu.institution}</span>
        </div>
        <div className="text-[var(--ide-date-color)] text-sm">
          <span>{edu.startDate} – {edu.endDate ?? 'Ongoing'}</span>
        </div>
        {edu.description && (
          <p className="text-[var(--ide-value-color)] text-sm mt-1">{edu.description}</p>
        )}
      </div>
    ))}
  </>
);
