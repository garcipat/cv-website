# Space Background Animations — Design Spec

**Created**: 2026-06-21
**Status**: Design Approved
**Parent Feature**: F-003 (Space Theme)
**Context**: Make the space theme less static by adding animated background elements — spaceships, planets, shooting stars, asteroids, satellites — that move as the user scrolls.

---

## Design Decisions

### Two-Layer Architecture

| Layer | z-index | Behavior | Interaction |
|-------|---------|----------|-------------|
| **Ambient** | z-0 | CSS-only `@keyframes`, always running, independent of scroll | `pointer-events: none` |
| **Scroll-Driven** | z-5 | Position = f(scrollOffset), deterministic, once-through (no looping) | `pointer-events: none` |

Existing CircleParade sits at z-10, so scroll-driven elements are always **behind** CV content circles. They never interfere with readability.

### Element Roster

**Ambient Layer (CSS-only)**:
- **Nebula Clouds** — 3–4 large blurred color blobs (pink, blue, purple), `filter: blur(80px)`, drifting via `@keyframes` over 60–90s cycles
- **Sun** — Toned-down warm radial gradient, bottom-right corner, `opacity: ~0.15`, subtle pulse `@keyframes`
- **Starfield** — Existing 100+ twinkling stars, keep as-is

**Scroll-Driven Layer**:
- **Ringed Planet** — Slow horizontal drift spanning ~92% of total scroll. Scales 0.3→0.9→0.4. Subtle ring rotation.
- **Futurama Ship** (Planet Express) — Recognizable green/red silhouette. Ease-in-out sweep across ~55% of scroll span, sine-wave bobbing, flickering engine flame.
- **Satellite** — Retro space probe with solar panels, spinning 0→720°, blinking red light on antenna. Linear cross over ~42% of span.
- **Shooting Stars** ×5–6 — Quick diagonal zips (top-right→bottom-left), bright head + fading trail. Spread across full span with ~3vh gaps. Each active for ~6% of span.
- **Asteroids** ×3 — Irregular tumbling rocks with craters. Full 360° rotation while crossing. Each active for ~14% of span.

### No Looping

Elements appear once across the full scroll span. Once they exit their scroll range, they're gone. Scrolling back up reverses through the same range deterministically (the element comes back into view in reverse). This creates a genuine sense of traversal rather than a mechanical loop.

No element respawns. No element is reused.

### Element Distribution & Overlap

Elements are staggered across the full scroll span with natural overlaps. At most ~3–4 scroll-driven elements are visible simultaneously at any scroll position. The `generateElementConfigs()` function distributes entries with randomized gaps between each element's exit offset and the next element's entry offset (minimum gap = 1.0vh). Overlap is fine and expected — a shooting star and asteroid can cross simultaneously — since elements occupy different screen regions and z-depths.

### Visual Rendering

All elements are pure CSS shapes (divs with `border-radius`, `background`, `box-shadow`, `transform`) — no SVG imports, no canvas, no images. Ship body/wings/nose/flame are nested divs with gradient backgrounds. Planet is a `radial-gradient` circle. Shooting star is a small bright dot with a `linear-gradient` pseudo-element trail. Asteroid is an irregular `border-radius` blob. Satellite is nested divs for body, panels, and antenna. This keeps the approach consistent with the existing codebase (Starfield uses the same technique).

### Dynamic Scroll Span

Total scroll span is computed from CV data:
```
totalSpan = entries.length × 1.4 + 1.0  (viewport-height units)
```

Element entry/exit offsets are scaled proportionally to `totalSpan`. A CV with 20 entries (29vh span) naturally spreads elements wider than one with 5 entries (8vh span).

### Signal-Based Scroll Sharing

SpacePage owns:
- The scroll container
- A single `onScroll` handler (rAF-throttled)
- A `scrollOffset` signal: `signal(0)`

```
// SpacePage.tsx
const scrollOffset = signal(0);

// onScroll: scrollOffset.value = container.scrollTop / window.innerHeight
```

Both `CircleParade` and `SpaceParade` consume `scrollOffset` as a prop (the signal). CircleParade's internal scroll listener and `useState` are removed — it becomes a pure renderer.

**Refactor boundaries**: SpacePage renders the scroll container `<div>` + spacer `<div>` (currently inside CircleParade). CircleParade renders only the fixed stage overlay + 7 circle pool slots. The `containerRef` for `scrollTo()` navigation (AnchorDots clicks) lives in SpacePage and is passed to AnchorDots as before. This keeps the scroll container as a single source of truth at the SpacePage level.

### Motion Formula

Each scroll-driven element computes its position from `scrollOffset`:

