import { useEffect, useState, type ReactElement } from 'react';
import {
  ImageIcon,
  LayoutGridIcon,
  MapIcon,
  MoonIcon,
  MountainIcon,
  PlayIcon,
  SaveIcon,
  ShareIcon,
  SunIcon,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react';
import { LevelSelect } from './LevelSelect';
import { BlueprintSelect } from './BlueprintSelect';
import { EditorSaveDialog, type EditorSaveDialogConfig } from './EditorSaveDialog';
import { cropLevelForExport } from './cropLevelForExport';
import { isDevEnvironmentSignal, probeDevEnvironment } from './devEnvironment';
import { LEVELS_FOLDER, levelFileJson } from './saveLevelFile';
import { BLUEPRINTS_FOLDER } from './saveBlueprintFile';
import {
  loadBlueprint,
  loadLevel,
  reconcilePersistedEditorState,
  saveCurrentBlueprint,
  saveCurrentLevel,
  setActiveLayer,
  setCanvasMode,
  toggleEditorAppearance,
  tryLayout,
  undoLastPlacement,
} from './editorActions';
import { editorSaveResultSignal } from './editorState';
import type {
  EditorAppearance,
  EditorLayer,
  PlacementSnapshot,
  SaveResultState,
} from './editorState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { MarkerGrid } from '../level/LevelData';
import type { BackgroundChar, TileChar } from '../level/LevelParser';

const LEVEL_SAVE_CONFIG: EditorSaveDialogConfig = {
  title: 'Save this level',
  description: (
    <>
      Writes the level as a JSON file into <code>{LEVELS_FOLDER}</code>, where the level list reads
      it from. Reload the editor afterwards to see it there.
    </>
  ),
  nameLabel: 'Level name',
  saveLabel: 'Save level file',
  fallbackHint: (
    <>
      Move it into <code>{LEVELS_FOLDER}</code> yourself.
    </>
  ),
};

const BLUEPRINT_SAVE_CONFIG: EditorSaveDialogConfig = {
  title: 'Save this blueprint',
  description: (
    <>
      Writes the blueprint as a JSON file into <code>{BLUEPRINTS_FOLDER}</code>, where the blueprint
      list reads it from. Reload the editor afterwards to see it there.
    </>
  ),
  nameLabel: 'Blueprint name',
  saveLabel: 'Save blueprint',
  fallbackHint: (
    <>
      Move it into <code>{BLUEPRINTS_FOLDER}</code> yourself.
    </>
  ),
};

/**
 * Tile-styled toolbar control classes — the toolbar's compact echo of
 * `PaletteTile` (bordered, muted box; blue ring when active), so the toolbar
 * and the palette read as the same visual language. Applied to the Base UI
 * `Button` used as the trigger so its `render` props/ref are preserved.
 */
const toolbarIconClass = (active = false) =>
  cn(
    'size-8 shrink-0 rounded border-2 border-border bg-muted text-muted-foreground hover:bg-muted hover:text-foreground',
    active && 'border-blue-400 text-foreground ring-2 ring-blue-400',
  );

interface ToggleOption {
  testId: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}

/**
 * A visible two-option toggle: both choices shown side by side inside one
 * bordered, muted panel, with the active one ringed in blue. This is the
 * toolbar's replacement for the old pair of unlabeled ghost icon buttons — the
 * group framing and the persistent highlight are what make it read as a toggle
 * rather than two unrelated buttons.
 */
const ToolbarToggleGroup = ({ options }: { options: ToggleOption[] }) => (
  <div className="inline-flex items-center gap-0.5 rounded-xl border bg-muted/40 p-0.5">
    {options.map(({ testId, label, icon: Icon, active, onClick }) => (
      <Tooltip key={testId}>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-testid={testId}
              aria-pressed={active}
              onClick={onClick}
              className={toolbarIconClass(active)}
            >
              <Icon className="size-4" />
            </Button>
          }
        />
        <TooltipContent role="tooltip">{label}</TooltipContent>
      </Tooltip>
    ))}
  </div>
);

/** An icon command with a tooltip, wrapping the trigger element it is given
 *  (a plain button, or a `DialogTrigger` for Export). The element must be a
 *  Base UI primitive so the tooltip's props/ref reach the DOM node. */
