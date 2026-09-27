import { describe, it, expect } from 'vitest';
import { padChestDefs, previewPlacements, previewPlayerState } from './previewPlacements';
import { gridToLayout } from './gridLayout';
import { importLayout, importMarkerGrid } from './importLayout';
import { LEVEL_1_LAYOUT, LEVEL_1_MARKERS } from '../../level/level';
import { RENDERED_TILE_SIZE, tileToPixel } from '../../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../../entities/Player';
import type { TileChar } from '../../level/LevelParser';
import type { MarkerGrid } from '../../level/LevelData';
import { DEFAULT_HINT_ID } from '../../level/HintCatalog';
import { computePotRenderPlan } from '../../entities/blocks/potRenderPlan';
import { PALETTE_TOOLS } from './paletteTiles';
import cvEn from '@/data/cv.en.json';
import type { CVData } from '@/types/cv';

// The runtime finder + mapper chain, used to prove the preview is built from
// the shared implementation rather than an editor-local synthesizer.
import {
  findCheckpointTiles,
  findChestTiles,
  findCoinTiles,
  findHazardTiles,
  findSignTiles,
} from '../../level/LevelParser';
import { placeCollectibles } from '../../level/CollectibleMapper';
import { mapCVDataToChests, placeChests } from '../../level/ChestMapper';
import { placeCheckpoints } from '../../level/CheckpointMapper';
import { placeSigns } from '../../level/SignMapper';
import { placeHazards } from '../../level/HazardMapper';
import { toCheckpointState } from '../../entities/Checkpoint';
import { toChestState } from '../../entities/chests';

const CV = cvEn as CVData;
const NO_MARKERS: MarkerGrid = [];

describe('previewPlayerState', () => {
  it('noSpawnMarker-returnsNull', () => {
    expect(previewPlayerState(['..', '..'])).toBeNull();
  });

  it('aSpawn-matchesTheRealGamesSpawnFormulaExactly', () => {
    const player = previewPlayerState(['.S']);
    expect(player).not.toBeNull();
    const spawnTileX = 1 * RENDERED_TILE_SIZE;
    const spawnTileY = 0;
    const expectedX = spawnTileX - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
    const expectedY = spawnTileY + RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    expect(player?.x).toBe(expectedX);
    expect(player?.y).toBe(expectedY);
    expect(player?.lastGroundedX).toBe(expectedX);
    expect(player?.lastGroundedY).toBe(expectedY);
    expect(player?.prevFeetY).toBe(expectedY + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING);
    expect(player?.direction).toBe('right');
    expect(player?.animState).toBe('idle');
    expect(player?.animFrame).toBe(0);
  });
});

