# Architecture

## Technology Stack

| Layer           | Choice                                   |
| --------------- | ---------------------------------------- |
| Build tool      | Vite 6+                                  |
| Framework       | React 19+                                |
| State           | Preact Signals (`@preact/signals-react`) |
| Language        | TypeScript (strict mode)                 |
| Styling         | Tailwind CSS 4+                          |
| Components      | shadcn/ui (added fresh via CLI)          |
| Data            | Typed JSON files under `src/data/`       |
| Testing         | Vitest + React Testing Library + jsdom   |
| Package manager | npm                                      |

## Data Flow

```
src/data/cv.en.json ──┐
                       ├──> signals (currentCV, currentLocale, currentTheme)
src/data/cv.de.json ──┘              │
                                      ▼
                           Theme Layout Components
                           (each theme reads signals directly)
                                      │
                                      ▼
                           App.tsx ──(renders active theme)──> Page
```

- **Signals layer**: `currentTheme` (IDE / 3D / Terminal), `currentLocale` (en / de), `currentCV` (computed from locale) — all components read signals directly, no prop drilling
- **Theme isolation**: Each theme is a separate root layout component with its own DOM structure and Tailwind styling. Themes share signals, not components
- **JSON data**: `cv.en.json` and `cv.de.json` share the `CVData` type. `currentCV` computed signal returns the active locale's data
- **No backend**: Static site — data lives in JSON files, no API calls, no database

## Multilanguage (i18n)

Two layers of translation, both driven by `currentLocale` signal:

### Layer 1: CV Content Data

```
src/data/
├── cv.en.json      # English CV content
└── cv.de.json      # German CV content
```

- Both files share `CVData` type — structurally identical, content differs
- `currentCV` computed signal returns the active locale's data

### Layer 2: UI Strings

```
src/i18n/
├── translations.ts   # UITranslations interface
├── en.ts             # English UI strings
└── de.ts             # German UI strings
```

- Labels, navigation, theme names, status bar text, buttons
- `currentUI` computed signal returns the active locale's UI strings
- Theme components use `currentUI.value.nav.experience` etc.

### Locale Signal

- `currentLocale` — `"en" | "de"`, persisted to `localStorage`
- `getBrowserLocale()` — detects `navigator.language`, defaults to `"en"`
- Language toggle placed in a consistent location across all themes

## Project Structure

```
src/
├── components/                # Shared components (used across themes)
│   └── ui/                    # shadcn components (CLI-managed)
├── data/                      # JSON data files
│   ├── cv.en.json             # English CV content
│   └── cv.de.json             # German CV content
├── i18n/                      # UI translation strings
│   ├── translations.ts        # UITranslations interface
│   ├── en.ts                  # English UI strings
│   └── de.ts                  # German UI strings
├── lib/                       # Utility functions (cn(), createLocalStorageSignal, etc.)
├── state/                     # Preact Signals (global reactive state)
│   ├── theme.ts               # currentTheme signal + theme list
│   ├── locale.ts              # currentLocale + currentCV + currentUI computed
│   └── ide.ts                 # IDE-specific signals (activeFile, openTabs, etc.)
├── themes/                    # Theme layouts — each theme is self-contained
│   ├── ide/                   # IDE theme
│   │   ├── components/        # IDE-specific components
│   │   │   ├── FileTree.tsx
│   │   │   ├── TabBar.tsx
│   │   │   ├── EditorPane.tsx
│   │   │   └── StatusBar.tsx
│   │   └── IdeLayout.tsx      # Root layout for IDE theme
│   ├── space/                 # 3D Room theme
│   │   ├── components/        # Space-specific components
│   │   │   ├── FloatingPanel.tsx
│   │   │   └── ParallaxLayer.tsx
│   │   └── SpaceLayout.tsx    # Root layout for 3D Room theme
│   └── terminal/              # Retro Terminal theme
│       ├── components/        # Terminal-specific components
│       │   ├── Scanlines.tsx
│       │   ├── CommandPrompt.tsx
│       │   └── TerminalOutput.tsx
│       └── TerminalLayout.tsx # Root layout for Terminal theme
├── types/                     # TypeScript type definitions
│   └── cv.ts                  # CVData interface
├── App.tsx                    # Root component — renders active theme layout
├── main.tsx                   # Entry point
└── index.css                  # Tailwind directives + global styles
```

## Key Patterns

- **Signals over Context**: Preact Signals for all shared state — no React Context, no prop drilling, minimal re-renders
- **Theme-as-layout**: Each theme is a self-contained layout component tree. Tailwind is used within each theme, never for cross-theme style switching. Language toggle and theme switcher are rendered by each theme in its own native style (IDE: sidebar/status bar, Terminal: commands, 3D Room: floating controls)
- **Typed data, presentational components**: Data flows from signals — components don't fetch or transform data
- **shadcn/ui components**: Added via CLI only (`npx shadcn add <name>`), live in `src/components/ui/`, never hand-modified
- **Static site**: No backend, no API calls, no database — everything is build-time
- **cn() utility**: Use `@/lib/utils` `cn()` helper for conditional Tailwind classes
- **localStorage persistence**: `createLocalStorageSignal()` wraps a signal with automatic `localStorage` sync

## Design Decisions

Design decisions for features are documented in `docs/ideas/` and `specs/` at the project root. Each spec covers a specific feature or setup phase with decisions, trade-offs, and rationale.
