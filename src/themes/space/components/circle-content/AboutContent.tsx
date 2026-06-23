import type { Personality } from '@/types/cv';

export interface AboutContentProps {
  data: Personality;
}

export const AboutContent = ({ data }: AboutContentProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
        {data.name}
      </h2>
      <p className="text-base font-medium text-[var(--primary)]">
        {data.tagline}
      </p>
      <p className="text-sm leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">
        {data.summary}
      </p>
      {data.favoriteQuote && (
        <blockquote className="mt-2 text-sm italic text-[var(--accent)] border-l-2 border-[var(--border)] pl-3">
          <p>&ldquo;{data.favoriteQuote.text}&rdquo;</p>
          <p className="mt-0.5 not-italic text-[var(--muted-foreground)]">&mdash; {data.favoriteQuote.author}</p>
        </blockquote>
      )}
    </div>
  );
};