const IconAction = ({ label, render }: { label: string; render: ReactElement }) => (
  <Tooltip>
    <TooltipTrigger render={render} />
    <TooltipContent role="tooltip">{label}</TooltipContent>
  </Tooltip>
);

/** A thin vertical rule separating toolbar groups (toggles | actions | selector). */
const ToolbarDivider = () => <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-border" />;

export interface EditorToolbarProps {
  activeLayer: EditorLayer;
  isBlueprintMode: boolean;
  appearance: EditorAppearance;
  lastPlacementSnapshot: PlacementSnapshot | null;
  loadedLevelName: string;
  isDirty: boolean;
  loadedBlueprintName: string;
  blueprintDirty: boolean;
  saveResult: SaveResultState | null;
  levelGrid: TileChar[][];
  /** The level canvas's own tile meta layer — folded into the Export
   *  dialog's complete JSON (`levelFileJson`), markers included. */
  markerGrid: MarkerGrid;
  /** The level canvas's own background grid — cropped to the same origin as
   *  the foreground and the markers for the Export dialog's complete JSON. */
  backgroundGrid: BackgroundChar[][];
}

/**
 * The editor's header toolbar (FR-001–FR-006): every command and toggle as a
 * compact control, right-aligned and wrapping rather than scrolling, laid out
 * on a bordered panel like the Palette. The layer and canvas pairs are visible
 * segmented toggles; Undo/Save/Export/Try sit in their own group; the entry
 * selector sits at the far right. Phase B hosts the Export dialog, the shared
 * Save dialog and the mount-time dev-environment probe here.
 */
