import { useSignals } from '@preact/signals-react/runtime';
import { currentLocale, supportedLocales, changeLocale, currentUI } from '@/state/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const LanguageSelect = () => {
  useSignals();

  const handleLanguageChange = (value: string | null) => {
    if (value !== null) {
      changeLocale(value as 'en' | 'de');
    }
  };

  const items = Object.fromEntries(
    supportedLocales.map((loc) => [loc, currentUI.value.language.names[loc]]),
  );

  return (
    <Select value={currentLocale.value} onValueChange={handleLanguageChange} items={items}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {supportedLocales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {currentUI.value.language.names[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
