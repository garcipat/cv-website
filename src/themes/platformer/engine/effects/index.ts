/**
 * Public barrel for the unified platformer transient-effect subsystem
 * (R-004). This is the single import site for consumers: the base type and
 * collection operations, the registry and its kinds, the one draw dispatch,
 * the shared particle producer, and every per-kind module's public API.
 *
 * Adding a new effect is one module plus one registry line — see
 * `docs/TransientEffectRecipe.md`.
 */
export * from './transientEffect';
export * from './registry';
export * from './drawEffects';
export * from './particles';
export * from './flight';
export * from './counterPopup';
export * from './puff';
export * from './healAura';
export * from './hitSplatter';
export * from './fadeOutText';
export * from './explosion';
export * from './debris';
