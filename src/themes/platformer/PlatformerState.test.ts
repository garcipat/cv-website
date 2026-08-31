import {
  playerState,
  cameraPositionX,
  cameraPositionY,
  healthState,
  lifecycleState,
  spawnPlayerState,
  spawnCenter,
  resetGame,
  resetGameProgress,
  collectedFacts,
  activeJournalSection,
  collectiblePlacements,
  enemyPlacements,
  enemyStates,
  collectedCollectibleIds,
  activeEffects,
  blockPlacements,
  chestPlacements,
  chestStates,
  endingScreenShown,
} from './PlatformerState';
import { mapCVDataToEnemies } from './level/EnemyMapper';
import { currentCV } from '@/state/locale';
import { MAX_HALF_HEARTS } from './entities/Health';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE, currentLayout, LEVEL_1_LAYOUT } from './level/level';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
} from './entities/Player';
import { toChestState, isChestOpen } from './entities/Chest';

describe('PlatformerState', () => {
  it('collectedFacts-initial-isEmpty', () => {
    expect(collectedFacts.value).toEqual([]);
  });

  it('collectiblePlacements-initial-isNonEmptyAndMatchesCVData', () => {
    // Real CVData has skill categories + languages — exact count isn't
    // pinned here (that's CollectibleMapper.test.ts's job against fixture
    // data), just that real data produces a real, non-trivial list.
    expect(collectiblePlacements.value.length).toBeGreaterThan(0);
  });

  it('enemyPlacements-initial-oneEnemyPerLevelMarkerNotPerFullCVData', () => {
    // currentLevel currently has exactly one `E` and one `M` marker — placement
    // count tracks the level's markers, not CVData's (larger) certificate/
    // project counts. This is expected for a mechanics-test level (see
    // level.ts's doc comment), not a regression.
    const allPossibleDefs = mapCVDataToEnemies(currentCV.value);
    expect(allPossibleDefs.length).toBeGreaterThan(enemyPlacements.value.length);
    expect(enemyPlacements.value.filter((p) => p.spriteType === 'slimeGreen')).toHaveLength(1);
    expect(enemyPlacements.value.filter((p) => p.spriteType === 'slimePurple')).toHaveLength(1);
  });

  it('blockPlacements-initial-hasTwoOfEachKindMatchingLevel1sMarkers', () => {
    // currentLevel currently has exactly two X/Q/F markers each (see level.ts's
    // doc comment) — placement count tracks the level's markers, same
    // convention as enemyPlacements/collectiblePlacements.
    expect(blockPlacements.value.filter((p) => p.blockKind === 'crate')).toHaveLength(2);
    expect(blockPlacements.value.filter((p) => p.blockKind === 'questionMark')).toHaveLength(2);
    expect(blockPlacements.value.filter((p) => p.blockKind === 'fragileRock')).toHaveLength(2);
  });

  describe('chestPlacements', () => {
    it('module-places-oneChestPerMarker-cappedByAvailableMarkers', () => {
      // currentLevel has 2 `T` markers (trimmed from 5, both near spawn — live user
      // feedback, 2026-08-30) but the real CVData has 5 Experience entries
      // (see level.ts's CHEST_TILES and cv.en.json) — placeChests has no
      // auto-placement fallback, so only the first 2 (oldest-first, after
      // this batch's D5 chest-ordering reversal) actually get placed.
      expect(chestPlacements.value).toHaveLength(2);
    });
  });

  describe('chestStates', () => {
    it('module-seeds-everyChestClosed', () => {
      expect(chestStates.value.every((c) => c.state === 'closed')).toBe(true);
    });
  });

  it('enemyStates-initial-oneLivePatrolStatePerEnemyPlacement', () => {
    expect(enemyStates.value).toHaveLength(enemyPlacements.value.length);
    for (const state of enemyStates.value) {
      expect(state.vx).toBe(0);
      expect(state.direction).toBe('right');
      expect(state.animState).toBe('walk');
    }
  });

  it('enemyStates-initial-desyncsStartingAnimFrameAcrossEnemies', () => {
    // currentLevel has 2 enemies (1 green, 1 purple) — their seeded walk frames
    // must differ so they don't visibly animate in unison (see Enemy.ts's
    // toEnemyState `index` parameter).
    expect(enemyStates.value.length).toBeGreaterThanOrEqual(2);
    const [first, second] = enemyStates.value;
    expect(first.animFrame).not.toBe(second.animFrame);
  });

  it('resetGame-calledAfterEnemiesMoved-restoresEnemiesToInitialState', () => {
    enemyStates.value = enemyStates.value.map((e) => ({ ...e, x: e.x + 500, vx: 60, direction: 'left' as const }));

    resetGame();

    expect(enemyStates.value).toHaveLength(enemyPlacements.value.length);
    enemyStates.value.forEach((state, i) => {
      expect(state.x).toBe(enemyPlacements.value[i].x);
      expect(state.vx).toBe(0);
      expect(state.direction).toBe('right');
    });
  });

  it('collectedCollectibleIds-initial-isEmptySet', () => {
    expect(collectedCollectibleIds.value.size).toBe(0);
  });

  it('activeEffects-initial-isEmptyArray', () => {
    expect(activeEffects.value).toEqual([]);
  });

  it('resetGame-calledAfterCollectingAndFactsAdded-doesNotClearCollectedStateOrFacts', () => {
    collectedCollectibleIds.value = new Set(['coin-backend']);
    collectedFacts.value = [
      { id: 'coin-backend', sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'Backend', skills: [] }, sourceType: 'coin' },
    ];

    resetGame();

    // FR-020c: collected coins/facts survive a death/respawn reset.
    expect(collectedCollectibleIds.value.has('coin-backend')).toBe(true);
    expect(collectedFacts.value).toHaveLength(1);
  });

  it('playerState-initial-hasIdleAnimAtFrameZero', () => {
    expect(playerState.value.animState).toBe('idle');
    expect(playerState.value.animFrame).toBe(0);
  });

  it('playerState-initial-standsHorizontallyCenteredOnSpawnTile', () => {
    const spawnCell = tileToPixel(SPAWN_TILE.value.col, SPAWN_TILE.value.row);
    const expectedX = spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
    expect(playerState.value.x).toBe(expectedX);
  });

  it('playerState-initial-feetRestOnGroundBelowSpawnTile', () => {
    const spawnCell = tileToPixel(SPAWN_TILE.value.col, SPAWN_TILE.value.row);
    const groundSurfaceY = spawnCell.y + RENDERED_TILE_SIZE;
    const expectedY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    expect(playerState.value.y).toBe(expectedY);
  });

  it('playerState-initial-hasZeroVelocityAndIsNotYetGrounded', () => {
    expect(playerState.value.vy).toBe(0);
    expect(playerState.value.grounded).toBe(false);
  });

  it('playerState-initial-hasZeroAnimationTimer', () => {
    expect(playerState.value.animTimer).toBe(0);
  });

  it('playerState-initial-hasZeroHorizontalVelocityAndFacesRight', () => {
    expect(playerState.value.vx).toBe(0);
    expect(playerState.value.facing).toBe('right');
  });

  it('cameraPositionX-initial-isZero', () => {
    expect(cameraPositionX.value).toBe(0);
  });

  describe('cameraPositionY', () => {
    it('initial-isZero', () => {
      expect(cameraPositionY.value).toBe(0);
    });
  });

  it('healthState-initial-isMaxHalfHearts', () => {
    expect(healthState.value).toBe(MAX_HALF_HEARTS);
  });

  it('spawnPlayerState-called-matchesPlayerStateInitialValue', () => {
    // spawnPlayerState() must be pure/deterministic so restart logic (Task 5)
    // can call it again later and get the exact same spawn position.
    expect(spawnPlayerState()).toEqual(playerState.value);
  });

  it('spawnCenter-called-isSpawnPlayerTopLeftPlusHalfRenderedSize', () => {
    const spawn = spawnPlayerState();
    const center = spawnCenter();
    expect(center.x).toBe(spawn.x + PLAYER_RENDERED_SIZE / 2);
    expect(center.y).toBe(spawn.y + PLAYER_VISUAL_CENTER_Y_OFFSET);
  });

  it('lifecycleState-initial-isIntroPhaseCenteredOnSpawnPlayer', () => {
    const center = spawnCenter();
    expect(lifecycleState.value.phase).toBe('intro');
    expect(lifecycleState.value.elapsed).toBe(0);
    expect(lifecycleState.value.centerX).toBe(center.x);
    expect(lifecycleState.value.centerY).toBe(center.y);
  });

  it('resetGame-calledAfterMutation-restoresSpawnHealthAndZeroCamera', () => {
    playerState.value = { ...playerState.value, x: 999, y: 999, vx: 5 };
    healthState.value = 0;
    cameraPositionX.value = 300;

    resetGame();

    expect(playerState.value).toEqual(spawnPlayerState());
    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(cameraPositionX.value).toBe(0);
  });

  it('resetGame-calledWithCollectedFacts-doesNotClearThem', () => {
    const facts = [
      {
        id: 'x',
        sectionId: 'skills' as const,
        sectionLabel: 'Skills',
        data: { name: 'Go', level: 70 },
        sourceType: 'coin' as const,
      },
    ];
    collectedFacts.value = facts;

    resetGame();

    expect(collectedFacts.value).toBe(facts);
  });

  describe('resetGame', () => {
    it('called-afterOpeningAChest-leavesChestOpen', () => {
      chestStates.value = chestStates.value.map((c, i) => (i === 0 ? { ...c, state: 'open' } : c));
      resetGame();
      expect(isChestOpen(chestStates.value[0])).toBe(true);
    });

    it('resetsCameraPositionYToZero', () => {
      cameraPositionY.value = 300;
      resetGame();
      expect(cameraPositionY.value).toBe(0);
    });
  });
});

