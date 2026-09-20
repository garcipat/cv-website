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
  activeHealAuraEffects,
  blockPlacements,
  chestPlacements,
  chestStates,
  endingScreenShown,
  signPlacements,
  controlsOverlayDismissed,
  keyPickupStates,
  collectedKeys,
  heartPickupStates,
  spawnedCoinPlacements,
  allCollectiblePlacements,
  levelTotals,
  blockStates,
  cratesDestroyed,
  enemiesDefeated,
  checkpointPlacements,
  checkpointStates,
  activeCheckpointId,
  activeFadeOutTexts,
  playerStateAtTile,
  activeRespawnPlacement,
  respawnPlayerState,
  respawnCenter,
  darknessLevel,
  tickDarkness,
  torchPositions,
} from './PlatformerState';
import type { CollectedFact } from './types';
import { mapCVDataToEnemies } from './level/EnemyMapper';
import { toBlockState } from './entities/Block';
import { computePotRenderPlan } from './entities/blocks/potRenderPlan';
import { BLOCK_TYPES } from './entities/blocks';
import { PHYSICS_CONFIG } from './engine/PhysicsConfig';
import { currentCV } from '@/state/locale';
import { MAX_HALF_HEARTS } from './entities/Health';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import {
  SPAWN_TILE,
  currentLayout,
  currentBackground,
  LEVEL_1_LAYOUT,
  LEVEL_1_BACKGROUND,
  ENEMY_TILES_PURPLE,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  CHEST_TILES,
  CHECKPOINT_TILES,
  SIGN_TILES,
  TORCH_TILES,
} from './level/level';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
  PLAYER_HIT_REACTION_SECONDS,
} from './entities/Player';
import { toChestState, isChestOpen } from './entities/Chest';
import { toCheckpointState } from './entities/Checkpoint';
import { startPuffEffect, startHealAuraEffect, startFadeOutTextEffect } from './engine/CollectionEffects';
import { MAX_DARKNESS, DARKNESS_FADE_SECONDS, playerOccupiedCell } from './engine/Lighting';

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

