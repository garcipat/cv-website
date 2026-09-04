import {
  playerState,
  cameraPositionX,
  cameraPositionY,
  lifecycleState,
  spawnPlayerState,
  spawnCenter,
  resetGame,
  resetGameProgress,
  collectedFacts,
  activeJournalSection,
  hintTooltipState,
  collectiblePlacements,
  enemyPlacements,
  enemyStates,
  collectedCollectibleIds,
  activeEffects,
  activePuffs,
  blockPlacements,
  chestPlacements,
  chestStates,
  endingScreenShown,
  signPlacements,
  controlsOverlayDismissed,
  keyPickupStates,
  collectedKeys,
  spawnedCoinPlacements,
  allCollectiblePlacements,
  levelTotals,
} from './PlatformerState';
import type { CollectedFact } from './types';
import { mapCVDataToEnemies } from './level/EnemyMapper';
import { currentCV } from '@/state/locale';
import { MAX_HALF_HEARTS } from './entities/Health';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import {
  SPAWN_TILE,
  currentLayout,
  LEVEL_1_LAYOUT,
  ENEMY_TILES_PURPLE,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  CHEST_TILES,
  SIGN_TILES,
} from './level/level';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
} from './entities/Player';
import { toChestState, isChestOpen } from './entities/Chest';
import { startPuffEffect } from './engine/CollectionEffects';

