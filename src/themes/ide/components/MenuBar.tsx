import { useSignals } from '@preact/signals-react/runtime';
import { currentUI } from '@/state/locale';

export const MenuBar = () => {
  useSignals();

  return (
    <div className="col-span-2 flex items-center gap-1 px-4 h-8 bg-[var(--ide-sidebar-bg)] text-xs text-[var(--color-ctp-subtext)] border-b border-[var(--color-ctp-overlay)] shrink-0">
      {Object.values(currentUI.value.ide.menu).map((label) => (
        <span key={label} className="px-2 py-0.5 rounded hover:bg-[rgba(255,255,255,0.2)] hover:text-white cursor-default select-none">
          {label}
        </span>
      ))}
    </div>
  );
};