describe('resetGameProgress', () => {
  afterEach(() => {
    collectedFacts.value = [];
    collectedCollectibleIds.value = new Set();
    activeJournalSection.value = undefined;
    chestStates.value = chestPlacements.value.map(toChestState);
  });

  it('called-clearsCollectedFactsAndCollectibleIds', () => {
    collectedFacts.value = [
      { id: 'coin-backend', sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'Backend', skills: [] }, sourceType: 'coin' },
    ];
    collectedCollectibleIds.value = new Set(['coin-backend']);
    activeJournalSection.value = 'skills';

    resetGameProgress();

    expect(collectedFacts.value).toEqual([]);
    expect(collectedCollectibleIds.value.size).toBe(0);
    expect(activeJournalSection.value).toBeUndefined();
  });

  it('called-alsoRestoresSpawnHealthAndCamera', () => {
    // Reuses resetGame()'s existing behavior (position/health/camera) —
    // this asserts the seam is actually called, not just facts/ids cleared.
    playerState.value = { ...playerState.value, x: 999 };
    healthState.value = 0;
    cameraPositionX.value = 300;

    resetGameProgress();

    expect(playerState.value).toEqual(spawnPlayerState());
    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(cameraPositionX.value).toBe(0);
  });

  it('called-afterOpeningAChest-closesItAgain', () => {
    chestStates.value = chestStates.value.map((c, i) => (i === 0 ? { ...c, state: 'open' } : c));
    resetGameProgress();
    expect(chestStates.value.every((c) => !isChestOpen(c))).toBe(true);
  });

  it('called-afterEndingScreenShown-resetsLatchToFalse', () => {
    // endingScreenShown is the module-level one-shot latch (see its doc
    // comment in PlatformerState.ts) gating the Thank You screen's
    // trigger — resetGameProgress() must clear it back to false, alongside
    // reopening chestStates, so a visitor who re-opens every chest after a
    // genuine Reset Game can see the screen again.
    endingScreenShown.value = true;
    resetGameProgress();
    expect(endingScreenShown.value).toBe(false);
  });
});

