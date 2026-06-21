import { useSignals } from '@preact/signals-react/runtime';
import { currentUI } from '@/state/locale';

export const MenuBar = () => {
  useSignals();

  return (
    <div className="col-span-2 flex items-center gap-1 px-4 h-8 bg-[var(--ide-sidebar-bg)] text-xs text-[var(--color-ctp-subtext)] border-b border-[var(--color-ctp-overlay)] shrink-0">
      <div className="flex items-center gap-1.5 mr-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#FF6B63', border: '1.5px solid #CC3F38' }} />
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#FFC94A', border: '1.5px solid #CC9A1C' }} />
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#3DD956', border: '1.5px solid #1A9E30' }} />
      </div>
      {Object.values(currentUI.value.ide.menu).map((label) => (
        <span key={label} className="menu-item px-2 py-0.5 rounded cursor-default select-none">
          {label}
        </span>
      ))}
    </div>
  );
};
