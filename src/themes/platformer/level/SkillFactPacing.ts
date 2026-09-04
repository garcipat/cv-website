/**
 * How many skill-category facts should be revealed once `coinsCollected`
 * coins (out of `totalCoinCount` the level actually has) have been picked
 * up this session, out of a pool of `poolLength` facts.
 *
 * Facts are spread PROPORTIONALLY across every coin the level has, rather
 * than the first `poolLength` coins each revealing one fact and every coin
 * after that revealing nothing: `floor(coinsCollected * poolLength /
 * totalCoinCount)`. This means a level with more coins than CVData facts
 * still makes every single coin count toward the next reveal instead of
 * some coins being permanently "dead" (there's a reason to collect all of
 * them, not just the first N) — and a level with fewer coins than facts
 * (unusual, but handled) reveals more than one fact on some pickups rather
 * than leaving facts forever unreachable. When `coinsCollected ===
 * totalCoinCount`, this always equals `poolLength` exactly (every fact is
 * reachable by collecting everything), and when `totalCoinCount ===
 * poolLength` (the common case), one coin reveals exactly one fact each,
 * in order — matching the simpler model this generalizes.
 *
 * `totalCoinCount <= 0` returns 0 unconditionally (nothing to divide by,
 * and there's nothing to reveal from an empty level anyway).
 */
export function revealedFactCountFor(
  coinsCollected: number,
  totalCoinCount: number,
  poolLength: number,
): number {
  if (totalCoinCount <= 0) return 0;
  return Math.floor((coinsCollected * poolLength) / totalCoinCount);
}
