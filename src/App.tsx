import { lazy, Suspense } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { IdePage } from '@/themes/ide/IdePage';
import { SpacePage } from '@/themes/space/SpacePage';
import { TerminalPage } from '@/themes/terminal/TerminalPage';
import { PlatformerPage } from '@/themes/platformer/PlatformerPage';
import { currentTheme } from '@/state/theme';

const LevelEditorPage = lazy(() =>
  import('@/themes/platformer/editor/LevelEditorPage').then((m) => ({ default: m.LevelEditorPage })),
);

const themePages = {
  ide: IdePage,
  space: SpacePage,
  terminal: TerminalPage,
  platformer: PlatformerPage,
} as const;

export const App = () => {
  useSignals();
  if (window.location.pathname === '/platformer/editor') {
    return (
      <Suspense fallback={null}>
        <LevelEditorPage />
      </Suspense>
    );
  }
  const Page = themePages[currentTheme.value] ?? IdePage;
  return <Page />;
};