function collectedFactFixture(): CollectedFact {
  return { id: 'f1', sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'Test', skills: [] }, sourceType: 'coin' };
}

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
    // Placement count tracks the level's markers, never CVData's length —
    // the level now carries one green slime per course, so those two happen
    // to match, while purple slimes have no CV defs at all and are placed
    // purely from markers (one per chest, see level.ts).
    const allPossibleDefs = mapCVDataToEnemies(currentCV.value);
    expect(enemyPlacements.value.filter((p) => p.type === 'slimeGreen')).toHaveLength(
      allPossibleDefs.length,
    );
    expect(enemyPlacements.value.filter((p) => p.type === 'slimePurple')).toHaveLength(
      ENEMY_TILES_PURPLE.value.length,
    );
  });

  it('blockPlacements-initial-hasOnePlacementPerLevelMarkerOfEachKind', () => {
    // Placement count tracks the level's markers, same convention as
    // enemyPlacements/collectiblePlacements.
    expect(blockPlacements.value.filter((p) => p.blockKind === 'crate')).toHaveLength(
      CRATE_TILES.value.length,
    );
    expect(blockPlacements.value.filter((p) => p.blockKind === 'questionMark')).toHaveLength(
      QUESTIONMARK_TILES.value.length,
    );
    expect(blockPlacements.value.filter((p) => p.blockKind === 'fragileRock')).toHaveLength(
      FRAGILE_ROCK_TILES.value.length,
    );
  });

  describe('chestPlacements', () => {
    it('module-places-oneChestPerMarker', () => {
      // The level carries one `T` marker per Experience entry, so every
      // chest def finds a slot — placeChests has no auto-placement fallback,
      // and a missing marker would silently drop an Experience entry.
      expect(chestPlacements.value).toHaveLength(CHEST_TILES.value.length);
      expect(chestPlacements.value).toHaveLength(currentCV.value.experience.length);
    });
  });

  describe('chestStates', () => {
    it('module-seeds-everyChestClosed', () => {
      expect(chestStates.value.every((c) => c.state === 'closed')).toBe(true);
    });
  });

  describe('signPlacements', () => {
    it('level1-placesOneSignPerHintMarker', () => {
      expect(signPlacements.value).toHaveLength(SIGN_TILES.value.length);
      expect(signPlacements.value.map((sign) => sign.hintId)).toContain('bridgeDropThrough');
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

  it('resetGame-afterEnemyMovedAndDied-revivesTheSameObjectsInPlace', () => {
    const before = enemyStates.value;
    enemyStates.value = before.map((e) => ({ ...e, x: e.x + 200, hitPoints: 0, alive: false }));

    resetGame();

    expect(enemyStates.value).toHaveLength(before.length);
    expect(enemyStates.value.every((e) => e.alive)).toBe(true);
    enemyStates.value.forEach((e, i) => {
      expect(e.x).toBe(before[i].x);
      expect(e.id).toBe(before[i].id);
    });
  });

  it('resetGame-enemyCarryingSessionState-preservesThatStateAcrossRevive', () => {
    // The property the whole plan exists for: resetGame() must not be able to
    // erase per-enemy session progress by rebuilding the array from placements.
    enemyStates.value = enemyStates.value.map((e, i) => (i === 0 ? { ...e, alive: false } : e));
    const targetId = enemyStates.value[0].id;

    resetGame();

    expect(enemyStates.value[0].id).toBe(targetId);
    expect(enemyStates.value[0].alive).toBe(true);
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
    expect(playerState.value.direction).toBe('right');
  });

  it('cameraPositionX-initial-isZero', () => {
    expect(cameraPositionX.value).toBe(0);
  });

  describe('cameraPositionY', () => {
    it('initial-isZero', () => {
      expect(cameraPositionY.value).toBe(0);
    });
  });

  it('playerState-initial-hasMaxHalfHeartsHitPoints', () => {
    expect(playerState.value.hitPoints).toBe(MAX_HALF_HEARTS);
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
    playerState.value = { ...playerState.value, x: 999, y: 999, vx: 5, hitPoints: 0 };
    cameraPositionX.value = 300;

    resetGame();

    expect(playerState.value).toEqual(spawnPlayerState());
    expect(playerState.value.hitPoints).toBe(MAX_HALF_HEARTS);
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

    it('calledWhileHintTooltipVisible-clearsHintTooltipState', () => {
      // Regression test: a sign's hint bubble used to freeze on screen
      // through the death animation, the awaitingRestart wait, and (since
      // resetGame() never cleared it) flash once more at the new spawn
      // point before the game-loop's own tick logic finally cleared it.
      hintTooltipState.value = { hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 };

      resetGame();

      expect(hintTooltipState.value).toBeNull();
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
    playerState.value = { ...playerState.value, x: 999, hitPoints: 0 };
    cameraPositionX.value = 300;

    resetGameProgress();

    expect(playerState.value).toEqual(spawnPlayerState());
    expect(playerState.value.hitPoints).toBe(MAX_HALF_HEARTS);
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

  it('controlsOverlayDismissed-initial-isFalse', () => {
    expect(controlsOverlayDismissed.value).toBe(false);
  });
});

describe('activePuffs', () => {
  it('startsEmpty', () => {
    expect(activePuffs.value).toEqual([]);
  });

  it('resetGame-doesNotClearActivePuffs', () => {
    const puff = startPuffEffect('a', 0, 0);
    activePuffs.value = [puff];
    resetGame();
    expect(activePuffs.value).toHaveLength(1);
    expect(activePuffs.value[0]).toBe(puff);
  });

  it('resetGameProgress-clearsActivePuffs', () => {
    activePuffs.value = [startPuffEffect('a', 0, 0)];
    resetGameProgress();
    expect(activePuffs.value).toEqual([]);
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

describe('hintTooltipState', () => {
  afterEach(() => {
    hintTooltipState.value = null;
  });

  it('initialValue-onModuleLoad-isNull', () => {
    expect(hintTooltipState.value).toBeNull();
  });
});

describe('keyPickupStates / collectedKeys persistence', () => {
  afterEach(() => {
    keyPickupStates.value = [];
    collectedKeys.value = 0;
  });

  it('resetGame-doesNotClearKeyPickupsOrCollectedKeys', () => {
    keyPickupStates.value = [{ id: 'k1', x: 0, y: 0, collected: true }];
    collectedKeys.value = 2;
    resetGame();
    expect(keyPickupStates.value).toEqual([{ id: 'k1', x: 0, y: 0, collected: true }]);
    expect(collectedKeys.value).toBe(2);
  });

  it('resetGameProgress-clearsKeyPickupsAndCollectedKeys', () => {
    keyPickupStates.value = [{ id: 'k1', x: 0, y: 0, collected: true }];
    collectedKeys.value = 2;
    resetGameProgress();
    expect(keyPickupStates.value).toEqual([]);
    expect(collectedKeys.value).toBe(0);
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
    expect(signPlacements.value).toEqual([]);
  });
});

describe('allCollectiblePlacements', () => {
  it('initially-equalsCollectiblePlacementsAlone', () => {
    expect(allCollectiblePlacements.value).toEqual(collectiblePlacements.value);
  });

  it('afterASpawnedCoinIsAdded-includesIt', () => {
    const extra = { id: 'spawned-1', spriteType: 'coin' as const, fact: collectedFactFixture(), x: 0, y: 0 };
    spawnedCoinPlacements.value = [extra];
    expect(allCollectiblePlacements.value).toContainEqual(extra);
    spawnedCoinPlacements.value = []; // don't leak into other tests
  });
});

describe('blockPlacements — coinPot', () => {
  it('someCoinPotBlocksExist-becauseTheDefaultLevelHasUMarkers', () => {
    // Task 12 adds at least one `u` marker to LEVEL_1_LAYOUT — this test
    // documents that expectation and will fail loudly if that task is
    // skipped or the marker is later removed.
    expect(blockPlacements.value.some((b) => b.blockKind === 'coinPot')).toBe(true);
  });
});

describe('levelTotals', () => {
  afterEach(() => {
    // currentLayout is module-level (see level.ts's doc comment) — restore it
    // so this describe block doesn't leak a stripped-down layout into every
    // other test in this file.
    currentLayout.value = LEVEL_1_LAYOUT;
  });

  it('layoutWithNoMarkers-isAllZeroes', () => {
    currentLayout.value = ['GGG'];

    expect(levelTotals.value).toEqual({ coins: 0, fruits: 0, enemies: 0, crates: 0, chests: 0 });
  });

  // A coin-pot's coin does not exist in allCollectiblePlacements until the pot
  // is destroyed, so the total counts placed coins PLUS every pot up front —
  // otherwise the denominator would creep upward during play instead of
  // staying fixed all session.
  it('layoutWithOneCoinAndOneCoinPot-countsBothAsCoins', () => {
    currentLayout.value = ['SCu', 'GGG'];

    expect(levelTotals.value.coins).toBe(2);
  });

  it('layoutWithOneCoinAndOneCoinPot-countsNoOtherCollectible', () => {
    currentLayout.value = ['SCu', 'GGG'];

    expect(levelTotals.value).toMatchObject({ fruits: 0, enemies: 0, crates: 0, chests: 0 });
  });

  it('level1Layout-matchesTheSamePlacementFiltersEveryCallSiteUsedBefore', () => {
    // Guards against a mis-wired field (crates reading questionMark, say) —
    // each field must equal the exact expression its former call site used.
    expect(levelTotals.value).toEqual({
      coins:
        collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length +
        blockPlacements.value.filter((b) => b.blockKind === 'coinPot').length,
      fruits: blockPlacements.value.filter((b) => b.blockKind === 'questionMark' && b.fact).length,
      enemies: enemyPlacements.value.filter((p) => p.fact).length,
      crates: blockPlacements.value.filter((b) => b.blockKind === 'crate').length,
      chests: chestPlacements.value.length,
    });
  });
});
