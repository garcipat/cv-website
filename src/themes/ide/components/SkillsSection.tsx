import type { SkillCategory } from '@/types/cv';

export const SkillsSection = ({ skills }: { skills: SkillCategory[] }) => (
  <>
    {skills.map((cat, i) => (
      <div key={i} className="mb-4">
        <div className="text-[var(--ide-label-color)] font-medium mb-1">{cat.category}</div>
        {cat.skills.map((skill, j) => (
          <div key={j} className="flex items-center gap-2 mb-1">
            <span className="text-[var(--ide-value-color)] text-sm w-28 shrink-0">{skill.name}</span>
            <div className="h-2 flex-1 rounded-full bg-[var(--color-ctp-surface)] overflow-hidden max-w-48">
              <div
                className="h-full rounded-full bg-[var(--ide-active-tab-accent)] transition-all"
                style={{ width: `${skill.level}%` }}
              />
            </div>
            <span className="text-[var(--ide-date-color)] text-xs w-8 text-right">{skill.level}%</span>
          </div>
        ))}
      </div>
    ))}
  </>
);
