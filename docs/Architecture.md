# Architecture

## Technology Stack

| Layer | Choice |
|---|---|
| Build tool | Vite 6+ |
| Framework | React 19+ |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4+ |
| Components | shadcn/ui (added fresh via CLI) |
| Data | Typed JSON files under `src/data/` |
| Testing | Vitest + React Testing Library + jsdom |
| Package manager | npm |

## Data Flow

```
src/data/cv.json ──(typed import)──> src/components/*.tsx ──(render)──> Page
         │
    CVData interface
    (src/types/cv.ts)
```

- JSON data is imported directly with its TypeScript type, giving full autocomplete
- Components receive typed data as props — no runtime parsing, no API calls
- Content changes mean editing JSON only — components adapt automatically

## Project Structure

```
src/
├── components/                # App-specific components
│   └── ui/                    # shadcn components (CLI-managed)
├── data/                      # JSON data files for CV content
├── lib/                       # Utility functions (cn(), etc.)
├── types/                     # TypeScript type definitions
├── App.tsx                    # Root component
├── main.tsx                   # Entry point
└── index.css                  # Tailwind directives + global styles
```

## Key Patterns

- **Typed data, presentational components**: Data flows top-down through typed props — components don't fetch or transform data
- **shadcn/ui components**: Added via CLI only (`npx shadcn add <name>`), live in `src/components/ui/`, never hand-modified
- **Static site**: No backend, no API calls, no database — everything is build-time
- **cn() utility**: Use `@/lib/utils` `cn()` helper for conditional Tailwind classes

## Design Decisions

Design decisions for features are documented in `specs/` at the project root. Each spec covers a specific feature or setup phase with decisions, trade-offs, and rationale.
