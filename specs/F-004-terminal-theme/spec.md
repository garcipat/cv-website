# Feature Specification: Terminal Theme (Retro CRT)

**Feature Branch**: `F-004-terminal-theme`
**Created**: 2026-06-21
**Status**: Draft
**Input**: User description: "Define the F-004: Terminal Theme feature to have the retro-terminal theme setup and see how it should work and even make some mockups"
**Ideas document**: `docs/ideas/retro-terminal-theme.md`

> **Design details** (visual treatment, font stack, color values, CRT effects, ASCII layout mockups) live in the ideas document. This spec defines the functional requirements, user flows, and success criteria needed for implementation planning.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View CV as Terminal Output (Priority: P1)

A visitor opens the CV website with the Terminal theme active. The entire page renders as a retro CRT terminal: black background, green phosphor text, monospaced font. All CV sections (personality, experience, skills, projects, education, courses, certificates, contact) are displayed as terminal output — styled with `>` prompt-like section headers, box-drawing ASCII separators, and readable monospaced formatting. The visitor can scroll through the entire CV like reading a long terminal session.

**Why this priority**: The terminal rendering is the core visual experience. Without it, none of the interactive features have a canvas. This delivers immediate value even before any command interaction is built.

**Independent Test**: Load the Terminal theme. Verify all CV sections are rendered as styled terminal text. Verify monospaced font, green-on-black color scheme, scanline overlay, and phosphor glow on headings. Scroll through the content — verify all sections are readable and the CRT effects persist.

**Acceptance Scenarios**:

1. **Given** the Terminal theme is active, **When** the page loads, **Then** the full viewport renders with a black background (`#0a0a0a`), green phosphor text (`#33ff33` / oklch-based), and a monospaced font.
2. **Given** the terminal is rendered, **When** the visitor views the content, **Then** all CV sections (personality, experience, skills, projects, education, courses, certificates, contact) are displayed with section headers prefixed by `>` and separated by ASCII horizontal rules (`═════`).
3. **Given** the terminal is rendered, **When** the visitor looks at the screen, **Then** a scanline overlay (repeating horizontal lines) and a subtle phosphor glow on headings are visible, as defined in the ideas document.
4. **Given** the terminal is rendered, **When** the active locale is `'de'`, **Then** all CV content is displayed in German with the same terminal styling.
5. **Given** the terminal content exceeds the viewport height, **When** the visitor scrolls, **Then** the terminal output scrolls vertically while the command input line and status bar remain fixed at the bottom.

---

### User Story 2 - Command-Line Navigation (Priority: P1)

A visitor sees a blinking cursor at a command prompt at the bottom of the terminal. They type `:help` and press Enter — the terminal outputs a list of available commands with descriptions. They then type `:exp` and press Enter — the terminal scrolls smoothly to the Experience section. They type `:skills` — the terminal scrolls to the Skills section. Each command produces a brief acknowledgement line (e.g., `# Showing experience...`) before scrolling to the relevant content.

**Why this priority**: The command-line interaction is the defining interaction metaphor of the terminal theme. It's what makes this more than just a green-styled page. Combined with US-1, this completes the MVP.

**Independent Test**: Type `:help` and press Enter — verify the help output appears. Type `:exp` — verify the terminal scrolls to the Experience section. Type an invalid command — verify a friendly error message appears. Test all documented commands.

**Acceptance Scenarios**:

1. **Given** the terminal theme is loaded, **When** the visitor types `:help` and presses Enter, **Then** a formatted list of all available commands with descriptions is displayed in the terminal output.
2. **Given** the terminal is showing content, **When** the visitor types `:about` and presses Enter, **Then** the terminal scrolls to the personality/summary section and shows an acknowledgement line.
3. **Given** the terminal is showing content, **When** the visitor types `:exp`, `:projects`, `:skills`, `:education`, `:courses`, `:certificates`, or `:contact` and presses Enter, **Then** the terminal scrolls to the corresponding CV section.
4. **Given** the terminal is showing content, **When** the visitor types `:top` and presses Enter, **Then** the terminal scrolls to the top of the output.
5. **Given** the terminal is showing content, **When** the visitor types `:clear` and presses Enter, **Then** the terminal output clears (shows only the welcome header) and the command input stays active.
6. **Given** the visitor types an unrecognized command (e.g., `:foo`), **When** they press Enter, **Then** the terminal displays an error message like `Unknown command ':foo'. Type :help for available commands.` without breaking the UI.
7. **Given** the active locale is `'de'`, **When** the visitor types `:help`, **Then** command descriptions are displayed in German.