describe('activeHealAuraEffects', () => {
  afterEach(() => {
    activeHealAuraEffects.value = [];
  });

  it('startsEmpty', () => {
    expect(activeHealAuraEffects.value).toEqual([]);
  });

  it('resetGame-doesNotClearActiveHealAuraEffects', () => {
    const aura = startHealAuraEffect('h1');
    activeHealAuraEffects.value = [aura];
    resetGame();
    expect(activeHealAuraEffects.value).toHaveLength(1);
    expect(activeHealAuraEffects.value[0]).toBe(aura);
  });

  it('resetGameProgress-clearsActiveHealAuraEffects', () => {
    activeHealAuraEffects.value = [startHealAuraEffect('h1')];
    resetGameProgress();
    expect(activeHealAuraEffects.value).toEqual([]);
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

describe('heartPickupStates', () => {
  afterEach(() => {
    heartPickupStates.value = [];
  });

  it('initialValue-onModuleLoad-isEmpty', () => {
    expect(heartPickupStates.value).toEqual([]);
  });

  it('resetGameProgress-clearsHeartPickups', () => {
    heartPickupStates.value = [{ id: 'h1', x: 0, y: 0 }];
    resetGameProgress();
    expect(heartPickupStates.value).toEqual([]);
  });
});

describe('blockPlacements — potionPot', () => {
  afterEach(() => {
    // currentLayout is module-level (see level.ts's doc comment) — restore
    // it so this describe block doesn't leak a stripped-down layout into
    // every other test in this file.
    currentLayout.value = LEVEL_1_LAYOUT;
  });

  it('layoutWithAPotionPotMarker-producesAPotionPotPlacement', () => {
    currentLayout.value = ['Sp', 'GG'];
    expect(blockPlacements.value.some((b) => b.blockKind === 'potionPot')).toBe(true);
  });
});

describe('resetGame — potion-pots restore, dropped hearts vanish', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    blockStates.value = blockPlacements.value.map(toBlockState);
    heartPickupStates.value = [];
  });

  it('resetGame-clearsDroppedHeartPickups', () => {
    // Unlike keyPickupStates/bonusFruitStates (which persist across a
    // death/respawn, cleared only by resetGameProgress), a dropped heart
    // disappears on every death — the user's call: a heart in the world is
    // tied to its still-broken pot, and the pot itself is about to reappear.
    heartPickupStates.value = [{ id: 'h1', x: 0, y: 0 }];
    resetGame();
    expect(heartPickupStates.value).toEqual([]);
  });

  it('resetGame-restoresADestroyedPotionPotBackToIntact', () => {
    currentLayout.value = ['Sp', 'GG'];
    const placement = blockPlacements.value.find((b) => b.blockKind === 'potionPot')!;
    // Simulate the pot having been destroyed and its shatter animation
    // settled: isBlockRemoved splices a used-up, removeWhenUsedUp block out
    // of blockStates entirely (see Block.ts's doc comment), so there is
    // nothing left in blockStates for this placement's id at all.
    blockStates.value = blockPlacements.value.map(toBlockState).filter((b) => b.id !== placement.id);
    expect(blockStates.value.some((b) => b.id === placement.id)).toBe(false);

    resetGame();

    expect(blockStates.value.find((b) => b.id === placement.id)).toMatchObject({
      blockKind: 'potionPot',
      hitsTaken: 0,
    });
  });

  it('resetGame-doesNotTouchOtherBlockKindsProgress', () => {
    // Every other block kind's progress persists across a death/respawn
    // (see resetGame's own doc comment) — only potionPot is special-cased.
    const crate = blockStates.value.find((b) => b.blockKind === 'crate')!;
    blockStates.value = blockStates.value.map((b) => (b.id === crate.id ? { ...b, hitsTaken: 1 } : b));

    resetGame();

    expect(blockStates.value.find((b) => b.id === crate.id)?.hitsTaken).toBe(1);
  });
});

describe('resetGame — restored-on-respawn flag and rewardGiven carry-over', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    blockStates.value = blockPlacements.value.map(toBlockState);
    heartPickupStates.value = [];
    spawnedCoinPlacements.value = [];
  });

  it('resetGame-rebuildsARestoredKindCarryingRewardGivenOverFromThePriorInstance', () => {
    currentLayout.value = ['Sp', 'GG'];
    const placement = blockPlacements.value.find((b) => b.blockKind === 'potionPot')!;
    blockStates.value = blockPlacements.value.map((b) =>
      b.id === placement.id ? { ...toBlockState(b), rewardGiven: true, hitsTaken: 1 } : toBlockState(b),
    );

    resetGame();

    expect(blockStates.value.find((b) => b.id === placement.id)).toMatchObject({
      blockKind: 'potionPot',
      hitsTaken: 0,
      rewardGiven: true,
    });
  });

  it('resetGame-aNonRestoredKindIsLeftInItsBrokenState', () => {
    currentLayout.value = ['Sup', 'GGG'];
    const coin = blockPlacements.value.find((b) => b.blockKind === 'coinPot')!;
    blockStates.value = blockPlacements.value.map((b) =>
      b.id === coin.id ? { ...toBlockState(b), hitsTaken: 1, rewardGiven: true } : toBlockState(b),
    );

    resetGame();

    expect(blockStates.value.find((b) => b.id === coin.id)).toMatchObject({
      blockKind: 'coinPot',
      hitsTaken: 1,
      rewardGiven: true,
    });
  });

  it('resetGame-restoredBottleBesideAStillBrokenPot-rendersIsolatedByThePlan', () => {
    currentLayout.value = ['Sup', 'GGG'];
    const coin = blockPlacements.value.find((b) => b.blockKind === 'coinPot')!;
    const bottle = blockPlacements.value.find((b) => b.blockKind === 'potionPot')!;
    blockStates.value = blockPlacements.value.map((b) =>
      b.id === coin.id ? { ...toBlockState(b), hitsTaken: 1 } : toBlockState(b),
    );

    resetGame();

    const plan = computePotRenderPlan(blockStates.value);
    expect(plan.ownerBlockId.has(coin.id)).toBe(false);
    expect(plan.ownerBlockId.get(bottle.id)).toBe(bottle.id);
    expect(plan.runsByOwnerId.get(bottle.id)!.fillers).toEqual([]);
  });

  it('restoredEveryBreakPot-dropsAFreshHeartOnTheNextBreak', () => {
    const block = toBlockState({ id: 'bottle-1', blockKind: 'potionPot', x: 0, y: 0 });

    expect(BLOCK_TYPES.potionPot.onHit!({ ...block, hitsTaken: 1, rewardGiven: true })).toEqual({
      spawnPickup: 'heart',
      bounceVelocity: PHYSICS_CONFIG.potBounceVelocity,
    });
  });

  it('oncePotThatAlreadyPaidOut-wouldNotDropASecondTimeEvenIfRestored', () => {
    const block = toBlockState({ id: 'coin-1', blockKind: 'coinPot', x: 0, y: 0 });

    expect(BLOCK_TYPES.coinPot.onHit!({ ...block, hitsTaken: 1, rewardGiven: true })).toEqual({
      bounceVelocity: PHYSICS_CONFIG.potBounceVelocity,
    });
  });

  it('resetGame-aPreviouslyDroppedCoinPickupSurvivesAndStaysCollectible', () => {
    const droppedCoin = { id: 'coinpot-x', spriteType: 'coin' as const, x: 100, y: 100 };
    spawnedCoinPlacements.value = [droppedCoin];

    resetGame();

    expect(spawnedCoinPlacements.value).toEqual([droppedCoin]);
    expect(allCollectiblePlacements.value).toContainEqual(droppedCoin);
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
    currentLayout.value = ['Sou', 'GGG'];

    expect(levelTotals.value.coins).toBe(2);
  });

  it('layoutWithOneCoinAndOneCoinPot-countsNoOtherCollectible', () => {
    currentLayout.value = ['Sou', 'GGG'];

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
      enemies: enemyPlacements.value.filter((p) => p.type === 'slimeGreen').length,
      crates: blockPlacements.value.filter((b) => b.blockKind === 'crate').length,
      chests: chestPlacements.value.length,
    });
  });

  // Every green slime now draws from a shared fact pool at defeat time (see
  // EnemyMapper.ts's mapCVDataToEnemyFactPool) rather than carrying a fixed
  // 1:1 fact — so the denominator for that pool must be every green slime
  // placed, not just the ones that happened to get a fact under the old
  // fixed-zip scheme.
  it('moreGreenEnemyMarkersThanCourses-enemiesTotalCountsEveryGreenMarkerNotJustFactBearingOnes', () => {
    const courseCount = mapCVDataToEnemies(currentCV.value).length;
    const markerCount = courseCount + 2; // guaranteed to exceed the fact pool
    currentLayout.value = ['S' + 'M'.repeat(markerCount) + 'G', 'G'.repeat(markerCount + 2)];

    expect(levelTotals.value.enemies).toBe(markerCount);
  });
});

