import { useSignals } from '@preact/signals-react/runtime';
import { EditorSidebar } from './EditorSidebar';
import { EditorCanvasPane } from './EditorCanvasPane';
import { EditorToolbar } from './EditorToolbar';
import {
  editorActiveLayerSignal,
  editorArmedBlueprintIdSignal,
  editorBackgroundPlacementsSignal,
  editorBlueprintDirtySignal,
  editorCanvasModeSignal,
  editorCenterRequestIdSignal,
  editorDirtySignal,
  editorGridSignal,
  editorIsBlueprintModeSignal,
  editorLastPlacementSnapshotSignal,
  editorLevelSignal,
  editorLoadedBlueprintNameSignal,
  editorLoadedLevelNameSignal,
  editorSaveResultSignal,
  editorSelectedBackgroundPieceSignal,
  editorSelectedToolSignal,
} from './editorState';

/**
 * The editor's single signal-reading container. It subscribes once with
 * `useSignals()` and passes the current editor values down to the presentational
 * containers, keeping `LevelEditorPage` a layout shell (FR-015) while giving
 * every editor value exactly one signal source (FR-017).
 */
export const EditorWorkspace = () => {
  useSignals();

  const isBlueprintMode = editorIsBlueprintModeSignal.value;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Platformer Level Editor</h1>
        <EditorToolbar
          activeLayer={editorActiveLayerSignal.value}
          isBlueprintMode={isBlueprintMode}
          lastPlacementSnapshot={editorLastPlacementSnapshotSignal.value}
          loadedLevelName={editorLoadedLevelNameSignal.value}
          isDirty={editorDirtySignal.value}
          loadedBlueprintName={editorLoadedBlueprintNameSignal.value}
          blueprintDirty={editorBlueprintDirtySignal.value}
          saveResult={editorSaveResultSignal.value}
          levelGrid={editorLevelSignal.value}
        />
      </header>
      <div className="flex min-h-0 flex-1 flex-row items-stretch gap-4">
        <EditorSidebar
          activeLayer={editorActiveLayerSignal.value}
          canvasMode={editorCanvasModeSignal.value}
          selectedTool={editorSelectedToolSignal.value}
          selectedBackgroundPiece={editorSelectedBackgroundPieceSignal.value}
          armedBlueprintId={editorArmedBlueprintIdSignal.value}
        />
        <EditorCanvasPane
          isBlueprintMode={isBlueprintMode}
          grid={editorGridSignal.value}
          backgroundPlacements={editorBackgroundPlacementsSignal.value}
          selectedTool={editorSelectedToolSignal.value}
          activeLayer={editorActiveLayerSignal.value}
          selectedBackgroundPiece={editorSelectedBackgroundPieceSignal.value}
          armedBlueprintId={editorArmedBlueprintIdSignal.value}
          centerRequestId={editorCenterRequestIdSignal.value}
          lastPlacementSnapshot={editorLastPlacementSnapshotSignal.value}
        />
      </div>
    </div>
  );
};