---

### User Story 3 - CRT Visual Effects (Priority: P2)

The terminal theme applies the retro CRT aesthetic consistently across the entire viewport: a scanline overlay animates subtly across the screen, headings emit a soft green phosphor glow, the main container has a subtle curvature (rounded corners with overflow hidden), and the color palette uses classic green-on-black with amber accents for highlights. The CRT effects are implemented entirely in CSS using the existing `[data-theme="terminal"]` selector infrastructure.

**Why this priority**: The CRT effects are the visual signature of the terminal theme. They can be implemented independently of the command interaction and scroll behavior. While critical for the aesthetic, they're P2 because the content and navigation (P1) must work first.

**Independent Test**: Open the Terminal theme. Verify the scanline overlay is visible and animating. Inspect heading elements — verify `text-shadow` glow is applied. Verify the root container has `border-radius` for screen curvature. Confirm the color scheme matches the ideas document.

**Acceptance Scenarios**:

1. **Given** the Terminal theme is active, **When** the page renders, **Then** a fixed scanline overlay (using `#root::after` with `repeating-linear-gradient`) covers the entire viewport, animates at a subtle speed, and does not intercept pointer events.
2. **Given** the terminal has heading elements (h1, h2, h3), **When** rendered, **Then** each heading has a green phosphor glow via `text-shadow` as defined in `terminal.css`.
3. **Given** the terminal layout container, **When** rendered, **Then** it has a subtle `border-radius` (screen curvature) with `overflow: hidden` to clip content to the curved edges.
4. **Given** the CRT effects are active, **When** the visitor switches to another theme, **Then** all CRT effects are removed (driven by `[data-theme]` selector change).
5. **Given** the visitor has reduced motion preferences (`prefers-reduced-motion: reduce`), **When** the terminal theme loads, **Then** the scanline animation is disabled but the static scanline overlay remains.

---

### User Story 4 - Theme and Language Switching via Commands (Priority: P2)

A visitor types `:theme space` and presses Enter — the theme switches to the Space theme. They switch back to Terminal via the theme switcher, then type `:lang de` — the locale changes to German and all terminal content updates. The `:theme` and `:lang` commands integrate with the existing signal infrastructure (`currentTheme`, `changeLocale`).

**Why this priority**: These commands provide an in-character way to switch themes and language without leaving the terminal metaphor. They're P2 because the global theme/language switchers (already built) serve as a fallback.

**Independent Test**: Type `:theme ide` — verify the IDE theme loads. Switch back to Terminal. Type `:lang de` — verify content changes to German. Test `:theme terminal` and `:lang en` to switch back. Test invalid arguments (`:theme foo`, `:lang fr`) — verify appropriate error messages.

**Acceptance Scenarios**:

1. **Given** the Terminal theme is active, **When** the visitor types `:theme ide` and presses Enter, **Then** the theme switches to the IDE theme immediately (via `currentTheme.value = 'ide'`).
2. **Given** the Terminal theme is active, **When** the visitor types `:lang de` and presses Enter, **Then** the locale changes to German, all terminal content updates, and the command prompt remains active.
3. **Given** the visitor types `:theme` without an argument, **When** they press Enter, **Then** an error message displays the valid theme options (`ide`, `space`, `terminal`).
4. **Given** the visitor types `:lang` without a valid locale, **When** they press Enter, **Then** an error message displays the valid language options (`en`, `de`).

---

### User Story 5 - Command History Navigation (Priority: P3)

A visitor has typed several commands (`:help`, `:exp`, `:skills`). They press the Up arrow key — the previously typed command (`:skills`) appears in the input line. They press Up again — `:exp` appears. They press Down — `:skills` appears again. They can edit a recalled command before re-submitting it. The command history persists only for the current session (resets on page reload).

