# Feature Specification: Space Background Animations (Space Parade)

**Feature Branch**: `S-005-space-parade`  
**Created**: 2026-06-21  
**Status**: Draft  
**Parent Feature**: F-003 (Space Theme)  
**Input**: Make the space theme less static by adding animated background elements — spaceships, planets, shooting stars, asteroids, satellites — that move as the user scrolls.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Scroll-Driven Space Elements Cross the Background (Priority: P1)

A visitor opens the CV website with the Space theme active. As they scroll through the circle parade, they notice elements crossing the deep-space background behind the CV circles: a ringed planet slowly drifting horizontally, a spaceship sweeping across with a flickering engine flame, a retro satellite spinning its solar panels. Each element enters from one side, traverses the viewport, and exits — never repeating. The motion feels like a genuine traversal through space, adding depth and life behind the content.

**Why this priority**: The scroll-driven layer is the core value of this feature. Without it, the background is static. This is what makes the space theme feel alive.

**Independent Test**: Load the Space theme. Scroll from top to bottom. Verify at least 3 distinct scroll-driven element types (planet, ship, satellite) are visible at different scroll positions. Verify elements move horizontally and/or diagonally as scroll position changes. Verify elements exit and do not reappear further down.

**Acceptance Scenarios**:

1. **Given** the Space theme is active and the page is at the top, **When** the visitor begins scrolling down, **Then** a ringed planet enters the viewport from one side and begins drifting across the background.
2. **Given** the visitor continues scrolling, **When** the planet exits, **Then** a spaceship (recognizable silhouette with engine flame) enters and sweeps across the viewport.
3. **Given** the visitor reaches the bottom of the page, **When** all scroll-driven elements have completed their paths, **Then** no elements remain visible; all have exited and are gone (no looping).
4. **Given** the visitor scrolls back up, **When** the scroll position reverses, **Then** each element reappears in reverse and retraces its path deterministically (backward traversal).

---

### User Story 2 - Ambient Background Elements Always Visible (Priority: P1)

A visitor views the Space theme. Even when not actively scrolling, the background feels alive: nebula clouds slowly drift in the background, stars twinkle, and a subtle warm sun glows in the bottom-right corner. These ambient elements are always running via CSS animations, independent of scroll position, creating a sense of being in deep space.

**Why this priority**: The ambient layer provides continuous visual interest regardless of scroll activity. Without it, the background would feel dead when the visitor pauses reading.

**Independent Test**: Load the Space theme. Without scrolling, observe for several seconds. Verify nebula clouds are slowly drifting. Verify stars are twinkling. Verify the sun has a subtle pulse. Verify these animations continue regardless of scroll position.

**Acceptance Scenarios**:

1. **Given** the Space theme is active, **When** the page loads and the visitor does not scroll, **Then** nebula clouds (blurred color blobs) are visible and slowly drifting via CSS animation.
2. **Given** the page is at any scroll position, **When** the visitor pauses scrolling, **Then** the ambient layer (nebula, stars, sun) continues animating independently.
3. **Given** the ambient layer is running, **When** the visitor scrolls, **Then** ambient elements remain fixed-position and their animations are unaffected by scroll position.

---

### User Story 3 - All Elements Stay Behind CV Content Circles (Priority: P1)

A visitor scrolls through the circle parade. The animated space elements (planet, ship, shooting stars, asteroids, satellite, nebula, sun) all render behind the CV content circles. No background element ever overlaps or obscures the glass-morphism circles, the anchor dots, or the floating controls. The elements provide depth without competing for attention.

**Why this priority**: The background must enhance, not obstruct. If elements overlap CV content, the feature fails its purpose. This z-index layering is foundational.

**Independent Test**: Scroll to a position where both a scroll-driven element and a CV circle are visible. Screenshot or inspect z-index. Verify the CV circle renders on top of the background element. Verify anchor dots and floating controls are also on top.

**Acceptance Scenarios**:

1. **Given** a scroll-driven element (e.g., planet) and a CV circle are both visible, **When** the visitor views the screen, **Then** the CV circle is visually on top of the space element with no overlap interference.
2. **Given** navigation anchor dots are visible, **When** a scroll-driven element passes near the right edge, **Then** the anchor dots remain visible and clickable on top of the element.
3. **Given** floating controls are in the top-right corner, **When** an ambient nebula or sun is in that region, **Then** the controls render on top and remain interactive.

---

### User Story 4 - Reduced-Motion Fallback Hides Scroll-Driven Elements (Priority: P2)

A visitor with `prefers-reduced-motion: reduce` enabled loads the Space theme. The scroll-driven elements (planet, ship, shooting stars, asteroids, satellite) are completely hidden — no motion-triggered effects. The ambient layer still renders but as static elements (no animation). The circle parade falls back to its static vertical stack as defined in F-003.

