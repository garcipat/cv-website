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
  collectiblePlacements,
  enemyPlacements,
  enemyStates,
  collectedCollectibleIds,
  activeEffects,
  refreshSpeechBubbleText,
  blockPlacements,
  chestPlacements,
  chestStates,
  endingScreenShown,
  signPlacements,
  activeLevel,
  controlsOverlayDismissed,
  keyPickupStates,
  collectedKeys,
  heartPickupStates,
  MAX_BOMBS,
  carriedBombs,
  bombPickupStates,
  placedBombs,
  spawnedCoinPlacements,
  allCollectiblePlacements,
  levelTotals,
  blockStates,
  cratesDestroyed,
  enemiesDefeated,
  checkpointPlacements,
  checkpointStates,
  activeCheckpointId,
  playerStateAtTile,
  activeRespawnPlacement,
  respawnPlayerState,
  respawnCenter,
  darknessLevel,
  tickDarkness,
  fogLevel,
  tickFog,
  torchPositions,
  mushroomSquashStates,
  tickMushroomSquashes,
  floorSpikeTimerStates,
  tickFloorSpikes,
  armFloorSpikeTrigger,
  crumblingFloorTimerStates,
  fallingStalactiteTimerStates,
  armFallingStalactiteTrigger,
  tickFallingStalactites,
  hazardPlacements,
  hazardPlacementsForTick,
} from './PlatformerState';
import { MUSHROOM_SQUASH_DURATION_SECONDS } from './entities/blocks/Mushroom';
import { FLOOR_SPIKE_CYCLE_SECONDS } from './entities/hazards/FloorSpike';
import type { CollectedFact } from './types';
import { mapCVDataToEnemies } from './level/EnemyMapper';
import { toBlockState } from './entities/Block';
import { computePotRenderPlan } from './entities/blocks/potRenderPlan';
import { BLOCK_TYPES } from './entities/blocks';
import { PHYSICS_CONFIG } from './contracts/PhysicsConfig';
import { changeLocale, currentCV } from '@/state/locale';
import { MAX_HALF_HEARTS } from './entities/Health';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { startSpeechBubble } from './engine/effects';
import type { SpeechBubbleState } from './engine/effects';
import { hintText } from './state/hintText';

import { LEVEL_1_LAYOUT, LEVEL_1_BACKGROUND, LEVEL_1_MARKERS } from './level/level';
import {
  SPAWN_TILE,
  currentLayout,
  currentBackgroundLayout,
  currentMarkers,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  BOMB_POT_TILES,
  CHEST_TILES,
  SIGN_TILES,
  TORCH_TILES,
} from './state/levelSession';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
  PLAYER_HIT_REACTION_SECONDS,
} from './entities/Player';
import { toChestState, isChestOpen } from './entities/Chest';
import { toCheckpointState } from './entities/Checkpoint';
import {
  advanceEffects,
  startCounterPopup,
  startDebrisEffect,
  startExplosionEffect,
  startFadeOutTextEffect,
  startFlyingText,
  startHealAuraEffect,
  startPlayerHitSplatter,
  startPuffEffect,
} from './engine/effects';
import type {
  DebrisState,
  EffectKind,
  ExplosionState,
  FadeOutTextState,
  HealAuraState,
  HitSplatterState,
  PuffState,
  TransientEffect,
} from './engine/effects';
import { FALLING_STALACTITE_SHAKE_SECONDS } from './entities/hazards/FallingStalactite';
import { MAX_DARKNESS, DARKNESS_FADE_SECONDS, playerOccupiedCell } from './engine/Lighting';

/** The live collection narrowed to one effect kind. */
const effectsOfKind = <S,>(kind: EffectKind): readonly TransientEffect<S>[] =>
  activeEffects.value.filter((effect) => effect.kind === kind) as readonly TransientEffect<S>[];