**Why this priority**: Command history is a quality-of-life feature that makes the terminal feel authentic. It's P3 because the core navigation (US-2) works without it.

**Independent Test**: Type 3 different commands. Press Up arrow twice — verify the second-most-recent command appears. Press Down — verify the most-recent command appears. Press Enter to execute a recalled command. Verify history resets on page reload.

**Acceptance Scenarios**:

1. **Given** the visitor has typed `:help`, `:exp`, `:skills` in order, **When** they press the Up arrow key, **Then** `:skills` appears in the input line.
2. **Given** the visitor has navigated to `:exp` in history via Up arrow, **When** they press the Down arrow key, **Then** `:skills` reappears in the input line.
3. **Given** the visitor has recalled a command via arrow keys, **When** they edit the text and press Enter, **Then** the edited command executes and is added to history.
4. **Given** the visitor is at the bottom of the history (most recent), **When** they press the Down arrow key, **Then** the input line clears (shows empty prompt, ready for new input).
5. **Given** the visitor reloads the page, **When** the terminal theme loads, **Then** the command history is empty (session-only, not persisted).

---

### User Story 6 - Blinking Cursor and Prompt UI (Priority: P3)

The command input area at the bottom of the terminal displays a prompt symbol (`$`) followed by a blinking block cursor (`█`). The cursor blinks at a steady cadence (~1 second interval). When the visitor types, the cursor moves ahead of the text. The prompt + input + cursor area is styled consistently with the terminal aesthetic — green text on black, monospaced font.

**Why this priority**: The blinking cursor and prompt are the final polish elements that complete the terminal illusion. They're P3 because the terminal is functional without them (a static input field works too).

**Independent Test**: Verify the prompt shows `$` symbol. Verify the cursor blinks at ~1 second interval. Type text — verify the cursor stays at the end of the typed text. Click away from the input — verify the cursor stops blinking. Click back — verify blinking resumes.

**Acceptance Scenarios**:

1. **Given** the terminal theme is loaded, **When** the page renders, **Then** a prompt symbol (`$`) followed by a blinking block cursor is visible at the bottom of the terminal output.
2. **Given** the cursor is blinking, **When** the visitor starts typing, **Then** the typed characters appear before the cursor and the cursor continues blinking at the end of the text.
3. **Given** the input field loses focus, **When** the visitor clicks elsewhere, **Then** the cursor stops blinking (static block visible). When the input regains focus, blinking resumes.
4. **Given** the cursor is visible, **When** the visitor switches themes away from Terminal and back, **Then** the blinking cursor reappears (terminal state is fresh on return).

---

### Edge Cases

- **Invalid commands**: Typing an unrecognized command (e.g., `:asdf`, `:foo bar`) displays an error message: `Unknown command ':asdf'. Type :help for available commands.` The terminal does not crash or clear.
- **Empty command submission**: Pressing Enter with an empty input line does nothing — no output, no error, no scroll.
- **Very long command input**: If the visitor types a command exceeding ~100 characters, the input line wraps visually within the terminal width. No horizontal scrollbar appears.
- **Rapid command execution**: Typing and submitting multiple commands rapidly (e.g., `:exp` then immediately `:skills`) processes each command sequentially. The terminal scrolls to the last requested section, not each intermediate one (last command wins for scroll targets).
- **Content overflow**: CV sections with long content (e.g., many experience entries) extend the terminal output vertically. The scrollable area grows naturally; the command input and status bar remain fixed at the bottom.
- **Keyboard-only navigation**: The terminal is fully operable via keyboard. Mouse clicks on the terminal output area focus the command input. Clicking within the terminal output does not select text or interfere with typing.
- **Locale switch mid-session**: When locale changes via `:lang`, all terminal output content updates immediately. The command history is preserved (commands typed in English remain in history but the terminal output is now German).
- **Theme preservation on return**: When switching away from the Terminal theme and back, terminal-specific state (command history, scroll position, cursor state) resets to defaults. This matches the IDE theme behavior.
- **Accessibility — motion reduction**: When `prefers-reduced-motion: reduce` is active, the scanline animation and cursor blink are disabled. Static scanlines and a static cursor block remain.
- **Accessibility — high contrast**: The green-on-black phosphor color scheme provides sufficient contrast for WCAG AA compliance. A future enhancement could add an amber or high-contrast white phosphor variant.