**Why this priority**: Accessibility is a hard requirement. Motion-sensitive users must not be subjected to animated background elements. P2 because the core visual experience (P1) should work first.

**Independent Test**: Enable `prefers-reduced-motion: reduce` in browser/OS. Load Space theme. Verify no scroll-driven elements are visible at any scroll position. Verify ambient layer elements are static (no drift, no pulse). Verify circle parade renders as static stack.

**Acceptance Scenarios**:

1. **Given** `prefers-reduced-motion: reduce` is active, **When** the Space theme loads, **Then** all scroll-driven elements (SpaceParade component) are hidden — no ship, planet, asteroids, shooting stars, or satellite appear.
2. **Given** reduced-motion is active, **When** the ambient layer renders, **Then** nebula, stars, and sun are visible but static — no CSS animations play (animation-duration: 0s or animation: none).
3. **Given** reduced-motion is not active, **When** the Space theme loads, **Then** the full scroll-driven and ambient animations play as designed.

---

### User Story 5 - Shooting Stars and Asteroids Add Episodic Visual Interest (Priority: P2)

As the visitor scrolls, brief, fast-moving elements punctuate the background: a shooting star zips diagonally across the screen with a bright head and fading trail, and a tumbling asteroid with visible craters rotates as it crosses. These elements are spread across the scroll span so the visitor encounters them occasionally — not all at once.

**Why this priority**: These are the "surprise and delight" elements. P2 because the core scroll-driven mechanics (planet, ship, satellite — P1) must work first.

**Independent Test**: Scroll through the entire parade. Count how many distinct shooting star zips and asteroid crossings are visible. Verify at least 5 shooting stars and 3 asteroids across the full span. Verify none overlap at the exact same scroll position and screen region in a confusing way.

**Acceptance Scenarios**:

1. **Given** the visitor scrolls through the parade, **When** a shooting star becomes active, **Then** it zips diagonally (top-right to bottom-left) with a bright head and fading trail, lasting for a short scroll distance (~6% of total span).
2. **Given** the visitor scrolls, **When** an asteroid becomes active, **Then** a tumbling irregular rock with visible craters rotates 360° while crossing, lasting for ~14% of total span.
3. **Given** the full scroll span, **When** the visitor completes the scroll, **Then** at least 5 shooting stars and at least 3 asteroids have appeared at different scroll positions with natural gaps between them.

---

### User Story 6 - Consistent Visual Rendering Across Elements (Priority: P2)

All space elements are rendered using pure CSS shapes (divs with gradients, border-radius, box-shadow, transforms) — consistent with the existing Starfield implementation. No images, SVGs, or canvas elements are used. The visual style is cohesive and matches the space theme aesthetic.

**Why this priority**: Consistency with the existing codebase approach is important for maintainability and bundle size. P2 because visual fidelity can be iterated after mechanics are working.

**Independent Test**: Inspect the DOM. Verify all space elements are `<div>` elements with CSS styling (no `<img>`, `<svg>`, `<canvas>`). Verify the Planet Express ship silhouette is an inspired-by shape (green/red gradients forming body, wings, nose, flame via nested divs) rather than a licensed image.

**Acceptance Scenarios**:

1. **Given** the Space theme is loaded, **When** inspecting the DOM, **Then** all space elements are `<div>` elements styled with CSS — no images, SVGs, or canvas elements are present.
2. **Given** the spaceship element renders, **When** viewed, **Then** it is a recognizable silhouette formed by nested divs with gradient backgrounds (green body, red accents, yellow/orange flame), evocative of a classic sci-fi ship without directly copying copyrighted designs.
3. **Given** the ringed planet renders, **When** viewed, **Then** it is a circle with a radial gradient body and an elliptical ring crossing it, formed purely by CSS gradients and transforms.

---

## Edge Cases