describe('cratesDestroyed', () => {
  afterEach(() => {
    // blockStates is a plain signal — restore it so this describe block
    // doesn't leak a mutated array into every other test in this file.
    blockStates.value = blockPlacements.value.map(toBlockState);
  });

  it('noCratesTouched-isZero', () => {
    expect(cratesDestroyed.value).toBe(0);
  });

  it('oneCrateMidShatterButStillPresentInBlockStates-countsAsDestroyedImmediately', () => {
    // Counted the instant it's used up (hitsTaken reaches max), not only
    // once its shatter animation finishes and it's spliced out of
    // blockStates (see isBlockRemoved) — no lag waiting for the animation.
    const crate = blockPlacements.value.find((b) => b.blockKind === 'crate')!;
    blockStates.value = blockStates.value.map((b) =>
      b.id === crate.id ? { ...b, hitsTaken: 2, animState: 'shatter', animTimer: 0 } : b,
    );

    expect(cratesDestroyed.value).toBe(1);
  });

  it('extraSyntheticCrateInBlockStatesBeyondRealPlacements-doesNotCorruptTheCount', () => {
    // A test helper (or anything else) injecting a crate-kind BlockState
    // whose id isn't one of blockPlacements's real crates must not affect
    // this count — it's derived from real placements checked by id, not
    // from blockStates's raw length.
    const realCrate = blockPlacements.value.find((b) => b.blockKind === 'crate')!;
    blockStates.value = [
      ...blockStates.value,
      { ...toBlockState(realCrate), id: 'synthetic-extra-crate' },
    ];

    expect(cratesDestroyed.value).toBe(0);
  });

  // The regression this computed exists to prevent: a destroyed crate is
  // spliced out of blockStates entirely once its shatter animation finishes
  // (see PlatformerPage.tsx's isBlockRemoved filtering) — naively filtering
  // blockStates for "used up" crates would undercount back to 0 the instant
  // that happens, even though the crate is very much still destroyed.
  it('oneCrateRemovedFromBlockStatesAfterItsShatterAnimationFinished-stillCountsAsDestroyed', () => {
    const crate = blockPlacements.value.find((b) => b.blockKind === 'crate')!;
    blockStates.value = blockStates.value.filter((b) => b.id !== crate.id);

    expect(cratesDestroyed.value).toBe(1);
  });

  it('everyCrateDestroyedAndRemoved-equalsLevelTotal', () => {
    blockStates.value = blockStates.value.filter((b) => b.blockKind !== 'crate');

    expect(cratesDestroyed.value).toBe(levelTotals.value.crates);
  });
});