## Requirements _(mandatory)_

### Functional Requirements

#### Terminal Layout

- **FR-001**: System MUST render the Terminal theme as a full-viewport layout with two fixed zones at the bottom:
  - **Command input line** (immediately above status bar) — prompt symbol + text input + blinking cursor
  - **Status bar** (bottom edge, full width) — decorative status info
  - The remaining viewport area above these zones is the **terminal output area** (scrollable CV content)

- **FR-002**: System MUST apply the CRT phosphor color palette as defined in the ideas document: dark background (`#0a0a0a` / `oklch(0.04 0 0)`), green text (`oklch(0.75 0.12 145)`), bright green primary (`oklch(0.65 0.18 145)`), amber accent for highlights (`oklch(0.7 0.15 85)`), and dim secondary green for metadata (`oklch(0.4 0.06 145)`).

#### Terminal Output Area

- **FR-003**: System MUST render all CV sections in the output area as styled terminal text. Section rendering follows the conventions defined in the ideas document:
  - **Personality** (`:about`): Name and tagline as a header block, summary as prose, favorite quote (if present) as an indented blockquote with `>` prefix
  - **Experience** (`:exp`): Each entry as a block with company, role, dates, and bullet-point highlights using `*` markers
  - **Skills** (`:skills`): Each category as a section header, skills listed with proficiency bars rendered as ASCII-style `[████░░]` indicators
  - **Projects** (`:projects`): Each project with name, description, tech tags (bracketed), and URLs
  - **Education** (`:education`): Each entry with degree, institution, dates, and optional description
  - **Courses** (`:courses`): Each entry with title, provider, year on one line
  - **Certificates** (`:certificates`): Each entry with name, issuer, date, and optional credential ID
  - **Contact** (`:contact`): Email, phone, location, website, LinkedIn, GitHub rendered as labeled fields

- **FR-004**: System MUST render section headers with a `>` prompt prefix (e.g., `> EXPERIENCE`) and separate sections with ASCII horizontal rule lines (e.g., `══════════════════════════════════════`).

- **FR-005**: System MUST apply semantic CSS coloring to terminal output text:
  - Section headers: Bright green / primary color
  - Key values (names, titles, companies): Green / foreground color
  - Dates and metadata: Dim secondary green
  - URLs and links: Amber / accent color
  - Bullet highlights: Default green with `*` prefix

- **FR-006**: System MUST read CV data from the `currentCV` computed signal (`src/state/locale.ts`). When `currentLocale` changes, all terminal output re-renders with translated content.

#### Command-Line Input

- **FR-007**: System MUST render a command input area at the bottom of the terminal with:
  - A prompt symbol (`$`) preceding the input
  - A text input field styled to blend with the terminal aesthetic
  - A blinking block cursor (`█`) at the text insertion point

- **FR-008**: System MUST process the following built-in commands when the visitor presses Enter:
  | Command | Behavior |
  |---------|----------|
  | `:help` | Display formatted list of all available commands with descriptions |
  | `:about` | Scroll to / display personality section |
  | `:exp` | Scroll to / display experience section |
  | `:skills` | Scroll to / display skills section |
  | `:projects` | Scroll to / display projects section |
  | `:education` | Scroll to / display education section |
  | `:courses` | Scroll to / display courses section |
  | `:certificates` | Scroll to / display certificates section |
  | `:contact` | Scroll to / display contact section |
  | `:theme <id>` | Switch theme to `<id>` (valid: `ide`, `space`, `terminal`) |
  | `:lang <locale>` | Switch language to `<locale>` (valid: `en`, `de`) |
  | `:clear` | Clear terminal output (retain welcome header) |
  | `:top` | Scroll terminal output to top |

