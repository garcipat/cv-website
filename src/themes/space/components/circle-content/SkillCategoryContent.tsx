import type { SkillCategory } from '@/types/cv';

export interface SkillCategoryContentProps {
  data: SkillCategory;
}

function levelLabel(level: number): string {
  if (level >= 90) return 'Expert';
  if (level >= 75) return 'Advanced';
  if (level >= 50) return 'Proficient';
  return 'Skilled';
}

export const SkillCategoryContent = ({ data }: SkillCategoryContentProps) => {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 max-w-md mx-auto w-full">
      <h3 className="text-base font-semibold text-[var(--foreground)] text-center">
        {data.category}
      </h3>
      <div className="space-y-2">
        {data.skills.map((skill, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--muted-foreground)] text-right whitespace-nowrap w-40 shrink-0 overflow-visible">
              {skill.name}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all"
                style={{ width: `${skill.level}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] whitespace-nowrap shrink-0 w-12 text-left">
              {levelLabel(skill.level)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
