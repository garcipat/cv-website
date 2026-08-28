import { useSignals } from '@preact/signals-react/runtime';
import { currentTheme, visibleThemes } from '@/state/theme';
import { currentLocale, supportedLocales, changeLocale, currentUI } from '@/state/locale';

export const SidebarSettings = () => {
  useSignals();

  return (
    <div className="border-t border-[var(--color-ctp-overlay)] px-3 py-3 space-y-4">
      <fieldset>
        <legend className="text-xs font-medium text-[var(--color-ctp-overlay)] uppercase tracking-wider mb-2">
          {currentUI.value.ide.themes}
        </legend>
        <div className="space-y-1">
          {visibleThemes.value.map((t) => {
            const checked = currentTheme.value === t.id;
            return (
              <label
                key={t.id}
                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                  checked
                    ? 'text-[var(--color-ctp-text)] bg-[var(--color-ctp-surface)]'
                    : 'text-[var(--color-ctp-subtext)] hover:text-[var(--color-ctp-text)] hover:bg-[var(--color-ctp-surface)]'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={t.id}
                  checked={checked}
                  onChange={() => { currentTheme.value = t.id; }}
                  className="appearance-none w-3 h-3 rounded-full border-2 border-[var(--color-ctp-overlay)] checked:border-[var(--color-ctp-lavender)] checked:bg-[var(--color-ctp-lavender)] shrink-0"
                />
                {t.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-medium text-[var(--color-ctp-overlay)] uppercase tracking-wider mb-2">
          {currentUI.value.ide.language}
        </legend>
        <div className="space-y-1">
          {supportedLocales.map((loc) => {
            const checked = currentLocale.value === loc;
            return (
              <label
                key={loc}
                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                  checked
                    ? 'text-[var(--color-ctp-text)] bg-[var(--color-ctp-surface)]'
                    : 'text-[var(--color-ctp-subtext)] hover:text-[var(--color-ctp-text)] hover:bg-[var(--color-ctp-surface)]'
                }`}
              >
                <input
                  type="radio"
                  name="locale"
                  value={loc}
                  checked={checked}
                  onChange={() => { changeLocale(loc); }}
                  className="appearance-none w-3 h-3 rounded-full border-2 border-[var(--color-ctp-overlay)] checked:border-[var(--color-ctp-lavender)] checked:bg-[var(--color-ctp-lavender)] shrink-0"
                />
                {loc.toUpperCase()}
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
};