- **FR-009**: System MUST display an error message for unrecognized commands: `Unknown command '<input>'. Type :help for available commands.` (localized).

- **FR-010**: System MUST display argument validation errors for `:theme` and `:lang` when invalid arguments are provided (e.g., `:theme foo` → `Invalid theme 'foo'. Valid themes: ide, space, terminal.`).

- **FR-011**: System MUST translate all command output, error messages, and help text when the active locale changes. Command names themselves (`:help`, `:exp`, etc.) remain language-independent.

#### CRT Visual Effects

- **FR-012**: System MUST apply a scanline overlay across the entire viewport using the existing `#root::after` pseudo-element with `repeating-linear-gradient`, driven by CSS custom properties `--scanline-opacity` and the `terminal-scanline` keyframe animation. The overlay MUST be `pointer-events: none` so it doesn't interfere with interaction.

- **FR-013**: System MUST apply a phosphor glow text-shadow on heading elements (h1, h2, h3) using the `--glow-color` custom property with three stacked shadows at increasing blur radii (10px, 20px, 40px).

- **FR-014**: System MUST apply a subtle screen curvature effect to the root container via `border-radius: var(--crt-curve)` with `overflow: hidden`.

- **FR-015**: System MUST disable scanline animation and cursor blinking when the user's system preference is `prefers-reduced-motion: reduce`, while keeping static scanlines and a static cursor block visible.

#### Theme and Language Integration

- **FR-016**: System MUST power the `:theme` command by writing directly to the existing `currentTheme` signal (`src/state/theme.ts`).

- **FR-017**: System MUST power the `:lang` command by calling the existing `changeLocale` function (`src/state/locale.ts`).

#### Terminal State Signals

- **FR-018**: System MUST create `src/state/terminal.ts` containing Preact Signals for terminal-specific state:
  - `commandHistory`: `Signal<string[]>` — ordered list of previously executed commands (newest last). Session-only, not persisted.
  - `historyIndex`: `Signal<number>` — current position in command history for arrow-key navigation. `-1` when not navigating history.
  - `currentInput`: `Signal<string>` — current text in the command input field.
  - `cursorVisible`: `Signal<boolean>` — whether the blinking cursor is currently visible (for blink toggle).

- **FR-019**: System MUST provide exported functions in `src/state/terminal.ts`:
  - `executeCommand(input: string): CommandResult` — parses and executes a command, returns structured result indicating success/error and action type
  - `navigateHistory(direction: 'up' | 'down'): void` — updates `currentInput` from `commandHistory` based on direction

#### Command History

- **FR-020**: System MUST capture each executed command in `commandHistory` (appended at the end). Duplicate consecutive commands (typing the same command twice in a row) are still added — no deduplication.

- **FR-021**: System MUST respond to Arrow Up keypress (when input is focused) by recalling the previous command from history into `currentInput`. Arrow Down moves forward toward the most recent. When at the most recent position, Arrow Down clears the input.

- **FR-022**: System MUST reset `commandHistory` and `historyIndex` on page reload (session-only, no localStorage persistence).

#### Component Structure

- **FR-023**: System MUST organize Terminal theme components under `src/themes/terminal/` with this file structure:
  ```
  src/themes/terminal/
   ├── TerminalPage.tsx          # Root layout — assembles all zones
   ├── components/
   │   ├── TerminalOutput.tsx    # Scrollable output area rendering CV sections
   │   ├── CommandInput.tsx      # Command prompt + text input + blinking cursor
   │   ├── CommandHelp.tsx       # :help command output renderer
   │   └── StatusLine.tsx        # Bottom status bar
   ├── terminal-commands.ts      # Command parsing, validation, execution logic
   └── terminal.test.tsx         # Existing test file (update for new components)
  ```

- **FR-024**: System MUST ensure `TerminalPage` imports and reads `currentCV` and `currentUI` signals to pass locale-aware data to child components. The existing `themePages` map in `App.tsx` already routes to `TerminalPage` — no App.tsx changes required.

#### Status Bar

