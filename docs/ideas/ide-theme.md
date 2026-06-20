# Idea: IDE / Editor Theme

## Status: Design Exploration

## Summary

The primary CV theme styled as a code editor. The page mimics a modern IDE (VS Code-like) with a file-tree sidebar, tabbed sections, syntax-highlighted content, and a status bar. Uses the Catppuccin Mocha color palette for a polished dark code-editor feel.

## Layout

```
┌──────────────────────────────────────────────────────┐
│  Menu bar (File Edit Selection View Go Run Terminal) │
├──────────┬───────────────────────────────────────────┤
│          │  Tab bar: [about.tsx] [exp.tsx] [proj...] │
│  File    ├───────────────────────────────────────────┤
│  Tree    │                                           │
│          │  Editor content area                      │
│  📁 cv/  │  - CV sections rendered as TypeScript/    │
│   about  │    React code with syntax highlighting    │
│   exp    │  - Section headings are function decls    │
│   proj   │  - Data is object properties              │
│   skills │  - Icons are imported components          │
│   contact│                                           │
│   person │                                           │
│          │                                           │
│  ─────── │                                           │
│  THEMES  │                                           │
│  ● IDE   │                                           │
│  ○ 3D    │                                           │
│  ○ Term  │                                           │
├──────────┴───────────────────────────────────────────┤
│  Status bar: master │ Ln 8, Col 32 │ UTF-8 │ TS      │
└──────────────────────────────────────────────────────┘
```

## Key Components

### File Tree Sidebar
- Mirrors the actual project structure (`src/components/`, `src/types/`, `src/data/`)
- CV sections are "files" in the tree — clicking opens them as tabs
- Active file is highlighted
- Folders are expandable/collapsible
- Theme switcher at the bottom of the sidebar

### Tab Bar
- One tab per CV section: about, experience, projects, skills, personality, contact
- Active tab is highlighted with an accent color indicator at the top
- Tabs can be closed or reordered (nice-to-have, not essential)
- Future: split-view for comparing two sections side by side

### Editor Content Area
- CV content rendered with syntax highlighting
- Language mode: TypeScript React (TSX)
- Line numbers on the left gutter
- Each section is a function component returning JSX
- Icons from lucide-react appear as imported components
- Text content as string literals
- Lists (skills, projects) as arrays

### Status Bar
- Left side: git branch indicator (e.g., `master` or a custom label), problem count
- Right side: line/column (scroll position), indentation ("Spaces: 2"), encoding (UTF-8), language mode (TypeScript React), build tool (Vite)
- Pure decoration — adds personality, not interactive

## Color Palette (Catppuccin Mocha)

| Token | Color | Usage |
|-------|-------|-------|
| Base | `#1e1e2e` | Editor background |
| Surface | `#181825` | Tab bar, title bar |
| Mantle | `#11111b` | Sidebar, status bar |
| Text | `#cdd6f4` | Primary text |
| Subtext | `#a6adc8` | Secondary text |
| Overlay | `#6c7086` | Comments, inactive text |
| Lavender | `#cba6f7` | Keywords (`import`, `export`, `from`) |
| Blue | `#89b4fa` | Component names, function names |
| Green | `#a6e3a1` | Props, properties |
| Red | `#f38ba8` | String literals |
| Yellow | `#f9e2af` | Brackets, parentheses |
| Pink | `#f5c2e7` | Directory/file icons |

## Navigation

- Sections are navigated via file tree clicks or tab clicks
- Only one section visible at a time (single editor pane by default)
- Could support split-view later for comparing two sections

## State (Preact Signals)

| Signal | Purpose |
|--------|---------|
| `activeFile` | Currently open CV section (e.g., `"about"`) |
| `openTabs` | Set of open tab filenames |
| `sidebarExpanded` | Which folders are expanded in the file tree |
| `activeTheme` | Shared signal — which theme is active (IDE / 3D / Terminal) |

Signals keep tab, file tree, and theme state reactive without prop drilling through the IDE layout.

## Desktop-First

This theme is designed for desktop screens (1280px+). Mobile responsiveness is not a priority for the first iteration.
