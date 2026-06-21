import { useSignals } from '@preact/signals-react/runtime';
import { openTabs, activeFile, closeTab } from '@/state/ide';
import { currentUI } from '@/state/locale';

export const TabBar = () => {
  useSignals();

  if (openTabs.value.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center h-9 bg-[var(--ide-tab-bar-bg)] border-b border-[var(--color-ctp-overlay)] shrink-0 overflow-x-auto">
      {openTabs.value.map((fileName) => {
        const isActive = activeFile.value === fileName;
        return (
          <button
            key={fileName}
            type="button"
            className={`shrink-0 group relative flex items-center gap-1 px-3 h-full text-xs cursor-pointer border-r border-[var(--color-ctp-overlay)] whitespace-nowrap ${
              isActive
                ? 'bg-[var(--color-ctp-mantle)] text-[var(--color-ctp-text)]'
                : 'bg-[var(--ide-tab-bar-bg)] text-[var(--color-ctp-subtext)] hover:text-white'
            }`}
            onClick={() => { activeFile.value = fileName; }}
            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(fileName); } }}
          >
            <span className="truncate max-w-32">{fileName}</span>
            <span
              role="button"
              tabIndex={0}
              className={`ml-1 text-[var(--color-ctp-overlay)] hover:text-[var(--color-ctp-subtext)] ${!isActive ? 'opacity-0 group-hover:opacity-100' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(fileName);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  closeTab(fileName);
                }
              }}
              aria-label={`${currentUI.value.ide.close} ${fileName}`}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
};
