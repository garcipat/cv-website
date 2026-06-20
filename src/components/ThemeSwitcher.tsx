import { useSyncExternalStore } from 'react';
import { themes, activeTheme, type ThemeId } from '@/state/theme';
import type { SelectRootChangeEventDetails } from '@base-ui/react/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const ThemeSwitcher = () => {
  const currentTheme = useSyncExternalStore(
    (onStoreChange) => {
      const unsub = activeTheme.subscribe(onStoreChange);
      return unsub;
    },
    () => activeTheme.value,
    () => activeTheme.value,
  );

  const handleThemeChange = (
    value: string | null,
    _details: SelectRootChangeEventDetails,
  ) => {
    if (value !== null) {
      activeTheme.value = value as ThemeId;
    }
  };

  const items = Object.fromEntries(
    themes.map((t) => [t.id, t.label]),
  );

  return (
    <Select value={currentTheme} onValueChange={handleThemeChange} items={items}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Select theme" />
      </SelectTrigger>
      <SelectContent>
        {themes.map((theme) => (
          <SelectItem key={theme.id} value={theme.id}>
            {theme.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