/** The single live speech bubble (R-005), kind-filtered from the collection. */
const speechBubble = (): TransientEffect<SpeechBubbleState> | undefined =>
  activeEffects.value.find(
    (effect): effect is TransientEffect<SpeechBubbleState> => effect.kind === 'speechBubble',
  );

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
    // Placement count tracks the level's markers, never CVData's length — a
    // fixture with two green markers places exactly two green enemies (not
    // one per CVData course), while a purple marker places a purple slime
    // even though purple slimes have no CV defs at all.
    try {
      currentLayout.value = ['SMMm', 'GGGG'];
      expect(enemyPlacements.value.filter((p) => p.type === 'slimeGreen')).toHaveLength(2);
      expect(enemyPlacements.value.filter((p) => p.type === 'slimeGreen')).not.toHaveLength(
        mapCVDataToEnemies(currentCV.value).length,
      );
      expect(enemyPlacements.value.filter((p) => p.type === 'slimePurple')).toHaveLength(1);
    } finally {
      currentLayout.value = LEVEL_1_LAYOUT;
    }
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
      // One chest per `$` marker, each zipped against one Experience entry —
      // a fixture authored with exactly one marker per Experience entry (the
      // shipped level's own convention) proves both halves without pinning
      // the shipped level's marker count.
      try {
        const markerCount = currentCV.value.experience.length;
        currentLayout.value = ['S' + '$'.repeat(markerCount), 'G'.repeat(markerCount + 1)];
        expect(chestPlacements.value).toHaveLength(CHEST_TILES.value.length);
        expect(chestPlacements.value).toHaveLength(currentCV.value.experience.length);
      } finally {
        currentLayout.value = LEVEL_1_LAYOUT;
      }
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
      // Each kind seeds its OWN resting state: the slimes walk, the bee flies
      // (FR-008).
      expect(state.animState).toBe(state.type === 'bee' ? 'fly' : 'walk');
    }
  });

  it('enemyPlacements-includesOneBeeForTheShippedQMarker', () => {
    // A `q` marker places exactly one fact-less bee — a single-`q` fixture
    // proves the marker-to-bee mapping without depending on how many `q`
    // markers the shipped level happens to author.
    try {
      currentLayout.value = ['Sq', 'GG'];
      const bees = enemyPlacements.value.filter((p) => p.type === 'bee');
      expect(bees).toHaveLength(1);
      expect(bees[0].fact).toBeUndefined();
    } finally {
      currentLayout.value = LEVEL_1_LAYOUT;
    }
  });

  it('levelTotalsAndEnemiesDefeated-areUnchangedByTheBee', () => {
    // SC-008: a level with bees reports the same enemies total / defeated
    // count as the same level with them removed. Swap the `q` marker out of
    // the layout and confirm neither counter moves, then restore.
    const withBee = currentLayout.value;
    const withoutBee = withBee.map((row) => row.replace('q', '.'));
    expect(withoutBee).not.toEqual(withBee);

    const totalsBefore = levelTotals.value.enemies;
    const defeatedBefore = enemiesDefeated.value;
    try {
      currentLayout.value = withoutBee;
      expect(levelTotals.value.enemies).toBe(totalsBefore);
      expect(enemiesDefeated.value).toBe(defeatedBefore);
    } finally {
      currentLayout.value = withBee;
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

    it('calledWhileSpeechBubbleVisible-clearsItFromActiveEffects', () => {
      // Regression test: a sign's hint bubble used to freeze on screen
      // through the death animation, the awaitingRestart wait, and (since
      // resetGame() never cleared it) flash once more at the new spawn
      // point before the game-loop's own tick logic finally cleared it.
      activeEffects.value = [
        startSpeechBubble('bridgeDropThrough', 'Hold Down to drop through a bridge.'),
      ];

      resetGame();

      expect(speechBubble()).toBeUndefined();
    });

    it('calledWhileCrouched-returnsTheCharacterStanding', () => {
      // FR-012: crouch is session-scoped in-memory state and never survives a
      // respawn — resetGame() assigns a fresh playerStateAtTile result.
      playerState.value = { ...playerState.value, crouching: true };

      resetGame();

      expect(playerState.value.crouching).toBe(false);
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

  it('calledWhileCrouched-returnsTheCharacterStanding', () => {
    // FR-012: a full Reset Game also returns the character standing.
    playerState.value = { ...playerState.value, crouching: true };

    resetGameProgress();

    expect(playerState.value.crouching).toBe(false);
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

describe('activeEffects — puffs', () => {
  beforeEach(() => {
    activeEffects.value = [];
  });

  afterEach(() => {
    activeEffects.value = [];
  });

  it('startsEmpty-withNoPuffEffects', () => {
    expect(effectsOfKind<PuffState>('puff')).toEqual([]);
  });

  it('resetGame-doesNotClearPuffs', () => {
    const puff = startPuffEffect('a', 0, 0);
    activeEffects.value = [puff];
    resetGame();
    expect(effectsOfKind<PuffState>('puff')).toHaveLength(1);
    expect(effectsOfKind<PuffState>('puff')[0]).toBe(puff);
  });

  it('resetGameProgress-clearsPuffs', () => {
    activeEffects.value = [startPuffEffect('a', 0, 0)];
    resetGameProgress();
    expect(effectsOfKind<PuffState>('puff')).toEqual([]);
  });
});

describe('activeEffects — heal auras', () => {
  beforeEach(() => {
    activeEffects.value = [];
  });

  afterEach(() => {
    activeEffects.value = [];
  });

  it('startsEmpty-withNoHealAuraEffects', () => {
    expect(effectsOfKind<HealAuraState>('healAura')).toEqual([]);
  });

  it('resetGame-doesNotClearHealAuras', () => {
    const aura = startHealAuraEffect('h1');
    activeEffects.value = [aura];
    resetGame();
    expect(effectsOfKind<HealAuraState>('healAura')).toHaveLength(1);
    expect(effectsOfKind<HealAuraState>('healAura')[0]).toBe(aura);
  });

  it('resetGameProgress-clearsHealAuras', () => {
    activeEffects.value = [startHealAuraEffect('h1')];
    resetGameProgress();
    expect(effectsOfKind<HealAuraState>('healAura')).toEqual([]);
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

describe('refreshSpeechBubbleText', () => {
  afterEach(() => {
    activeEffects.value = [];
    changeLocale('en');
  });

  it('noActiveBubble-leavesTheCollectionUntouched', () => {
    const puff = startPuffEffect('p', 0, 0);
    activeEffects.value = [puff];

    refreshSpeechBubbleText();

    expect(activeEffects.value).toEqual([puff]);
    expect(activeEffects.value[0]).toBe(puff);
  });

  it('bubbleWithMatchingText-leavesTheCollectionReferenceUnchanged', () => {
    activeEffects.value = [startSpeechBubble('noBombs', hintText.value.noBombs)];
    const before = activeEffects.value;

    refreshSpeechBubbleText();

    // No steady-state collection write when the stored text already matches.
    expect(activeEffects.value).toBe(before);
  });

  it('bubbleWithStaleText-rewritesOnlyThatEffect', () => {
    const other = startPuffEffect('p', 0, 0);
    const bubble = startSpeechBubble('noBombs', 'stale');
    activeEffects.value = [bubble, other];

    refreshSpeechBubbleText();

    expect(activeEffects.value[1]).toBe(other);
    const updated = speechBubble()!;
    expect(updated).not.toBe(bubble);
    expect(updated.state.text).toBe(hintText.value.noBombs);
  });

  it('languageChange-rewritesTheStoredTextToTheNewLocale', () => {
    activeEffects.value = [
      startSpeechBubble('bridgeDropThrough', 'Hold Down to drop through a bridge.'),
    ];

    changeLocale('de');
    refreshSpeechBubbleText();

    expect(speechBubble()?.state.text).not.toBe('Hold Down to drop through a bridge.');
    expect(speechBubble()?.state.messageId).toBe('bridgeDropThrough');
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

describe('blockPlacements — bombPot', () => {
  afterEach(() => {
    // currentLayout is module-level (see level.ts's doc comment) — restore
    // it so this describe block doesn't leak a stripped-down layout into
    // every other test in this file.
    currentLayout.value = LEVEL_1_LAYOUT;
  });

  it('layoutWithABombPotMarker-producesABombPotPlacement', () => {
    currentLayout.value = ['Sb', 'GG'];
    expect(BOMB_POT_TILES.value).toEqual([{ col: 1, row: 0 }]);
    expect(blockPlacements.value.some((b) => b.blockKind === 'bombPot')).toBe(true);
  });
});

describe('bomb inventory signals', () => {
  it('MAX_BOMBS-isFive', () => {
    expect(MAX_BOMBS).toBe(5);
  });

  it('module-load-seedsAnEmptyInventoryAndNoBombsInTheWorld', () => {
    expect(carriedBombs.value).toBe(0);
    expect(bombPickupStates.value).toEqual([]);
    expect(placedBombs.value).toEqual([]);
    expect(effectsOfKind<ExplosionState>('explosion')).toEqual([]);
  });
});

describe('resetGame — bombs clear and bomb-pots restore', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    blockStates.value = blockPlacements.value.map(toBlockState);
  });

  it('resetGame-clearsPlacedBombsCarriedCountAndDroppedBombPickups', () => {
    placedBombs.value = [
      {
        id: 'bomb-1',
        x: 0,
        y: 0,
        vy: 0,
        col: 0,
        row: 0,
        landingRow: 0,
        fuseElapsed: 1,
        landed: true,
      },
    ];
    carriedBombs.value = 3;
    bombPickupStates.value = [{ id: 'b1', x: 0, y: 0 }];

    resetGame();

    expect(placedBombs.value).toEqual([]);
    expect(carriedBombs.value).toBe(0);
    expect(bombPickupStates.value).toEqual([]);
  });

  it('resetGame-restoresABrokenBombPotIntact', () => {
    currentLayout.value = ['Sb', 'GG'];
    const placement = blockPlacements.value.find((b) => b.blockKind === 'bombPot')!;
    // Simulate the pot having been destroyed and its animation settled:
    // isBlockRemoved splices a used-up, removeWhenUsedUp block out entirely.
    blockStates.value = blockPlacements.value
      .map(toBlockState)
      .filter((b) => b.id !== placement.id);
    expect(blockStates.value.some((b) => b.id === placement.id)).toBe(false);

    resetGame();

    const restored = blockStates.value.find((b) => b.id === placement.id);
    expect(restored).toBeDefined();
    expect(restored!.hitsTaken).toBe(0);
  });

  it('resetGameProgress-clearsActiveExplosions', () => {
    activeEffects.value = [startExplosionEffect('bomb-1', 0, 0)];

    resetGameProgress();

    expect(effectsOfKind<ExplosionState>('explosion')).toEqual([]);
  });
});

describe('resetGame — potion-pots restore, dropped hearts vanish', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    blockStates.value = blockPlacements.value.map(toBlockState);
    heartPickupStates.value = [];
  });

  it('resetGame-clearsDroppedHeartPickups', () => {
    // Unlike keyPickupStates/fruitStates (which persist across a
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
    // A layout with no marker characters at all — placeEnemies/
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
    activeEffects.value = [];
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
    activeEffects.value = [];
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

  it('fadeOutTextKind-startsEmpty', () => {
    expect(effectsOfKind<FadeOutTextState>('fadeOutText')).toEqual([]);
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
    // Seeded to its own feet, so a respawn never carries a stale pre-death
    // feet line into the spear's swept contact test.
    expect(state.prevFeetY).toBe(expectedY + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING);
    expect(state.vx).toBe(0);
    expect(state.vy).toBe(0);
    expect(state.grounded).toBe(false);
    expect(state.hitPoints).toBe(MAX_HALF_HEARTS);
    expect(state.alive).toBe(true);
    // Immediately vulnerable: no free invulnerability window after respawn.
    expect(state.hitTimer).toBe(PLAYER_HIT_REACTION_SECONDS);
  });

  it('playerStateAtTile-seedsCrouchingFalse', () => {
    expect(playerStateAtTile(3, 4).crouching).toBe(false);
  });

  it('spawnPlayerState-seedsCrouchingFalse', () => {
    expect(spawnPlayerState().crouching).toBe(false);
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
    activeEffects.value = [];
  });

  it('resetGame-preservesRaisedFlagsAndTheActiveIdButClearsLabels', () => {
    const placement = { id: 'checkpoint-1-1', col: 1, row: 1, x: 32, y: 32 };
    checkpointStates.value = [{ ...toCheckpointState(placement), activated: true, activatedAt: 1 }];
    activeCheckpointId.value = 'checkpoint-1-1';
    activeEffects.value = [startFadeOutTextEffect('checkpoint-1-1', 0, 0, 'Checkpoint')];

    resetGame();

    expect(checkpointStates.value).toHaveLength(1);
    expect(checkpointStates.value[0].activated).toBe(true);
    expect(activeCheckpointId.value).toBe('checkpoint-1-1');
    // A frozen label must not survive a respawn.
    expect(effectsOfKind<FadeOutTextState>('fadeOutText')).toEqual([]);
  });

  it('resetGameProgress-clearsTheActiveIdRebuildsDormantAndClearsLabels', () => {
    currentLayout.value = ['SC.', 'GGG'];
    const placement = checkpointPlacements.value[0];
    checkpointStates.value = [{ ...toCheckpointState(placement), activated: true, activatedAt: 1 }];
    activeCheckpointId.value = placement.id;
    activeEffects.value = [startFadeOutTextEffect(placement.id, 0, 0, 'Checkpoint')];

    resetGameProgress();

    expect(activeCheckpointId.value).toBeNull();
    expect(checkpointStates.value).toHaveLength(1);
    expect(checkpointStates.value[0]).toMatchObject({ activated: false, activatedAt: null });
    expect(effectsOfKind<FadeOutTextState>('fadeOutText')).toEqual([]);
  });
});

/** A background `string[]` layout just big enough to hold a single material
 *  character at `(col, row)`, everything else empty — mirrors the old
 *  single-placement fixtures these darkness tests used before O-014's grid
 *  rework (and its later storage-unification revision). */
function singleCellBackground(material: 'charcoal' | 'dirt', col: number, row: number): string[] {
  const char = material === 'charcoal' ? 'c' : 'd';
  const rows: string[] = Array.from({ length: row + 1 }, () => '.'.repeat(col + 1));
  rows[row] = rows[row].slice(0, col) + char + rows[row].slice(col + 1);
  return rows;
}

describe('darkness', () => {
  afterEach(() => {
    // currentBackgroundLayout/darknessLevel are module-level; restoring them
    // keeps this block from leaking a dark state into every other test in
    // the file.
    currentBackgroundLayout.value = LEVEL_1_BACKGROUND;
    darknessLevel.value = 0;
  });

  it('darknessLevel-initial-isZero', () => {
    expect(darknessLevel.value).toBe(0);
  });

  it('tickDarkness-playerFootCellCoveredByACavePiece-risesTowardMaxDarkness', () => {
    // Arrange: cover the cell under the player's feet with a cave-family piece.
    const cell = playerOccupiedCell(playerState.value);
    currentBackgroundLayout.value = singleCellBackground('charcoal', cell.col, cell.row);

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
    currentBackgroundLayout.value = singleCellBackground('charcoal', cell.col, cell.row);
    tickDarkness(DARKNESS_FADE_SECONDS);
    expect(darknessLevel.value).toBeCloseTo(MAX_DARKNESS);

    // Act: remove the cave piece and tick half a fade.
    currentBackgroundLayout.value = [];
    tickDarkness(DARKNESS_FADE_SECONDS / 2);

    // Assert
    expect(darknessLevel.value).toBeCloseTo(MAX_DARKNESS / 2);
  });

  it('tickDarkness-surfaceBackground-neverDarkens', () => {
    const cell = playerOccupiedCell(playerState.value);
    currentBackgroundLayout.value = singleCellBackground('dirt', cell.col, cell.row);

    tickDarkness(DARKNESS_FADE_SECONDS);

    expect(darknessLevel.value).toBe(0);
  });

  it('resetGame-calledWhileDark-setsDarknessBackToZero', () => {
    const cell = playerOccupiedCell(playerState.value);
    currentBackgroundLayout.value = singleCellBackground('charcoal', cell.col, cell.row);
    tickDarkness(DARKNESS_FADE_SECONDS);
    expect(darknessLevel.value).toBeCloseTo(MAX_DARKNESS);

    resetGame();

    expect(darknessLevel.value).toBe(0);
  });
});

describe('fog', () => {
  afterEach(() => {
    // currentBackgroundLayout/fogLevel are module-level; restoring them keeps
    // this block from leaking a fogged state into every other test in the
    // file. darknessLevel is reset too, since some tests here tick it
    // alongside fogLevel to check the pairing invariant.
    currentBackgroundLayout.value = LEVEL_1_BACKGROUND;
    fogLevel.value = 0;
    darknessLevel.value = 0;
  });

  it('fogLevel-initial-isZero', () => {
    expect(fogLevel.value).toBe(0);
  });

  it('tickFog-playerFootCellOnOpenGround-risesTowardMaxDarkness', () => {
    // Arrange: no background at all under the player's feet (open ground).
    currentBackgroundLayout.value = [];

    // Act: two half-fades.
    tickFog(DARKNESS_FADE_SECONDS / 2);
    const halfway = fogLevel.value;
    tickFog(DARKNESS_FADE_SECONDS / 2);

    // Assert
    expect(halfway).toBeCloseTo(MAX_DARKNESS / 2);
    expect(fogLevel.value).toBeCloseTo(MAX_DARKNESS);
  });

  it('tickFog-playerFootCellCoveredByACavePiece-returnsTowardZero', () => {
    // Arrange: fog in fully first, on open ground.
    currentBackgroundLayout.value = [];
    tickFog(DARKNESS_FADE_SECONDS);
    expect(fogLevel.value).toBeCloseTo(MAX_DARKNESS);

    // Act: cover the player's own cell with a cave-family piece and tick half a fade.
    const cell = playerOccupiedCell(playerState.value);
    currentBackgroundLayout.value = singleCellBackground('charcoal', cell.col, cell.row);
    tickFog(DARKNESS_FADE_SECONDS / 2);

    // Assert
    expect(fogLevel.value).toBeCloseTo(MAX_DARKNESS / 2);
  });

  it('tickFog-playerFootCellCoveredByACavePiece-neverFogs', () => {
    const cell = playerOccupiedCell(playerState.value);
    currentBackgroundLayout.value = singleCellBackground('charcoal', cell.col, cell.row);

    tickFog(DARKNESS_FADE_SECONDS);

    expect(fogLevel.value).toBe(0);
  });

  it('resetGame-calledWhileFogged-setsFogBackToZero', () => {
    currentBackgroundLayout.value = [];
    tickFog(DARKNESS_FADE_SECONDS);
    expect(fogLevel.value).toBeCloseTo(MAX_DARKNESS);

    resetGame();

    expect(fogLevel.value).toBe(0);
  });

  it('tickFogAndTickDarknessTogether-openGround-fogIsFullAndDarknessIsZero', () => {
    // Arrange: no background at all under the player's feet (open ground).
    currentBackgroundLayout.value = [];

    // Act: tick both effects together for a full fade.
    tickFog(DARKNESS_FADE_SECONDS);
    tickDarkness(DARKNESS_FADE_SECONDS);

    // Assert: the pairing invariant this whole feature rests on — on open
    // ground, fog ends fully present and darkness ends fully off.
    expect(fogLevel.value).toBeCloseTo(MAX_DARKNESS);
    expect(darknessLevel.value).toBeCloseTo(0);
  });

  it('tickFogAndTickDarknessTogether-caveFamilyCell-darknessIsFullAndFogIsZero', () => {
    // Arrange: cover the cell under the player's feet with a cave-family piece.
    const cell = playerOccupiedCell(playerState.value);
    currentBackgroundLayout.value = singleCellBackground('charcoal', cell.col, cell.row);

    // Act: tick both effects together for a full fade.
    tickDarkness(DARKNESS_FADE_SECONDS);
    tickFog(DARKNESS_FADE_SECONDS);

    // Assert: the mirror of the open-ground case above — inside a cave,
    // darkness ends fully present and fog ends fully off.
    expect(darknessLevel.value).toBeCloseTo(MAX_DARKNESS);
    expect(fogLevel.value).toBeCloseTo(0);
  });
});

describe('torchPositions', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    currentMarkers.value = LEVEL_1_MARKERS;
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
        strength: 5,
      },
    ]);
  });

  it('aTorchWithAStrengthMarker-usesThatStrength', () => {
    currentLayout.value = ['S.¥', 'GGG'];
    const [torch] = TORCH_TILES.value;
    const cell = tileToPixel(torch.col, torch.row);

    currentMarkers.value = [{ col: torch.col, row: torch.row, marker: { kind: 'torch', strength: 9 } }];

    expect(torchPositions.value).toEqual([
      {
        col: torch.col,
        row: torch.row,
        x: cell.x + RENDERED_TILE_SIZE / 2,
        y: cell.y + RENDERED_TILE_SIZE / 2,
        strength: 9,
      },
    ]);
  });

  it('layoutWithNoTorches-yieldsAnEmptyArray', () => {
    currentLayout.value = ['S..', 'GGG'];
    expect(torchPositions.value).toEqual([]);
  });
});

describe('mushroomSquashStates', () => {
  afterEach(() => {
    mushroomSquashStates.value = [];
  });

  it('initial-isEmpty', () => {
    expect(mushroomSquashStates.value).toEqual([]);
  });

  it('tickMushroomSquashes-advancesAndPrunesTheList', () => {
    mushroomSquashStates.value = [{ col: 1, row: 2, elapsed: 0 }];

    tickMushroomSquashes(MUSHROOM_SQUASH_DURATION_SECONDS / 2);
    expect(mushroomSquashStates.value).toEqual([
      { col: 1, row: 2, elapsed: MUSHROOM_SQUASH_DURATION_SECONDS / 2 },
    ]);

    tickMushroomSquashes(MUSHROOM_SQUASH_DURATION_SECONDS);
    expect(mushroomSquashStates.value).toEqual([]);
  });

  it('resetGame-called-whileSquashing-clearsTheList', () => {
    mushroomSquashStates.value = [{ col: 1, row: 2, elapsed: 0 }];

    resetGame();

    expect(mushroomSquashStates.value).toEqual([]);
  });

  it('resetGameProgress-called-whileSquashing-clearsTheList', () => {
    mushroomSquashStates.value = [{ col: 1, row: 2, elapsed: 0 }];

    resetGameProgress();

    expect(mushroomSquashStates.value).toEqual([]);
  });
});

describe('tickFloorSpikes', () => {
  afterEach(() => {
    floorSpikeTimerStates.value = [];
  });

  it('armedEntry-advancesItsElapsed', () => {
    floorSpikeTimerStates.value = [{ id: 'fs1', elapsed: 0 }];
    tickFloorSpikes(0.1);
    expect(floorSpikeTimerStates.value).toEqual([{ id: 'fs1', elapsed: expect.closeTo(0.1, 5) }]);
  });

  it('entryPastTheFullCycle-isDropped', () => {
    floorSpikeTimerStates.value = [{ id: 'fs1', elapsed: FLOOR_SPIKE_CYCLE_SECONDS - 0.01 }];
    tickFloorSpikes(0.02);
    expect(floorSpikeTimerStates.value).toEqual([]);
  });
});

describe('armFloorSpikeTrigger', () => {
  afterEach(() => {
    floorSpikeTimerStates.value = [];
  });

  it('unarmedId-addsIt', () => {
    floorSpikeTimerStates.value = [];
    armFloorSpikeTrigger('fs1');
    expect(floorSpikeTimerStates.value).toEqual([{ id: 'fs1', elapsed: 0 }]);
  });

  it('alreadyArmedId-isANoOp', () => {
    floorSpikeTimerStates.value = [{ id: 'fs1', elapsed: 0.3 }];
    armFloorSpikeTrigger('fs1');
    expect(floorSpikeTimerStates.value).toEqual([{ id: 'fs1', elapsed: 0.3 }]);
  });
});

describe('resetGame — floor spikes', () => {
  afterEach(() => {
    floorSpikeTimerStates.value = [];
  });

  it('clearsFloorSpikeTimerStates', () => {
    floorSpikeTimerStates.value = [{ id: 'fs1', elapsed: 0.3 }];
    resetGame();
    expect(floorSpikeTimerStates.value).toEqual([]);
  });
});

describe('falling stalactites — state and per-tick merge', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    currentMarkers.value = LEVEL_1_MARKERS;
    fallingStalactiteTimerStates.value = [];
    activeEffects.value = [];
  });

  it('fallingStalactiteTimerStates-startsEmpty', () => {
    expect(fallingStalactiteTimerStates.value).toEqual([]);
  });

  it('armFallingStalactiteTrigger-addsAZeroElapsedEntryAndIsIdempotent', () => {
    armFallingStalactiteTrigger('h1');
    expect(fallingStalactiteTimerStates.value).toEqual([{ id: 'h1', elapsed: 0 }]);
    armFallingStalactiteTrigger('h1');
    expect(fallingStalactiteTimerStates.value).toHaveLength(1);
  });

  it('tickFallingStalactites-advancesAndNeverPrunes', () => {
    armFallingStalactiteTrigger('h1');
    tickFallingStalactites(0.2);
    expect(fallingStalactiteTimerStates.value[0].elapsed).toBeCloseTo(0.2, 5);
    tickFallingStalactites(100);
    expect(fallingStalactiteTimerStates.value).toHaveLength(1);
  });

  it('hazardPlacementsForTick-mergesTheFallingStalactitePhaseAndOffsets', () => {
    currentLayout.value = ['S...', '.⊤..', '....', 'GGGG'];
    currentMarkers.value = [
      { col: 1, row: 1, marker: { kind: 'fallingStalactite' } },
    ];
    const hazard = hazardPlacements.value.find((h) => h.hazardType === 'fallingStalactite')!;

    const hanging = hazardPlacementsForTick().find((h) => h.id === hazard.id)!;
    expect(hanging.fallingStalactitePhase).toBe('hanging');
    expect(hanging.fallingStalactiteOffsetY).toBe(0);
    expect(hanging.fallingStalactiteShakeOffsetX).toBe(0);

    armFallingStalactiteTrigger(hazard.id);
    tickFallingStalactites(FALLING_STALACTITE_SHAKE_SECONDS / 2);
    const shaking = hazardPlacementsForTick().find((h) => h.id === hazard.id)!;
    expect(shaking.fallingStalactitePhase).toBe('shaking');
    expect(shaking.fallingStalactiteOffsetY).toBe(0);
  });

  it('hazardPlacementsForTick-passesOtherKindsThroughUnchanged', () => {
    currentLayout.value = ['S^..', '....', '....', 'GGGG'];
    const spike = hazardPlacements.value.find((h) => h.hazardType === 'spike')!;
    const merged = hazardPlacementsForTick().find((h) => h.id === spike.id)!;
    expect(merged).toBe(spike);
  });

  it('resetGame-clearsFallingStalactiteTimersButNotDebris', () => {
    armFallingStalactiteTrigger('h1');
    tickFallingStalactites(10);
    const debris = startDebrisEffect('d1', 0, 0, []);
    activeEffects.value = [debris];

    resetGame();

    expect(fallingStalactiteTimerStates.value).toEqual([]);
    expect(effectsOfKind<DebrisState>('debris')).toHaveLength(1);
    expect(effectsOfKind<DebrisState>('debris')[0]).toBe(debris);
  });

  it('resetGameProgress-clearsActiveDebrisEffects', () => {
    activeEffects.value = [startDebrisEffect('d1', 0, 0, [])];
    resetGameProgress();
    expect(effectsOfKind<DebrisState>('debris')).toEqual([]);
  });
});

describe('tile meta layer consumption', () => {
  afterEach(() => {
    currentLayout.value = LEVEL_1_LAYOUT;
    currentMarkers.value = LEVEL_1_MARKERS;
  });

  it('activeLevel-preservesMarkersThroughTheDeployableLadderOverride', () => {
    currentLayout.value = ['S..', '...', 'GGG'];
    currentMarkers.value = [{ col: 1, row: 1, marker: { kind: 'patrolBoundary' } }];
    expect(activeLevel.value.markers?.[1]?.[1]).toEqual({ kind: 'patrolBoundary' });
  });

  it('signPlacements-readsTheSignMarkersHint', () => {
    currentLayout.value = ['S.T', 'GGG'];
    currentMarkers.value = [{ col: 2, row: 0, marker: { kind: 'sign', hintId: 'bomb' } }];
    expect(signPlacements.value).toEqual([
      expect.objectContaining({ hintId: 'bomb', x: 2 * RENDERED_TILE_SIZE, y: 0 }),
    ]);
  });

  it('hazardPlacements-includesTheMarkerDerivedFallingStalactite', () => {
    currentLayout.value = ['S..', '.⊤.', 'GGG'];
    currentMarkers.value = [{ col: 1, row: 1, marker: { kind: 'fallingStalactite' } }];
    const hazard = hazardPlacements.value.find((h) => h.hazardType === 'fallingStalactite');
    expect(hazard).toBeDefined();
    expect(hazard).toEqual(
      expect.objectContaining({ hazardType: 'fallingStalactite', facing: 'down', col: 1, row: 1 }),
    );
  });
});

describe('R-004 US5 — unified effect collection lifecycle', () => {
  beforeEach(() => {
    activeEffects.value = [];
    mushroomSquashStates.value = [];
    floorSpikeTimerStates.value = [];
    crumblingFloorTimerStates.value = [];
    fallingStalactiteTimerStates.value = [];
  });

  afterEach(() => {
    activeEffects.value = [];
    mushroomSquashStates.value = [];
    floorSpikeTimerStates.value = [];
    crumblingFloorTimerStates.value = [];
    fallingStalactiteTimerStates.value = [];
  });

  it('resetGame-clearsOnlyDeathScopedEffectsAndTheFourTimedTileTimers', () => {
    const fade = startFadeOutTextEffect('f', 0, 0, 'x');
    const puff = startPuffEffect('p', 0, 0);
    const aura = startHealAuraEffect('h');
    const splatter = startPlayerHitSplatter('s', 0, 0, 1);
    const debris = startDebrisEffect('d', 0, 0, []);
    const explosion = startExplosionEffect('e', 0, 0);
    const flyingText = startFlyingText('fl', 't', 0, 0, 0, 0, 0, 0);
    const popup = startCounterPopup('coins', 1, 4);
    activeEffects.value = [fade, puff, aura, splatter, debris, explosion, flyingText, popup];
    mushroomSquashStates.value = [{ col: 0, row: 0, elapsed: 0 }];
    floorSpikeTimerStates.value = [{ id: 'h', elapsed: 0 }];
    crumblingFloorTimerStates.value = [{ col: 0, row: 0, elapsed: 0 }];
    fallingStalactiteTimerStates.value = [{ id: 'h', elapsed: 0 }];

    resetGame();

    // Only the death-scoped fade-out labels are cleared from the collection...
    expect(effectsOfKind<FadeOutTextState>('fadeOutText')).toEqual([]);
    // ...every other kind survives by reference.
    for (const survivor of [puff, aura, splatter, debris, explosion, flyingText, popup]) {
      expect(activeEffects.value).toContain(survivor);
    }
    // The four timed-tile timer arrays are cleared as before.
    expect(mushroomSquashStates.value).toEqual([]);
    expect(floorSpikeTimerStates.value).toEqual([]);
    expect(crumblingFloorTimerStates.value).toEqual([]);
    expect(fallingStalactiteTimerStates.value).toEqual([]);
  });

  it('resetGameProgress-clearsTheWholeCollection', () => {
    activeEffects.value = [startPuffEffect('p', 0, 0), startFadeOutTextEffect('f', 0, 0, 'x')];
    resetGameProgress();
    expect(activeEffects.value).toEqual([]);
  });

  it('advanceEffects-filteredToHitSplatter-advancesOnlySplattersAndFreezesTheRest', () => {
    const splatter = startPlayerHitSplatter('s', 0, 0, 1);
    const puff = startPuffEffect('p', 0, 0);
    activeEffects.value = [splatter, puff];

    activeEffects.value = advanceEffects(activeEffects.value, 0.2, { kinds: ['hitSplatter'] });

    expect(effectsOfKind<HitSplatterState>('hitSplatter')[0].elapsed).toBeCloseTo(0.2, 5);
    expect(effectsOfKind<PuffState>('puff')[0]).toBe(puff);
    expect(effectsOfKind<PuffState>('puff')[0].elapsed).toBe(0);
  });
});