- **FR-025**: System MUST render a status bar at the bottom of the viewport (below the command input) showing decorative text: `screen 80x24 · 9600 baud · vt100` on the left side. The right side shows the current theme name and locale (e.g., `terminal · EN`).

- **FR-026**: System MUST update the status bar right-side text when theme or locale changes.

#### Testing

- **FR-027**: System MUST include unit tests for `src/state/terminal.ts` covering:
  - `executeCommand` returns correct result for each built-in command
  - `executeCommand` returns error for unrecognized commands
  - `executeCommand` validates `:theme` and `:lang` arguments
  - `navigateHistory` recalls correct command for Up/Down directions
  - `navigateHistory` at boundaries (empty history, past oldest, past newest) behaves correctly
  - Command history is appended in correct order

- **FR-028**: System MUST include unit tests for `terminal-commands.ts` covering:
  - Command parsing handles leading/trailing whitespace
  - Command parsing handles empty input
  - Argument extraction works for `:theme ide` and `:lang de`
  - Case sensitivity: command names are case-insensitive but section navigation still works

- **FR-029**: System MUST include component tests for `CommandInput` covering:
  - Enter key submits the command and clears the input
  - Arrow Up/Down navigates command history
  - Blinking cursor toggles visibility at correct interval
  - Input field gains focus on terminal area click
  - Prompt symbol renders before the input

### Key Entities

- **Terminal State Signals** (`src/state/terminal.ts`):
  - `commandHistory`: Ordered list of executed command strings. Drives arrow-key navigation. Session-only.
  - `historyIndex`: Tracks current position during history navigation. `-1` means "not navigating."
  - `currentInput`: The text currently in the command input field. Bound to the input element.
  - `cursorVisible`: Boolean toggle for blinking cursor animation. Alternates at ~1 second interval.

- **Command Result** (internal type, in `terminal-commands.ts`):
  - Structured result of command execution: `{ type: 'navigate' | 'theme' | 'lang' | 'clear' | 'help' | 'error' | 'none', target?: string, message?: string }`
  - Consumed by `TerminalPage` to decide what action to take (scroll, switch theme, change locale, display message).

- **CV Data** (from F-002): Read via `currentCV.value`. All 8 command targets map to CVData fields:
  - `:about` → `CVData.personality`
  - `:exp` → `CVData.experience`
  - `:skills` → `CVData.skills`
  - `:projects` → `CVData.projects`
  - `:education` → `CVData.education`
  - `:courses` → `CVData.courses`
  - `:certificates` → `CVData.certificates`
  - `:contact` → `CVData.contact`

- **Shared Signals** (from F-012, F-013):
  - `currentTheme` (`src/state/theme.ts`): Written by `:theme` command
  - `currentLocale` / `changeLocale` (`src/state/locale.ts`): Used by `:lang` command

**Entity Relationships**:
```
commandHistory (Signal<string[]>)
 ├── Appended by executeCommand()
 ├── Read by navigateHistory()
 └── Reset on page reload

currentInput (Signal<string>)
 ├── Bound to CommandInput input element
 ├── Set by navigateHistory() during arrow-key navigation
 └── Cleared after command execution

cursorVisible (Signal<boolean>)
 └── Toggled by setInterval in CommandInput component

TerminalPage
 ├── Reads currentCV → passes to TerminalOutput
 ├── Reads currentUI → passes to CommandHelp, error messages
 ├── Reads currentTheme → writes via :theme command
 ├── Calls changeLocale → via :lang command
 └── Owns executeCommand flow → updates output/scroll position
```

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Full section coverage**: All 8 CV sections (personality, experience, skills, projects, education, courses, certificates, contact) are accessible via the `:help` command listing and render correctly in the terminal output. Verified by: executing each section command and confirming content matches `CVData` for the active locale.

- **SC-002 — Command execution accuracy**: All 13 built-in commands (`:help`, `:about`, `:exp`, `:skills`, `:projects`, `:education`, `:courses`, `:certificates`, `:contact`, `:theme`, `:lang`, `:clear`, `:top`) execute without errors and produce the expected terminal output or action. Verified by: automated tests for `executeCommand`.

