import { useSignals } from '@preact/signals-react/runtime';
import { currentTheme, visibleThemes, type ThemeId } from '@/state/theme';
import { currentUI } from '@/state/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const ThemeSelect = () => {
  useSignals();

  // Derived from the shared `visibleThemes` computed signal (state/theme.ts)
  // rather than re-filtering `themes` locally — every theme switcher UI
  // (this dropdown, the IDE theme's sidebar radio list) reads the same
  // source so Platformer's unlock state can't drift between them.
  const themeIds: ThemeId[] = visibleThemes.value.map((t) => t.id);

  const handleThemeChange = (value: string | null) => {
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
