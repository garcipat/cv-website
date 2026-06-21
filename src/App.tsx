import { useSignals } from '@preact/signals-react/runtime';
import { IdePage } from '@/themes/ide/IdePage';
import { SpacePage } from '@/themes/space/SpacePage';
import { TerminalPage } from '@/themes/terminal/TerminalPage';
import { currentTheme } from '@/state/theme';

const themePages = {
  ide: IdePage,
  space: SpacePage,
  terminal: TerminalPage,
} as const;

export const App = () => {
  useSignals();
  const Page = themePages[currentTheme.value] ?? IdePage;
  return <Page />;
};