- **Very few CV entries (1–2)**: If the CV has only 1 or 2 entries (e.g., only About + Contact), `totalSpan = entries.length × 1.4 + 1.0` evaluates to `3.8` or `2.4` vh. With such a short span, scroll-driven elements traverse very quickly. The element distribution function must scale entry/exit offsets proportionally to the short span — elements still appear but in rapid succession. Minimum total span is clamped to at least `5.0` vh to prevent elements from being unviewable.
- **Zero entries (empty CV)**: If `entries.length` is 0, `totalSpan = 1.0` vh (the `+ 1.0` floor). Scroll-driven elements still render across this minimal span but traverse near-instantly. The ambient layer remains unaffected.
- **Rapid scrolling (fast wheel / trackpad fling)**: Fast scroll changes should not cause jarring visual jumps. Since element positions are computed purely from `scrollOffset` signal (deterministic, no animation delays), rapid scrolling simply plays the traversal faster — elements sweep across the screen quickly. This is acceptable since the position computation is synchronous with the rAF-throttled scroll handler.
- **Scroll to exact element boundary**: If the visitor stops scrolling at a position where an element is mid-cross or partially faded (in its `edgeFade` entry/exit phase), the element pauses at that intermediate state. On next scroll, it continues from that point. This is expected and mirrors the circle parade's behavior.
- **Viewport resize mid-scroll**: Resizing the viewport changes `window.innerHeight` (used for vh calculations in `scrollOffset`) and `window.innerWidth` (used for vw element positioning). The scroll handler must recalculate on resize — elements may shift position slightly but remain in their proportional scroll range. No elements should disappear or jump to wrong positions.
- **Multiple scroll-driven elements overlapping same screen region**: With at most ~3–4 elements visible simultaneously and each occupying different screen regions and z-depths, overlap is fine and expected (e.g., a shooting star zips across while an asteroid tumbles in a different quadrant). The hardcoded `SPACE_PARADE_CONFIGS` array uses curated start/end positions and vertical offsets to avoid exact position conflicts.
- **Browser without `backdrop-filter` support**: The space theme's glass-morphism circles degrade gracefully to semi-transparent circles without blur. SpaceParade elements (pure CSS shapes with opacity/transform) are unaffected — no `backdrop-filter` dependency in SpaceParade.
- **Browser without `will-change` support or GPU compositing**: Elements still render and animate via `transform`/`opacity` changes. Performance may be lower on software-rendered browsers, but the visual experience is preserved. No `will-change` dependency.
- **Performance on low-end devices**: At most ~7 DOM nodes for scroll-driven elements (max visible simultaneously: ~3–4, plus 3–4 buffer nodes entering/exiting the visible zone) plus 3–4 ambient nodes (nebula clouds) plus 1 sun node plus starfield nodes. Total ~115 DOM nodes for space background. No canvas, no WebGL, no heavy computation. Frame budget: position math is simple arithmetic (clamp, lerp, sin, easing) — sub-millisecond per frame.
- **`scrollOffset` signal outside valid range**: If `scrollOffset < 0` (scrolled above top) or `scrollOffset > totalSpan` (scrolled past bottom), the `computeElementPosition()` function clamps `t` to `[0, 1]`. Elements at the boundary positions stay at their start or end state until scroll returns to valid range.
- **Scroll container not yet mounted**: On initial render before the scroll container ref is attached, `scrollOffset` defaults to `0`. No elements are mispositioned.
- **Theme switch while scroll-driven elements are active**: Switching away from Space theme unmounts `SpacePage` (and therefore `SpaceParade` and the ambient layer). Switching back remounts with `scrollOffset` reset to `0`. Cross-theme scroll position preservation is out of scope (same as F-003).

---

## Requirements _(mandatory)_

### Design Decisions

#### Two-Layer Architecture

| Layer | z-index | Behavior | Interaction |
|-------|---------|----------|-------------|
| **Ambient** | z-0 | CSS-only `@keyframes`, always running, independent of scroll | `pointer-events: none` |
| **Scroll-Driven** | z-5 | Position = f(scrollOffset), deterministic, once-through (no looping) | `pointer-events: none` |

Existing CircleParade sits at z-10, so scroll-driven elements are always **behind** CV content circles. They never interfere with readability.

#### Element Roster

**Ambient Layer (CSS-only)**:
- **Nebula Clouds** — 3–4 large blurred color blobs (pink, blue, purple), `filter: blur(80px)`, drifting via `@keyframes` over 60–90s cycles
- **Sun** — Toned-down warm radial gradient, bottom-right corner, `opacity: ~0.15`, subtle pulse `@keyframes`
- **Starfield** — Existing 100+ twinkling stars, keep as-is

**Scroll-Driven Layer**:
- **Ringed Planet** — Slow horizontal drift spanning ~92% of total scroll. Scales 0.3→0.9→0.4. Subtle ring rotation.
- **Spaceship** — Recognizable sci-fi silhouette (green body, red accents, orange engine flame, formed by nested divs with gradient backgrounds — an original/inspired-by shape, not a direct copy of copyrighted designs). Ease-in-out sweep across ~55% of scroll span, sine-wave bobbing, flickering engine flame.
- **Satellite** — Retro space probe with solar panels, spinning 0→720°, blinking red light on antenna. Linear cross over ~42% of span.
- **Shooting Stars** ×5–6 — Quick diagonal zips (top-right→bottom-left), bright head + fading trail. Spread across full span with ~3vh gaps. Each active for ~6% of span.
- **Asteroids** ×3 — Irregular tumbling rocks with craters. Full 360° rotation while crossing. Each active for ~14% of span.

#### No Looping

Elements appear once across the full scroll span. Once they exit their scroll range, they're gone. Scrolling back up reverses through the same range deterministically (the element comes back into view in reverse). This creates a genuine sense of traversal rather than a mechanical loop.

No element respawns. No element is reused.

#### Element Distribution & Overlap