export const EditorToolbar = ({
  activeLayer,
  isBlueprintMode,
  appearance,
  lastPlacementSnapshot,
  loadedLevelName,
  isDirty,
  loadedBlueprintName,
  blueprintDirty,
  saveResult,
  levelGrid,
  markerGrid,
  backgroundGrid,
}: EditorToolbarProps) => {
  const [isDevEnvironment, setIsDevEnvironment] = useState(isDevEnvironmentSignal.value);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    void probeDevEnvironment();
    return isDevEnvironmentSignal.subscribe(setIsDevEnvironment);
  }, []);

  useEffect(() => {
    reconcilePersistedEditorState();
  }, []);

  // All three layers share the same crop origin/bounds (cropLevelForExport,
  // the same alignment `saveCurrentLevel`/`tryLayout` rely on). The Export
  // textarea shows the complete level JSON via the same `levelFileJson` a
  // save writes (FR-033/FR-034), so the two can never drift apart.
  const cropped = cropLevelForExport(levelGrid, backgroundGrid, markerGrid);
  const exportedText = levelFileJson(
    loadedLevelName,
    cropped.layout,
    cropped.background,
    cropped.markers,
  );

  const openSaveDialog = () => {
    editorSaveResultSignal.value = null;
    setSaveDialogOpen(true);
  };

  const handleSave = async (name: string) => {
    if (isBlueprintMode) {
      await saveCurrentBlueprint(name);
    } else {
      await saveCurrentLevel(name);
    }
    if (editorSaveResultSignal.value?.result.written === true) setSaveDialogOpen(false);
  };

  const activeSaveResult =
    saveResult !== null && saveResult.target === (isBlueprintMode ? 'blueprint' : 'level')
      ? saveResult.result
      : null;

  const saveLabel = isBlueprintMode ? 'Save Blueprint' : 'Save';

  const showUndo = !isBlueprintMode && lastPlacementSnapshot !== null;
  const showExport = !isBlueprintMode;
  const showTry = !isBlueprintMode;
  const hasActions = showUndo || isDevEnvironment || showExport || showTry;

  return (
    <TooltipProvider delay={0}>
      <div
        data-testid="editor-toolbar"
        className="flex flex-wrap items-center justify-end gap-1 rounded-xl border bg-card p-1.5 shadow-sm"
      >
        <ToolbarToggleGroup
          options={[
            {
              testId: 'editor-layer-foreground',
              label: 'Foreground',
              icon: MountainIcon,
              active: activeLayer === 'foreground',
              onClick: () => setActiveLayer('foreground'),
            },
            {
              testId: 'editor-layer-background',
              label: 'Background',
              icon: ImageIcon,
              active: activeLayer === 'background',
              onClick: () => setActiveLayer('background'),
            },
          ]}
        />
        <ToolbarDivider />
        <ToolbarToggleGroup
          options={[
            {
              testId: 'editor-canvas-level',
              label: 'Level',
              icon: MapIcon,
              active: !isBlueprintMode,
              onClick: () => setCanvasMode('level'),
            },
            {
              testId: 'editor-canvas-blueprint',
              label: 'Blueprint',
              icon: LayoutGridIcon,
              active: isBlueprintMode,
              onClick: () => setCanvasMode('blueprint'),
            },
          ]}
        />
        <div className="inline-flex items-center gap-0.5 rounded-xl border bg-muted/40 p-0.5">
          <IconAction
            label={appearance === 'dark' ? 'Dark mode: on' : 'Dark mode: off'}
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-testid="editor-appearance-toggle"
                aria-pressed={appearance === 'dark'}
                onClick={toggleEditorAppearance}
                className={toolbarIconClass(appearance === 'dark')}
              >
                {appearance === 'dark' ? (
                  <SunIcon className="size-4" />
                ) : (
                  <MoonIcon className="size-4" />
                )}
              </Button>
            }
          />
        </div>
        {hasActions && <ToolbarDivider />}
        {hasActions && (
          <div className="inline-flex items-center gap-0.5 rounded-xl border bg-muted/40 p-0.5">
            {showUndo && (
              <IconAction
                label="Undo placement"
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-testid="editor-toolbar-undo"
                    onClick={undoLastPlacement}
                    className={toolbarIconClass()}
                  >
                    <Undo2Icon className="size-4" />
                  </Button>
                }
              />
            )}
            {isDevEnvironment && (
              <IconAction
                label={saveLabel}
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-testid="editor-toolbar-save"
                    onClick={openSaveDialog}
                    className={toolbarIconClass()}
                  >
                    <SaveIcon className="size-4" />
                  </Button>
                }
              />
            )}
            {showExport && (
              <Dialog>
                <IconAction
                  label="Export"
                  render={
                    <DialogTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          data-testid="editor-toolbar-export"
                          className={toolbarIconClass()}
                        >
                          <ShareIcon className="size-4" />
                        </Button>
                      }
                    />
                  }
                />
                <DialogContent data-testid="editor-export-dialog">
                  <DialogHeader>
                    <DialogTitle>Export Layout</DialogTitle>
                  </DialogHeader>
                  <textarea
                    readOnly
                    data-testid="editor-export-output"
                    value={exportedText}
                    className="h-64 w-full resize-none font-mono text-xs"
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      data-testid="editor-export-copy"
                      onClick={() => {
                        navigator.clipboard.writeText(exportedText).catch(() => {});
                      }}
                    >
                      Copy Layout
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {showTry && (
              <IconAction
                label="Try"
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-testid="editor-toolbar-try"
                    onClick={tryLayout}
                    className={toolbarIconClass()}
                  >
                    <PlayIcon className="size-4" />
                  </Button>
                }
              />
            )}
          </div>
        )}
        <ToolbarDivider />
        {isBlueprintMode ? (
          <BlueprintSelect
            loadedBlueprintName={loadedBlueprintName}
            isDirty={blueprintDirty}
            onLoadBlueprint={loadBlueprint}
          />
        ) : (
          <LevelSelect loadedLevelName={loadedLevelName} isDirty={isDirty} onLoadLevel={loadLevel} />
        )}
        {saveResult?.target === 'level' && saveResult.result.written === true && (
          <p
            data-testid="editor-save-status"
            className="max-w-40 text-xs break-all text-muted-foreground"
            role="status"
          >
            Saved to <code>{saveResult.result.path}</code> — reload to see it in the level list.
          </p>
        )}
      </div>
      <EditorSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        config={isBlueprintMode ? BLUEPRINT_SAVE_CONFIG : LEVEL_SAVE_CONFIG}
        defaultName={isBlueprintMode ? loadedBlueprintName : loadedLevelName}
        result={activeSaveResult}
        onSave={handleSave}
      />
    </TooltipProvider>
  );
};
