import { slugId } from './ids';
import { placeAtMarkers } from './placement';
import type { CVData, SkillCategory, Skill } from '@/types/cv';
import type { CollectedFact } from '../types';
import type { Pickup } from '../contracts/Pickup';

function categoryToSkillFact(category: SkillCategory): CollectedFact {
  const skills: Skill[] = [
    ...category.skills,
    ...(category.sections?.flatMap((s) => s.skills) ?? []),
  ];
  return {
    id: slugId('coin', category.category),
    sectionId: 'skills',
    sectionLabel: 'Skills',
    data: { category: category.category, skills },
    sourceType: 'coin',
  };
}

/**
 * The ordered pool of skill-category facts a coin can reveal, one per
 * CVData skill category, in CVData's own order.
 *
 * Unlike every other reward source (a crate/question-mark/enemy/chest each
 * carries ONE specific CV item it alone reveals), a coin is a plain
 * position — see `CollectiblePlacement` below — with no fact bound to it at
 * creation. This is deliberate — which physical coin maps to which skill
 * category was never meaningful to a player, so binding them at placement
 * time only bought fragility (the level's coin-marker count had to exactly
 * match CVData's skill count, or a coin-pot's leftover-defs bookkeeping
 * could silently run dry).
 *
 * HOW MANY of this pool's entries have been revealed as of a given
 * collected-coin count — and therefore which entry a specific pickup
 * reveals — is resolved dynamically at collection time
 * (`PlatformerPage.tsx`), via `level/SkillFactPacing.ts`'s
 * `revealedFactCountFor`: see that function's doc comment for the exact
 * proportional-fill rule (it spreads this pool's entries evenly across
 * every coin the level has, so a level with more coins than skill
 * categories never has a coin that reveals nothing, and a level with fewer
 * still reaches every category by the time everything is collected).
 */
export function mapCVDataToSkillFactPool(cv: CVData): CollectedFact[] {
  return cv.skills.map(categoryToSkillFact);
}

/**
 * A placed coin collectible — purely positional (see
 * `mapCVDataToSkillFactPool`'s doc comment for why a coin carries no fact of
 * its own). Composes the shared `Pickup` base with `kind: 'coin'`, so the
 * generic collision and draw paths treat a placed coin like any other kind.
 * `id` is derived from its marker position, stable and unique; its `collected`
 * flag lives on the mutable `PlatformerState.baseCoinPlacements` (so it
 * survives death/respawn and is cleared only by a full reset).
 */
export interface CollectiblePlacement extends Pickup {
  kind: 'coin';
}

/**
 * Places one coin per hand-authored `o` marker (LevelParser.ts's
 * findCoinTiles). There is no auto-placement: a collectible's position is
 * always exactly where a level author put its marker, mirroring
 * EnemyMapper.ts's placeEnemies/BlockMapper.ts's placeBlocks.
 *
 * A question-mark block's reward is NOT placed here — a hit `Q` spawns its own
 * rising fruit (`entities/pickups/Fruit.ts`'s `spawnFruit`), so the former
 * dormant placed-fruit branch and its `CollectibleMarkerPositions.fruit` field
 * were removed. This path is coin-only.
 */
export function placeCollectibles(
  coinMarkers: readonly { col: number; row: number }[],
): CollectiblePlacement[] {
  return placeAtMarkers(coinMarkers, {
    idPrefix: 'coin',
    build: () => ({ kind: 'coin', collected: false }),
  });
}
