const FILLED = '\u2588';
const EMPTY = '\u2591';

export function ProgressBar({ value, label, width = 20 }: { value: number; label: string; width?: number }) {
  const filled = Math.round((value / 100) * width);
  const bar = FILLED.repeat(filled) + EMPTY.repeat(width - filled);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[var(--ide-highlight-color)]">[{bar}]</span>
      <span className="text-[var(--color-ctp-yellow)]">{label}</span>
    </span>
  );
}
