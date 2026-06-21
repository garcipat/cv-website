import { useSignals } from '@preact/signals-react/runtime';
import { activeFile, sidebarExpanded, openFile } from '@/state/ide';
import { currentUI } from '@/state/locale';

export interface TreeItem {
  id: string;
  label: string;
  type: 'folder' | 'file';
  fileKey?: string;
  children?: TreeItem[];
}

export const FILE_TREE: TreeItem[] = [
  {
    id: 'cv-website',
    label: 'cv-website',
    type: 'folder',
    children: [
      {
        id: 'src',
        label: 'src',
        type: 'folder',
        children: [
          { id: 'about.tsx', label: 'about.tsx', type: 'file', fileKey: 'about.tsx' },
          {
            id: 'src/sections',
            label: 'sections',
            type: 'folder',
            children: [
              { id: 'experience.tsx', label: 'experience.tsx', type: 'file', fileKey: 'experience.tsx' },
              { id: 'skills.tsx', label: 'skills.tsx', type: 'file', fileKey: 'skills.tsx' },
              { id: 'projects.tsx', label: 'projects.tsx', type: 'file', fileKey: 'projects.tsx' },
              { id: 'education.tsx', label: 'education.tsx', type: 'file', fileKey: 'education.tsx' },
              { id: 'courses.tsx', label: 'courses.tsx', type: 'file', fileKey: 'courses.tsx' },
              { id: 'certificates.tsx', label: 'certificates.tsx', type: 'file', fileKey: 'certificates.tsx' },
            ],
          },
          { id: 'types.tsx', label: 'types.tsx', type: 'file', fileKey: 'types.tsx' },
        ],
      },
    ],
  },
];

function TreeNode({ item, depth }: { item: TreeItem; depth: number }) {
  const isFolder = item.type === 'folder';
  const expanded = isFolder ? sidebarExpanded.value.has(item.id) : false;
  const isActive = !isFolder && activeFile.value === item.fileKey;

  function handleClick() {
    if (isFolder) {
      const next = new Set(sidebarExpanded.value);
      if (expanded) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      sidebarExpanded.value = next;
    } else if (item.fileKey) {
      openFile(item.fileKey);
    }
  }

  return (
    <div>
      <button
        type="button"
        className={`flex w-full items-center gap-1 px-2 py-0.5 text-left text-sm cursor-pointer border-l-2 transition-colors ${
          isActive
            ? 'border-[var(--ide-active-tab-accent)] bg-[var(--color-ctp-surface)] text-[var(--color-ctp-text)]'
            : 'border-transparent text-[var(--color-ctp-subtext)] tree-hover'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        data-active={isActive ? 'true' : undefined}
      >
        {isFolder && (
          <span className="shrink-0 text-xs">
            {expanded ? '📂' : '📁'}
          </span>
        )}
        {!isFolder && <span className="shrink-0 text-xs">📄</span>}
        <span className="truncate">{item.label}{isFolder ? '/' : ''}</span>
      </button>
      {isFolder && expanded && item.children && (
        <div>
          {item.children.map((child) => (
            <TreeNode key={child.id} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export const FileTree = () => {
  useSignals();

  return (
    <div className="py-2">
      <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-ctp-overlay)] select-none">
        {currentUI.value.ide.explorer}
      </div>
      {FILE_TREE.map((item) => (
        <TreeNode key={item.id} item={item} depth={0} />
      ))}
    </div>
  );
};
