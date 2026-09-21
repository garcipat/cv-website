import { screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The editor's single page object — one file, one exported root object with all
 * nested regions defined here (contracts/test-locators.md). Tests reach the
 * editor's DOM only through this object and the stable `editor-*`
 * `data-testid`s it wraps. It contains no assertions and never captures nodes at
 * module load; every getter re-queries.
 */

const toolbar = {
  get root() {
    return screen.getByTestId('editor-toolbar');
  },
  get layerForeground() {
    return screen.getByTestId('editor-layer-foreground');
  },
  get layerBackground() {
    return screen.getByTestId('editor-layer-background');
  },
  get canvasLevel() {
    return screen.getByTestId('editor-canvas-level');
  },
  get canvasBlueprint() {
    return screen.getByTestId('editor-canvas-blueprint');
  },
  get appearanceToggle() {
    return screen.getByTestId('editor-appearance-toggle');
  },
  get queryAppearanceToggle() {
    return screen.queryByTestId('editor-appearance-toggle');
  },
  get undo() {
    return screen.getByTestId('editor-toolbar-undo');
  },
  findUndo() {
    return screen.findByTestId('editor-toolbar-undo');
  },
  get queryUndo() {
    return screen.queryByTestId('editor-toolbar-undo');
  },
  get save() {
    return screen.getByTestId('editor-toolbar-save');
  },
  findSave() {
    return screen.findByTestId('editor-toolbar-save');
  },
  get querySave() {
    return screen.queryByTestId('editor-toolbar-save');
  },
  get export() {
    return screen.getByTestId('editor-toolbar-export');
  },
  get queryExport() {
    return screen.queryByTestId('editor-toolbar-export');
  },
  get try() {
    return screen.getByTestId('editor-toolbar-try');
  },
  get queryTry() {
    return screen.queryByTestId('editor-toolbar-try');
  },
  get saveStatus() {
    return screen.getByTestId('editor-save-status');
  },
  findSaveStatus() {
    return screen.findByTestId('editor-save-status');
  },
  get querySaveStatus() {
    return screen.queryByTestId('editor-save-status');
  },
};

const palette = {
  get root() {
    return screen.getByTestId('editor-palette');
  },
  group(slug: string) {
    return screen.getByTestId(`editor-palette-group-${slug}`);
  },
  queryGroup(slug: string) {
    return screen.queryByTestId(`editor-palette-group-${slug}`);
  },
  tile(char: string) {
    return screen.getByTestId(`editor-palette-tile-${char}`);
  },
  findTile(char: string) {
    return screen.findByTestId(`editor-palette-tile-${char}`);
  },
  queryTile(char: string) {
    return screen.queryByTestId(`editor-palette-tile-${char}`);
  },
  backgroundTile(material: string) {
    return screen.getByTestId(`editor-palette-tile-${material}`);
  },
  findBackgroundTile(material: string) {
    return screen.findByTestId(`editor-palette-tile-${material}`);
  },
  queryBackgroundTile(material: string) {
    return screen.queryByTestId(`editor-palette-tile-${material}`);
  },
  blueprintTile(id: string) {
    return screen.getByTestId(`editor-palette-tile-blueprint-${id}`);
  },
  queryBlueprintTile(id: string) {
    return screen.queryByTestId(`editor-palette-tile-blueprint-${id}`);
  },
};

const saveDialog = {
  get root() {
    return screen.getByTestId('editor-save-dialog');
  },
  get queryRoot() {
    return screen.queryByTestId('editor-save-dialog');
  },
  findRoot() {
    return screen.findByTestId('editor-save-dialog');
  },
  get nameInput() {
    return screen.getByTestId('editor-save-dialog-name');
  },
  get confirm() {
    return screen.getByTestId('editor-save-dialog-confirm');
  },
  get cancel() {
    return screen.getByTestId('editor-save-dialog-cancel');
  },
  get result() {
    return screen.getByTestId('editor-save-dialog-result');
  },
  findResult() {
    return screen.findByTestId('editor-save-dialog-result');
  },
  get queryResult() {
    return screen.queryByTestId('editor-save-dialog-result');
  },
};

const entrySelect = {
  get trigger() {
    return screen.getByTestId('editor-entry-select');
  },
  option(id: string) {
    return screen.getByTestId(`editor-entry-select-option-${id}`);
  },
  findOption(id: string) {
    return screen.findByTestId(`editor-entry-select-option-${id}`);
  },
  queryOption(id: string) {
    return screen.queryByTestId(`editor-entry-select-option-${id}`);
  },
  get options() {
    return screen.getAllByTestId(/^editor-entry-select-option-/);
  },
  get discardDialog() {
    return screen.getByTestId('editor-entry-discard-dialog');
  },
  findDiscardDialog() {
    return screen.findByTestId('editor-entry-discard-dialog');
  },
  get queryDiscardDialog() {
    return screen.queryByTestId('editor-entry-discard-dialog');
  },
  get discardConfirm() {
    return screen.getByTestId('editor-entry-discard-confirm');
  },
  findDiscardConfirm() {
    return screen.findByTestId('editor-entry-discard-confirm');
  },
  get discardCancel() {
    return screen.getByTestId('editor-entry-discard-cancel');
  },
  findDiscardCancel() {
    return screen.findByTestId('editor-entry-discard-cancel');
  },
};

const exportDialog = {
  get root() {
    return screen.getByTestId('editor-export-dialog');
  },
  get queryRoot() {
    return screen.queryByTestId('editor-export-dialog');
  },
  get output() {
    return screen.getByTestId('editor-export-output');
  },
  findOutput() {
    return screen.findByTestId('editor-export-output');
  },
  get copy() {
    return screen.getByTestId('editor-export-copy');
  },
};

export const levelEditorPage = {
  toolbar,
  palette,
  saveDialog,
  entrySelect,
  exportDialog,

  get root() {
    return screen.getByTestId('editor-page');
  },
  get canvas() {
    return screen.getByTestId('editor-canvas') as HTMLCanvasElement;
  },
  get canvasPane() {
    return screen.getByTestId('editor-canvas-pane');
  },
  get sidebar() {
    return screen.getByTestId('editor-sidebar');
  },
  get zoomValue() {
    return screen.getByTestId('editor-canvas-zoom-value').textContent;
  },

  /** The editor-owned appearance attribute the palette is selected through
   *  (`<html data-editor-appearance="…">`) — `undefined` once unmounted. */
  get editorAppearanceAttribute() {
    return document.documentElement.dataset.editorAppearance;
  },

  // Interaction helpers — no assertions, just user actions.
  async selectTool(char: string) {
    await userEvent.click(palette.tile(char));
  },
  async selectBackgroundMaterial(material: string) {
    await userEvent.click(palette.backgroundTile(material));
  },
  async setLayer(layer: 'foreground' | 'background') {
    const target = layer === 'foreground' ? toolbar.layerForeground : toolbar.layerBackground;
    fireEvent.click(target);
  },
  async setCanvas(mode: 'level' | 'blueprint') {
    const target = mode === 'level' ? toolbar.canvasLevel : toolbar.canvasBlueprint;
    fireEvent.click(target);
  },
  async undo() {
    await userEvent.click(toolbar.undo);
  },
  async openSave() {
    await userEvent.click(toolbar.save);
  },
  async openExport() {
    await userEvent.click(toolbar.export);
  },
  async chooseEntry(id: string) {
    fireEvent.click(entrySelect.trigger);
    await userEvent.click(await screen.findByTestId(`editor-entry-select-option-${id}`));
  },
  async toggleAppearance() {
    await userEvent.click(toolbar.appearanceToggle);
  },
  /** Sets the active canvas's zoom via the slider's keyboard interaction.
   *  The base-ui Slider (this repo's shadcn style) puts the actual
   *  keyboard-interactive element on a hidden native `<input type="range">`
   *  inside the thumb, not on the outer `editor-canvas-zoom` testid
   *  container (that's the Root, which has no tabIndex of its own) — see
   *  this file's own "editor zoom (O-019)" describe block and
   *  EditorCanvas.test.tsx's matching slider tests, both of which target
   *  that inner input the same way. `ZOOM_LEVELS` (EditorZoom.ts) is
   *  ascending — [25, 50, 75, 100] as percent — so index 0 is the slider's
   *  minimum (25%) and index 3 its maximum (100%). "Home" always lands on
   *  index 0 first, so stepping up with ArrowUp by the target's index is
   *  deterministic regardless of the slider's current position.
   */
  setZoomViaSlider(percent: 25 | 50 | 75 | 100) {
    const slider = screen.getByTestId('editor-canvas-zoom');
    const input = slider.querySelector('input') as HTMLInputElement;
    const levels = [25, 50, 75, 100] as const;
    const targetIndex = levels.indexOf(percent);
    act(() => {
      input.focus();
    });
    fireEvent.keyDown(input, { key: 'Home' });
    for (let i = 0; i < targetIndex; i++) {
      fireEvent.keyDown(input, { key: 'ArrowUp' });
    }
  },
  scrollZoomIn(clientX = 0, clientY = 0) {
    fireEvent.wheel(levelEditorPage.canvas, { deltaY: -100, clientX, clientY });
  },
  scrollZoomOut(clientX = 0, clientY = 0) {
    fireEvent.wheel(levelEditorPage.canvas, { deltaY: 100, clientX, clientY });
  },
};
