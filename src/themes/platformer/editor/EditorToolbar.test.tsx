import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LevelEditorPage } from './LevelEditorPage';
import { levelEditorPage } from './LevelEditorPage.page';
import { LEVEL_1_LAYOUT } from '../level/level';
import { importLayout } from './importLayout';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import {
  editorArmedBlueprintIdSignal,
  editorBackgroundSignal,
  editorBlueprintBackgroundSignal,
  editorBlueprintSignal,
  editorCanvasModeSignal,
  editorDirtySignal,
  editorLevelSignal,
  editorLoadedBlueprintNameSignal,
  editorLoadedLevelNameSignal,
  editorSelectedBackgroundPieceSignal,
  editorSelectedToolSignal,
} from './editorState';
import { isDevEnvironmentSignal } from './devEnvironment';

vi.mock('../engine/SpriteLoader', () => ({
  loadImage: vi.fn((src: string) => Promise.resolve({ src } as unknown as HTMLImageElement)),
}));

vi.mock('../engine/Renderer', () => ({
  drawTerrain: vi.fn(),
  drawPlayer: vi.fn(),
  drawCollectibles: vi.fn(),
  drawEnemies: vi.fn(),
  drawBlocks: vi.fn(),
  drawChests: vi.fn(),
  drawCheckpoints: vi.fn(),
  drawSigns: vi.fn(),
  drawHazards: vi.fn(),
  drawBackgroundTiles: vi.fn(),
  drawDeployableLadders: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  editorLevelSignal.value = importLayout(LEVEL_1_LAYOUT);
  editorSelectedToolSignal.value = 'G';
  editorLoadedLevelNameSignal.value = 'main';
  editorDirtySignal.value = false;
  editorBackgroundSignal.value = [];
  editorCanvasModeSignal.value = 'level';
  editorBlueprintSignal.value = importLayout(BLANK_BLUEPRINT.layout);
  editorBlueprintBackgroundSignal.value = [];
  editorLoadedBlueprintNameSignal.value = BLANK_BLUEPRINT.name;
  editorArmedBlueprintIdSignal.value = null;
  editorSelectedBackgroundPieceSignal.value = null;
  isDevEnvironmentSignal.value = true;
});

afterEach(() => {
  isDevEnvironmentSignal.value = false;
});

describe('EditorToolbar — layout and controls', () => {
  it('levelMode-rendersEveryCommandAndToggleInTheHeader', () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.root).toBeInTheDocument();
    expect(levelEditorPage.toolbar.layerForeground).toBeInTheDocument();
    expect(levelEditorPage.toolbar.layerBackground).toBeInTheDocument();
    expect(levelEditorPage.toolbar.canvasLevel).toBeInTheDocument();
    expect(levelEditorPage.toolbar.canvasBlueprint).toBeInTheDocument();
    expect(levelEditorPage.toolbar.export).toBeInTheDocument();
    expect(levelEditorPage.toolbar.try).toBeInTheDocument();
    expect(levelEditorPage.toolbar.save).toBeInTheDocument();
    expect(levelEditorPage.entrySelect.trigger).toBeInTheDocument();
  });

  it('theSidebarIsTilesOnlyWithNoCommands', () => {
    render(<LevelEditorPage />);

    const sidebar = levelEditorPage.sidebar;
    expect(within(sidebar).getByTestId('editor-palette')).toBeInTheDocument();
    expect(within(sidebar).queryByTestId('editor-toolbar-save')).not.toBeInTheDocument();
    expect(within(sidebar).queryByTestId('editor-toolbar-export')).not.toBeInTheDocument();
    expect(within(sidebar).queryByTestId('editor-toolbar-try')).not.toBeInTheDocument();
    expect(within(sidebar).queryByTestId('editor-layer-foreground')).not.toBeInTheDocument();
    expect(within(sidebar).queryByTestId('editor-canvas-level')).not.toBeInTheDocument();
    expect(within(sidebar).queryByTestId('editor-entry-select')).not.toBeInTheDocument();
  });

  it('everyOldSidebarCommandIsReachableFromTheToolbar', () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.layerForeground).toBeInTheDocument();
    expect(levelEditorPage.toolbar.layerBackground).toBeInTheDocument();
    expect(levelEditorPage.toolbar.canvasLevel).toBeInTheDocument();
    expect(levelEditorPage.toolbar.canvasBlueprint).toBeInTheDocument();
    expect(levelEditorPage.toolbar.export).toBeInTheDocument();
    expect(levelEditorPage.toolbar.try).toBeInTheDocument();
    expect(levelEditorPage.toolbar.save).toBeInTheDocument();
    expect(levelEditorPage.entrySelect.trigger).toBeInTheDocument();
  });

  it('toolbar-wrapsRatherThanScrollingHorizontally', () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.root.className).toContain('flex-wrap');
    expect(levelEditorPage.toolbar.root.className).not.toContain('overflow-x');
  });
});

describe('EditorToolbar — per-canvas adaptation', () => {
  it('blueprintMode-omitsExportTryAndUndo', () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.toolbar.queryExport).not.toBeInTheDocument();
    expect(levelEditorPage.toolbar.queryTry).not.toBeInTheDocument();
    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });

  it('levelMode-omitsUndoUntilAPlacementExists', () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });

  it('blueprintMode-saveOpensTheBlueprintDialog', async () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);
    await userEvent.click(levelEditorPage.toolbar.save);

    expect(await screen.findByText('Save this blueprint')).toBeInTheDocument();
  });

  it('noDevServer-omitsSaveButKeepsExportAndTry', () => {
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.querySave).not.toBeInTheDocument();
    expect(levelEditorPage.toolbar.export).toBeInTheDocument();
    expect(levelEditorPage.toolbar.try).toBeInTheDocument();
  });

  it('noDevServer-blueprintMode-omitsSaveButKeepsTheSelector', () => {
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.toolbar.querySave).not.toBeInTheDocument();
    expect(levelEditorPage.entrySelect.trigger).toBeInTheDocument();
  });
});

describe('EditorToolbar — tooltips', () => {
  it('hoveringAControl-showsItsNameAsATooltip', async () => {
    render(<LevelEditorPage />);

    await userEvent.hover(levelEditorPage.toolbar.layerForeground);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Foreground');
    await userEvent.unhover(levelEditorPage.toolbar.layerForeground);

    await userEvent.hover(levelEditorPage.toolbar.export);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Export');
    await userEvent.unhover(levelEditorPage.toolbar.export);
  });

  it('keyboardFocusingAControl-showsItsNameAsATooltip', async () => {
    render(<LevelEditorPage />);

    levelEditorPage.toolbar.canvasBlueprint.focus();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Blueprint');
  });

  it('blueprintMode-theSaveTooltipNamesTheBlueprintSave', async () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);
    await userEvent.hover(levelEditorPage.toolbar.save);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Save Blueprint');
  });

  it('theEntrySelectorTooltipNamesTheSelector', async () => {
    render(<LevelEditorPage />);

    await userEvent.hover(levelEditorPage.entrySelect.trigger);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Levels');
  });
});