describe('enemiesDefeated', () => {
  afterEach(() => {
    // enemyStates is a plain signal — restore rewardGiven so this describe
    // block doesn't leak into every other test in this file.
    enemyStates.value = enemyStates.value.map((e) => ({ ...e, rewardGiven: false }));
  });

  it('noEnemiesDefeated-isZero', () => {
    expect(enemiesDefeated.value).toBe(0);
  });

  it('oneGreenSlimeRewardGiven-countsAsDefeated', () => {
    const [first] = enemyStates.value.filter((e) => e.type === 'slimeGreen');
    enemyStates.value = enemyStates.value.map((e) => (e.id === first.id ? { ...e, rewardGiven: true } : e));

    expect(enemiesDefeated.value).toBe(1);
  });

  it('purpleSlimeRewardGiven-doesNotCountTowardEnemiesDefeated', () => {
    // A purple slime's rewardGiven is set by its key drop, not a course
    // fact — the "enemies" counter is specifically about green slimes/
    // courses (see COUNTER_SECTIONS), so a purple defeat must not inflate it.
    const [purple] = enemyStates.value.filter((e) => e.type === 'slimePurple');
    if (!purple) return; // this level may have no purple markers
    enemyStates.value = enemyStates.value.map((e) => (e.id === purple.id ? { ...e, rewardGiven: true } : e));

    expect(enemiesDefeated.value).toBe(0);
  });
});

describe('checkpointPlacements', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    checkpointStates.value = checkpointPlacements.value.map(toCheckpointState);
    activeCheckpointId.value = null;
    activeFadeOutTexts.value = [];
  });

  it('shippedLevel-hasItsAuthoredCheckpoint', () => {
    currentLayout.value = LEVEL_1_LAYOUT;
    expect(checkpointPlacements.value.map((p) => p.id)).toEqual(['checkpoint-12-9']);
    expect(CHECKPOINT_TILES.value).toEqual([{ col: 12, row: 9 }]);
  });

  it('layoutWithCheckpoints-derivesOnePlacementPerMarkerInReadingOrder', () => {
    currentLayout.value = ['SC.', '.G.'];
    expect(checkpointPlacements.value.map((p) => p.id)).toEqual(['checkpoint-1-0']);
    expect(checkpointPlacements.value[0]).toMatchObject({ col: 1, row: 0 });
  });
});

