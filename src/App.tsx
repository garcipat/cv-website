import { IdePage } from '@/themes/ide/IdePage';
import { SpacePage } from '@/themes/space/SpacePage';
import { TerminalPage } from '@/themes/terminal/TerminalPage';
import { activeTheme } from '@/state/theme';

const themePages = {
  ide: IdePage,
  space: SpacePage,
  terminal: TerminalPage,
} as const;

export const App = () => {
  const Page = themePages[activeTheme.value] ?? IdePage;
  return <Page />;
};