```typescript
// For element with config { entryOffset, exitOffset, startX, endX, baseY, easing, ... }
const t = (scrollOffset - entryOffset) / (exitOffset - entryOffset);
const easedT = easingFunction(clamp(t, 0, 1));

const x = lerp(startX, endX, easedT);
const y = baseY + Math.sin(easedT * PI * waves) * amplitude;
const scale = scaleProfile(easedT);
const rotation = lerp(rotationStart, rotationEnd, easedT);
const opacity = edgeFade(easedT);
// edgeFade: opacity 0 at t=0, ramps to 1 by t=0.12 (ease-out), holds at 1 through t=0.88,
//           ramps to 0 by t=1 (ease-in). Mirrors the fade phases in computeCircleTransform().

element.style.transform = `translate(${x}vw, ${y}vh) scale(${scale}) rotate(${rotation}deg)`;
```

Same pattern as `computeCircleTransform()` in `parade-utils.ts` — GPU-composited, no layout thrashing.
`edgeFade` mirrors the existing 3-phase opacity model: entry fade-in, full-opacity display, exit fade-out.

### Reduced Motion

When `prefers-reduced-motion: reduce`:
- **Ambient layer**: Elements still render but without animation (static nebula, dim stars, static sun)
- **Space parade**: Completely hidden — no scroll-driven elements
- **Circle parade**: Existing fallback to static vertical stack (unchanged)

---

## Files

### New

| File | Role |
|------|------|
| `src/themes/space/components/SpaceParade.tsx` | Scroll-driven element manager — reads `scrollOffset`, computes positions, renders element components |
| `src/themes/space/components/space-elements/Nebula.tsx` | Ambient CSS-only nebula clouds |
| `src/themes/space/components/space-elements/Sun.tsx` | Ambient CSS-only pulsing corner sun |
| `src/themes/space/components/space-elements/FuturamaShip.tsx` | Scroll-driven Planet Express ship |
| `src/themes/space/components/space-elements/ShootingStar.tsx` | Scroll-driven comet with trail |
| `src/themes/space/components/space-elements/RingedPlanet.tsx` | Scroll-driven planet with rings |
| `src/themes/space/components/space-elements/Asteroid.tsx` | Scroll-driven tumbling rock |
| `src/themes/space/components/space-elements/Satellite.tsx` | Scroll-driven spinning probe |
| `src/themes/space/components/space-elements/types.ts` | Motion profile types |
| `src/themes/space/space-parade-utils.ts` | Pure functions: element position math, element config generation |
| `src/themes/space/space-parade-utils.test.ts` | Unit tests for position math |

### Modified

| File | Change |
|------|--------|
| `src/themes/space/SpacePage.tsx` | Add ambient layer (Nebula, Sun), add SpaceParade, create `scrollOffset` signal, own scroll listener |
| `src/themes/space/components/CircleParade.tsx` | Accept `scrollOffset` signal prop, remove internal scroll listener + `useState` |
| `src/styles/themes/space.css` | Add `@keyframes` for nebula drift, sun pulse, ship bob, satellite spin |

---

## Z-Index Stack

```
z-0:    Ambient Layer (nebula, starfield, sun)        — fixed, CSS-only
z-5:    Space Parade (ship, planet, asteroids, etc.)   — fixed, scroll-driven
z-10:   Circle Parade (CV content circles)             — fixed, scroll-driven (EXISTING)
z-40:   Anchor Dots                                   — fixed (EXISTING)
z-50:   Floating Controls                             — fixed (EXISTING)
z-100:  Poster overlay                                — fixed (EXISTING)
```

---

## Element Configuration Schema

```typescript
interface MotionConfig {
  entryOffset: number;     // scroll offset (vh units) where element becomes visible
  exitOffset: number;      // scroll offset where element exits
  startX: number;          // starting X position (vw units)
  endX: number;            // ending X position (vw units)
  baseY: number;           // base Y position (vh units)
  verticalWaves: number;   // number of sine wave oscillations across path
  verticalAmplitude: number; // sine wave amplitude (vh units)
  scaleProfile: (t: number) => number;  // scale over 0..1
  rotationStart: number;   // starting rotation (degrees)
  rotationEnd: number;     // ending rotation (degrees)
  easing: (t: number) => number;  // easing function
}

interface ElementConfig extends MotionConfig {
  id: string;
  type: 'planet' | 'ship' | 'shooting-star' | 'asteroid' | 'satellite';
}

// Generated once per page load, distributed across totalSpan
function generateElementConfigs(totalSpan: number): ElementConfig[];
```

---

## Testing

- **Unit**: `space-parade-utils.test.ts` — test position math, easing, clamp, edge fade, config generation, edge cases (zero span, single entry, extreme offsets)
- **Integration**: Existing `space.test.tsx` — verify SpaceParade renders behind circles (z-index), ambient elements render, reduced-motion hides scroll-driven layer, scroll offset signal shared correctly
