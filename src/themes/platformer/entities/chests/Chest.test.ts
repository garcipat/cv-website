import { describe, it, expect, vi } from 'vitest';
import {
  toChestState,
  isChestState,
  isChestOpen,
  openChest,
  allChestsOpen,
  chestDeployableItem,
  CHEST_CLOSED_WIDTH,
  CHEST_CLOSED_HEIGHT,
  CHEST_OPEN_WIDTH,
  CHEST_OPEN_HEIGHT,
  CHEST_CLOSED_RENDERED_WIDTH,
  CHEST_CLOSED_RENDERED_HEIGHT,
  CHEST_OPEN_RENDERED_WIDTH,
  CHEST_OPEN_RENDERED_HEIGHT,
  CHEST_CLOSED_OFFSET_X,
  CHEST_OPEN_OFFSET_X,
} from './Chest';
import type { ChestState } from './Chest';
import type { ChestPlacement } from '../../level/ChestMapper';
import { CHEST_CLOSED_SHEET, CHEST_OPEN_SHEET } from '../sprites/sheets';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_HIT_REACTION_SECONDS,
} from '../Player';
import type { PlayerState } from '../Player';
import type { DrawContext } from '../../contracts/DrawContext';

const placement: ChestPlacement = {
  id: 'chest-exp-x',
  col: 0,
  row: 0,
  x: 100,
  y: 200,
  fact: {
    id: 'chest-exp-x',
    sectionId: 'experience',
    sectionLabel: 'Experience',
    data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
    sourceType: 'chest',
  },
};

function makePlayer(x: number, y: number): PlayerState {
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
  };
}

describe('toChestState', () => {
  it('placement-converts-toClosedStateCarryingKindAndTile', () => {
    expect(toChestState(placement)).toEqual({
      id: placement.id,
      kind: 'chest',
      col: placement.col,
      row: placement.row,
      x: placement.x,
      y: placement.y,
      state: 'closed',
      fact: placement.fact,
    });
  });
});

describe('isChestState', () => {
  it('chestKind-returnsTrue-andOtherKindsReturnFalse', () => {
    expect(isChestState(toChestState(placement))).toBe(true);
    expect(
      isChestState({ id: 'b', kind: 'bomb', col: 0, row: 0, x: 0, y: 0 }),
    ).toBe(false);
  });
});

describe('isChestOpen', () => {
  it('closedState-returns-false', () => {
    expect(isChestOpen(toChestState(placement))).toBe(false);
  });

  it('openState-returns-true', () => {
    expect(isChestOpen(openChest(toChestState(placement)))).toBe(true);
  });
});

describe('openChest', () => {
  it('closedChest-becomes-open', () => {
    const opened = openChest(toChestState(placement));
    expect(opened.state).toBe('open');
  });

  it('alreadyOpenChest-staysOpen-sameReference', () => {
    const opened = openChest(toChestState(placement));
    expect(openChest(opened)).toBe(opened);
  });
});

describe('allChestsOpen', () => {
  it('emptyArray-returns-false', () => {
    expect(allChestsOpen([])).toBe(false);
  });

  it('someClosed-returns-false', () => {
    const chests = [toChestState(placement), openChest(toChestState({ ...placement, id: 'chest-exp-y' }))];
    expect(allChestsOpen(chests)).toBe(false);
  });

  it('allOpen-returns-true', () => {
    const chests = [
      openChest(toChestState(placement)),
      openChest(toChestState({ ...placement, id: 'chest-exp-y' })),
    ];
    expect(allChestsOpen(chests)).toBe(true);
  });
});

