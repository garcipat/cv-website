import { useSignals } from '@preact/signals-react/runtime';
import { currentUI } from '@/state/locale';

export const ReadmeSection = () => {
  useSignals();
  const t = currentUI.value.ide.readme;

  return (
    <div className="font-mono">
      <div className="text-[var(--color-ctp-lavender)] text-lg font-bold"># {t.title}</div>

      <div className="mt-2 text-[var(--color-ctp-overlay)]">
        <div>// {t.tagline1}</div>
        <div>// {t.tagline2}</div>
      </div>

      <div className="mt-4 text-[var(--color-ctp-blue)] text-base font-semibold">## {t.about}</div>

      <div className="mt-2 text-[var(--color-ctp-text)] leading-relaxed">{t.aboutBody}</div>

      <div className="mt-4 text-[var(--color-ctp-blue)] text-base font-semibold">## {t.techStack}</div>

      <div className="mt-2 text-[var(--color-ctp-overlay)]">
        <span>// {t.techStackBody}</span>
      </div>

      <div className="mt-4 text-[var(--color-ctp-blue)] text-base font-semibold">## {t.gettingStarted}</div>

      <div className="mt-2 text-[var(--color-ctp-text)] space-y-1">
        <div>- {t.step1}</div>
        <div>- {t.step2}</div>
        <div>- {t.step3}</div>
        <div>- {t.step4}</div>
      </div>
    </div>
  );
};