describe('checkpointStates', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    checkpointStates.value = checkpointPlacements.value.map(toCheckpointState);
    activeCheckpointId.value = null;
    activeFadeOutTexts.value = [];
  });

  it('module-seedsOneDormantStatePerPlacement', () => {
    // The signal is seeded once at module load (from the shipped level, which
    // has no checkpoints) — rebuilding it for a new layout is
    // resetGameProgress()'s job (FR-016), not a reactive recompute.
    expect(checkpointStates.value).toEqual(checkpointPlacements.value.map(toCheckpointState));
    expect(checkpointStates.value.every((c) => c.activated === false)).toBe(true);
    expect(checkpointStates.value.every((c) => c.activatedAt === null)).toBe(true);
  });

  it('activeCheckpointId-startsNull', () => {
    expect(activeCheckpointId.value).toBeNull();
  });

  it('activeFadeOutTexts-startsEmpty', () => {
    expect(activeFadeOutTexts.value).toEqual([]);
  });
});

describe('playerStateAtTile', () => {
  it('placesTheCharacterCentredOnTheCellWithFeetOnItsBottomEdge', () => {
    const cell = tileToPixel(3, 4);
    const state = playerStateAtTile(3, 4);
    const expectedX = cell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
    const expectedY = cell.y + RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;

    expect(state.x).toBe(expectedX);
    expect(state.y).toBe(expectedY);
    expect(state.lastGroundedX).toBe(expectedX);
    expect(state.lastGroundedY).toBe(expectedY);
    expect(state.vx).toBe(0);
    expect(state.vy).toBe(0);
    expect(state.grounded).toBe(false);
    expect(state.hitPoints).toBe(MAX_HALF_HEARTS);
    expect(state.alive).toBe(true);
    // Immediately vulnerable: no free invulnerability window after respawn.
    expect(state.hitTimer).toBe(PLAYER_HIT_REACTION_SECONDS);
  });

  it('spawnPlayerState-delegatesToTheSpawnTile', () => {
    const { col, row } = SPAWN_TILE.value;
    expect(spawnPlayerState()).toEqual(playerStateAtTile(col, row));
  });
});

describe('respawn signals', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    checkpointStates.value = checkpointPlacements.value.map(toCheckpointState);
    activeCheckpointId.value = null;
  });

  it('noActiveCheckpoint-respawnsAtTheLevelSpawn', () => {
    expect(activeRespawnPlacement.value).toBeNull();
    expect(respawnPlayerState.value).toEqual(spawnPlayerState());
  });

  it('activeCheckpoint-respawnsAtTheCheckpointTile', () => {
    const placement = { id: 'checkpoint-2-3', col: 2, row: 3, x: 64, y: 96 };
    checkpointStates.value = [toCheckpointState(placement)];
    activeCheckpointId.value = 'checkpoint-2-3';

    expect(activeRespawnPlacement.value).toEqual(placement);
    expect(respawnPlayerState.value).toEqual(playerStateAtTile(2, 3));
  });

  it('respawnCenter-isTheVisualCentreOfTheRespawnState', () => {
    const state = respawnPlayerState.value;
    expect(respawnCenter.value).toEqual({
      x: state.x + PLAYER_RENDERED_SIZE / 2,
      y: state.y + PLAYER_VISUAL_CENTER_Y_OFFSET,
    });
  });
});

describe('checkpoint reset semantics', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    checkpointStates.value = checkpointPlacements.value.map(toCheckpointState);
    activeCheckpointId.value = null;
    activeFadeOutTexts.value = [];
  });

  it('resetGame-preservesRaisedFlagsAndTheActiveIdButClearsLabels', () => {
    const placement = { id: 'checkpoint-1-1', col: 1, row: 1, x: 32, y: 32 };
    checkpointStates.value = [{ ...toCheckpointState(placement), activated: true, activatedAt: 1 }];
    activeCheckpointId.value = 'checkpoint-1-1';
    activeFadeOutTexts.value = [startFadeOutTextEffect('checkpoint-1-1', 0, 0, 'Checkpoint')];

    resetGame();

    expect(checkpointStates.value).toHaveLength(1);
    expect(checkpointStates.value[0].activated).toBe(true);
    expect(activeCheckpointId.value).toBe('checkpoint-1-1');
    // A frozen label must not survive a respawn.
    expect(activeFadeOutTexts.value).toEqual([]);
  });

  it('resetGameProgress-clearsTheActiveIdRebuildsDormantAndClearsLabels', () => {
    currentLayout.value = ['SC.', 'GGG'];
    const placement = checkpointPlacements.value[0];
    checkpointStates.value = [{ ...toCheckpointState(placement), activated: true, activatedAt: 1 }];
    activeCheckpointId.value = placement.id;
    activeFadeOutTexts.value = [startFadeOutTextEffect(placement.id, 0, 0, 'Checkpoint')];

    resetGameProgress();

    expect(activeCheckpointId.value).toBeNull();
    expect(checkpointStates.value).toHaveLength(1);
    expect(checkpointStates.value[0]).toMatchObject({ activated: false, activatedAt: null });
    expect(activeFadeOutTexts.value).toEqual([]);
  });
});

