# Patterns

A living catalog of recurring problems in this codebase and the solutions we've settled on. Use
it to avoid re-inventing an approach, and to record one once it is actually in use.

Related: [Architecture](Architecture.md) (overview + key patterns) ·
[Coding Guidelines](CodingGuidelines.md) ·
[Platformer Architecture Analysis](PlatformerArchitectureAnalysis.md).

## How to add a pattern

Copy the template below. Keep entries short and concrete; link the modules that demonstrate the
pattern rather than pasting large code blocks. Only add patterns that are **actually in use**.

````md
## Pattern: <name>
**Status**: adopted
**Problem**: <the recurring problem>
**Solution**: <the shape of the fix, small code sketch>
**Trade-offs / when not to use**: <limits>
````

---

## Pattern: Shared output contract — producers implement, the renderer consumes

**Status**: adopted (introduced by R-003)

**Problem**: several sources of light (wall torches, the player's carried light, and future
emitters) all feed one shared rendering concern. Wiring each source into the draw passes
individually produces a copy of the same punch/glow block per source, plus a matching source-check
in every consumer — so adding an emitter means editing the renderer.

**Solution**: define one small output type (`LightSource`) that any producer can return. The app
collects producers' outputs into a single `readonly LightSource[]`; every consumer loops over that
list and never names a producer.

```ts
// contracts/lighting.ts — the shared output
interface LightSource {
  x; y; radius; color; intensity; glowMidAlpha; punchHole;
}

// producers (any module): (source, worldElapsed) => LightSource
// consumers (engine): loop over the list, no producer branches
function drawDarkness(…, lights: readonly LightSource[], …): void { … }
function localDarknessAt(x, y, darknessLevel, lights: readonly LightSource[]): number { … }
```

**Trade-offs / when not to use**: each producer still needs its own adapter (positions and
cardinality differ), and radii are resolved once per frame at the caller's `worldElapsed`. If a
concern has a single producer and a single consumer, a shared output type is unnecessary overhead.