describe('previewPlacements', () => {
  const grid: TileChar[][] = [
    ['.', 'o', 'M', 'm', 'q', '=', '?', 'F', 'u', 'p', 'b', '$', 'C', 'T', '^', '@'],
    ['S', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G'],
  ];
  const markers: MarkerGrid = [
    [...new Array(13).fill(null), { kind: 'sign', hintId: 'bomb' }, null, null],
    new Array(16).fill(null),
  ];

  it('aGridWithOneOfEachMarker-kindAndPositionMatchTheMarkerCells', () => {
    const scene = previewPlacements(grid, markers, CV);

    expect(scene.coins).toHaveLength(1);
    expect(scene.coins[0]).toMatchObject({ kind: 'coin', collected: false, ...tileToPixel(1, 0) });

    expect(scene.enemies.map((e) => e.type).sort()).toEqual(['bee', 'slimeGreen', 'slimePurple']);
    expect(scene.enemies.every((e) => e.animState !== undefined)).toBe(true);

    expect(scene.blocks.map((b) => b.blockKind).sort()).toEqual(
      ['bombPot', 'coinPot', 'crate', 'fragileRock', 'potionPot', 'questionMark'].sort(),
    );
    expect(scene.blocks.every((b) => b.hitsTaken === 0)).toBe(true);

    expect(scene.chests).toHaveLength(1);
    expect(scene.chests[0]).toMatchObject({ kind: 'chest', state: 'closed', ...tileToPixel(11, 0) });

    expect(scene.checkpoints).toHaveLength(1);
    expect(scene.checkpoints[0]).toMatchObject({ col: 12, row: 0, activated: false, activatedAt: null });

    expect(scene.signs).toHaveLength(1);
    expect(scene.signs[0]).toEqual({
      id: 'sign-bomb-13-0',
      hintId: 'bomb',
      ...tileToPixel(13, 0),
    });

    expect(scene.hazards).toHaveLength(1);
    expect(scene.hazards[0]).toMatchObject({ hazardType: 'spike', facing: 'up', col: 14, row: 0 });

    expect(scene.bundles).toHaveLength(1);
    expect(scene.bundles[0]).toMatchObject({ kind: 'ladder', col: 15, row: 0 });
  });

  it('everyCollection-equalsTheRuntimeFinderAndMapperChainForTheSameLayout', () => {
    const layout = gridToLayout(grid);
    const scene = previewPlacements(grid, markers, CV);

    expect(scene.coins).toEqual(placeCollectibles(findCoinTiles(layout)));
    expect(scene.checkpoints).toEqual(
      placeCheckpoints(findCheckpointTiles(layout)).map(toCheckpointState),
    );
    expect(scene.signs).toEqual(placeSigns(findSignTiles(layout, markers)));
    expect(scene.hazards).toEqual(placeHazards(findHazardTiles(layout, markers)));
    const chestMarkers = findChestTiles(layout);
    expect(scene.chests).toEqual(
      placeChests(
        padChestDefs(mapCVDataToChests(CV), chestMarkers),
        chestMarkers,
      ).map(toChestState),
    );
  });

  it('aTWithASignMarker-returnsItsHintIdAndPixelPosition', () => {
    const signMarkers: MarkerGrid = [
      [null, null],
      [null, { kind: 'sign', hintId: 'bridgeDropThrough' }],
    ];
    const scene = previewPlacements(
      [
        ['.', '.'],
        ['.', 'T'],
      ],
      signMarkers,
      CV,
    );
    const { x, y } = tileToPixel(1, 1);
    expect(scene.signs).toEqual([
      { id: 'sign-bridgeDropThrough-1-1', hintId: 'bridgeDropThrough', x, y },
    ]);
  });

  it('aTWithNoSignMarker-fallsBackToTheDefaultHint', () => {
    const scene = previewPlacements([['T']], NO_MARKERS, CV);
    expect(scene.signs).toEqual([{ id: `sign-${DEFAULT_HINT_ID}-0-0`, hintId: DEFAULT_HINT_ID, x: 0, y: 0 }]);
  });

  it('noSignCharacters-returnsEmptyArray', () => {
    expect(previewPlacements([['G', 'G']], NO_MARKERS, CV).signs).toEqual([]);
  });

  it('noCheckpointMarkers-returnsEmptyArray', () => {
    expect(previewPlacements([['G', 'G']], NO_MARKERS, CV).checkpoints).toEqual([]);
  });

  it('multipleCheckpointMarkers-returnsOnePerCellInReadingOrder', () => {
    const scene = previewPlacements(
      [
        ['C', '.'],
        ['.', 'C'],
      ],
      NO_MARKERS,
      CV,
    );
    expect(scene.checkpoints.map((c) => ({ col: c.col, row: c.row }))).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 1 },
    ]);
    expect(scene.checkpoints.every((c) => !c.activated && c.activatedAt === null)).toBe(true);
  });

  it('noHazardMarkers-returnsEmptyArray', () => {
    expect(previewPlacements([['G', 'G']], NO_MARKERS, CV).hazards).toEqual([]);
  });

  it('everyFacingCharacter-mapsToItsOwnFacing', () => {
    const scene = previewPlacements([['^', 'v', '<', '>']], NO_MARKERS, CV);
    expect(scene.hazards.map((h) => h.facing)).toEqual(['up', 'down', 'left', 'right']);
    expect(scene.hazards.every((h) => h.hazardType === 'spike')).toBe(true);
  });

  it('everyHazardPlacement-carriesItsGridColAndRow', () => {
    const scene = previewPlacements(
      [
        ['^', '.'],
        ['.', 'A'],
      ],
      NO_MARKERS,
      CV,
    );
    expect(scene.hazards.map((h) => ({ col: h.col, row: h.row }))).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 1 },
    ]);
  });

  it('aFallingStalactiteMarker-emitsItsColAndRow', () => {
    const scene = previewPlacements([['.', '⊤']], [[null, { kind: 'fallingStalactite' }]], CV);
    const { x, y } = tileToPixel(1, 0);
    expect(scene.hazards).toEqual([
      {
        id: 'hazard-fallingStalactite-1-0',
        hazardType: 'fallingStalactite',
        facing: 'down',
        x,
        y,
        col: 1,
        row: 0,
      },
    ]);
  });

  it('aRopeLadderBundle-previewsOneRolledStateAtItsCell', () => {
    const scene = previewPlacements([['@', 'G']], NO_MARKERS, CV);
    expect(scene.bundles).toHaveLength(1);
    expect(scene.bundles[0].phase).toBe('rolled');
  });

  it('aBombPotMarker-synthesizesABombPotBlockState', () => {
    const scene = previewPlacements([['b']], NO_MARKERS, CV);
    expect(scene.blocks).toHaveLength(1);
    expect(scene.blocks[0].blockKind).toBe('bombPot');
    expect(scene.blocks[0].hitsTaken).toBe(0);
  });

  it('aBombPotBesideAnotherPot-mergesThroughTheSharedRenderPlanWithASeamFiller', () => {
    const scene = previewPlacements([['b', 'u']], NO_MARKERS, CV);
    const bombBlock = scene.blocks.find((b) => b.blockKind === 'bombPot')!;
    const plan = computePotRenderPlan(scene.blocks);
    const run = plan.runsByOwnerId.get(bombBlock.id)!;
    expect(run.blocks.map((m) => m.kind.drop)).toEqual(['bomb', 'coin']);
    expect(run.fillers).toHaveLength(1);
    expect(run.fillers[0].x).toBe(bombBlock.x + RENDERED_TILE_SIZE / 2);
  });

  it('theEditorPalette-hasNoPlacedBombOrExplosionEntry', () => {
    const keys = Object.keys(PALETTE_TOOLS);
    expect(keys).not.toContain('bomb');
    expect(keys).not.toContain('explosion');
    const labels = Object.values(PALETTE_TOOLS).map((tool) => tool.label);
    expect(labels.some((label) => /placed bomb|explosion/i.test(label))).toBe(false);
  });
});

