import { describe, it, expect } from 'vitest';
import { applyTool, markerRemovedOnRepaint } from './applyTool';
import { paintMarkerCell } from './paintMarkerCell';
import { tileToPixel } from '../../level/Terrain';
import type { MarkerEntry, MarkerGrid } from '../../level/LevelData';

const emptyMarkers = (width: number, height: number): MarkerGrid =>
  Array.from({ length: height }, () => new Array<MarkerEntry | null>(width).fill(null));

describe('applyTool — pure marker tools', () => {
  it('patrolBoundary-writesTheMarkerAndNoPaint', () => {
    const markers = emptyMarkers(2, 1);
    const result = applyTool([['.', '.']], markers, 1, 0, 'patrolBoundary', false);
    expect(result.paint).toBeNull();
    expect(result.markers).toEqual([[null, { kind: 'patrolBoundary' }]]);
    expect(result.target).toEqual({ col: 1, row: 0 });
  });

  it('patrolBoundaryErase-clearsTheMarkerCell', () => {
    const markers: MarkerGrid = [[null, { kind: 'patrolBoundary' }]];
    const result = applyTool([['.', '.']], markers, 1, 0, 'patrolBoundary', true);
    expect(result.paint).toBeNull();
    expect(result.markers).toEqual([[null, null]]);
  });

  it('connectionPoint-writesTheMarkerAndNoPaint', () => {
    const markers = emptyMarkers(1, 1);
    const result = applyTool([['.']], markers, 0, 0, 'connectionPoint', false);
    expect(result.paint).toBeNull();
    expect(result.markers).toEqual([[{ kind: 'connectionPoint' }]]);
  });
});

describe('applyTool — sign / falling stalactite', () => {
  it('aSignTool-writesTheTCharacterAndADefaultHintMarker', () => {
    const markers = emptyMarkers(1, 1);
    const result = applyTool([['.']], markers, 0, 0, 'T', false);
    expect(result.paint?.grid).toEqual([['T']]);
    expect(result.markers?.[0][0]).toMatchObject({ kind: 'sign' });
  });

  it('aFallingStalactiteTool-writesTheDecorativeTileAndItsMarker', () => {
    const markers = emptyMarkers(1, 1);
    const result = applyTool([['.']], markers, 0, 0, 'fallingStalactite', false);
    expect(result.paint?.grid).toEqual([['⊤']]);
    expect(result.markers?.[0][0]).toEqual({ kind: 'fallingStalactite' });
  });

  it('anEraseWithAMarkerOnTheCell-clearsBothTerrainAndMarker', () => {
    const markers: MarkerGrid = [[{ kind: 'sign', hintId: 'bomb' }]];
    const result = applyTool([['T']], markers, 0, 0, 'T', true);
    expect(result.paint?.grid).toEqual([['.']]);
    expect(result.markers).toEqual([[null]]);
  });

  it('anEraseWithNoMarkerOnTheCell-writesNoMarker', () => {
    const result = applyTool([['T']], emptyMarkers(1, 1), 0, 0, 'T', true);
    expect(result.paint?.grid).toEqual([['.']]);
    expect(result.markers).toBeNull();
  });
});

describe('applyTool — torch', () => {
  it('aFreshTorch-laysTheTileWithoutAMarker', () => {
    const result = applyTool([['.']], emptyMarkers(1, 1), 0, 0, '¥', false);
    expect(result.paint?.grid).toEqual([['¥']]);
    expect(result.markers).toBeNull();
  });

  it('anAlreadyPlacedTorch-cyclesItsStrengthMarker', () => {
    const result = applyTool([['¥']], [[null]], 0, 0, '¥', false);
    expect(result.paint?.grid).toEqual([['¥']]);
    expect(result.markers?.[0][0]).toMatchObject({ kind: 'torch' });
  });

  it('anErase-clearsTheTorchAndItsMarker', () => {
    const markers: MarkerGrid = [[{ kind: 'torch', strength: 7 }]];
    const result = applyTool([['¥']], markers, 0, 0, '¥', true);
    expect(result.paint?.grid).toEqual([['.']]);
    expect(result.markers).toEqual([[null]]);
  });
});

describe('applyTool — default terrain tools and marker clearing', () => {
  it('repaintingATileWithASignMarker-clearsTheMarker', () => {
    const markers: MarkerGrid = [[null, { kind: 'sign', hintId: 'bomb' }]];
    const result = applyTool([['.', '.']], markers, 1, 0, 'G', false);
    expect(result.paint?.grid).toEqual([['.', 'G']]);
    expect(result.markers).toEqual([[null, null]]);
  });

  it('repaintingATileWithAPatrolBoundary-leavesTheMarker', () => {
    const markers: MarkerGrid = [[null, { kind: 'patrolBoundary' }]];
    const result = applyTool([['.', '.']], markers, 1, 0, 'G', false);
    expect(result.markers).toBeNull();
  });

  it('aNonEraserRepaint-onAConnectionPointCell-leavesTheMarker', () => {
    const markers: MarkerGrid = [[null, { kind: 'connectionPoint' }]];
    const result = applyTool([['.', '.']], markers, 1, 0, 'G', false);
    expect(result.paint?.grid).toEqual([['.', 'G']]);
    expect(result.markers).toBeNull();
  });

  it('aRightClick-cleansTheMarkerWhateverItsKind', () => {
    const markers: MarkerGrid = [[null, { kind: 'connectionPoint' }]];
    const result = applyTool([['.', 'G']], markers, 1, 0, 'G', true);
    expect(result.paint?.grid).toEqual([['.', '.']]);
    expect(result.markers).toEqual([[null, null]]);
  });

  it('anOutOfBoundsTarget-reportsThePostGrowthCell', () => {
    const result = applyTool([['G']], emptyMarkers(1, 1), -1, 0, 'R', false);
    expect(result.target).toEqual({ col: 0, row: 0 });
    expect(result.paint?.colShift).toBe(1);
  });
});

describe('markerRemovedOnRepaint', () => {
  it('tileDescribingMarkers-returnTrue', () => {
    expect(markerRemovedOnRepaint('sign')).toBe(true);
    expect(markerRemovedOnRepaint('fallingStalactite')).toBe(true);
    expect(markerRemovedOnRepaint('torch')).toBe(true);
  });

  it('overlayMarkers-returnFalse', () => {
    expect(markerRemovedOnRepaint('patrolBoundary')).toBe(false);
    expect(markerRemovedOnRepaint('connectionPoint')).toBe(false);
  });
});

describe('applyTool — parity with the direct marker write', () => {
  it('aPatrolBoundaryWrite-equalsPaintMarkerCell', () => {
    const markers = emptyMarkers(2, 1);
    const result = applyTool([['.', '.']], markers, 0, 0, 'patrolBoundary', false);
    expect(result.markers).toEqual(paintMarkerCell(markers, 0, 0, { kind: 'patrolBoundary' }));
    expect(tileToPixel(0, 0)).toEqual({ x: 0, y: 0 });
  });
});