- **SC-003 — Error handling**: Invalid commands and invalid arguments produce descriptive, localized error messages without breaking the terminal UI. Verified by: typing 5+ invalid commands in sequence, confirming error messages appear and terminal remains functional.

- **SC-004 — Command history navigation**: After executing 5 commands, pressing Arrow Up 5 times recalls all 5 commands in reverse chronological order. Arrow Down returns forward. Verified by: automated tests for `navigateHistory`.

- **SC-005 — Locale reactivity**: Switching locale via `:lang de` updates all terminal output content to German. Switching back via `:lang en` restores English. Command outputs (help text, error messages) also translate. Verified by: manual verification and automated tests.

- **SC-006 — CRT visual effects**: Scanline overlay animates across the viewport, headings emit green phosphor glow, and the root container has curved corners. Effects respect `prefers-reduced-motion` (animations disabled, static effects remain). Verified by: visual inspection of the rendered theme against the CRT specification in the ideas document.

- **SC-007 — Build integrity**: The entire Terminal theme implementation compiles without errors, with full type safety and no suppressed type checks. Verified by: project build passes cleanly with no warnings.

- **SC-008 — Theme interoperability**: Switching from Terminal to IDE or Space theme via `:theme` command works correctly. Switching back to Terminal via the global theme switcher loads the Terminal theme with fresh default state. Verified by: round-trip theme switching test.

## Assumptions

- **F-002 (Data Model) is complete**: `CVData` types and both `cv.en.json` / `cv.de.json` files exist and are importable. F-004 consumes these, does not create or modify them.
- **F-012 (Theme System) infrastructure is available**: `createLocalStorageSignal`, `currentTheme` signal, `ThemeId` type, and `DocumentElement.dataset.theme` sync all exist in `src/state/theme.ts`. F-004 uses these, does not recreate them.
- **F-013 (Multilanguage) is complete**: `currentLocale`, `currentCV`, `currentUI` computed signals, and `changeLocale` function all exist in `src/state/locale.ts`. F-004 reads these signals.
- **Desktop-first**: The Terminal theme is designed for desktop screens. Mobile responsiveness is explicitly out of scope for the initial implementation. The terminal layout assumes a minimum viewport width of ~800px.
- **No cross-theme state persistence**: When switching away from the Terminal theme and back, terminal-specific state (command history, scroll position, cursor state) resets to defaults. This matches the IDE theme behavior.
- **Scanline and CRT effects are CSS-only**: The CRT visual effects (scanlines, glow, curvature) are implemented entirely in `src/styles/themes/terminal.css` and applied via the `[data-theme="terminal"]` selector. No JavaScript-based rendering for effects.
- **Command input is a styled text input**: The command input uses an HTML `<input>` element styled to look like a terminal prompt. It is not a custom canvas-based terminal emulator or xterm.js instance.
- **Commands are case-insensitive**: `:HELP`, `:Help`, and `:help` all produce the same result. Arguments are case-sensitive where appropriate (e.g., `:lang DE` is invalid, must be `de`).
- **Section scrolling, not filtering**: Section commands (`:about`, `:exp`, etc.) scroll the terminal output to the relevant section. They do not hide or filter other content — the full CV remains visible above and below the scrolled-to section.
- **Session-only state**: Command history and scroll position are not persisted across page reloads or theme switches. No localStorage for terminal state.
- **The existing `terminal.css` is correct**: The CRT custom properties, scanline overlay, glow effects, and font variables already defined in `src/styles/themes/terminal.css` provide the foundation. F-004 builds the interactive layer on top.

## Out of Scope

- Mobile-responsive layout (desktop-only)
- Cross-theme state persistence (terminal state resets on theme switch)
- Custom canvas-based terminal rendering (uses styled HTML elements, not xterm.js)
- Tab-completion for commands
- Real shell features (pipes, redirects, scripting)
- Command aliases or customization
- Multiple phosphor color variants (amber, white) — green only for v1
- Animated typewriter text effect for initial load
- Sound effects (keyboard clicks, CRT hum)
- Print-friendly styling for the terminal theme
- Keyboard shortcuts beyond Arrow Up/Down and Enter