Elements are staggered across the full scroll span with natural overlaps. At most ~3–4 scroll-driven elements are visible simultaneously at any scroll position. Element entry/exit offsets are defined in a hardcoded `SPACE_PARADE_CONFIGS` array — each element's position, timing, and trajectory are hand-designed to ensure visually balanced distribution across the scroll span (minimum gap between consecutive element ranges = 1.0vh). Overlap is fine and expected — a shooting star and asteroid can cross simultaneously — since elements occupy different screen regions and z-depths.

#### Visual Rendering

All elements are pure CSS shapes (divs with `border-radius`, `background`, `box-shadow`, `transform`) — no SVG imports, no canvas, no images. Ship body/wings/nose/flame are nested divs with gradient backgrounds. Planet is a `radial-gradient` circle. Shooting star is a small bright dot with a `linear-gradient` pseudo-element trail. Asteroid is an irregular `border-radius` blob. Satellite is nested divs for body, panels, and antenna. This keeps the approach consistent with the existing codebase (Starfield uses the same technique).

#### Dynamic Scroll Span

Total scroll span is computed from CV data:
```
totalSpan = entries.length × 1.4 + 1.0  (viewport-height units)
```

Element entry/exit offsets are scaled proportionally to `totalSpan`. A CV with 20 entries (29vh span) naturally spreads elements wider than one with 5 entries (8vh span). Minimum total span is clamped to `5.0` vh to prevent unviewable elements with very short CVs.

#### Signal-Based Scroll Sharing

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

#### Motion Formula

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

#### Reduced Motion

When `prefers-reduced-motion: reduce`:
- **Ambient layer**: Elements still render but without animation (static nebula, dim stars, static sun)
- **Space parade**: Completely hidden — no scroll-driven elements
- **Circle parade**: Existing fallback to static vertical stack (unchanged)

---

### Functional Requirements

#### Architecture & Layering

- **FR-001**: System MUST implement a two-layer background animation architecture: Ambient (CSS-only, z-0) and Scroll-Driven (JS-computed from scrollOffset, z-5). Both layers use `pointer-events: none` to prevent interaction with CV content.

- **FR-002**: System MUST render scroll-driven elements behind the existing CircleParade (z-10), anchor dots (z-40), floating controls (z-50), and poster overlay (z-100). The full z-index stack is: z-0 (ambient) → z-5 (SpaceParade) → z-10 (CircleParade) → z-40 (AnchorDots) → z-50 (FloatingControls) → z-100 (Poster).

#### Ambient Layer

- **FR-003**: System MUST render 3–4 nebula cloud elements (large blurred color blobs in pink, blue, purple) using CSS `@keyframes` for slow drift animation over 60–90s cycles. Nebulas use `filter: blur(80px)` and are fixed-position.

- **FR-004**: System MUST render a sun element (warm radial gradient, bottom-right corner, `opacity: ~0.15`) with a subtle CSS `@keyframes` pulse animation. The sun is fixed-position and belongs to the ambient layer.

- **FR-005**: System MUST retain the existing Starfield component (100+ twinkling stars) as-is on the ambient layer.

#### Scroll-Driven Layer

- **FR-006**: System MUST implement a scroll-driven element manager (`SpaceParade` component) that reads the `scrollOffset` signal, computes element positions via the motion formula, and renders element components at transformed positions.

- **FR-007**: System MUST support these scroll-driven element types with distinct visual profiles and motion behaviors:
  - **Ringed Planet**: Radial gradient circle + elliptical ring, horizontal drift across ~92% of span, scale profile 0.3→0.9→0.4, subtle ring rotation
  - **Spaceship**: Nested-div silhouette (green/red gradients, engine flame), ease-in-out sweep across ~55% of span, sine-wave bobbing, flickering flame
  - **Satellite**: Nested-div retro probe with solar panels, 0→720° spin, linear cross over ~42% of span, blinking red antenna light
  - **Shooting Stars** ×5–6: Bright dot + linear-gradient trail, diagonal zip (top-right to bottom-left), each active for ~6% of span, spread across full span with minimum 3vh gaps
  - **Asteroids** ×3: Irregular border-radius blob with crater details, full 360° rotation, each active for ~14% of span

- **FR-008**: System MUST implement no-looping behavior: each scroll-driven element appears exactly once across the full scroll span. When scrollOffset is within an element's `[entryOffset, exitOffset]` range, the element is visible at its computed position. When scrollOffset moves outside the range, the element is gone. Scrolling backward reverses the traversal deterministically.

- **FR-009**: System MUST define element entry/exit offsets via a hardcoded `SPACE_PARADE_CONFIGS: ElementConfig[]` array in `space-parade-utils.ts`. Each element's `entryOffset` and `exitOffset` are hand-designed values scaled proportionally to `totalSpan` at render time. Gaps between consecutive element ranges are at least 1.0vh. At most ~3–4 scroll-driven elements are visible simultaneously at any scroll position.

#### Motion Computation