describe('chestDeployableItem.onPlayerInteract', () => {
  const closedChest: ChestState = toChestState({ ...placement, x: 100, y: 100 });

  it('playerOverlappingClosedChest-returnsAnActivateOutcomeWithKeyCostAndReveal', () => {
    const player = makePlayer(closedChest.x, closedChest.y);
    expect(chestDeployableItem.onPlayerInteract(closedChest, { level: null as never, player, keys: 1 })).toEqual({
      kind: 'activate',
      state: openChest(closedChest),
      keyCost: 1,
      reveal: {
        fact: closedChest.fact,
        effectId: closedChest.id,
        x: closedChest.x + CHEST_CLOSED_OFFSET_X,
        y: closedChest.y,
      },
    });
  });

  it('playerOverlappingClosedChestWithNoKey-returnsTheBlockedHint', () => {
    const player = makePlayer(closedChest.x, closedChest.y);
    expect(chestDeployableItem.onPlayerInteract(closedChest, { level: null as never, player, keys: 0 })).toEqual({
      kind: 'blocked',
      hint: 'noKeyForChest',
    });
  });

  it('playerFarFromAnyChest-returnsNull', () => {
    const player = makePlayer(closedChest.x + 1000, closedChest.y);
    expect(chestDeployableItem.onPlayerInteract(closedChest, { level: null as never, player, keys: 1 })).toBeNull();
  });

  it('alreadyOpenChest-isIgnored-evenWhileOverlapping', () => {
    const openChestState: ChestState = openChest(closedChest);
    const player = makePlayer(openChestState.x, openChestState.y);
    expect(
      chestDeployableItem.onPlayerInteract(openChestState, { level: null as never, player, keys: 1 }),
    ).toBeNull();
  });

  it('playerOverlappingOnlyTheOffsetShiftedRegion-stillMatches', () => {
    // The closed box's x is chest.x + CHEST_CLOSED_OFFSET_X (a negative
    // number), so its left edge sits to the LEFT of chest.x. A player hitbox
    // at x 52 overlaps that shifted-left sliver (box spans 93.6..138.4) but
    // would miss a box that started at chest.x unshifted entirely — this is
    // the case a dropped offset breaks.
    const player = makePlayer(52, closedChest.y);
    expect(
      chestDeployableItem.onPlayerInteract(closedChest, { level: null as never, player, keys: 1 }),
    ).not.toBeNull();
  });
});

describe('chestDeployableItem.draw', () => {
  function makeDrawContext(
    sprites: Record<string, HTMLImageElement | null> = {
      [CHEST_CLOSED_SHEET.src]: { tag: 'closed' } as unknown as HTMLImageElement,
      [CHEST_OPEN_SHEET.src]: { tag: 'open' } as unknown as HTMLImageElement,
    },
  ): DrawContext {
    return {
      ctx: { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D,
      sprites,
      originX: 0,
      originY: 0,
      worldElapsed: 0,
    };
  }

  it('closedChest-drawsFromClosedSprite-atNativeSize', () => {
    const dc = makeDrawContext();
    const chest = toChestState({ ...placement, x: 10, y: 20 });

    chestDeployableItem.draw(chest, dc);

    expect(dc.ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[CHEST_CLOSED_SHEET.src],
      0,
      0,
      CHEST_CLOSED_WIDTH,
      CHEST_CLOSED_HEIGHT,
      10 + CHEST_CLOSED_OFFSET_X,
      20,
      CHEST_CLOSED_RENDERED_WIDTH,
      CHEST_CLOSED_RENDERED_HEIGHT,
    );
  });

  it('openChest-drawsFromOpenSprite-atItsOwnNativeSize', () => {
    const dc = makeDrawContext();
    const chest = openChest(toChestState({ ...placement, x: 10, y: 20 }));

    chestDeployableItem.draw(chest, dc);

    expect(dc.ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[CHEST_OPEN_SHEET.src],
      0,
      0,
      CHEST_OPEN_WIDTH,
      CHEST_OPEN_HEIGHT,
      10 + CHEST_OPEN_OFFSET_X,
      20,
      CHEST_OPEN_RENDERED_WIDTH,
      CHEST_OPEN_RENDERED_HEIGHT,
    );
  });

  it('missingSpriteForCurrentState-skipsThatChest-noThrow', () => {
    const dc = makeDrawContext({ [CHEST_CLOSED_SHEET.src]: null, [CHEST_OPEN_SHEET.src]: null });
    const chest = toChestState(placement);

    expect(() => chestDeployableItem.draw(chest, dc)).not.toThrow();
    expect(dc.ctx.drawImage).not.toHaveBeenCalled();
  });
});
