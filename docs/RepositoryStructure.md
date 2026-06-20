# Repository Structure

```
cv-website/
├── docs/                          # Project documentation
│   ├── Architecture.md            # Tech stack, data flow, key patterns
│   ├── CodingGuidelines.md        # Naming conventions, component structure
│   ├── Features.md                # Feature list, status, dependency diagram
│   ├── RepositoryStructure.md     # This file
│   └── TestingGuide.md            # Test setup, patterns, coverage targets
├── public/                        # Static assets served at root (favicon, robots.txt)
├── specs/                         # Feature and setup design documents
├── src/
│   ├── components/                # App-specific React components
│   │   └── ui/                    # shadcn/ui components (CLI-managed, do not edit)
│   ├── data/                      # CV content as typed JSON files
│   ├── lib/                       # Shared utilities (cn() classname helper, etc.)
│   ├── types/                     # TypeScript type definitions for data and props
│   ├── App.tsx                    # Root application component
│   ├── main.tsx                   # React entry point (mounts App to DOM)
│   └── index.css                  # Tailwind CSS directives and global styles
├── AGENTS.md                      # Agent instructions and project conventions
├── index.html                     # HTML shell (Vite entry)
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
└── vite.config.ts                 # Vite bundler configuration
```

## Key Directories

| Directory            | Purpose                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| `docs/`              | Living project documentation — architecture, conventions, features, testing   |
| `specs/`             | Design documents for features and setup phases                                |
| `src/components/`    | Application components — flat structure, can be nested when layout is decided |
| `src/components/ui/` | shadcn/ui managed territory — added/removed via CLI only                      |
| `src/data/`          | Single source of truth for all CV content — typed JSON                        |
| `src/types/`         | TypeScript interfaces — change these first, then update data                  |
| `src/lib/`           | Utility belt — pure functions with no React dependency                        |