- **FR-010**: System MUST compute each scroll-driven element's visual state using this formula (matching the `computeCircleTransform` pattern):
  ```
  t = clamp((scrollOffset - entryOffset) / (exitOffset - entryOffset), 0, 1)
  easedT = easingFunction(t)
  x = lerp(startX, endX, easedT)
  y = baseY + sin(easedT × PI × verticalWaves) × verticalAmplitude
  scale = scaleProfile(easedT)
  rotation = lerp(rotationStart, rotationEnd, easedT)
  opacity = edgeFade(easedT)
  ```
  All properties use CSS `transform` and `opacity` for GPU compositing — no layout-triggering properties.

- **FR-011**: System MUST implement `edgeFade(t)` producing a 3-phase opacity model: ramp from 0→1 over t=[0, 0.12] (ease-out, entry fade-in), hold at 1 through t=[0.12, 0.88] (full opacity display), ramp from 1→0 over t=[0.88, 1] (ease-in, exit fade-out). This mirrors the fade phases in the existing `computeCircleTransform()`.

- **FR-012**: System MUST compute `totalSpan` dynamically from CV data: `max(entries.length × 1.4 + 1.0, 5.0)` vh units. Element entry/exit offsets are scaled proportionally to `totalSpan`.

#### Scroll Signal & Integration

- **FR-013**: System MUST create a single `scrollOffset` signal in `SpacePage.tsx` and update it via a rAF-throttled `onScroll` handler on the scroll container. The signal value is `container.scrollTop / window.innerHeight` (vh units).

- **FR-014**: System MUST pass the `scrollOffset` signal as a prop to both `CircleParade` and `SpaceParade`. CircleParade's internal scroll listener and `useState` must be removed — it becomes a pure renderer consuming the signal.

- **FR-015**: System MUST refactor CircleParade so that the scroll container `<div>` and spacer `<div>` live in `SpacePage`. CircleParade renders only the fixed stage overlay + 7 circle pool slots. The `containerRef` for `scrollTo()` navigation stays in SpacePage.

#### Visual Rendering

- **FR-016**: System MUST render all space elements as pure CSS shapes (divs with `border-radius`, `background` gradients, `box-shadow`, `transform`) — no SVG imports, no `<canvas>`, no `<img>` tags. This is consistent with the existing Starfield approach.

- **FR-017**: System MUST render the spaceship as an original/inspired-by sci-fi silhouette formed by nested divs with gradient backgrounds — green body, red accents, orange/yellow engine flame. It must not directly copy copyrighted designs (e.g., the "Planet Express" ship from Futurama).

#### Reduced Motion

- **FR-018**: System MUST detect `prefers-reduced-motion: reduce` via CSS media query. When active: the SpaceParade component is completely hidden (no scroll-driven elements render), and ambient layer elements render statically (CSS animations disabled or set to `animation-duration: 0s`).

- **FR-019**: System MUST ensure the reduced-motion fallback preserves all CV content, navigation, and controls — only the background animation effects are removed.

#### Performance

- **FR-020**: System MUST use CSS `transform` (translate, scale, rotate) and `opacity` for all element animations — GPU-composited, no layout thrashing.

- **FR-021**: System MUST apply `will-change: transform, opacity` only to scroll-driven elements currently within or near the visible zone (in `[entryOffset, exitOffset]` range plus a buffer margin). Elements far outside their active range must have `will-change` removed.

- **FR-022**: System MUST keep the total DOM node count for scroll-driven elements bounded (at most ~7 visible simultaneously plus ambient nodes, ~115 total background DOM nodes). No per-scroll-position DOM creation — elements are conditionally rendered based on whether scrollOffset falls within their range.

#### File & Component Structure

- **FR-023**: System MUST create `src/themes/space/components/SpaceParade.tsx` — the scroll-driven element manager that reads `scrollOffset`, computes positions via the motion formula, and renders element components.

- **FR-024**: System MUST create individual element components under `src/themes/space/components/space-elements/`:
  - `Nebula.tsx` — ambient CSS-only nebula clouds
  - `Sun.tsx` — ambient CSS-only pulsing corner sun
  - `Spaceship.tsx` — scroll-driven sci-fi ship silhouette
  - `ShootingStar.tsx` — scroll-driven comet with trail
  - `RingedPlanet.tsx` — scroll-driven planet with rings
  - `Asteroid.tsx` — scroll-driven tumbling rock
  - `Satellite.tsx` — scroll-driven spinning probe
  - `types.ts` — motion profile TypeScript types

- **FR-025**: System MUST create `src/themes/space/space-parade-utils.ts` containing pure functions:
  - `computeElementPosition(config: MotionConfig, scrollOffset: number): ElementTransform` — position math
  - `scaleConfigsToSpan(configs: ElementConfig[], totalSpan: number): ElementConfig[]` — scales hardcoded config entry/exit offsets proportionally to the current `totalSpan`
  - `edgeFade(t: number): number` — 3-phase opacity
  - `lerp(a: number, b: number, t: number): number`
  - `clamp(value: number, min: number, max: number): number`

