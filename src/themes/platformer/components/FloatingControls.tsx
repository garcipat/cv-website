import { useSignals } from '@preact/signals-react/runtime';
import { ThemeSelect } from '@/components/ThemeSelect';
import { LanguageSelect } from '@/components/LanguageSelect';

export const FloatingControls = () => {
  useSignals();

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <ThemeSelect />
      <LanguageSelect />
    </div>
  );
};
