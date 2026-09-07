import { useSignals } from '@preact/signals-react/runtime';
import { currentTheme, themes, type ThemeId } from '@/state/theme';
import { currentUI } from '@/state/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ThemeSelectProps {
  onOpenChange?: (open: boolean) => void;
}

export const ThemeSelect = ({ onOpenChange }: ThemeSelectProps = {}) => {
  useSignals();

  // Read straight from the shared `themes` list (state/theme.ts) — every
  // theme switcher UI (this dropdown, the IDE theme's sidebar radio list)
  // renders the same source, so the offered themes can't drift between them.
  const themeIds: ThemeId[] = themes.map((t) => t.id);

  const handleThemeChange = (value: string | null) => {
    if (value !== null) {
      currentTheme.value = value as ThemeId;
    }
  };

  const items = Object.fromEntries(
    themeIds.map((id) => [id, currentUI.value.themes[id]]),
  );

  return (
    <Select
      value={currentTheme.value}
      onValueChange={handleThemeChange}
      onOpenChange={(open) => onOpenChange?.(open)}
      items={items}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={currentUI.value.themes.select} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {themeIds.map((id) => (
          <SelectItem key={id} value={id}>
            {currentUI.value.themes[id]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
