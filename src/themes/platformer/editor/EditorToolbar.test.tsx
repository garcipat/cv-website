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
  editorAppearanceSignal,
  editorBackgroundSignal,
  editorBlueprintBackgroundSignal,
  editorBlueprintSignal,
  editorCanvasModeSignal,
  editorDirtySignal,
  editorLevelSignal,
  editorLoadedBlueprintNameSignal,
  editorLoadedLevelNameSignal,
  editorSelectedBackgroundMaterialSignal,
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
  drawDarkness: vi.fn(),
  drawEnemyEyes: vi.fn(),
  drawHeldTorch: vi.fn(),
  heldTorchLightPosition: vi.fn(() => ({ x: 0, y: 0 })),
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
  editorSelectedBackgroundMaterialSignal.value = null;
  editorAppearanceSignal.value = 'light';
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

describe('EditorToolbar — export dialog background section', () => {
  it('exportOutput-includesALabelledBackgroundSectionAlongsideTheForegroundLayout', async () => {
    editorLevelSignal.value = importLayout(['G#']);
    editorBackgroundSignal.value = [['d', 'c']];
    render(<LevelEditorPage />);

    await userEvent.click(levelEditorPage.toolbar.export);
    const textarea = (await levelEditorPage.exportDialog.findOutput()) as HTMLTextAreaElement;

    // One textarea, two paste-ready blocks: the foreground layout first,
    // then a comment marking where LEVEL_1_BACKGROUND's own rows start —
    // cropped to the SAME origin/bounds as the foreground layout above it.
    expect(textarea.value).toBe("  'G#',\n// LEVEL_1_BACKGROUND\n  'dc',");
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

describe('EditorToolbar — appearance toggle (O-015 US1)', () => {
  it('toolbar-whenLevelCanvas-showsTheAppearanceToggle', () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.appearanceToggle).toBeInTheDocument();
  });

  it('toolbar-whenBlueprintCanvas-showsTheAppearanceToggle', () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.toolbar.appearanceToggle).toBeInTheDocument();
  });

  it('appearanceToggle-whenLight-hasAriaPressedFalseAndNamesDarkModeOff', async () => {
    editorAppearanceSignal.value = 'light';
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.appearanceToggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.hover(levelEditorPage.toolbar.appearanceToggle);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Dark mode: off');
  });

  it('appearanceToggle-whenDark-hasAriaPressedTrueAndNamesDarkModeOn', async () => {
    editorAppearanceSignal.value = 'dark';
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.appearanceToggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.hover(levelEditorPage.toolbar.appearanceToggle);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Dark mode: on');
  });

  it('appearanceToggle-whenKeyboardFocused-revealsTheTooltipWithItsState', async () => {
    editorAppearanceSignal.value = 'light';
    render(<LevelEditorPage />);

    levelEditorPage.toolbar.appearanceToggle.focus();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Dark mode: off');
  });

  it('appearanceToggle-click-togglesTheSignalAndPersists', async () => {
    editorAppearanceSignal.value = 'light';
    render(<LevelEditorPage />);

    await userEvent.click(levelEditorPage.toolbar.appearanceToggle);

    expect(editorAppearanceSignal.value).toBe('dark');
    expect(JSON.parse(localStorage.getItem('platformer-editor-appearance')!)).toBe('dark');
  });
});
