# Data Model: Project Setup (F-001)

**Date**: 2026-06-20 | **Status**: Complete

## Overview

F-001 is a project setup/scaffold feature — it does not introduce runtime data entities. Instead, it defines the configuration schemas that govern the development environment. This document maps each configuration artifact to its purpose and validation rules.

## Configuration Entities

### 1. Package Configuration (`package.json`)

Represents the Node.js project manifest. Key fields relevant to this feature:

| Field | Type | Required | Constraints | Source |
|-------|------|----------|-------------|--------|
| `name` | `string` | Yes | `"vite-scaffold"` → update? | Existing |
| `private` | `boolean` | Yes | Must be `true` (not published to npm) | Existing |
| `type` | `string` | Yes | Must be `"module"` (ESM) | Existing |
| `scripts.dev` | `string` | Yes | `"vite"` | FR-001 |
| `scripts.build` | `string` | Yes | `"tsc -b && vite build"` | FR-002 |
| `scripts.lint` | `string` | Yes | `"eslint ."` | FR-004 |
| `scripts.preview` | `string` | Yes | `"vite preview"` | FR-003 |
| `scripts.test` | `string` | Yes (MUST ADD) | `"vitest run"` | Constitution II |
| `scripts.test:watch` | `string` | Yes (MUST ADD) | `"vitest"` | Constitution II |
| `engines.node` | `string` | Yes (MUST ADD) | `">=24.0.0"` | FR-013 |
| `engines.npm` | `string` | Yes (MUST ADD) | `">=10.0.0"` | Assumptions |
| `imports.@/*` | `string` | Yes | `"./src/*"` | FR-005 |

### 2. Vite Configuration (`vite.config.ts`)

| Field | Type | Required | Constraints | Source |
|-------|------|----------|-------------|--------|
| `plugins` | `Plugin[]` | Yes | Must include `react()` and `tailwindcss()` | FR-001, FR-006 |
| `resolve.alias.@` | `string` | Yes | Must resolve to `./src` | FR-005 |
| `base` | `string` | Yes (MUST ADD) | Default `"/"`, overridable via `VITE_BASE` env | FR-014 |

### 3. TypeScript Configuration

**`tsconfig.json`** — Project references:
| Field | Value | Source |
|-------|-------|--------|
| `references[0].path` | `"./tsconfig.app.json"` | FR-012 |
| `references[1].path` | `"./tsconfig.node.json"` | FR-012 |

**`tsconfig.app.json`** — Application source:
| Field | Value | Source |
|-------|-------|--------|
| `compilerOptions.target` | `"es2023"` | Modern baseline |
| `compilerOptions.moduleResolution` | `"bundler"` | Vite requirement |
| `compilerOptions.jsx` | `"react-jsx"` | React 19 |
| `compilerOptions.noUnusedLocals` | `true` | Strict mode |
| `compilerOptions.noUnusedParameters` | `true` | Strict mode |
| `include` | `["src"]` | FR-012 |

### 4. shadcn/ui Configuration (`components.json`)

| Field | Value | Purpose |
|-------|-------|---------|
| `style` | `"base-nova"` | shadcn v4 style |
| `tailwind.css` | `"src/index.css"` | CSS entry point |
| `tailwind.baseColor` | `"neutral"` | Design token base |
| `tailwind.cssVariables` | `true` | CSS custom properties for theming |
| `iconLibrary` | `"lucide"` | Icon set |
| `aliases.components` | `"@/components"` | Component import path |
| `aliases.utils` | `"@/lib/utils"` | Utility import path |
| `aliases.ui` | `"@/components/ui"` | shadcn component destination |

### 5. ESLint Configuration (`eslint.config.js`)

Flat config format (ESLint 10+):

| Rule Set | Purpose |
|----------|---------|
| `js.configs.recommended` | Core JavaScript best practices |
| `tseslint.configs.recommended` | TypeScript-aware rules |
| `reactHooks.configs.flat.recommended` | Rules of Hooks enforcement |
| `reactRefresh.configs.vite` | HMR-safe component patterns |
| `globalIgnores(['dist'])` | Ignore build output |

### 6. Testing Configuration (`vitest.config.ts`) — MUST CREATE

| Field | Value | Purpose |
|-------|-------|---------|
| `test.environment` | `"jsdom"` | DOM simulation for component tests |
| `test.globals` | `true` | Global `describe`/`it`/`expect` |
| `test.setupFiles` | `["./src/test/setup.ts"]` | jest-dom matchers |

### 7. Runtime Version Pinning (`.nvmrc`) — MUST CREATE

| Field | Value | Purpose |
|-------|-------|---------|
| Content | `24` | Node.js version for nvm/fnm |

### 8. Documentation Files (`docs/`)

| File | Required Sections | Status |
|------|------------------|--------|
| `Architecture.md` | Tech stack, data flow, project structure, key patterns, design decisions | ✅ Complete |
| `CodingGuidelines.md` | Naming conventions, component structure, Tailwind usage, shadcn/ui policy, data pattern | ✅ Complete |
| `Features.md` | Feature list, implementation status table, dependency diagram, workflow | ✅ Complete |
| `TestingGuide.md` | Test setup, test types, test structure, coverage targets, running tests | ✅ Complete |
| `RepositoryStructure.md` | Directory tree, key directories table | ✅ Complete |

### 9. README (`README.md`) — MUST UPDATE

| Section | Content Required |
|---------|-----------------|
| Getting Started | Clone, install, dev, build, preview, lint, test commands |
| Prerequisites | Node.js 24+, npm 10+ |

## Relationships

```
package.json ──► scripts ──► vite.config.ts
                          ──► eslint.config.js
                          ──► vitest.config.ts (to add)
                          ──► tsc (via tsconfig.json)

components.json ──► npx shadcn add ──► src/components/ui/*

vite.config.ts ──► @/ alias ──► tsconfig.app.json (paths must align)

.nvmrc ──► Node version for nvm/fnm
package.json#engines ──► npm warning on mismatch
```

## State Transitions

Not applicable — configuration artifacts are static. No runtime state.

## Validation Rules

1. `npm run build` must succeed (type-check + Vite build)
2. `npm run lint` must report zero errors
3. `npm run test` must execute (even if no substantive tests yet — infrastructure validated)
4. `npx shadcn@latest add button` must create `src/components/ui/button.tsx` without errors
5. `npm run dev` must start and serve the React app
6. TypeScript strict mode must be enforced (build fails on type errors)