- **FR-026**: System MUST modify `SpacePage.tsx` to add: ambient layer rendering (Nebula, Sun), SpaceParade rendering, `scrollOffset` signal creation, and the shared scroll listener.

- **FR-027**: System MUST modify `CircleParade.tsx` to accept `scrollOffset` as a signal prop and remove its internal scroll listener and `useState`.

- **FR-028**: System MUST add new `@keyframes` to `src/styles/themes/space.css` for: nebula drift, sun pulse, spaceship bobbing, satellite spin.

#### TypeScript

- **FR-029**: System MUST define TypeScript types in `space-parade-utils.ts` or `space-elements/types.ts`:
  ```typescript
  interface MotionConfig {
    entryOffset: number;
    exitOffset: number;
    startX: number;
    endX: number;
    baseY: number;
    verticalWaves: number;
    verticalAmplitude: number;
    scaleProfile: (t: number) => number;
    rotationStart: number;
    rotationEnd: number;
    easing: (t: number) => number;
  }

  interface ElementConfig extends MotionConfig {
    id: string;
    type: 'planet' | 'spaceship' | 'shooting-star' | 'asteroid' | 'satellite';
  }

  interface ElementTransform {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
  }
  ```

- **FR-030**: System MUST compile under TypeScript `strict: true` with no `any` types and no `@ts-ignore` directives.

---

### Key Entities

- **SpacePage (component)**: Root layout for the space theme. Owns:
  - The scroll container `<div>` and spacer `<div>` (refactored out of CircleParade)
  - The `scrollOffset` signal — single source of truth for scroll position
  - The rAF-throttled `onScroll` handler
  - The `containerRef` passed to AnchorDots for `scrollTo()` navigation
  - Renders ambient layer (Nebula, Sun, Starfield) at z-0
  - Renders SpaceParade at z-5
  - Renders CircleParade at z-10

- **SpaceParade (component)**: Scroll-driven element manager. Key concerns:
  - Consumes `scrollOffset` signal as prop
  - Calls `scaleConfigsToSpan(SPACE_PARADE_CONFIGS, totalSpan)` once to produce the scaled element config list for the current CV
  - For each element config, calls `computeElementPosition(config, scrollOffset)` to get the current transform
  - Conditionally renders element components only when `scrollOffset` is within the element's `[entryOffset, exitOffset]` range (plus a small buffer for edgeFade transitions)
  - Dispatches to the correct element component based on `config.type`

- **Element Components** (`RingedPlanet`, `Spaceship`, `ShootingStar`, `Asteroid`, `Satellite`): Presentational components that receive an `ElementTransform` and apply it via inline `style`. Each is a tree of styled `<div>` elements forming the visual shape. All use `pointer-events: none`.

- **Ambient Components** (`Nebula`, `Sun`): Pure CSS-animated components. No props — self-contained visual elements using CSS `@keyframes` defined in `space.css`.

- **`scrollOffset` Signal**: A `Signal<number>` created in SpacePage. Value is `container.scrollTop / window.innerHeight` (vh units). Updated via rAF-throttled scroll handler. Consumed by both CircleParade and SpaceParade.

- **`MotionConfig` / `ElementConfig`**: TypeScript interfaces describing an element's scroll range, path, and visual behavior (see Element Configuration Schema below).

- **`space-parade-utils.ts`**: Pure function module. Contains `computeElementPosition`, `scaleConfigsToSpan`, `edgeFade`, `lerp`, `clamp`. Exports the hardcoded `SPACE_PARADE_CONFIGS` constant. No React dependencies — independently testable.

- **`space.css` additions**: New `@keyframes` for nebula drift, sun pulse, ship bobbing, satellite spin. Existing starfield and theme tokens remain unchanged.

**Entity Relationships**:
```
scrollOffset (Signal<number>, owned by SpacePage)
 ├── Consumed by CircleParade → drives circle transforms (unchanged logic)
 ├── Consumed by SpaceParade → drives element position computation
 │    └── computeElementPosition(config, scrollOffset) → ElementTransform
 │         └── Applied as inline styles on element components
 └── Determines which elements are visible (in-range vs out-of-range)

SPACE_PARADE_CONFIGS (hardcoded) → scaleConfigsToSpan(configs, totalSpan) → ElementConfig[]
 ├── Called once in SpaceParade
 ├── Depends on CVData.entries.length → totalSpan
 └── Each config feeds into computeElementPosition()

Ambient Layer (Nebula, Sun, Starfield)
 ├── CSS-only, no signal dependency
 └── Fixed-position, always mounted in SpacePage

prefers-reduced-motion (CSS media query)
 ├── When "reduce": SpaceParade hidden, ambient layer static
 └── When "no-preference": full animations active

CircleParade (refactored)
 ├── Accepts scrollOffset signal as prop (was internal useState)
 ├── Scroll container and spacer moved to SpacePage
 └── Renders fixed stage + 7 circle pool slots at z-10
```

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Scroll-driven element coverage**: At least 4 distinct scroll-driven element types (planet, spaceship, satellite, shooting stars, asteroids) appear across a full scroll traversal from top to bottom. Verified by: visual inspection and component test that scrolls through full span and checks element visibility.

