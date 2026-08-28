import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentUI } from '@/state/locale';
import { platformerPrototypeUnlocked, setPlatformerPrototypeUnlocked } from '@/state/theme';

interface MenuSubItem {
  key: string;
  label: string;
  kind: 'toggle' | 'link';
  checked?: boolean;
  onSelect: () => void;
}

/**
 * The IDE theme's top menu bar (File/Edit/Selection/View/Go/Run/Terminal)
 * was purely decorative — labels with a hover style and no click handler.
 * Menu items can now optionally carry a `submenu` (a dropdown opened by
 * clicking the label) whose entries are either a `toggle` (a checkbox-style
 * flag, e.g. unlocking a hidden theme) or a `link` (a plain action) — per
 * user request, giving the menu bar an actual purpose instead of just
 * dressing. Only "View" has a submenu today (unlocking the Platformer
 * theme in `ThemeSelect.tsx`'s dropdown, see `state/theme.ts`); the rest
 * stay decorative until something real needs to live there.
 */
export const MenuBar = () => {
  useSignals();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const unlocked = platformerPrototypeUnlocked.value;

  const submenus: Partial<Record<string, MenuSubItem[]>> = {
    view: [
      {
        key: 'showPlatformerPrototype',
        label: currentUI.value.ide.menuSubitems.showPlatformerPrototype,
        kind: 'toggle',
        checked: unlocked,
        onSelect: () => setPlatformerPrototypeUnlocked(!unlocked),
      },
    ],
  };

  const toggleMenu = (id: string) => {
    if (!submenus[id]) return;
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="col-span-2 flex items-center gap-1 px-4 h-8 bg-[var(--ide-sidebar-bg)] text-xs text-[var(--color-ctp-subtext)] border-b border-[var(--color-ctp-overlay)] shrink-0">
      <div className="flex items-center gap-1.5 mr-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#FF6B63', border: '1.5px solid #CC3F38' }} />
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#FFC94A', border: '1.5px solid #CC9A1C' }} />
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#3DD956', border: '1.5px solid #1A9E30' }} />
      </div>
      {Object.entries(currentUI.value.ide.menu).map(([id, label]) => {
        const submenu = submenus[id];
        return (
          <div key={id} className="relative">
            <span
              onClick={() => toggleMenu(id)}
              className={`menu-hover px-2 py-0.5 rounded select-none ${submenu ? 'cursor-pointer' : 'cursor-default'}`}
              data-testid={submenu ? `menu-trigger-${id}` : undefined}
              aria-haspopup={submenu ? 'menu' : undefined}
              aria-expanded={submenu ? openMenuId === id : undefined}
            >
              {label}
            </span>
            {submenu && openMenuId === id && (
              <>
                {/* Closes the dropdown on any outside click — a fixed,
                    transparent full-viewport layer behind the dropdown
                    itself (lower in DOM order = lower default stacking,
                    dropdown below has its own z-index). */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setOpenMenuId(null)}
                  data-testid="menu-backdrop"
                />
                <div
                  role="menu"
                  data-testid={`menu-dropdown-${id}`}
                  className="absolute top-full left-0 z-50 mt-1 min-w-56 rounded border border-[var(--color-ctp-overlay)] bg-[var(--ide-sidebar-bg)] py-1 shadow-lg"
                >
                  {submenu.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role={item.kind === 'toggle' ? 'menuitemcheckbox' : 'menuitem'}
                      aria-checked={item.kind === 'toggle' ? item.checked : undefined}
                      onClick={() => {
                        item.onSelect();
                        setOpenMenuId(null);
                      }}
                      className="menu-hover flex w-full cursor-pointer items-center gap-2 px-3 py-1 text-left select-none"
                    >
                      {item.kind === 'toggle' && (
                        <span className="inline-block w-3 shrink-0 text-[var(--color-ctp-green)]">
                          {item.checked ? '✓' : ''}
                        </span>
                      )}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
