import { useSignals } from '@preact/signals-react/runtime';
import type { SkillCategory } from '@/types/cv';
import { currentUI } from '@/state/locale';
import { ProgressBar } from './ProgressBar';

function levelLabel(value: number, levels: typeof currentUI.value.skills.levels): string {
  if (value < 25) return levels.skilled;
  if (value < 50) return levels.proficient;
  if (value < 75) return levels.advanced;
  return levels.expert;
}

export const SkillsSection = ({ skills }: { skills: SkillCategory[] }) => {
  useSignals();
  const levels = currentUI.value.skills.levels;

  return (
    <div className="font-mono">
      <div className="text-[var(--color-ctp-lavender)] text-lg font-bold"># Skills</div>

      {skills.map((cat, i) => (
        <div key={i} className="mt-4">
          <div className="text-[var(--color-ctp-blue)] text-base font-semibold">## {cat.category}</div>

          <div className="mt-2 space-y-1">
            {cat.skills.map((skill, j) => (
              <div key={j} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-[var(--color-ctp-text)]">- {skill.name}</span>
                <ProgressBar value={skill.level} label={levelLabel(skill.level, levels)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
