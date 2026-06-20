import { useSignals } from '@preact/signals-react/runtime';
import { Button } from '@/components/ui/button';
import { ThemeSelect } from '@/components/ThemeSelect';
import { LanguageSelect } from '@/components/LanguageSelect';
import { currentUI } from '@/state/locale';

export const TerminalPage = () => {
  useSignals();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-3xl font-bold">Curriculum Vitae Terminal</h1>
        <div className="flex items-center gap-2">
          <ThemeSelect />
          <LanguageSelect />
        </div>
      </div>
      <div className="flex gap-2 p-4">
        <Button variant="default">{currentUI.value.action.default}</Button>
        <Button variant="destructive">{currentUI.value.action.delete}</Button>
        <Button variant="outline">{currentUI.value.action.outline}</Button>
      </div>
    </div>
  );
};
