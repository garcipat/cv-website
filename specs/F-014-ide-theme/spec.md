# Feature Specification: IDE Theme

**Feature Branch**: `F-014-ide-theme`  
**Created**: 2026-06-21  
**Status**: Draft  
**Input**: User description: "IDE theme feature to define our first theme to display the CV data. Define visuals and how the navigation should work."  
**Clarifications session**: 2026-06-21 — 4 questions answered (see ## Clarifications).  
**Ideas document**: `docs/ideas/ide-theme.md`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse CV Sections via File Tree (Priority: P1)

A visitor opens the CV website and sees an IDE-like interface. A file tree sidebar on the left shows the project structure: `cv-website/ → src/ → sections/` containing `.tsx` files for each CV section (`exp.tsx`, `skills.tsx`, `projects.tsx`, `education.tsx`, `courses.tsx`, `certificates.tsx`). An `about.tsx` file sits outside the `sections/` folder. The visitor clicks `exp.tsx` — the editor pane on the right shows the experience section rendered as readable pseudo-code, and a new tab labeled `exp.tsx` appears in the tab bar above the editor.

**Why this priority**: File tree navigation is the primary visitor interaction. Without it, the IDE theme is just a styled page with no interactivity. This is the core navigation metaphor.

**Independent Test**: Load the IDE theme, verify the file tree renders with all 7 CV section files in the correct hierarchy. Click `exp.tsx` — verify the editor shows experience content and the tab bar shows `exp.tsx`. Click `about.tsx` — verify the editor switches to personality/summary content and the tab bar updates.

**Acceptance Scenarios**:

1. **Given** the IDE theme is active, **When** the page loads, **Then** the file tree sidebar is visible on the left showing `cv-website/` as root with `src/` expanded and `sections/` folder containing 6 `.tsx` files plus `about.tsx` outside sections.
2. **Given** no CV section is currently selected (fresh load), **When** the visitor clicks `about.tsx` in the file tree, **Then** the editor pane displays the personality/summary content and a tab labeled `about.tsx` appears in the tab bar.
3. **Given** the visitor clicks `skills.tsx`, **When** the editor renders, **Then** the skills content appears and `skills.tsx` tab is added to the tab bar alongside any existing tabs.
4. **Given** the file tree is visible, **When** the visitor collapses the `sections/` folder, **Then** the folder items hide; expanding it again shows the same files.
5. **Given** the active locale is `'de'`, **When** the visitor clicks a file tree item, **Then** the editor displays content in German.

---

### User Story 2 - Multi-Tab Navigation (Priority: P1)

A visitor has opened `about.tsx`, then clicks `exp.tsx` and `skills.tsx`. Three tabs appear in the tab bar above the editor: `[about.tsx] [exp.tsx] [skills.tsx]`. The last-clicked tab (`skills.tsx`) is active and highlighted. The visitor clicks the `about.tsx` tab — the editor switches back to the personality content. The visitor clicks the close icon on `exp.tsx` — the tab is removed. If the closed tab was active, the rightmost remaining tab becomes active.

**Why this priority**: Multi-tab navigation is a defining feature of the IDE metaphor. Without it, the experience is just a file tree + single pane, not an IDE.

**Independent Test**: Click multiple file tree items, verify tabs accumulate. Click tabs to switch, verify content updates. Close a tab, verify it's removed and a neighboring tab becomes active.

**Acceptance Scenarios**:

1. **Given** a visitor clicks `about.tsx`, `exp.tsx`, `skills.tsx` in order, **When** all three are clicked, **Then** three tabs appear in the tab bar and `skills.tsx` is the active tab with highlighted styling.
2. **Given** tabs `[about.tsx] [exp.tsx] [skills.tsx]` are open with `skills.tsx` active, **When** the visitor clicks the `about.tsx` tab, **Then** the editor switches to about content, `about.tsx` becomes highlighted, and `skills.tsx` loses highlight.
3. **Given** `[about.tsx] [exp.tsx] [skills.tsx]` with `skills.tsx` active, **When** the visitor closes the `skills.tsx` tab, **Then** the tab disappears, the rightmost remaining tab (`exp.tsx`) becomes active, and the editor shows experience content.
4. **Given** only one tab is open (`about.tsx`), **When** the visitor closes it, **Then** the tab bar becomes empty and the editor shows a welcome/empty state.
5. **Given** a tab is already open for `skills.tsx`, **When** the visitor clicks `skills.tsx` in the file tree again, **Then** the existing tab becomes active (no duplicate tab is created).

---

### User Story 3 - Readable Pseudo-Code Editor Content (Priority: P1)

A non-technical visitor (HR manager, recruiter) opens the IDE theme and sees CV content rendered as readable pseudo-code. The editor uses semantic CSS coloring (not token-by-token highlighting): section headings look like function declarations with a distinct color, key data like company names and dates stand out as property values in another color, and bullet-point highlights read as clean string arrays. No real TypeScript syntax parsing is needed — the content uses a lightweight structural format that is inviting and easy to scan without programming knowledge.

**Why this priority**: The editor content is what visitors actually read. If it's confusing or overly technical (real JSX with imports, hooks, curly braces), non-programmers will bounce. Readability for all audiences is non-negotiable.

**Independent Test**: Render each CV section in the editor pane. Verify a non-technical reader can understand name, roles, dates, skills, and highlights without being confronted by React hooks, JSX syntax, or complex code patterns.

**Acceptance Scenarios**:

1. **Given** `about.tsx` is active, **When** the editor renders, **Then** the personality name, tagline, and summary are displayed as readable pseudo-code using color-coded structural elements (headings in one color, values in another). No React imports, hooks, or JSX markup is visible.
2. **Given** `exp.tsx` is active, **When** the editor renders, **Then** each experience entry shows company name, role, dates, and highlights in a scannable structure with semantic coloring that distinguishes field labels from values.
3. **Given** `skills.tsx` is active, **When** the editor renders, **Then** skill categories and individual skills with levels are presented as a clean key-value-like structure.
4. **Given** the editor is rendering any section, **When** the content exceeds the viewport height, **Then** the editor pane scrolls vertically (with line numbers scrolling in sync).
5. **Given** the active locale switches from `'en'` to `'de'`, **When** the editor re-renders, **Then** all text content updates to German while the structural layout and coloring remain identical.

---

### User Story 4 - Status Bar with Context Info (Priority: P2)

A status bar at the bottom of the page displays contextual information: the active section name (left side), a decorative line/column indicator (right side), and a language mode indicator (`TypeScript React`). The status bar is purely decorative — it reinforces the IDE metaphor without being interactive.

**Why this priority**: The status bar adds polish and authenticity to the IDE metaphor but doesn't affect navigation or content display. It's a P2 enhancement.

**Independent Test**: Verify the status bar renders at the bottom of the viewport. Verify the left side shows the active file name. Verify the right side shows line/column and language mode text. Switch tabs — verify the status bar updates.

**Acceptance Scenarios**:

1. **Given** `about.tsx` is active, **When** the page renders, **Then** the status bar left side shows `about.tsx` and the right side shows decorative `Ln X, Col Y` and `TypeScript React`.
2. **Given** the visitor switches to `exp.tsx`, **When** the tab becomes active, **Then** the status bar left side updates to `exp.tsx`.
3. **Given** the status bar is rendered, **When** the visitor interacts with it, **Then** it has no click behavior — it is purely informational.

---

### User Story 5 - Theme and Language Toggle in Sidebar (Priority: P2)

Below the file tree in the sidebar, a settings-like area shows the theme and language toggles rendered as radio button lists. The current theme (`IDE`) is selected with a filled radio; the other themes (`3D Room`, `Retro Terminal`) are unselected options. Similarly, the active language (`EN` / `DE`) is shown as a radio group. This placement mimics IDE settings panels and keeps the top area clean for the menu bar.

**Why this priority**: The theme and language toggles are required for the application to function but can technically live anywhere. Placing them in the sidebar as radio lists creates a playful IDE-settings metaphor and frees the menu bar for other uses.

**Independent Test**: Verify both toggle groups render below the file tree. Click a different theme radio — verify the theme changes. Click a different language radio — verify the locale changes. Verify the selected options are visually indicated.

**Acceptance Scenarios**:

1. **Given** the IDE theme is active, **When** the sidebar renders, **Then** below the file tree a "THEMES" radio group shows with `IDE` selected by default and `3D Room`/`Retro Terminal` unselected.
2. **Given** the language radio group is visible, **When** the visitor clicks `DE`, **Then** the locale changes to German, all editor content updates, and the `DE` radio becomes selected.
3. **Given** the radio groups are rendered, **When** the visitor switches themes via the radio list, **Then** App.tsx renders the new theme layout — the IDE sidebar and radio lists are replaced by the newly selected theme's interface.

---

### User Story 6 - Static Top Menu Bar (Priority: P3)

A static menu bar spans the top of the page with IDE-typical menu items: `File`, `Edit`, `Selection`, `View`, `Go`, `Run`, `Terminal`. These are decorative only — no dropdowns, no interactions. They establish the IDE look without adding behavioral complexity.

**Why this priority**: The menu bar is pure decoration that makes the IDE metaphor feel complete, but provides no functional value. It's a P3 polish item.

**Independent Test**: Verify the menu bar renders with all menu labels. Verify no dropdowns or interactions are present. Verify it stays fixed at the top when the editor scrolls.

**Acceptance Scenarios**:

1. **Given** the IDE theme loads, **When** the page renders, **Then** a top menu bar with `File Edit Selection View Go Run Terminal` is visible.
2. **Given** the editor content scrolls, **When** the visitor scrolls down, **Then** the menu bar remains fixed at the top of the viewport.

---

### Edge Cases

- **Empty editor state**: On first load with no tabs open, the editor pane shows a welcome/empty state (e.g., a subtle message or icon) rather than blank space. The file tree is visible and ready for interaction.
- **Closing the last tab**: When all tabs are closed, the editor returns to the empty/welcome state. The file tree remains visible.
- **Duplicate tab prevention**: Clicking a file tree item that already has an open tab does not create a second tab — it activates the existing tab.
- **File tree overflow**: If the file tree grows or the viewport is very short, the file tree section scrolls independently within the sidebar. The theme/language radio groups at the bottom remain pinned.
- **Localized file names**: File names in the tree (`about.tsx`, `exp.tsx`) are language-independent and remain identical across locales. Only the editor *content* changes with locale.
- **Locale persistence across tabs**: Switching locale preserves all open tabs and the active tab. Only the editor content re-renders with translated text.
- **Theme switch state preservation**: When switching *away from* the IDE theme to another theme and back, IDE-specific state (open tabs, active tab, expanded folders) is **not** preserved — each theme visit starts fresh. This is acceptable for the initial implementation.
- **Rapid tab switching**: Rapidly clicking multiple file tree items creates tabs correctly without race conditions or duplicate active states.
- **Scroll position per tab**: Each tab does NOT preserve its scroll position. Switching tabs always shows the top of the content. This is acceptable for the initial implementation.

## Requirements _(mandatory)_

### Functional Requirements

#### Layout Structure

- **FR-001**: System MUST render the IDE theme as a full-viewport layout with four zones:
  - **Menu bar** (top, full width, fixed) — static menu labels
  - **Sidebar** (left, fixed width ~260px, full remaining height) — file tree + theme/language radio groups
  - **Editor area** (right, flexible width) — tab bar + content pane
  - **Status bar** (bottom, full width) — context info

- **FR-002**: System MUST apply the Catppuccin Mocha color palette as the theme's visual foundation. The sidebar and status bar use `Mantle` (`#11111b`), the editor background uses `Base` (`#1e1e2e`), the tab bar uses `Surface` (`#181825`), primary text uses `Text` (`#cdd6f4`), and secondary text uses `Subtext` (`#a6adc8`). Refer to `docs/ideas/ide-theme.md` for the full token-to-role mapping.

#### File Tree Sidebar

- **FR-003**: System MUST render a file tree in the sidebar with the following hierarchy:
  ```
  📁 cv-website/
   ├── 📁 src/
   │    ├── 📄 about.tsx
   │    └── 📁 sections/
   │         ├── 📄 exp.tsx
   │         ├── 📄 skills.tsx
   │         ├── 📄 projects.tsx
   │         ├── 📄 education.tsx
   │         ├── 📄 courses.tsx
   │         └── 📄 certificates.tsx
  ```

- **FR-004**: System MUST render folders as expandable/collapsible. The `src/` folder MUST be expanded by default. The `sections/` folder MUST be expanded by default.

- **FR-005**: System MUST highlight the file tree item corresponding to the currently active tab. If no tab is active, no file tree item is highlighted.

- **FR-006**: System MUST respond to clicks on file tree items by opening or activating a tab for that CV section (see Tab Bar requirements).

#### Tab Bar

- **FR-007**: System MUST render a tab bar above the editor pane showing all open tabs. Each tab displays the file name (e.g., `about.tsx`, `exp.tsx`).

- **FR-008**: System MUST render each tab with a close button (× icon). Clicking the close button removes the tab. If the closed tab was active, the rightmost remaining tab becomes active. If no tabs remain, the editor shows the empty state.

- **FR-009**: System MUST highlight the active tab with the accent color (`Lavender`, `#cba6f7`) as a top border indicator.

- **FR-010**: System MUST ensure clicking a file tree item that already has an open tab activates the existing tab — no duplicate tabs are created.

- **FR-011**: System MUST switch the editor content to the corresponding CV section when a tab is clicked (becomes active).

- **FR-012**: System MUST provide an empty/welcome state in the editor pane when no tabs are open.

#### Editor Content Pane

- **FR-013**: System MUST render CV section content as readable pseudo-code using the following structural conventions for each section:

  **`about.tsx`** (maps to `CVData.personality`):
  - Name and tagline rendered as a header block
  - Summary text displayed as formatted prose
  - Favorite quote (if present) shown as a highlighted blockquote

  **`exp.tsx`** (maps to `CVData.experience`):
  - Each experience entry rendered as a block with:
    - Company name and role on the first line
    - Date range on the second line
    - Highlights as a bulleted list below
    - Location indicator (if present)

  **`skills.tsx`** (maps to `CVData.skills`):
  - Each skill category rendered as a section header
  - Individual skills shown with name and level indicator (visual bar or percentage)

  **`projects.tsx`** (maps to `CVData.projects`):
  - Each project rendered with name as header
  - Description as body text
  - Tech stack as comma-separated tags
  - Links (URL, GitHub) as clickable references

  **`education.tsx`** (maps to `CVData.education`):
  - Each education entry rendered with degree and institution
  - Date range and description below

  **`courses.tsx`** (maps to `CVData.courses`):
  - Each course rendered with title, provider, and year on one line
  - Optional certificate link

  **`certificates.tsx`** (maps to `CVData.certificates`):
  - Each certificate rendered with name, issuer, and date
  - Optional credential ID and verification URL

- **FR-014**: System MUST apply semantic CSS coloring to pseudo-code elements:
  - Section headings / labels: `Blue` (`#89b4fa`) — e.g., "Company", "Role", "Highlights"
  - Values / data: `Text` (`#cdd6f4`) — e.g., "Tech Innovations Inc.", "Staff Frontend Engineer"
  - Dates and metadata: `Subtext` (`#a6adc8`) — e.g., "2021-04 – 2024-06"
  - Highlighted/important items: `Green` (`#a6e3a1`) — e.g., quote text
  - Links: `Lavender` (`#cba6f7`) — clickable URLs

- **FR-015**: System MUST render line numbers in a gutter on the left side of the editor pane. Line numbers are sequential integers starting from 1, derived from the total count of rendered content rows (each visual output line — heading, value, list item — increments the counter). The gutter scrolls in sync with the editor content via a shared scroll container. Line numbers are purely decorative and do not track logical line/column positions.

- **FR-016**: System MUST ensure the editor pane scrolls vertically when content exceeds the viewport height. The tab bar and status bar remain fixed.

- **FR-017**: System MUST read CV data from the `currentCV` computed signal (`src/state/locale.ts`). When `currentLocale` changes, all open tabs re-render with translated content while maintaining the active tab.

#### Menu Bar

- **FR-018**: System MUST render a static menu bar at the top of the page containing the labels: `File`, `Edit`, `Selection`, `View`, `Go`, `Run`, `Terminal`. These labels are decorative — no dropdown menus, no click handlers.

- **FR-019**: System MUST keep the menu bar fixed at the top of the viewport when the editor content scrolls.

#### Status Bar

- **FR-020**: System MUST render a status bar at the bottom of the viewport with:
  - Left side: The active file name (e.g., `about.tsx`), or empty string when no tab is active
  - Right side: Decorative text showing `Ln X, Col Y` and `TypeScript React` (non-functional, no scroll tracking)

- **FR-021**: System MUST update the status bar left-side text whenever the active tab changes.

#### Theme and Language Toggles

- **FR-022**: System MUST render the theme selector as a radio button group below the file tree in the sidebar, labeled "THEMES" (uppercase, muted style). The three options are: `IDE`, `3D Room`, `Retro Terminal`. The active theme's radio is selected.

- **FR-023**: System MUST render the language selector as a radio button group below the theme radio group in the sidebar, labeled "LANGUAGE" (uppercase, muted style). The two options are `EN` and `DE`. The active locale's radio is selected.

- **FR-024**: System MUST power the radio groups by reading and writing directly to the existing signal infrastructure (`currentTheme` from `src/state/theme.ts`, `currentLocale` and `changeLocale` from `src/state/locale.ts`). The `ThemeSelect` and `LanguageSelect` dropdown components are NOT reused — the IDE theme uses its own native radio button styling while maintaining consistency through shared signals.

#### IDE State Signals

- **FR-025**: System MUST create `src/state/ide.ts` containing Preact Signals for IDE-specific state:
  - `activeFile`: `Signal<string | null>` — the currently active file name (e.g., `'about.tsx'`), or `null` when no tab is active
  - `openTabs`: `Signal<string[]>` — ordered list of open tab file names
  - `sidebarExpanded`: `Signal<Set<string>>` — set of expanded folder paths in the file tree (e.g., `new Set(['src', 'src/sections'])`)

- **FR-026**: System MUST provide two exported functions in `src/state/ide.ts`:
  - `openFile(fileName: string): void` — adds the file to `openTabs` if not already present, sets it as `activeFile`
  - `closeTab(fileName: string): void` — removes the file from `openTabs`, updates `activeFile` to the rightmost remaining tab or `null`

- **FR-027**: System MUST ensure that `openTabs` preserves insertion order (oldest first, newest last). When `closeTab` removes the active tab, `activeFile` selects the rightmost remaining tab. If removing the rightmost tab itself, select the new rightmost.

#### Component Structure

- **FR-028**: System MUST organize IDE theme components under `src/themes/ide/` with this file structure:
  ```
  src/themes/ide/
   ├── IdePage.tsx          # Root layout — assembles all zones
   ├── components/
   │   ├── MenuBar.tsx       # Static top menu bar
   │   ├── FileTree.tsx      # File tree sidebar with folder expansion
   │   ├── TabBar.tsx        # Tab row with open/close/switch
   │   ├── EditorPane.tsx    # Content display with line numbers
   │   ├── StatusBar.tsx     # Bottom status bar
   │   └── SidebarSettings.tsx  # Theme and language radio groups
  ```

- **FR-029**: System MUST ensure the `IdePage` component imports and reads `currentCV` and `currentUI` signals to pass locale-aware data to child components. The root layout must NOT be modified in `App.tsx` — the existing `themePages` map already routes to `IdePage`.

#### Testing

- **FR-030**: System MUST include unit tests for `src/state/ide.ts` covering:
  - `openFile` adds to `openTabs` and sets `activeFile`
  - `openFile` does not duplicate an already-open tab
  - `closeTab` removes the tab and selects the correct successor
  - `closeTab` on the last tab results in `null` activeFile and empty openTabs
  - Tab ordering is preserved on open/close operations

- **FR-031**: System MUST include component tests for `FileTree` verifying:
  - All files and folders render in the correct hierarchy
  - Folders expand/collapse on click
  - Clicking a file calls the open handler with the correct file name
  - The active file is visually highlighted

- **FR-032**: System MUST include component tests for `TabBar` verifying:
  - Open tabs render as tab items with file names
  - Active tab has highlight styling
  - Clicking a tab switches the active tab
  - Clicking close button removes the tab
  - Closing the active tab activates the rightmost remaining tab
  - Empty state renders when no tabs are open

### Key Entities

- **IDE State Signals** (`src/state/ide.ts`):
  - `activeFile`: The currently viewed CV section identifier. Maps directly to a file name like `'about.tsx'` which corresponds to a rendering strategy in `EditorPane`. Components read this signal to determine what content to display and which file tree / tab items to highlight.
  - `openTabs`: Ordered list of file names representing open tabs. Preserves insertion order. Used by `TabBar` to render tab items and by `FileTree` to prevent duplicate tab creation.
  - `sidebarExpanded`: Tracks which folders in the file tree are expanded. Initialized with `src` and `src/sections` expanded.

- **File Tree Items**: Each item in the tree is either a folder (expandable, contains children) or a file (clickable, maps to a CV section). Defined as a static data structure (not from signals) since the file hierarchy is fixed. Rendered by `FileTree` component.

- **Editor Section Renderers**: Each CV section (personality, experience, skills, projects, education, courses, certificates) has a dedicated rendering function within `EditorPane` that transforms CVData fields into the pseudo-code format with semantic CSS coloring. These are internal to the editor and not exported.

- **CV Data** (from F-002): Read via `currentCV.value` from the locale signal. All 7 file tree items map to subsets of `CVData`:
  - `about.tsx` → `CVData.personality`
  - `exp.tsx` → `CVData.experience`
  - `skills.tsx` → `CVData.skills`
  - `projects.tsx` → `CVData.projects`
  - `education.tsx` → `CVData.education`
  - `courses.tsx` → `CVData.courses`
  - `certificates.tsx` → `CVData.certificates`

**Entity Relationships**:
```
activeFile (Signal<string | null>)
 ├── Determines which EditorPane section renderer is active
 ├── Determines which FileTree item is highlighted
 └── Used by StatusBar for left-side label

openTabs (Signal<string[]>)
 ├── Drives TabBar rendering (tab items, order)
 ├── Checked by openFile() for duplicate prevention
 └── Updated by closeTab() with successor selection

sidebarExpanded (Signal<Set<string>>)
 └── Controls FileTree folder expand/collapse state

currentCV (Computed<CVData>, from locale.ts)
 └── Provides all content data to EditorPane section renderers

currentUI (Computed<UITranslations>, from locale.ts)
 └── Provides translated UI strings (not currently needed for IDE chrome since labels are mostly language-independent)

currentTheme (Signal<ThemeId>, from theme.ts)
 └── Read by SidebarSettings radio group for active selection

currentLocale (Signal<Locale>, from locale.ts)
 └── Read by SidebarSettings radio group for active selection
```

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Full section coverage**: All 7 CV sections (`about`, `exp`, `skills`, `projects`, `education`, `courses`, `certificates`) are accessible via the file tree and render correctly in the editor pane. Verified by: click each file tree item, verify content matches `CVData` for the active locale.

- **SC-002 — Multi-tab functionality**: Opening 3+ files creates that many tabs. Closing the active tab activates the rightmost remaining tab. Closing the last tab shows the empty state. Verified by automated component tests.

- **SC-003 — Locale reactivity**: Switching locale from `'en'` to `'de'` updates all editor content in open tabs without losing tab state or the active tab. Verified by: open 3 tabs, switch locale, verify all 3 tabs show German content and the active tab is unchanged.

- **SC-004 — Theme and language toggles work**: Clicking radio buttons for theme or language correctly updates `currentTheme.value` and `currentLocale.value`, propagating through the existing signal infrastructure. Verified by: automated tests and manual verification that theme switching replaces the IDE layout with the selected theme.

- **SC-005 — IDE state signal correctness**: The `openFile` and `closeTab` functions in `src/state/ide.ts` pass all unit tests covering duplicate prevention, ordering, successor selection, and edge cases. Verified by: Vitest unit test suite.

- **SC-006 — Zero TypeScript errors**: The entire IDE theme implementation compiles under `strict: true` with no `any` types, no `as` casts, and no `@ts-ignore` directives. Verified by: `npm run build` passes cleanly.

- **SC-007 — Catppuccin Mocha palette applied**: The IDE theme uses colors exclusively from the Catppuccin Mocha palette as defined in `docs/ideas/ide-theme.md`. Verified by: visual inspection of the rendered theme — sidebar is `#11111b`, editor background is `#1e1e2e`, text is `#cdd6f4`, accent highlights use `#cba6f7` (Lavender) and `#89b4fa` (Blue).

## Assumptions

- **F-002 (Data Model) is complete**: `CVData` types and both `cv.en.json` / `cv.de.json` files exist and are importable. F-014 consumes these, does not create or modify them.
- **F-012 (Theme System) infrastructure is available**: `createLocalStorageSignal`, `currentTheme` signal, `ThemeId` type, and `DocumentElement.dataset.theme` sync all exist in `src/state/theme.ts`. F-014 uses these, does not recreate them.
- **F-013 (Multilanguage) is complete**: `currentLocale`, `currentCV`, `currentUI` computed signals, and `changeLocale` function all exist in `src/state/locale.ts`. The `LanguageSelect` component exists in `src/components/LanguageSelect.tsx`. F-014 reads these signals and wraps the language toggle in its own radio-group UI.
- **Desktop-only**: The IDE theme is designed for desktop screens (1280px+). Mobile responsiveness is explicitly out of scope for the initial implementation. The layout does not need to adapt below 1280px.
- **No scroll position preservation**: When switching between tabs, the editor scroll position resets to the top. Per-tab scroll position is a future enhancement.
- **No theme-return state preservation**: When the visitor switches away from the IDE theme and returns, IDE-specific state (open tabs, active file, expanded folders) resets to defaults. Cross-theme state persistence is a future enhancement.
- **Static file tree**: The file tree hierarchy is hardcoded — it does not dynamically adapt to CV data structure changes. Adding a new CV section requires updating the file tree definition and adding a new editor renderer.
- **No real syntax highlighting**: The editor uses semantic CSS classes for coloring — no tokenizer, AST parser, or syntax highlighting library is used. Content is rendered as React elements with semantic class names, not as real code.
- **Menu bar is non-functional**: The top menu bar items are decorative labels only. No dropdown menus, no interactions, no keyboard shortcuts.
- **Status bar is non-functional**: The status bar shows static/decorative text only. Line/column numbers do not track actual scroll position. No interactive elements.
- **Radio groups replace existing select components**: The theme and language toggles in the sidebar use custom radio button styling appropriate for the IDE theme, not the existing `ThemeSelect` / `LanguageSelect` dropdown components. They read/write the same signals (`currentTheme`, `currentLocale`) to maintain consistency.
- **File names are language-independent**: File tree and tab labels (`about.tsx`, `exp.tsx`, etc.) are the same regardless of locale. Only editor content changes with locale.
- **Tab bar styling follows the mockup**: Active tab has a `Lavender` (`#cba6f7`) top border accent. Inactive tabs have a muted background. Close buttons are subtle and appear on hover.
- **Line numbers start at 1**: Editor gutter line numbers are sequential integers starting from 1, scoped to the editor content height. They are purely visual and do not correspond to logical code lines.

## Clarifications

Record of the clarification session on 2026-06-21. Four questions were asked and answered before finalizing the spec. Each answer is encoded into the relevant sections above.

| # | Question | Choice | Impact |
|---|---|---|---|
| 1 | File tree: mirror project structure or list CV sections as files? | CV-website root → /src → /sections with .tsx files; about.tsx outside sections. Theme/language as radio buttons below tree. | Defined FR-003 hierarchy and FR-022/FR-023 radio placement |
| 2 | Editor rendering: real syntax highlighting or pseudo-code? | Pseudo-code with semantic CSS classes — readable for non-programmers, minimal HTML complexity. | Defined FR-013 structural conventions and FR-014 color mapping |
| 3 | Navigation: single-section or multi-tab? | Multi-tab with open/close. | Defined FR-007 through FR-012 tab bar requirements and FR-025/FR-026 IDE state signals |
| 4 | Create IDE state signals in F-014 or defer? | Include in F-014. Create `src/state/ide.ts` with `activeFile`, `openTabs`, `sidebarExpanded`. | Defined FR-025/FR-026/FR-027 state management requirements |

## Out of Scope

- Mobile-responsive layout (desktop-only, 1280px+)
- Per-tab scroll position preservation
- Cross-theme state persistence (IDE state resets when switching away)
- Real syntax highlighting with a tokenizer library (Shiki, Prism, etc.)
- Functional menu bar dropdowns or keyboard shortcuts
- Functional status bar scroll tracking
- Split-view editor panes
- Tab reordering via drag-and-drop
- File tree dynamic extension (adding new sections requires code changes)
- Print-friendly styling for the IDE theme
