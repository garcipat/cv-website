import {
  playerState,
  cameraPositionX,
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
  collectedCollectibleIds,
  activeEffects,
} from './PlatformerState';
import { mapCVDataToEnemies } from './level/EnemyMapper';
import { currentCV } from '@/state/locale';
import { MAX_HALF_HEARTS } from './entities/Health';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE } from './level/level1';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
} from './entities/Player';

describe('PlatformerState', () => {
  it('collectedFacts-initial-isEmpty', () => {
    expect(collectedFacts.value).toEqual([]);
  });

  it('collectiblePlacements-initial-isNonEmptyAndMatchesCVData', () => {
    // Real CVData has skill categories + languages — exact count isn't
    // pinned here (that's CollectibleMapper.test.ts's job against fixture
    // data), just that real data produces a real, non-trivial list.
    expect(collectiblePlacements.length).toBeGreaterThan(0);
  });

  it('enemyPlacements-initial-oneEnemyPerLevelMarkerNotPerFullCVData', () => {
    // level1 currently has exactly one `E` and one `M` marker — placement
    // count tracks the level's markers, not CVData's (larger) certificate/
    // project counts. This is expected for a mechanics-test level (see
    // level1.ts's doc comment), not a regression.
    const allPossibleDefs = mapCVDataToEnemies(currentCV.value);
    expect(allPossibleDefs.length).toBeGreaterThan(enemyPlacements.length);
    expect(enemyPlacements.filter((p) => p.spriteType === 'slimeGreen')).toHaveLength(1);
    expect(enemyPlacements.filter((p) => p.spriteType === 'slimePurple')).toHaveLength(1);
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
    const spawnCell = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
    const expectedX = spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
    expect(playerState.value.x).toBe(expectedX);
  });

  it('playerState-initial-feetRestOnGroundBelowSpawnTile', () => {
    const spawnCell = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
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
});

describe('resetGameProgress', () => {
  afterEach(() => {
    collectedFacts.value = [];
    collectedCollectibleIds.value = new Set();
    activeJournalSection.value = undefined;
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
});

describe('activeJournalSection', () => {
  it('initialValue-onModuleLoad-isUndefined', () => {
    // undefined until the user manually picks a bookmark tab — Journal.tsx
    // falls back to defaulting from the first collected fact this session
    // (`facts[0]`, not the most recently collected one).
    expect(activeJournalSection.value).toBeUndefined();
  });
});
