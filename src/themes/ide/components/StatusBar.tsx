import { useSignals } from '@preact/signals-react/runtime';
import { activeFile } from '@/state/ide';
import { currentUI } from '@/state/locale';

export const StatusBar = () => {
  useSignals();

  return (
    <div className="col-span-2 flex items-center justify-between px-4 h-6 bg-[var(--ide-status-bar-bg)] text-xs text-[var(--color-ctp-subtext)] border-t border-[var(--color-ctp-overlay)] shrink-0">
      <span>{activeFile.value ?? ''}</span>
      <div className="flex items-center gap-4">
        <span>Ln 1, Col 1</span>
        <span>{currentUI.value.ide.statusLang}</span>
      </div>
    </div>
  );
};