- **SC-002 — One-time traversal (no looping)**: Each scroll-driven element appears exactly once. When scrolling past an element's exit offset, the element is not visible again further down. Scrolling back up reverses the element through the same range. Verified by: unit test on `computeElementPosition` with scroll offsets before entry, during range, and after exit.

- **SC-003 — Z-index layering**: All SpaceParade elements (z-5) render behind CV circles (z-10). No space element overlaps or obscures CV content, anchor dots, or floating controls. Verified by: component test checking computed z-index values and visual inspection.

- **SC-004 — Ambient layer independence**: Nebula clouds, sun, and starfield animate via CSS `@keyframes` independently of scroll position. Pausing scrolling does not pause ambient animations. Verified by: visual inspection (pause scroll, observe continued ambient animation).

- **SC-005 — Reduced-motion compliance**: With `prefers-reduced-motion: reduce`, the SpaceParade component renders no elements (empty, `display: none`, or conditional rendering skip). Ambient layer elements render statically. Verified by: component test with mocked `prefers-reduced-motion` media query.

- **SC-006 — Deterministic backward scroll**: Scrolling back to a previous position reproduces the same element state as the forward pass at that position. The motion formula is pure — no random variation per render. Verified by: unit test computing element position at a given scrollOffset, then re-computing at the same offset after scrolling past and back — results are identical.

- **SC-007 — DOM node count bounded**: The total number of space background DOM nodes does not grow with scroll position. At most ~115 total nodes (starfield stars + ambient + max simultaneous scroll-driven elements). Verified by: DOM node count check at multiple scroll positions.

- **SC-008 — Zero TypeScript errors**: The entire SpaceParade implementation compiles under `strict: true` with no `any` types and no `@ts-ignore` directives. Verified by: `npm run build` passes cleanly.

- **SC-009 — Dynamic span adapts to CV size**: With a CV containing 20 entries, `totalSpan` is ~29vh and elements are spread wider. With a CV containing 3 entries, `totalSpan` is ~5.2vh and elements are more tightly packed. Minimum span is clamped to 5.0vh. Verified by: unit test on `scaleConfigsToSpan` with different `totalSpan` values — entry/exit offsets scale proportionally.

- **SC-010 — Pure CSS rendering (no external assets)**: All space elements are DOM `<div>` elements with CSS styling. No `<img>`, `<svg>`, `<canvas>`, or external asset URLs in the space background implementation. Verified by: DOM inspection and grep for forbidden element tags in space theme files.

---

## Assumptions

- **F-003 (Space Theme) is complete or in progress**: The circle parade, scroll container, anchor dots, floating controls, and space CSS tokens exist and are importable. S-005 extends F-003 — it does not create the base space theme infrastructure.
- **F-002 (Data Model) is complete**: `CVData` types and `cv.en.json` / `cv.de.json` files exist. `entries.length` is used to compute `totalSpan` for element distribution.
- **F-013 (Multilanguage) is complete**: `currentLocale` and `currentCV` signals exist. SpaceParade does not render locale-specific content (purely visual), but the scroll span adapts to the number of CV entries which may vary by locale.
- **Desktop-only**: The SpaceParade is designed for desktop screens (>1024px). Responsive layout and mobile adaptation are out of scope, consistent with F-003's desktop-only assumption.
- **CircleParade can be refactored**: The existing CircleParade component can be modified to accept a `scrollOffset` signal prop and have its internal scroll listener removed. The scroll container and spacer can be moved to SpacePage without breaking the circle parade behavior.
- **Scroll container is a single source of truth**: SpacePage owns the scroll container, the `onScroll` handler, and the `scrollOffset` signal. Both CircleParade and SpaceParade consume this signal — there is no alternative scroll tracking mechanism.
- **Existing `space.css` is reused**: New `@keyframes` are added to the existing `src/styles/themes/space.css` file. Existing tokens, keyframes, and Starfield styles remain intact.
- **No external assets**: All space elements are pure CSS shapes. No images, SVGs, fonts, or 3D models are loaded for background animations. Bundle size impact is minimal (CSS additions + TypeScript utilities).
- **`backdrop-filter` support is optional for SpaceParade**: The space background elements do not use `backdrop-filter`. Only the CircleParade glass-morphism circles depend on it, and they already have graceful degradation (semi-transparent without blur). SpaceParade has no dependency on this CSS feature.
- **Performance target is 60fps on mid-range devices**: The motion formula (clamp, lerp, sin, easing) is sub-millisecond per frame. With GPU-composited `transform`/`opacity` and bounded DOM nodes, the target is achievable without optimization tricks.
- **No user interaction with background elements**: All space elements use `pointer-events: none`. Visitors cannot click, hover, or interact with background elements. This is intentional — elements are purely decorative.

