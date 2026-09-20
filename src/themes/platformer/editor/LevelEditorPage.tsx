import { EditorWorkspace } from './EditorWorkspace';

/**
 * The editor's layout shell. Reads no signals and holds no persistence,
 * file-I/O or placement logic (FR-015) — every value lives in `editorState`
 * and every mutation goes through `editorActions`.
 */
export const LevelEditorPage = () => (
  <div data-testid="editor-page" className="flex h-screen flex-col gap-4 p-4">
    <EditorWorkspace />
  </div>
);
