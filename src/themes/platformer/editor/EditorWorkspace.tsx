import { useEffect, useLayoutEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { EditorSidebar } from './EditorSidebar';
import { EditorCanvasPane } from './EditorCanvasPane';
import { EditorToolbar } from './EditorToolbar';
import {
  editorActiveLayerSignal,
  editorAppearanceSignal,
  editorArmedBlueprintIdSignal,
  editorBackgroundGridSignal,
  editorBackgroundSignal,
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
  editorSelectedBackgroundMaterialSignal,
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
  const appearance = editorAppearanceSignal.value;

  // The editor owns its palette: the attribute lives on <html> while the
  // editor is mounted so portaled Dialog/Select/Tooltip content inherits the
  // tokens too, and it is removed on unmount so no other route does (O-015
  // FR-004/FR-005).
  // `useLayoutEffect` (not `useEffect`): `EditorCanvas` reads the
  // `--editor-canvas-backdrop` token in its own passive redraw effect, and
  // React runs child passive effects before parent passive effects. Setting the
  // attribute in a passive effect here would let the canvas read the *previous*
  // appearance's token until some unrelated redraw (a pan) — so the toggle
  // would not repaint the canvas. A layout effect runs before any passive
  // effect (and before paint), so the canvas always reads the current token.
  useLayoutEffect(() => {
    document.documentElement.dataset.editorAppearance = appearance;
  }, [appearance]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.editorAppearance;
    },
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Platformer Level Editor</h1>
        <EditorToolbar
          activeLayer={editorActiveLayerSignal.value}
          isBlueprintMode={isBlueprintMode}
          appearance={appearance}
          lastPlacementSnapshot={editorLastPlacementSnapshotSignal.value}
          loadedLevelName={editorLoadedLevelNameSignal.value}
          isDirty={editorDirtySignal.value}
          loadedBlueprintName={editorLoadedBlueprintNameSignal.value}
          blueprintDirty={editorBlueprintDirtySignal.value}
          saveResult={editorSaveResultSignal.value}
          levelGrid={editorLevelSignal.value}
          backgroundGrid={editorBackgroundSignal.value}
        />
      </header>
      <div className="flex min-h-0 flex-1 flex-row items-stretch gap-4">
        <EditorSidebar
          activeLayer={editorActiveLayerSignal.value}
          canvasMode={editorCanvasModeSignal.value}
          selectedTool={editorSelectedToolSignal.value}
          selectedBackgroundMaterial={editorSelectedBackgroundMaterialSignal.value}
          armedBlueprintId={editorArmedBlueprintIdSignal.value}
        />
        <EditorCanvasPane
          isBlueprintMode={isBlueprintMode}
          appearance={appearance}
          grid={editorGridSignal.value}
          backgroundGrid={editorBackgroundGridSignal.value}
          selectedTool={editorSelectedToolSignal.value}
          activeLayer={editorActiveLayerSignal.value}
          selectedBackgroundMaterial={editorSelectedBackgroundMaterialSignal.value}
          armedBlueprintId={editorArmedBlueprintIdSignal.value}
          centerRequestId={editorCenterRequestIdSignal.value}
          lastPlacementSnapshot={editorLastPlacementSnapshotSignal.value}
        />
      </div>
    </div>
  );
};
