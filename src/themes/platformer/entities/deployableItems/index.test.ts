import { describe, it, expect } from 'vitest';
import {
  DEPLOYABLE_ITEM_TYPES,
  applyDeployableItemTerrain,
  proposeDeployableItemInteraction,
} from './index';
import { createRopeLadderState } from './RopeLadder';
import { toChestState } from '../chests';
import type { ChestPlacement } from '../../level/ChestMapper';
import { parseLevel } from '../../level/LevelParser';
import { tileAt } from '../../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING, PLAYER_HIT_REACTION_SECONDS } from '../Player';
import type { PlayerState } from '../Player';

function makePlayer(x: number, y: number, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    crouching: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    prevFeetY: y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
    ...overrides,
  };
}

function makeChest(id = 'chest-1', x = 0, y = 0) {
  const placement: ChestPlacement = {
    id,
    col: 0,
    row: 0,
    x,
    y,
    fact: {
      id,
      sectionId: 'experience',
      sectionLabel: 'Experience',
      data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
      sourceType: 'chest',
    },
  };
  return toChestState(placement);
}

describe('DEPLOYABLE_ITEM_TYPES', () => {
  it('hasABombLadderAndChestSlotWhoseEntryKeyEqualsItsSlot', () => {
    expect(Object.keys(DEPLOYABLE_ITEM_TYPES).sort()).toEqual(['bomb', 'chest', 'ladder']);
    for (const [key, type] of Object.entries(DEPLOYABLE_ITEM_TYPES)) {
      expect(type.key).toBe(key);
    }
  });
});

describe('applyDeployableItemTerrain', () => {
  const level = parseLevel(['@', '.', 'G']);

  it('nothingContributes-returnsTheSameLevelObject', () => {
    const rolled = createRopeLadderState(level, 0, 0);
    expect(applyDeployableItemTerrain(level, [rolled])).toBe(level);
    expect(applyDeployableItemTerrain(level, [])).toBe(level);
  });

  it('deployedLadderWritesRopeLadderCellsFromBundleRowToLandingRow', () => {
    const deployed = { ...createRopeLadderState(level, 0, 0), phase: 'deployed' as const };
    const effective = applyDeployableItemTerrain(level, [deployed]);
    expect(tileAt(effective, 0, 0)).toBe('ropeLadder');
    expect(tileAt(effective, 0, 1)).toBe('ropeLadder');
    // The solid landing row is untouched.
    expect(tileAt(effective, 0, 2)).toBe('groundGrass');
  });

  it('doesNotMutateTheInputLevel', () => {
    const deployed = { ...createRopeLadderState(level, 0, 0), phase: 'deployed' as const };
    applyDeployableItemTerrain(level, [deployed]);
    expect(tileAt(level, 0, 0)).toBe('ladderBundle');
  });

  it('twoContributionsBothFoldInCollectionOrder', () => {
    const multi = parseLevel(['@.@', 'G.G']);
    const left = { ...createRopeLadderState(multi, 0, 0), phase: 'deployed' as const };
    const right = { ...createRopeLadderState(multi, 2, 0), phase: 'deployed' as const };
    const effective = applyDeployableItemTerrain(multi, [left, right]);
    expect(tileAt(effective, 0, 0)).toBe('ropeLadder');
    expect(tileAt(effective, 2, 0)).toBe('ropeLadder');
    expect(tileAt(effective, 1, 0)).toBe('empty');
  });
});

describe('proposeDeployableItemInteraction', () => {
  // A grounded player at the origin stands on the col-0 bundle and overlaps a
  // chest at the same tile, so both interactables match one press.
  const level = parseLevel(['@', 'G']);
  const ladder = createRopeLadderState(level, 0, 0);
  const chest = makeChest('chest-1', 0, 0);
  const player = makePlayer(0, 0);

  it('bestInteractionPriorityWins-ladderZeroBeatsChestOne', () => {
    const interaction = proposeDeployableItemInteraction([ladder, chest], {
      level,
      player,
      keys: 3,
    });
    expect(interaction.activate?.id).toBe('ladder-bundle-0-0');
    expect(interaction.hint).toBeUndefined();
  });

  it('chestAloneWithAKey-returnsItsActivationWithKeyCostAndReveal', () => {
    const interaction = proposeDeployableItemInteraction([chest], { level, player, keys: 3 });
    expect(interaction.activate?.id).toBe('chest-1');
    expect(interaction.activate?.keyCost).toBe(1);
    expect(interaction.activate?.next.id).toBe('chest-1');
    expect(interaction.activate?.reveal?.fact).toBe(chest.fact);
  });

  it('chestAloneWithNoKey-returnsOnlyTheBlockedHint', () => {
    expect(proposeDeployableItemInteraction([chest], { level, player, keys: 0 })).toEqual({
      hint: 'noKeyForChest',
    });
  });

  it('nothingMatches-returnsAnEmptyInteraction', () => {
    const airborne = makePlayer(1000, 0, { grounded: false });
    expect(
      proposeDeployableItemInteraction([ladder, chest], { level, player: airborne, keys: 3 }),
    ).toEqual({});
    expect(proposeDeployableItemInteraction([], { level, player, keys: 3 })).toEqual({});
  });

  it('severalMatches-produceAtMostOneActivation', () => {
    const interaction = proposeDeployableItemInteraction([ladder, ladder, chest], {
      level,
      player,
      keys: 3,
    });
    expect(interaction.activate).toBeDefined();
    expect(Object.keys(interaction)).toEqual(['activate']);
  });
});
