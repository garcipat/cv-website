import { useSignals } from '@preact/signals-react/runtime';
import { currentTheme, type ThemeId } from '@/state/theme';
import { currentUI } from '@/state/locale';
import type { SelectRootChangeEventDetails } from '@base-ui/react/select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const themeIds: ThemeId[] = ['ide', 'space', 'terminal'];

export const ThemeSelect = () => {
  useSignals();

  const handleThemeChange = (
    value: string | null,
    _details: SelectRootChangeEventDetails,
  ) => {
    if (value !== null) {
      currentTheme.value = value as ThemeId;
    }
  };

  const items = Object.fromEntries(
    themeIds.map((id) => [id, currentUI.value.themes[id]]),
  );

  return (
    <Select value={currentTheme.value} onValueChange={handleThemeChange} items={items}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={currentUI.value.themes.select} />
      </SelectTrigger>
      <SelectContent>
        {themeIds.map((id) => (
          <SelectItem key={id} value={id}>
            {currentUI.value.themes[id]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