---

## Clarifications

Record of design decisions made during specification.

| # | Question | Choice | Impact |
|---|---|---|---|
| 1 | Animation architecture? | Two-layer: ambient CSS-only (z-0) + scroll-driven JS layer (z-5) | Defined element roster split, z-index stack, and refactor boundaries |
| 2 | Element looping behavior? | No looping — once-through deterministic traversal | Bidirectional motion, no respawning, genuine traversal feel |
| 3 | Visual rendering approach? | Pure CSS shapes (divs with gradients, border-radius, transforms) | No SVG/canvas/images; consistent with existing Starfield; minimal bundle impact |
| 4 | How does scroll span adapt to CV content? | Dynamic: `max(entries.length × 1.4 + 1.0, 5.0)` vh | Elements spread naturally for large CVs, clamped minimum for small CVs |
| 5 | How is scroll position shared between components? | Single `scrollOffset` signal in SpacePage, consumed as prop by CircleParade and SpaceParade | CircleParade refactored from internal `useState` to signal consumer; single source of truth |
| 6 | Element visual style constraint? | Original/inspired-by designs, no direct copies of copyrighted IP | Spaceship is a generic sci-fi silhouette (green/red gradients), not a direct Planet Express copy |
| 7 | Reduced-motion behavior? | SpaceParade hidden entirely; ambient layer static but visible | Consistent with F-003's reduced-motion fallback; no scroll-driven animation when preference is "reduce" |
| 8 | How are element positions/timing generated? | Hardcoded `SPACE_PARADE_CONFIGS` array — hand-designed, not randomized | Full control over visual quality; no risk of awkward auto-generated layouts; offsets expressed as 0..1 fractions, scaled to `totalSpan` at render time via `scaleConfigsToSpan()` |

---

## Out of Scope

- Mobile-responsive layout (desktop-only, >1024px, consistent with F-003)
- Touch/swipe gestures for background element interaction
- 3D or WebGL-based rendering (pure CSS transforms only)
- Canvas-based or SVG-based element rendering
- Real photographic backgrounds or image-based elements
- Audio/sound effects tied to element movement
- User-configurable element selection (which elements appear, how many)
- Cross-theme animation state persistence (switching themes resets scroll position and element states)
- Interactive/clickable space elements (all are `pointer-events: none`)
- Elements that respond to mouse position or parallax effects
- Adaptive element count based on device performance
- Print-friendly styling for animated elements
- Per-element animation curve customization (hardcoded easing profiles per element type)
- Element collision detection or avoidance (natural overlap is acceptable)
- Respawn or looping element cycles

---

## Files

### New

| File | Role |
|------|------|
| `src/themes/space/components/SpaceParade.tsx` | Scroll-driven element manager — reads `scrollOffset`, computes positions, renders element components |
| `src/themes/space/components/space-elements/Nebula.tsx` | Ambient CSS-only nebula clouds |
| `src/themes/space/components/space-elements/Sun.tsx` | Ambient CSS-only pulsing corner sun |
| `src/themes/space/components/space-elements/Spaceship.tsx` | Scroll-driven spaceship silhouette |
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
| `src/styles/themes/space.css` | Add `@keyframes` for nebula drift, sun pulse, spaceship bobbing, satellite spin |

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
  type: 'planet' | 'spaceship' | 'shooting-star' | 'asteroid' | 'satellite';
}

interface ElementTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

// Hardcoded master config — hand-designed for visual quality.
// Entry/exit offsets are expressed as fractions of totalSpan (0..1 range).
// Scale to actual totalSpan at render time via scaleConfigsToSpan().
const SPACE_PARADE_CONFIGS: ElementConfig[];

// Scales hardcoded config entry/exit offsets to actual totalSpan (vh units)
function scaleConfigsToSpan(configs: ElementConfig[], totalSpan: number): ElementConfig[];
```

---

## Testing

- **Unit**: `space-parade-utils.test.ts` — test position math (`computeElementPosition`), easing, clamp, edge fade, config scaling (`scaleConfigsToSpan`), edge cases (zero span, single entry, extreme offsets, scrollOffset out of range, backward scroll determinism), verify `SPACE_PARADE_CONFIGS` entries have valid offsets (no overlap violations, all offsets in [0,1] range)
- **Integration**: Existing `space.test.tsx` — verify SpaceParade renders behind circles (z-index), ambient elements render, reduced-motion hides scroll-driven layer, scroll offset signal shared correctly, element visibility at start/mid/end of scroll range
