import { Palette } from './Palette';
import { armBlueprint, selectBackgroundMaterial, selectTool } from './editorActions';
import type { EditorCanvasMode, EditorLayer } from './editorState';
import type { BackgroundChar, TileChar } from '../level/LevelParser';

export interface EditorSidebarProps {
  activeLayer: EditorLayer;
  canvasMode: EditorCanvasMode;
  selectedTool: TileChar;
  selectedBackgroundMaterial: BackgroundChar | null;
  armedBlueprintId: string | null;
}

/**
 * The editor sidebar: the tiles-only Palette (FR-007). Every command and toggle
 * lives in `EditorToolbar`; the Palette keeps its collapsible catalog-derived
 * groups and its layer/canvas-driven contents untouched (FR-008/FR-009).
 */
export const EditorSidebar = ({
  activeLayer,
  canvasMode,
  selectedTool,
  selectedBackgroundMaterial,
  armedBlueprintId,
}: EditorSidebarProps) => (
  <div data-testid="editor-sidebar" className="flex min-h-0 flex-col gap-2 overflow-y-auto">
    <Palette
      selectedTool={selectedTool}
      onSelectTool={selectTool}
      activeLayer={activeLayer}
      selectedBackgroundMaterial={selectedBackgroundMaterial}
      onSelectBackgroundMaterial={selectBackgroundMaterial}
      canvasMode={canvasMode}
      armedBlueprintId={armedBlueprintId}
      onArmBlueprint={armBlueprint}
    />
  </div>
);
