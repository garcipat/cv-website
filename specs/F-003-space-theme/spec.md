# Feature Specification: Space Theme

**Feature Branch**: `F-003-space-theme`  
**Created**: 2026-06-21  
**Status**: Draft  
**Input**: User description: "A scroll-driven circle parade — CV items appear as circles entering from the right, growing to full size to show content, then shrinking and exiting to the left. One circle is fully visible at a time, with brief overlap during transitions."
**Ideas document**: `docs/ideas/3d-room-theme.md`
**Clarifications session**: 2026-06-21 — 3 questions answered (see ## Clarifications).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Scroll Through the Circle Parade (Priority: P1)

A visitor opens the CV website with the Space theme active. Against a deep-space abstract background, a circle containing the About/Hero content is centered and fully visible. As the visitor scrolls down, the About circle shrinks and drifts to the left while a new circle — the first Experience entry — enters from the right, grows to center, and becomes the new focal point. The visitor continues scrolling and each CV item appears as its own circle: experience entries, projects, skill categories, education entries, courses, certificates, and finally Contact. At any moment, only one circle is at full size showing its content; the incoming and outgoing circles are visible at the edges during the brief handoff.

**Why this priority**: The circle parade is the entire value proposition of this theme. Without the enter-grow-display-shrink-exit flow, it's just static circles on a page. This is the core experience.

**Independent Test**: Load the Space theme. Verify the About circle is centered and full-size. Scroll down — verify it shrinks and exits left while the next circle enters from the right and grows. Verify only one circle shows readable content at a time. Verify the parade ends with Contact.

**Acceptance Scenarios**:

1. **Given** the Space theme is active and the page is at the top, **When** the page loads, **Then** the About/Hero circle is centered at full size, fully opaque, against a deep-space abstract background.
2. **Given** the visitor scrolls down, **When** the About circle begins transitioning out, **Then** it shrinks and drifts left while the next circle (first experience) enters from the right at small size and begins growing.
3. **Given** the visitor continues scrolling, **When** the next circle reaches the center/viewing position, **Then** it is at full size, fully opaque, and its content is readable; the previous circle has exited left.
4. **Given** the visitor scrolls all the way, **When** they reach the end of the timeline, **Then** the Contact circle is centered at full size and no further circles enter from the right.

---

### User Story 2 - Navigate via Anchor Dots to Skip Ahead (Priority: P1)

A visitor is viewing the third experience circle and wants to jump to the Contact section. Navigation anchor dots line the right edge of the viewport — one dot per major CV section. They click the Contact dot, and the scroll smoothly advances through the parade to position the Contact circle at center. The active dot highlights which section is currently displayed.

**Why this priority**: With many individual-item circles (potentially 20+), being forced to scroll through every single one is a critical usability problem. Anchor dots let visitors jump between major sections instantly.

**Independent Test**: Load the Space theme. Verify anchor dots for each major non-empty section are visible on the right edge. Click the last dot — verify the circle parade advances to show the Contact circle. Verify the active dot tracks which section's circle is at center as you scroll.

**Acceptance Scenarios**:

1. **Given** the Space theme is active, **When** the page loads, **Then** navigation anchor dots are visible along the right edge, one per major non-empty section (About, Experience, Projects, Skills, Education, Courses, Certificates, Contact).
2. **Given** the About circle is at center, **When** the visitor observes the anchor dots, **Then** the About dot is highlighted as active and remaining dots are dimmed.
3. **Given** the visitor clicks the Contact anchor dot, **When** the click is processed, **Then** the viewport smoothly scrolls to position the Contact circle at center and the Contact dot becomes highlighted.
4. **Given** the visitor scrolls naturally through the circle parade, **When** circles from a new section reach center, **Then** the corresponding anchor dot updates to active without requiring a click.

---

### User Story 3 - Each CV Item Is Its Own Circle (Priority: P1)

A recruiter scrolls through the circle parade. Each experience entry is its own circle showing company, role, dates, and highlights. Each project is its own circle. Each skill category is its own circle. Each education entry, course, and certificate is its own circle. The circles appear in a defined order: About/Hero first, then all experience entries (newest first), then all projects, then all skill categories, then education entries, then courses, then certificates, and finally Contact.

**Why this priority**: This is how the CV content is structured and presented. The granularity (one item = one circle) and ordering define the visitor's journey through the CV.

**Independent Test**: Scroll through the entire parade. Count the circles — verify the count matches the number of non-empty CV items. Verify order: About, then experience[0]...experience[N], projects[0]...projects[N], skill categories, education entries, courses, certificates, contact.

**Acceptance Scenarios**:

1. **Given** the visitor scrolls past About, **When** experience circles appear, **Then** each is an individual experience entry in newest-first order, with company, role, dates, and highlights visible.
2. **Given** the visitor scrolls past experience, **When** subsequent circles appear, **Then** they show individual projects, skill categories, education entries, courses, certificates, and contact — in that fixed section order.
3. **Given** a CV section has no data (e.g., empty certificates array), **When** the parade reaches that section's position, **Then** no circles are rendered for it and the parade continues to the next non-empty section.

---

### User Story 4 - Circle Transition Timing (Priority: P2)

As the visitor scrolls, the timing of circle transitions must feel natural. When one circle begins shrinking and drifting left, the next circle begins entering from the right and growing. There is a brief moment where both circles are partially visible (the outgoing one shrinking, the incoming one growing), but only the incoming circle occupies the center when at full size. The scroll distance between "circle A at center" and "circle B at center" is consistent for all circles.

**Why this priority**: The transition timing is what makes the parade feel like a cohesive experience rather than a jumpy slideshow. It's P2 because the basic enter/center/exit mechanic (P1) must work first, but timing polish significantly affects the perceived quality.

**Independent Test**: Scroll through the parade at a steady pace. Verify each transition has overlapping circles briefly visible. Verify the distance between circle centers is consistent. Verify the overlap never results in two circles competing for visual attention at center.

**Acceptance Scenarios**:

1. **Given** circle A is at center, **When** the visitor scrolls forward, **Then** circle A begins shrinking and drifting left, and circle B begins entering from the right and growing — both are partially visible during the transition.
2. **Given** the transition is in progress, **When** circle B reaches center, **Then** circle A has fully exited left and only circle B is at full size and readable.
3. **Given** the visitor scrolls at a normal pace, **When** moving from one circle to the next, **Then** the scroll distance between centers is consistent (e.g., one viewport-height worth of scroll) for all circles.

---

### User Story 5 - Glass-Morphism Circles with Floating Animation (Priority: P2)

Each circle has a glass-morphism appearance — semi-transparent with backdrop blur, subtle border, and soft shadow. Circles have a subtle floating/bobbing animation when at center (not during enter/exit transitions) that reinforces the "floating in space" metaphor. The glass effect uses the space theme color tokens from `src/styles/themes/space.css`.

**Why this priority**: The visual design defines the aesthetic of the theme. It's P2 because the circle mechanics (P1) must work first.

**Independent Test**: Verify circles have frosted-glass appearance. Verify the circle at center has a subtle bobbing animation. Verify the glass effect uses CSS custom properties from `space.css`.

**Acceptance Scenarios**:

1. **Given** a circle is visible, **When** the visitor views it, **Then** it appears as frosted glass — semi-transparent dark background with backdrop blur, subtle border, and soft shadow.
2. **Given** a circle is at center (full size), **When** observed over several seconds, **Then** a subtle floating/bobbing animation plays, creating the illusion it's suspended in space.
3. **Given** a circle is entering or exiting (in transition), **When** observed, **Then** the floating animation is suppressed — only the enter/exit transform is active.

---

### User Story 6 - Floating Controls for Theme and Language (Priority: P2)

In the top-right corner of the viewport, small floating translucent controls provide theme switching and language toggling. These controls are fixed-position and remain accessible regardless of scroll position in the circle parade. They are styled to match the space theme aesthetic.

**Why this priority**: Theme and language toggles are required for the application. Their placement and styling must fit the space metaphor. P2 because the core parade experience (P1) is the primary deliverable.

**Independent Test**: Verify floating controls visible in top-right. Verify theme selector switches active theme. Verify language toggle switches EN/DE with content updating. Verify controls stay fixed during scroll.

**Acceptance Scenarios**:

1. **Given** the Space theme is active, **When** the page loads, **Then** floating translucent controls are visible in the top-right corner.
2. **Given** the visitor clicks the theme control, **When** they select a different theme, **Then** the theme switches and the space layout is replaced.
3. **Given** the visitor clicks the language toggle, **When** they switch from EN to DE, **Then** all circle content updates to German while maintaining scroll position.
4. **Given** the visitor scrolls through the circle parade, **When** scrolling, **Then** the floating controls remain fixed at the top-right.

---

### User Story 7 - Locale Reactivity Across Circles (Priority: P2)

A visitor is viewing the third experience circle in English. They switch to German via the language toggle. The current circle and all upcoming circles update their content to German immediately, without losing scroll position.

**Why this priority**: Multilingual support is inherited from F-013. All CV themes must support locale switching.

**Independent Test**: Scroll to mid-parade in English. Switch to German. Verify current and upcoming circles show German. Verify scroll position unchanged.

**Acceptance Scenarios**:

1. **Given** the visitor is viewing a circle in English, **When** they switch to German, **Then** all circles (current and upcoming) display German content and scroll position is unchanged.
2. **Given** the language is switched, **When** the visitor continues scrolling, **Then** all remaining circles display German content.

---

### User Story 8 - Accessibility: Reduced Motion Fallback (Priority: P2)

A visitor with `prefers-reduced-motion: reduce` enabled loads the Space theme. The circle parade transitions (enter/exit animations, grow/shrink, floating bobbing) are disabled. Instead, circles render as a simple vertical stack with standard scrolling — one circle per section area, fully readable, no motion effects.

**Why this priority**: Accessibility is a requirement. The theme must not exclude users who cannot tolerate motion effects.

**Independent Test**: Enable `prefers-reduced-motion: reduce`. Load Space theme. Verify circles render as a static vertical stack. Verify standard scrolling works. Disable preference and verify parade effects return.

**Acceptance Scenarios**:

1. **Given** `prefers-reduced-motion: reduce` is active, **When** the Space theme loads, **Then** all enter/exit/grow/shrink/float animations are disabled, and circles render as a simple vertical stack with standard scrolling.
2. **Given** the reduced-motion fallback is active, **When** the visitor scrolls, **Then** the page behaves as a normal vertically-scrolling document.
3. **Given** `prefers-reduced-motion` is not active, **When** the Space theme loads, **Then** the full circle parade transition effects are active.

---

### Edge Cases

- ✅ **Empty data sections**: If a CV section has no data (e.g., empty `certificates` array), no circles are created for it. The corresponding anchor dot is hidden. The parade continues to the next non-empty section without gaps.
- ✅ **Single-item sections**: If a section has only one entry (e.g., one project), it produces exactly one circle with no intra-section transitions needed.
- ✅ **Very few items**: If the CV has only 3-4 total items, the circle parade is short with only a few transitions. The scrollable distance adapts proportionally.
- ✅ **Very many items**: If the CV has 30+ items, the circle parade is long. The consistent scroll-distance-per-circle ensures the experience doesn't feel rushed or stretched.
- ✅ **Long content within a circle**: If an experience entry has many highlights, the circle at center accommodates the content — if it exceeds the viewport, the circle content scrolls internally (overflow scroll within the circle). The circle remains at center during internal content scroll.
- ✅ **Rapid scrolling**: Fast scroll wheel or trackpad flings should not cause jarring visual jumps. Circles transition smoothly based on scroll position — rapid scrolling simply plays the transitions faster.
- ✅ **Scroll to exact boundary**: If the visitor stops scrolling mid-transition (between two circles), the parade pauses at that intermediate state — both circles partially visible. This is acceptable; the next scroll motion continues from that point.
- ✅ **Anchor navigation during transition**: If the visitor clicks a navigation dot while a circle transition is in progress, the smooth-scroll animation redirects to the new target section.
- ✅ **Theme switch state loss**: When switching away from Space and returning, the parade resets to the beginning (About circle at center). Cross-theme state persistence is a future enhancement.
- ✅ **Floating controls + anchor dots**: If the viewport is narrow, controls (top-right) and anchor dots (right edge) must not overlap. The anchor dots sit below the controls on the right edge.
- ✅ **Contact with no data**: If `contact` is undefined or has no populated fields, the Contact circle is omitted and its anchor dot is hidden.
- ✅ **Background remains static**: The deep-space abstract background does not move or animate during scrolling — only circles move. This provides a stable depth reference that makes the circle motion readable.

## Requirements _(mandatory)_

### Functional Requirements

#### Layout Structure

- **FR-001**: System MUST render the Space theme as a full-viewport page with a deep-space abstract background (using `--background` from `space.css`). The circle parade occupies the scrollable area; a single scroll container drives the entire experience.

- **FR-002**: System MUST apply the space theme color tokens from `src/styles/themes/space.css` as the theme's visual foundation. The background uses `--background`, circles use the glass-morphism card tokens (`--card`, `--border`), text uses `--foreground`, and accents use `--primary` (nebula violet) and `--accent` (aurora green).

- **FR-003**: System MUST use a single vertical scroll container. A tall spacer element creates the scrollable distance, and circle positions are computed from the scroll offset — they are NOT laid out in document flow.

#### Circle Parade Mechanics

- **FR-004**: System MUST compute a flat ordered list of all CV items (circle entries) from `CVData` in this section order:
  1. **About/Hero** — 1 circle from `CVData.personality`
  2. **Experience** — N circles from `CVData.experience[]`, in array order (newest first)
  3. **Projects** — N circles from `CVData.projects[]`
  4. **Skills** — N circles from `CVData.skillCategories[]` (one per category)
  5. **Education** — N circles from `CVData.education[]`
  6. **Courses** — N circles from `CVData.courses[]`
  7. **Certificates** — N circles from `CVData.certificates[]`
  8. **Contact** — 1 circle from `CVData.contact` (omitted if no contact data)

  Sections with empty arrays produce zero circles. The total scrollable distance adapts to the number of circles.

- **FR-005**: System MUST define a default "circle span" — the base scroll distance that advances from one circle at center to the next circle at center. Default: `100vh` (one viewport height). Per FR-011, individual circles may have an expanded effective span for overflow content, up to a `300vh` cap. The total scroll distance is the sum of all circles' effective spans, and each circle's center position is the cumulative sum of preceding effective spans.

- **FR-006**: System MUST position each circle based on the current scroll offset relative to the circle's center position (accounting for per-circle effective spans per FR-005):
  - When scroll offset equals the circle's cumulative center position, circle N is at center (full size, full opacity).
  - Before its center: the circle enters from the right at small size, growing and moving left as scroll approaches its center.
  - After its center: the circle shrinks and drifts left, exiting the viewport as scroll moves past.

- **FR-007**: System MUST implement the circle appearance transition using these visual properties based on the scroll offset relative to the circle's center:

  **Position (horizontal translateX)**:
  - Before center: circle is offset to the right (e.g., `translateX(50vw)` at max distance, `translateX(0)` at center).
  - After center: circle drifts left (e.g., `translateX(0)` at center, `translateX(-50vw)` at max distance).

  **Scale**:
  - At max entry distance: `scale(0.3)` (small dot entering from right).
  - At center: `scale(1.0)` (full size).
  - At max exit distance: `scale(0.3)` (small dot exiting left).

  **Opacity**:
  - At max entry distance: `opacity(0.2)`.
  - At center: `opacity(1.0)`.
  - At max exit distance: `opacity(0.2)`.

  All three properties interpolate smoothly based on the circle's distance from center. Easing: ease-out for entry, ease-in for exit.

- **FR-008**: System MUST ensure that at any scroll position, only one circle is at or near `scale(1.0)` and `opacity(1.0)` — the circle closest to its center position. Adjacent circles are at smaller scales and lower opacities during transition.

- **FR-009**: System MUST apply a subtle floating/bobbing animation to the circle at center (or nearest to center) using the existing `space-float` keyframe and `float-panel` class from `space.css`. The animation provides a gentle 6px vertical oscillation over 5s (using existing `--float-duration: 6s` token from `space.css`). The animation is suppressed for circles in active enter/exit transition.

#### Circle Content Rendering

- **FR-010**: System MUST render each circle's content derived from the corresponding CV data item:

  - **About circle**: `CVData.personality` — name prominent, tagline below, summary text, favorite quote (if present).
  - **Experience circle**: Single `Experience` entry — company name, role, date range (startDate–endDate or "Present"), highlights as bullet list, location (if present).
  - **Project circle**: Single `Project` — name, description, tech stack tags, links (URL, GitHub) as clickable references.
  - **Skill category circle**: Single `SkillCategory` — category name as header, each skill with name and level indicator (bar or numeric).
  - **Education circle**: Single `Education` entry — degree, institution, date range, description (if present).
  - **Course circle**: Single `Course` — title, provider, date, certificate link (if present).
  - **Certificate circle**: Single `Certificate` — name, issuer, date, credential ID (if present), verification URL (if present).
  - **Contact circle**: `CVData.contact` — email, phone, location, website, LinkedIn, GitHub as a styled contact card.

- **FR-011**: System MUST handle overflow content within a circle: if the circle at center has content taller than the viewport, the circle content scrolls internally. The circle itself remains centered while its content scrolls. The effective scroll span for that circle expands to accommodate all content so that the parade does not advance until the user has scrolled through the full content. The expanded span has a maximum cap of `300vh` to prevent excessive stretching for extremely long entries — content beyond `300vh` is accessible via manual scroll within the circle while the parade holds at the cap.

- **FR-012**: System MUST omit circles for empty data. If `CVData.contact` is undefined or has all fields empty, the Contact circle is omitted. Empty arrays produce no circles for that section.

#### Navigation Anchor Dots

- **FR-013**: System MUST render navigation anchor dots along the right edge of the viewport, fixed-position. One dot per major non-empty section (About, Experience, Projects, Skills, Education, Courses, Certificates, Contact). Dots are labeled with the section name.

- **FR-014**: System MUST visually distinguish the dot corresponding to the section whose circle is currently at or nearest center (active dot = filled/highlighted with `--primary` color; inactive dots = dimmed outline with `--muted-foreground`).

- **FR-015**: System MUST smoothly scroll to the first circle of the target section when a navigation dot is clicked. The smooth-scroll behavior is interruptible — clicking another dot mid-animation redirects to the new target.

- **FR-016**: System MUST update the active dot in real-time as the visitor scrolls naturally, reflecting whichever section's circles are currently nearest center.

#### Glass-Morphism Circle Styling

- **FR-017**: System MUST style each circle with a glass-morphism appearance:
  - Semi-transparent background using `--card` token
  - Backdrop blur: `blur(24px)` (`backdrop-filter: blur(24px)`)
  - Border: `1px solid` using `--border` token
  - Box-shadow: `0 0 80px rgba(167, 139, 250, 0.06), 0 15px 50px rgba(0, 0, 0, 0.35), inset 0 0 50px rgba(255, 255, 255, 0.015)`
  - Perfectly circular shape (`border-radius: 50%`), or near-circular with large border-radius for content fit

- **FR-018**: System MUST ensure text content within circles is readable against the glass background, with sufficient contrast using `--foreground` for text and `--muted` for secondary information.

- **FR-019**: System MUST size circles using two tiers based on content type:
  - **Standard circle**: `60vw × 60vw` (60% of viewport) — for content-heavy entries: Experience (with highlights), Projects (with description), Skill Categories (with multiple skills), Education (with description), About
  - **Compact circle**: `45vw × 45vw` (45% of viewport) — for minimal-content entries: Courses (title + provider + date), Certificates (name + issuer + date), Contact (contact info card)
  All sizes are `min(vw, vh)` to ensure the circle fits within the viewport.

#### Floating Controls

- **FR-020**: System MUST render the theme selector and language toggle as floating, fixed-position controls in the top-right corner of the viewport. Controls are styled as translucent elements consistent with the space theme.

- **FR-021**: System MUST power the floating controls by reading and writing to the existing signal infrastructure (`currentTheme` from `src/state/theme.ts`, `currentLocale` and `changeLocale` from `src/state/locale.ts`). The controls use space-themed styling while maintaining consistency through shared signals.

- **FR-022**: System MUST ensure floating controls remain fixed in position and accessible while the circle parade scrolls behind them. Controls must not overlap with anchor dots — anchor dots sit below the controls on the right edge.

#### Locale Reactivity

- **FR-023**: System MUST read CV data from the `currentCV` computed signal (`src/state/locale.ts`). When `currentLocale` changes, all circles re-render with translated content while maintaining the current scroll position.

- **FR-024**: System MUST ensure that locale switching does not change the total number of circles or the scroll position.

#### Accessibility: Reduced Motion

- **FR-025**: System MUST detect `prefers-reduced-motion: reduce` via CSS media query. When active, the system MUST:
  - Disable all circle enter/exit/grow/shrink animations
  - Disable the floating/bobbing animation
  - Render circles as a simple vertical stack (circles laid out in document flow, one after another)
  - Enable standard vertical scrolling

- **FR-026**: System MUST ensure the reduced-motion fallback preserves all CV content, navigation anchor dots, and floating controls — only the motion effects are removed.

#### Performance

- **FR-027**: System MUST use CSS `transform` (translateX, scale) and `opacity` for circle animations to leverage GPU/hardware acceleration. No layout-triggering properties (width, height, top, left) are animated.

- **FR-028**: System MUST apply `will-change: transform, opacity` only to circles currently within the visible transition zone (the entering circle, the center circle, and the exiting circle — at most 3 circles at any time). All other circles have `will-change` removed.

- **FR-029**: System MUST use a `requestAnimationFrame`-based scroll observer (or an equivalent React idiom like a scroll event handler with rAF throttling) for computing circle positions from scroll offset, ensuring updates are synchronized with the browser's paint cycle.

- **FR-030**: System MUST keep the total number of rendered DOM nodes constant — the circle parade reuses a fixed pool of 7 circle components that are repositioned and re-contented based on scroll position, rather than creating DOM nodes for every CV item. This prevents DOM bloat for CVs with many items.

#### Component Structure

- **FR-031**: System MUST organize Space theme components under `src/themes/space/` with this file structure:
  ```
  src/themes/space/
   ├── SpacePage.tsx              # Root layout — scroll container, background, spacer
   ├── components/
   │   ├── CircleParade.tsx        # Scroll observer, circle pool manager, position computer
   │   ├── ParadeCircle.tsx        # Individual circle — receives content + position, applies transforms
   │   ├── AnchorDots.tsx          # Navigation anchor dots along the right edge
   │   ├── FloatingControls.tsx    # Theme and language toggle floating controls
   │   └── circle-content/
   │       ├── AboutContent.tsx      # About/Hero content renderer
   │       ├── ExperienceContent.tsx # Experience entry content renderer
   │       ├── ProjectContent.tsx    # Project content renderer
   │       ├── SkillCategoryContent.tsx # Skill category content renderer
   │       ├── EducationContent.tsx  # Education entry content renderer
   │       ├── CourseContent.tsx     # Course content renderer
   │       ├── CertificateContent.tsx # Certificate content renderer
   │       └── ContactContent.tsx    # Contact content renderer
   └── parade-utils.ts            # Circle position math, interpolation helpers
  ```

- **FR-032**: System MUST replace the existing `SpacePage.tsx` stub with the full implementation. The `themePages` map in `App.tsx` already routes `space` to `SpacePage` — no changes to `App.tsx` are needed.

#### State Management

- **FR-033**: System MUST create `src/themes/space/parade-utils.ts` containing pure functions:
  - `buildCircleEntries(cv: CVData): CircleEntry[]` — flattens CVData into the ordered circle list
  - `computeEffectiveSpans(entries: CircleEntry[], defaultSpanVh: number): number[]` — calculates per-circle scroll spans with content overflow expansion capped at `300vh` per FR-011
  - `computeCircleTransform(scrollOffset: number, circleCenterVh: number, effectiveSpanVh: number): CircleTransform` — returns `{ translateX, scale, opacity }` for a given circle and scroll position relative to its center
  - `buildSections(entries: CircleEntry[]): SectionInfo[]` — groups circles by section for anchor dot mapping
  - `getActiveSectionIndex(sections: SectionInfo[], activeCircleIndex: number): number` — returns which anchor dot section the active circle belongs to

- **FR-034**: System MUST define TypeScript types for the circle parade in `src/themes/space/parade-utils.ts`:
  - `CircleEntry`: `{ type: CircleType; data: CVItemData; sectionLabel: string; sectionId: SectionId; index: number }` — a single circle's content reference
  - `CircleType`: `'about' | 'experience' | 'project' | 'skillCategory' | 'education' | 'course' | 'certificate' | 'contact'`
  - `SectionId`: `'about' | 'experience' | 'projects' | 'skills' | 'education' | 'courses' | 'certificates' | 'contact'` — section identifiers for anchor dot grouping
  - `CircleTransform`: `{ translateX: number; scale: number; opacity: number }` — visual transform values
  - `SectionInfo`: `{ id: SectionId; label: string; firstCircleIndex: number; circleCount: number }` — section summary for anchor dots
  - `CVItemData`: A discriminated union of the specific CV item types

#### Testing

- **FR-035**: System MUST update the existing test file at `src/themes/space/space.test.tsx` to cover:
  - `buildCircleEntries` produces correct circle list from CVData
  - `computeCircleTransform` returns correct `{ translateX, scale, opacity }` for various scroll offsets
  - Circle at center has `scale: 1, opacity: 1, translateX: 0`
  - Adjacent circles during transition have intermediate values
  - Circle pool renders the correct number of circles (fixed pool, not per-item DOM)
  - Navigation anchor dots render for each non-empty section
  - Anchor dot click triggers scroll to correct circle
  - Floating controls render and interact with theme/locale signals
  - Reduced-motion fallback renders circles as vertical stack
  - Empty data sections produce no circles and hide their anchor dot
  - Locale switching updates circle content without changing scroll position

- **FR-036**: System MUST include unit tests for `parade-utils.ts` covering all pure functions with edge cases (empty CV, single-item CV, boundary scroll positions).

### Key Entities

- **CircleEntry**: A single item in the circle parade. Contains:
  - `type`: Which CV section this circle belongs to
  - `data`: The specific CV data item (e.g., one Experience, one Project)
  - `sectionLabel`: The parent section name for anchor dot mapping

- **CircleParade (component)**: The scroll observer and circle pool manager. Key concerns:
  - **Scroll offset**: Current `scrollTop` of the scroll container, read via scroll event + rAF
  - **Circle pool**: A fixed array of 7 `ParadeCircle` components that are reused — repositioned and re-contented based on scroll position
  - **Active circle index**: Which `CircleEntry` is closest to center, derived from `scrollOffset / circleSpan`
  - **Circle span**: The scroll distance per circle (default `100vh`)

- **ParadeCircle (component)**: A single circle element in the pool. Key concerns:
  - **Assigned entry**: The `CircleEntry` this pool slot is currently displaying
  - **Transform**: `translateX`, `scale`, `opacity` computed from `computeCircleTransform`
  - **Content renderer**: Dispatches to the correct content component based on `entry.type`
  - **Visibility**: Hidden (display:none) when assigned to a circle far outside the visible zone

- **AnchorDots**: Fixed-position navigation. Key concerns:
  - **Dot entries**: One per non-empty section, derived from the unique `sectionLabel` values in the circle entries list
  - **Active dot**: The section whose circles are currently nearest center
  - **Scroll targets**: The scroll offset that brings the first circle of each section to center

- **FloatingControls**: Fixed-position controls for theme and language. Key concerns:
  - Reads `currentTheme` and `currentLocale` signals
  - Writes to `currentTheme` and calls `changeLocale()`

- **CV Data** (from F-002): Read via `currentCV.value`. All circle content derives from `CVData`.

**Entity Relationships**:
```
Scroll Position (scrollTop)
 ├── Drives computeCircleTransform() for each circle in the pool
 ├── Determines activeCircleIndex (which CircleEntry is at center)
 └── Determines which AnchorDots dot is active

CircleEntry[] (from buildCircleEntries(currentCV))
 ├── Defines the total number of circles and their order
 ├── Used by CircleParade to assign content to pool slots
 └── Used by AnchorDots to determine which sections exist

Circle Pool (fixed array of ParadeCircle components)
 ├── Each slot assigned a CircleEntry based on scroll position proximity
 ├── Each slot receives a CircleTransform for positioning
 └── Slots far from visible zone are hidden

currentCV (Computed<CVData>, from locale.ts)
 └── Fed to buildCircleEntries() to produce the circle list
 └── Changing locale triggers rebuild of circle list with translated content

currentTheme / currentLocale (Signals, from theme.ts / locale.ts)
 └── Read by FloatingControls for display and change handling

prefers-reduced-motion (CSS media query)
 └── When "reduce": bypasses CircleParade pool mechanics, renders circles as static vertical stack
```

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Full item coverage**: Every non-empty CV item produces a circle in the parade. The total circle count matches: 1 (about) + experience.length + projects.length + skillCategories.length + education.length + courses.length + certificates.length + (contact ? 1 : 0). Verified by: unit test on `buildCircleEntries`.

- **SC-002 — Circle parade transitions**: Scrolling advances through circles with the enter-right → grow-to-center → shrink-exit-left pattern. At any scroll position, at most one circle has `scale >= 0.9` and `opacity >= 0.9`. Verified by: unit test on `computeCircleTransform` at various offsets and visual inspection.

- **SC-003 — Circle center alignment**: When scroll offset equals a circle's cumulative center position (sum of preceding effective spans per FR-005/FR-011), that circle returns `{ translateX: 0, scale: 1, opacity: 1 }`. The default spacing between adjacent circle centers is the effective span for each circle. Verified by: unit test using per-circle center positions.

- **SC-004 — Anchor dots functional**: All non-empty sections have a visible dot. Clicking a dot scrolls to the first circle of that section. The active dot tracks the current section as the visitor scrolls. Verified by: component tests.

- **SC-005 — Locale reactivity**: Switching locale updates all circle content without changing scroll position or circle count. Verified by: component test that switches locale mid-parade and verifies content changes.

- **SC-006 — Floating controls work**: Theme and language controls are visible, fixed, and functional. Theme switching replaces the space layout. Language switching updates content. Verified by: component tests.

- **SC-007 — Reduced-motion fallback**: With `prefers-reduced-motion: reduce`, circles render as a static vertical stack with no animations. Content, anchors, and controls remain functional. Verified by: test with mocked media query.

- **SC-008 — DOM node count bounded**: The circle pool renders exactly 7 DOM nodes regardless of how many CV items exist. A CV with 50 items and a CV with 5 items produce the same DOM node count. Verified by: rendering with large mock CV data and checking DOM node count.

- **SC-009 — Zero TypeScript errors**: The entire Space theme implementation compiles under `strict: true` with no `any` types and no `@ts-ignore` directives. Verified by: `npm run build` passes cleanly.

- **SC-010 — Existing CSS reused**: The existing `src/styles/themes/space.css` file is used as the color and animation foundation. The `float-panel` and `space-float` classes are leveraged for the center circle's bobbing. Verified by: test that CSS classes are applied.

## Assumptions

- **F-002 (Data Model) is complete**: `CVData` types and both `cv.en.json` / `cv.de.json` files exist and are importable. F-003 consumes these, does not create or modify them.
- **F-011 (Page Layout) is complete**: The app shell, routing, and theme-page mapping in `App.tsx` are in place. The `themePages` map already routes `space` to `SpacePage`. No changes to `App.tsx` are needed.
- **F-012 (Theme System) is available**: `createLocalStorageSignal`, `currentTheme` signal, `ThemeId` type, and `DocumentElement.dataset.theme` sync all exist in `src/state/theme.ts`.
- **F-013 (Multilanguage) is complete**: `currentLocale`, `currentCV`, `currentUI` computed signals, and `changeLocale` function all exist in `src/state/locale.ts`.
- **Desktop-only**: The Space theme is designed for desktop screens with a mouse or trackpad. Responsive layout below 1024px is out of scope.
- **Experience ordered newest-first**: The `CVData.experience` array is already sorted newest-first (by convention from F-002). The theme renders in array order without re-sorting.
- **Circle shape is near-circular**: Circles use a large `border-radius` (possibly `50%` for shorter content) but may become slightly elliptical for long content that exceeds a perfect circle's capacity. The exact shape adapts to content fit.
- **Circle span defaults to 100vh, with per-circle effective spans**: The default scroll distance between circle centers is `100vh`. Circles with overflow content expand their effective span per FR-011 up to a `300vh` cap. Circle center positions are computed from cumulative effective spans.
- **No scroll position preservation across theme switches**: Switching away from Space and returning resets to the beginning.
- **Anchor dots on the right edge**: Navigation dots sit on the right edge, below the floating controls.
- **Floating controls in top-right**: Theme and language toggles are fixed at top-right.
- **Existing `space.css` is reused**: The existing CSS file is the foundation. New styles for circles and parade mechanics are additive — existing tokens and keyframes remain intact.
- **Glass-morphism uses backdrop-filter**: The frosted glass effect relies on `backdrop-filter: blur()`. Browsers without support see a semi-transparent circle without blur — acceptable graceful degradation.
- **Circle pool size is 7**: This covers the entering circle, center circle, exiting circle, and 4 buffer circles for smooth transitions at parade start/end. Research confirmed 7 is the optimal size.
- **Abstract background only initially**: The initial implementation uses the deep-space abstract background from `space.css`. Photo backgrounds are a future enhancement — the architecture supports adding background layers but ships with abstract-only.

## Clarifications

Record of the clarification session on 2026-06-21. Three questions were answered before finalizing the spec.

| # | Question | Choice | Impact |
|---|---|---|---|
| 1 | Circle granularity: one circle per section or per item? | One circle = one item (each experience, project, skill category, etc. is its own circle) | Defined FR-004 circle list construction and FR-010 per-item content rendering |
| 2 | How many circles visible at once? | One circle fully visible at center. Incoming and outgoing circles visible at edges during brief overlap transition. Timing is critical. | Defined FR-006/FR-007/FR-008 transition mechanics and User Story 4 timing requirements |
| 3 | Background style? | Abstract dark space (existing space.css tokens). Photo backgrounds as future enhancement. | Defined in assumptions — abstract-only for initial implementation, architecture extensible |
| 4 | Overflow content handling (content taller than viewport within a circle)? | Extend span (Option A) — effective scroll span expands to fit all content up to 300vh cap. Beyond cap: manual scroll within the circle. | Resolved FR-011 conflict; parade never advances past unread content |

## Out of Scope

- Mobile-responsive layout (desktop-only, 1024px+)
- Per-circle internal scroll position preservation (resets when circle leaves center)
- Cross-theme scroll/parade position preservation
- Photo-based backgrounds (future enhancement)
- Activities section rendering (optional data, omitted from initial implementation)
- Background particle effects, star fields, or animated backgrounds
- 3D model or WebGL-based rendering (pure CSS transforms only)
- Keyboard-only circle navigation (beyond standard scroll and anchor clicks)
- Print-friendly styling for the space theme
- Touch/swipe gestures for circle navigation
- Configurable circle span or animation curves (hardcoded defaults)
- Circle shape variants (all circles use the same large-border-radius shape)