describe('darkness', () => {
  afterEach(() => {
    // currentBackground/darknessLevel are module-level; restoring them keeps
    // this block from leaking a dark state into every other test in the file.
    currentBackground.value = LEVEL_1_BACKGROUND;
    darknessLevel.value = 0;
  });

  it('darknessLevel-initial-isZero', () => {
    expect(darknessLevel.value).toBe(0);
  });

  it('tickDarkness-playerFootCellCoveredByACavePiece-risesTowardMaxDarkness', () => {
    // Arrange: cover the cell under the player's feet with a cave-family piece.
    const cell = playerOccupiedCell(playerState.value);
    currentBackground.value = [{ pieceId: 'charcoalBlock3x3', col: cell.col, row: cell.row }];

    // Act: two half-fades.
    tickDarkness(DARKNESS_FADE_SECONDS / 2);
    const halfway = darknessLevel.value;
    tickDarkness(DARKNESS_FADE_SECONDS / 2);

    // Assert
    expect(halfway).toBeCloseTo(MAX_DARKNESS / 2);
    expect(darknessLevel.value).toBeCloseTo(MAX_DARKNESS);
  });

  it('tickDarkness-playerFootCellOnOpenGround-returnsTowardZero', () => {
    // Arrange: darken fully first.
    const cell = playerOccupiedCell(playerState.value);
    currentBackground.value = [{ pieceId: 'charcoalBlock3x3', col: cell.col, row: cell.row }];
    tickDarkness(DARKNESS_FADE_SECONDS);
    expect(darknessLevel.value).toBeCloseTo(MAX_DARKNESS);

    // Act: remove the cave piece and tick half a fade.
    currentBackground.value = [];
    tickDarkness(DARKNESS_FADE_SECONDS / 2);

    // Assert
    expect(darknessLevel.value).toBeCloseTo(MAX_DARKNESS / 2);
  });

  it('tickDarkness-surfaceBackground-neverDarkens', () => {
    const cell = playerOccupiedCell(playerState.value);
    currentBackground.value = [{ pieceId: 'dirtBlock3x3', col: cell.col, row: cell.row }];

    tickDarkness(DARKNESS_FADE_SECONDS);

    expect(darknessLevel.value).toBe(0);
  });

  it('resetGame-calledWhileDark-setsDarknessBackToZero', () => {
    const cell = playerOccupiedCell(playerState.value);
    currentBackground.value = [{ pieceId: 'charcoalBlock3x3', col: cell.col, row: cell.row }];
    tickDarkness(DARKNESS_FADE_SECONDS);
    expect(darknessLevel.value).toBeCloseTo(MAX_DARKNESS);

    resetGame();

    expect(darknessLevel.value).toBe(0);
  });
});

describe('torchPositions', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
  });

  it('eachTorchTile-mapsToItsWorldSpaceCentre', () => {
    currentLayout.value = ['S.¥', 'GGG'];
    const [torch] = TORCH_TILES.value;
    const cell = tileToPixel(torch.col, torch.row);

    expect(torchPositions.value).toEqual([
      {
        col: torch.col,
        row: torch.row,
        x: cell.x + RENDERED_TILE_SIZE / 2,
        y: cell.y + RENDERED_TILE_SIZE / 2,
      },
    ]);
  });

  it('layoutWithNoTorches-yieldsAnEmptyArray', () => {
    currentLayout.value = ['S..', 'GGG'];
    expect(torchPositions.value).toEqual([]);
  });
});
