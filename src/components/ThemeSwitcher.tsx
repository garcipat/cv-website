import { useSyncExternalStore } from 'react';
import { themes, currentTheme, type ThemeId } from '@/state/theme';
import type { SelectRootChangeEventDetails } from '@base-ui/react/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const ThemeSwitcher = () => {
  const currentThemeId = useSyncExternalStore(
    (onStoreChange) => {
      const unsub = currentTheme.subscribe(onStoreChange);
      return unsub;
    },
    () => currentTheme.value,
    () => currentTheme.value,
  );

  const handleThemeChange = (
    value: string | null,
    _details: SelectRootChangeEventDetails,
  ) => {
    if (value !== null) {
      currentTheme.value = value as ThemeId;
    }
  };

  const items = Object.fromEntries(
    themes.map((t) => [t.id, t.label]),
  );

  return (
    <Select value={currentThemeId} onValueChange={handleThemeChange} items={items}>
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
