import { useSignals } from '@preact/signals-react/runtime';
import { MenuBar } from './components/MenuBar';
import { FileTree } from './components/FileTree';
import { SidebarSettings } from './components/SidebarSettings';
import { TabBar } from './components/TabBar';
import { EditorPane } from './components/EditorPane';
import { StatusBar } from './components/StatusBar';

export const IdePage = () => {
  useSignals();

  return (
    <div className="grid h-screen w-full grid-rows-[auto_1fr_auto] grid-cols-[260px_1fr] overflow-hidden bg-[var(--ide-editor-bg)] text-[var(--color-ctp-text)]" style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
      <MenuBar />

      <div className="flex flex-col bg-[var(--ide-sidebar-bg)] border-r border-[var(--color-ctp-overlay)] overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <FileTree />
        </div>
        <SidebarSettings />
      </div>

      <div className="flex flex-col overflow-hidden">
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <EditorPane />
        </div>
      </div>

      <StatusBar />
    </div>
  );
};