describe('previewPlacements — OQ-1 chest parity', () => {
  it('theShippedLevel-previewsOneChestPerDollarMarkerWhileTheRuntimeListIsUnpadded', () => {
    const grid = importLayout(LEVEL_1_LAYOUT);
    const markers = importMarkerGrid(LEVEL_1_LAYOUT, LEVEL_1_MARKERS);
    const layout = gridToLayout(grid);
    const chestMarkers = findChestTiles(layout);

    const scene = previewPlacements(grid, markers, CV);
    expect(chestMarkers.length).toBe(7);
    expect(scene.chests).toHaveLength(7);

    const runtime = placeChests(mapCVDataToChests(CV), chestMarkers);
    expect(runtime.length).toBe(CV.experience.length);
    expect(runtime.length).toBeLessThan(chestMarkers.length);

    expect(scene.player).not.toBeNull();
  });

  it('padChestDefs-fewerDefsThanMarkers-appendsPlaceholderDefsUpToTheMarkerCount', () => {
    const defs = mapCVDataToChests(CV);
    const markers = findChestTiles(gridToLayout(importLayout(LEVEL_1_LAYOUT)));
    const padded = padChestDefs(defs, markers);
    expect(defs.length).toBeLessThan(markers.length);
    expect(padded).toHaveLength(markers.length);
    expect(padded.slice(0, defs.length)).toEqual(defs);
  });

  it('padChestDefs-atLeastAsManyDefsAsMarkers-returnsTheDefsUnchanged', () => {
    const defs = mapCVDataToChests(CV);
    expect(padChestDefs(defs, [])).toEqual(defs);
  });
});