describe('activeJournalSection', () => {
  it('initialValue-onModuleLoad-isUndefined', () => {
    // undefined until the user manually picks a bookmark tab — Journal.tsx
    // falls back to defaulting from the first collected fact this session
    // (`facts[0]`, not the most recently collected one).
    expect(activeJournalSection.value).toBeUndefined();
  });
});

describe('marker-derived placements react to currentLayout', () => {
  afterEach(() => {
    // currentLayout is module-level (see level.ts's doc comment) — restore
    // it so this describe block doesn't leak a stripped-down layout into
    // every other test in this file.
    currentLayout.value = LEVEL_1_LAYOUT;
  });

  it('changingCurrentLayoutToALayoutWithNoMarkers-recomputesEveryPlacementSignalToEmpty', () => {
    // A layout with no S/E/M/C/X/Q/F/T markers at all — placeEnemies/
    // placeCollectibles/placeBlocks/placeChests all zip real CVData against
    // zero marker positions, so every placement list must come back empty.
    // This is the behavior collectiblePlacements/enemyPlacements/
    // blockPlacements/chestPlacements becoming `computed(...)` signals
    // (instead of plain module-load-time constants) exists to enable: the
    // Level Editor's Try button relies on these re-deriving from a freshly
    // set `currentLayout`, not staying pinned to LEVEL_1_LAYOUT's markers.
    currentLayout.value = ['GGG'];

    expect(collectiblePlacements.value).toEqual([]);
    expect(enemyPlacements.value).toEqual([]);
    expect(blockPlacements.value).toEqual([]);
    expect(chestPlacements.value).toEqual([]);
  });
});
