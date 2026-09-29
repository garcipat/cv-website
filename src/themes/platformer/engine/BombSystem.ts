/**
 * Resolves bomb blasts into a declarative delta for the page to apply. It
 * consumes the `BlastRequest`s the deployable-item pass returns (fuse and
 * detonation stay in `entities/deployableItems/Bomb.ts`, geometry in
 * `engine/Blast.ts`); it writes no state and imports no `state/` module.
 *
 * Phases per blast, in order: blast tiles → blocks driven to terminal → enemies
 * hit → at most one player effect list for the whole tick → one explosion.
 */
import type { BlastRequest } from '../entities/deployableItems/DeployableItemType';
import type { LevelDef } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE, PLAYER_HIT_REACTION_SECONDS } from '../entities/Player';
import type { EnemyState } from '../entities/Enemy';
import type { BlockState } from '../entities/Block';
import type { HitEffect } from '../contracts/HitEffect';
import { isInvulnerable } from '../contracts/capabilities';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { BLOCK_TYPES } from '../entities/blocks';
import { blastTiles, blocksInBlast, enemiesInBlast, playerInBlast } from './Blast';
import { playerHitbox } from './Collision';
import { resolveHitEffects } from './HitResolver';
import { DEFAULT_HIT_KNOCKBACK } from '../shared/knockback';

/** Half-heart units a blast deals — one full heart. */
export const BOMB_DAMAGE = 2;

export interface BlastWorld {
  readonly level: LevelDef;
  readonly player: PlayerState;
  readonly blocks: readonly BlockState[];
  readonly enemies: readonly EnemyState[];
}

export interface BlastDelta {
  readonly blocks: readonly BlockState[];
  /** Blocks driven to terminal this tick — the caller runs its terminal applier. */
  readonly terminalBlockIds: readonly string[];
  readonly enemies: readonly EnemyState[];
  readonly damagedEnemyIds: readonly string[];
  /** At most one damage-bearing player effect list across all blasts. */
  readonly playerEffects?: readonly HitEffect[];
  /** Present only when the hit leaves the player alive. */
  readonly playerSplatter?: { readonly side: -1 | 0 | 1; readonly id: string };
  readonly explosions: readonly { id: string; x: number; y: number }[];
}

export function resolveBlasts(blasts: readonly BlastRequest[], world: BlastWorld): BlastDelta {
  let blocks = world.blocks.slice();
  let enemies = world.enemies.slice();
  const terminalBlockIds: string[] = [];
  const terminalBlockIdSet = new Set<string>();
  const damagedEnemyIds: string[] = [];
  const explosions: { id: string; x: number; y: number }[] = [];
  let playerEffects: HitEffect[] | undefined;
  let playerSplatter: { side: -1 | 0 | 1; id: string } | undefined;

  for (const blast of blasts) {
    const tiles = blastTiles(blast.col, blast.row, world.level.width, world.level.height);

    // A question-mark never leaves the world and a used-up block is inert, so
    // `blocksInBlast` excludes both.
    const blastedBlocks = blocksInBlast(blocks, tiles);
    if (blastedBlocks.length > 0) {
      const blastIds = new Set(blastedBlocks.map((block) => block.id));
      for (const id of blastIds) {
        if (terminalBlockIdSet.has(id)) continue;
        terminalBlockIdSet.add(id);
        terminalBlockIds.push(id);
      }
      blocks = blocks.map((block) => {
        if (!blastIds.has(block.id)) return block;
        return resolveHitEffects(block, [
          { type: 'damage', amount: BLOCK_TYPES[block.blockKind].maxHits },
        ]).block;
      });
    }

    const blastedEnemies = enemiesInBlast(enemies, tiles, RENDERED_TILE_SIZE);
    if (blastedEnemies.length > 0) {
      const blastEnemyIds = new Set(blastedEnemies.map((enemy) => enemy.id));
      enemies = enemies.map((enemy) => {
        if (!blastEnemyIds.has(enemy.id)) return enemy;
        const hit = resolveHitEffects(enemy, [
          { type: 'damage', amount: BOMB_DAMAGE },
          { type: 'reaction' },
        ]);
        if (hit.damaged && !damagedEnemyIds.includes(enemy.id)) damagedEnemyIds.push(enemy.id);
        return hit.enemy;
      });
    }

    // Latch so overlapping blasts cost the player one hit, and push away from
    // the blast centre (a crouched hit takes the damage but no push).
    if (
      playerEffects === undefined &&
      !isInvulnerable(world.player, PLAYER_HIT_REACTION_SECONDS) &&
      playerInBlast(playerHitbox(world.player), tiles, RENDERED_TILE_SIZE)
    ) {
      const bombCenterX = blast.x + RENDERED_TILE_SIZE / 2;
      const direction: -1 | 1 = world.player.x + PLAYER_RENDERED_SIZE / 2 <= bombCenterX ? -1 : 1;
      const effects: HitEffect[] = [{ type: 'damage', amount: BOMB_DAMAGE }, { type: 'reaction' }];
      if (!world.player.crouching) {
        effects.push({
          type: 'velocity',
          x: direction * DEFAULT_HIT_KNOCKBACK.vx,
          duration: DEFAULT_HIT_KNOCKBACK.duration,
        });
      }
      // `takeDamage` clamps, so a positive remainder is the "survives" test.
      if (world.player.hitPoints > BOMB_DAMAGE) {
        playerSplatter = { side: direction === 1 ? -1 : 1, id: blast.hitEffectId };
      }
      playerEffects = effects;
    }

    explosions.push({
      id: blast.effectId,
      x: blast.x + RENDERED_TILE_SIZE / 2,
      y: blast.y + RENDERED_TILE_SIZE / 2,
    });
  }

  return {
    blocks,
    terminalBlockIds,
    enemies,
    damagedEnemyIds,
    playerEffects,
    playerSplatter,
    explosions,
  };
}
