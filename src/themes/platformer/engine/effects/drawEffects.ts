/**
 * The single layer-filtered effect draw pass (R-004 FR-005). It iterates the
 * registry in declaration order, drawing only entries whose `layer` matches,
 * and within a kind the collection's effects in insertion order — so
 * intra-layer order is preserved. The page invokes this once per pipeline
 * layer (midWorld/worldEffects/aboveWorld/hudLast), never collapsing depth.
 */
import { EFFECT_REGISTRY, type EffectLayer, type EffectRegistryEntry } from './registry';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/**
 * The single layer-filtered effect draw pass (R-004 FR-005). `drawEffects` is
 * the one dispatch; `drawEffectsFrom` is its registry-parameterized core, used
 * by the contributor-recipe regression test to prove a freshly registered kind
 * is picked up (see docs/TransientEffectRecipe.md).
 */
export function drawEffects(
  rc: EffectRenderContext,
  layer: EffectLayer,
  effects: readonly TransientEffect<unknown>[],
): void {
  drawEffectsFrom(EFFECT_REGISTRY, rc, layer, effects);
}

export function drawEffectsFrom(
  registry: readonly EffectRegistryEntry<unknown>[],
  rc: EffectRenderContext,
  layer: EffectLayer,
  effects: readonly TransientEffect<unknown>[],
): void {
  const rcWithEffects: EffectRenderContext = { ...rc, effects };
  for (const entry of registry) {
    if (entry.layer !== layer) continue;
    for (const effect of effects) {
      if (effect.kind !== entry.kind) continue;
      entry.draw(effect, rcWithEffects);
    }
  }
}
