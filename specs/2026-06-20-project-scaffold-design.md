# Project Scaffold Design

**Date**: 2026-06-20
**Topic**: Initial project setup — Vite + React + TypeScript scaffold, tooling, project structure, data model, and documentation

---

## Technology Stack

| Layer | Choice |
|---|---|
| Build tool | Vite 6+ |
| Framework | React 19+ |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4+ |
| Components | shadcn/ui (added fresh via CLI, not copied from other projects) |
| Data | Typed JSON files under `src/data/` |
| Testing | Vitest + React Testing Library |
| Package manager | npm |

## Initialization Sequence

1. `npm create vite@latest . -- --template react-ts` — scaffold into current directory
2. Install and configure Tailwind CSS (postcss plugin + `@tailwindcss/vite`)
3. `npx shadcn@latest init` — sets up Tailwind CSS variables, utilities, `lib/utils.ts`, base styles
4. Add needed shadcn components via `npx shadcn@latest add <name>`
5. Install Vitest + React Testing Library + jsdom

## Project Structure

```
cv-website/
├── docs/                          # Project documentation
│   ├── Architecture.md            # Tech stack, data flow, key patterns
│   ├── CodingGuidelines.md        # Naming, component structure, conventions
│   ├── Features.md                # Feature list, status, dependency diagram
│   ├── RepositoryStructure.md     # Directory layout with descriptions
│   └── TestingGuide.md            # Vitest setup, coverage, naming pattern
├── public/                        # Static assets (favicon, etc.)
├── src/
│   ├── components/                # App-specific components
│   │   └── ui/                    # shadcn components (managed by CLI, do not hand-edit)
│   ├── data/                      # JSON data files for CV content
│   ├── lib/                       # Utility functions (cn() helper, etc.)
│   ├── types/                     # TypeScript type definitions
│   ├── App.tsx                    # Root component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Tailwind directives + global styles
├── AGENTS.md                      # Agent instructions + project conventions
├── README.md
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Principles

- `data/` holds all CV content as typed JSON — single source of truth, easy to maintain without touching components
- `types/` defines TypeScript interfaces matching the JSON shapes, giving autocomplete everywhere
- `components/` is flat for now, no deep nesting — reorganize when layout is decided
- `components/ui/` is shadcn territory — added/updated via CLI only (`npx shadcn add`), never copy-pasted from other projects
- Config files live at project root (universal convention)

## Data Model

```typescript
// types/cv.ts

interface CVData {
  personality: Personality;
  career: CareerEntry[];
  courses: Course[];
  skills: SkillCategory[];
}

interface Personality {
  name: string;
  tagline: string;
  summary: string;
}

interface CareerEntry {
  company: string;
  role: string;
  period: string;
  highlights: string[];
}

interface Course {
  title: string;
  provider: string;
  year: number;
}

interface SkillCategory {
  name: string;       // e.g., "Frontend", "Backend", "Languages"
  skills: Skill[];
}

interface Skill {
  name: string;
  level: number;      // 1-5 or 0-100, for rendering progress bars/stars
}
```

The JSON data file imports these types: `const cv: CVData = { ... }` — ensuring the data always matches the types.

## Documentation Plan

| Doc | Content |
|---|---|
| **Architecture.md** | Tech stack, data flow (JSON → typed import → component render), key patterns (typed data, presentational components) |
| **CodingGuidelines.md** | Naming conventions, component structure, importing `cn()` for Tailwind classes, when to create vs reuse shadcn components |
| **Features.md** | Feature list with eventual features (display personality, career timeline, skill bars, course list), implementation status table, dependency diagram |
| **RepositoryStructure.md** | Directory layout with descriptions of what lives in each folder |
| **TestingGuide.md** | Vitest + React Testing Library setup, coverage targets, test naming pattern (`Method_Condition_ExpectedResult`) |

## AGENTS.md Updates

Add project-specific conventions:
- **Tech stack**: Vite + React + TypeScript + Tailwind + shadcn/ui
- **Data pattern**: CV content lives in typed JSON files under `src/data/`
- **shadcn**: Add components with `npx shadcn add <name>` only — never copy-paste from other projects
- **Strict TypeScript**: No `any`, proper types for all data and component props
- **No backend**: This is a static site — no server, no API calls, no database

## Out of Scope (Deferred)

- Layout and visual design (to be decided in next iteration)
- Which specific shadcn components to use
- Final section organization (single page vs multi-page vs tabs)
- Deployment configuration
