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
    <div className="flex flex-col gap-2 px-5 py-3 max-w-sm mx-auto w-full">
      <h3 className="text-sm font-semibold text-[var(--foreground)] text-center">
        {data.category}
      </h3>
      <div className="space-y-1.5">
        {data.skills.map((skill, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--muted-foreground)] w-16 shrink-0 text-right">
              {skill.name}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all"
                style={{ width: `${skill.level}%` }}
              />
            </div>
            <span className="text-[9px] text-[var(--muted-foreground)] w-14">
              {levelLabel(skill.level)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
