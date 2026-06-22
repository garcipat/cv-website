const BLOCK = '\u2588';

export function ProgressBar({ value, label, width = 20 }: { value: number; label: string; width?: number }) {
  const filled = Math.round((value / 100) * width);

  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs leading-none">
      <span>
        <span className="text-[var(--ide-highlight-color)]">[{BLOCK.repeat(filled)}</span>
        <span className="text-[var(--color-ctp-surface2)]">{BLOCK.repeat(width - filled)}</span>
        <span className="text-[var(--ide-highlight-color)]">]</span>
      </span>
      <span className="text-[var(--color-ctp-yellow)]">{label}</span>
    </span>
  );
}
