import type { Personality } from '@/types/cv';

export const AboutSection = ({ personality }: { personality: Personality }) => (
  <>
    <div className="mb-4">
      <span className="text-[var(--ide-label-color)] font-semibold">const </span>
      <span className="text-[var(--ide-value-color)] font-semibold">{personality.name}</span>
      <span className="text-[var(--ide-label-color)]">: </span>
      <span className="text-[var(--ide-value-color)]">{personality.tagline}</span>
    </div>
    <div className="mb-3 text-[var(--ide-value-color)] leading-relaxed">
      {personality.summary.split('\n\n').map((p, i) => (
        <p key={i} className="mb-2">{p}</p>
      ))}
    </div>
    {personality.favoriteQuote && (
      <div className="border-l-2 border-[var(--ide-highlight-color)] pl-3 my-3 text-[var(--ide-highlight-color)] italic">
        "{personality.favoriteQuote}"
      </div>
    )}
  </>
);
