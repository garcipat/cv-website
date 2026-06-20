# Feature Specification: Project Setup

**Feature Branch**: `F-001-project-setup`  
**Created**: 2026-06-20  
**Status**: Draft  
**Input**: User description: "i want to specify F-001 — Project setup: Vite + React + TypeScript scaffold, Tailwind, shadcn/ui, docs"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scaffold the Development Environment (Priority: P1)

A developer clones the repository and wants to get a working development environment running with a single command. They expect the Vite dev server to start, serve a React app written in TypeScript, and reload automatically when source files change.

**Why this priority**: Without a working dev environment, no other feature work can begin. This is the foundation every subsequent feature depends on.

**Independent Test**: Clone the repo, run `npm install && npm run dev`, and verify a browser window opens showing a running React application with hot module replacement.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** the developer runs `npm install`, **Then** all dependencies install without errors and the project is ready for development.
2. **Given** dependencies are installed, **When** the developer runs `npm run dev`, **Then** the Vite dev server starts on a local port and displays a working React page.
3. **Given** the dev server is running, **When** the developer edits a `.tsx` source file and saves, **Then** the browser reflects the change within 2 seconds without a full page reload.
4. **Given** the dev server is running, **When** the developer introduces a TypeScript type error in a source file, **Then** the error is reported in the terminal and/or browser overlay.

---

### User Story 2 - Build for Production (Priority: P1)

A developer needs to produce a production-ready static bundle of the website. The build process must type-check all source files and output optimized, minified assets ready for deployment to any static host.

**Why this priority**: The project is a static website; the build output is the deliverable. Must work before any content can be published.

**Independent Test**: Run `npm run build`, verify the command completes without errors and produces a `dist/` directory containing an `index.html`, JavaScript bundles, and CSS.

**Acceptance Scenarios**:

1. **Given** the project source passes type-checking cleanly, **When** the developer runs `npm run build`, **Then** Vite produces optimized output in the `dist/` directory.
2. **Given** the project source contains a type error, **When** the developer runs `npm run build`, **Then** the build fails with a descriptive error message indicating the problematic file and line.
3. **Given** a successful build, **When** the developer runs `npm run preview` and opens the resulting URL, **Then** the production build renders correctly in the browser.

---

### User Story 3 - Style with Tailwind CSS (Priority: P2)

A developer writing a component wants to use Tailwind utility classes for styling. They expect Tailwind classes to work in `.tsx` files out of the box, including responsive variants, hover states, and dark mode utilities. Only utility classes used in source files are included in the production build.

**Why this priority**: Tailwind is the project's styling foundation. Components built without it would require CSS workarounds.

**Independent Test**: Add a `<div className="bg-blue-500 hover:bg-blue-700 text-white p-4 rounded-lg">` to `App.tsx`, verify it renders with the expected styling in dev and production builds.

**Acceptance Scenarios**:

1. **Given** a component uses Tailwind utility classes, **When** the dev server renders the component, **Then** the correct styles are applied.
2. **Given** a component uses responsive variants (e.g., `md:flex-col`), **When** the browser viewport resizes across the breakpoint, **Then** the layout changes accordingly.
3. **Given** a production build, **When** inspecting the output CSS, **Then** only utility classes used in source files are present (tree-shaken CSS).
4. **Given** the project uses a custom Tailwind theme (colors, fonts, spacing), **When** a component references a theme token, **Then** the correct custom value is applied.

---

### User Story 4 - Use shadcn/ui Components (Priority: P2)

A developer wants to add a UI component from the shadcn/ui library to their React component. They run the shadcn CLI to add the component, import it, and use it with appropriate props.

**Why this priority**: shadcn/ui is the component library for the project. UI features depend on having this integration working.

**Independent Test**: Run `npx shadcn add button`, then import and render a `<Button>` in `App.tsx` with a variant prop. Verify it renders with correct styling.

**Acceptance Scenarios**:

1. **Given** the project has shadcn/ui configured via `components.json`, **When** the developer runs `npx shadcn add button`, **Then** the Button component files are created under `src/components/ui/` with correct imports.
2. **Given** a shadcn/ui Button component has been added, **When** the developer imports it with `<Button variant="destructive">Delete</Button>`, **Then** it renders with the destructive color styling.
3. **Given** the `src/lib/utils.ts` utility exists with `cn()` function, **When** shadcn components reference it for className merging, **Then** Tailwind class conflicts are resolved correctly.

---

### User Story 5 - Access Project Documentation (Priority: P3)

A new contributor to the project needs to understand the architecture, coding conventions, repository structure, and feature roadmap. They open the `docs/` directory and find clear, up-to-date documentation.

**Why this priority**: Documentation is essential for onboarding and maintaining consistency, but the project can function without it for a solo developer in early stages.

**Independent Test**: Open each document in the `docs/` directory and verify it contains the expected sections with helpful, accurate content.

**Acceptance Scenarios**:

1. **Given** the `docs/Architecture.md` file, **When** a developer reads it, **Then** they understand the tech stack, component tree, data flow, and directory structure.
2. **Given** the `docs/CodingGuidelines.md` file, **When** a developer reads it, **Then** they know the naming conventions, file organization rules, and TypeScript strictness requirements.
3. **Given** the `docs/Features.md` file, **When** a developer reads it, **Then** they see the full feature list with priorities, status, and dependency diagram.
4. **Given** the `docs/TestingGuide.md` file, **When** a developer reads it, **Then** they understand the testing strategy, tooling, and how to write tests for the project.
5. **Given** the `docs/RepositoryStructure.md` file, **When** a developer reads it, **Then** they understand the purpose of each top-level directory and configuration file.

---

### Edge Cases

- ✅ What happens when a developer runs `npm install` on a Node.js version outside the supported range? → **Resolved**: `engines` field in `package.json` enforces `node >= 24` with `npm warn` on mismatch. A `.nvmrc` file pins the version for nvm/fnm users.
- ✅ What happens when a `tsconfig.json` strict mode check finds an error at build time — is the error message clear and actionable? → **Resolved**: TypeScript's built-in error reporting identifies the problematic file and line (verified by Acceptance Scenario 2.2: "build fails with a descriptive error message indicating the problematic file and line").
- ✅ What happens when Tailwind CSS v4 plugin is missing or misconfigured — does the build fail gracefully with a helpful error? → **Resolved**: If the plugin is missing from dependencies, `npm install` would fail. If missing from `vite.config.ts`, Vite starts but Tailwind classes remain unprocessed. Vite's built-in module resolution errors and CSS processing behavior are sufficient for the initial scaffold.
- ✅ What happens when `npx shadcn add` is run for a component that already exists — does it overwrite or warn? → **Resolved**: shadcn CLI's default behavior prompts the user before overwriting any existing component files. shadcn CLI defaults handle this scenario.
- ✅ What happens when the `dist/` directory is served from a sub-path (not the domain root) — are asset paths relative and correct? → **Resolved**: `base` option in `vite.config.ts` defaults to `'/'` but is configurable via `VITE_BASE` env variable for sub-path deployment. Client-side routing handles language/theme paths (e.g., `/en/`, `/de/`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Vite-powered development server with React 19 and TypeScript in strict mode, accessible via `npm run dev`.
- **FR-002**: System MUST produce an optimized static production build via `npm run build`, with TypeScript type-checking as a required build step.
- **FR-003**: System MUST provide a production preview server via `npm run preview` to verify the built output before deployment.
- **FR-004**: System MUST lint source files via `npm run lint` using ESLint with TypeScript and React-specific rules, and format source files via `npm run format` using Prettier with ESLint-compatible configuration.
- **FR-004a**: System MUST provide a test runner via `npm test` using Vitest with React Testing Library and jsdom, with DOM matchers available globally.
- **FR-005**: System MUST resolve `@/` path aliases to the `src/` directory in both TypeScript compilation and Vite module resolution.
- **FR-006**: System MUST integrate Tailwind CSS v4 via the `@tailwindcss/vite` plugin, with base styles imported in the application entry point.
- **FR-007**: System MUST configure shadcn/ui via `components.json` with a defined style, base color, CSS variable mode, and icon library preference.
- **FR-008**: System MUST provide a `cn()` utility function in `src/lib/utils.ts` that merges Tailwind classes using `clsx` and `tailwind-merge`.
- **FR-009**: System MUST allow developers to add shadcn/ui components to `src/components/ui/` via the `npx shadcn add <component>` CLI command.
- **FR-010**: System MUST include a `docs/` directory containing Architecture.md, CodingGuidelines.md, Features.md, TestingGuide.md, and RepositoryStructure.md.
- **FR-011**: System MUST include a `README.md` at the project root with getting-started instructions (install, dev, build, preview).
- **FR-012**: System MUST configure TypeScript with incremental compilation (`tsconfig.json`), path aliases, and strict mode enabled.
- **FR-013**: System MUST enforce Node.js 24+ via `engines` field in `package.json` and provide a `.nvmrc` file for version manager hints.
- **FR-014**: System MUST support configurable base path via `VITE_BASE` environment variable (default `'/'`) in `vite.config.ts` for sub-path deployments.

### Key Entities

- **Project Configuration**: The collection of config files (`package.json`, `vite.config.ts`, `tsconfig.json`, `components.json`, `eslint.config.js`) that define the development environment, build process, and tooling behavior.
- **Documentation Files**: Markdown files in `docs/` that describe the project's architecture, conventions, features, testing approach, and repository structure for contributor onboarding.
- **Component Library Registry**: The shadcn/ui configuration (`components.json`) that maps component names to file locations and defines styling defaults for added components.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from `git clone` to a running dev server in under 3 minutes (assuming standard broadband and a modern machine).
- **SC-002**: The production build outputs a total page weight under 200 KB (HTML + JS + CSS gzipped) for the initial scaffold (no content pages yet).
- **SC-003**: The `npm run build` command completes in under 30 seconds on a modern development machine.
- **SC-004**: ESLint and Prettier report zero issues on a clean checkout with the default source files.
- **SC-005**: All five documentation files in `docs/` contain the sections described in their acceptance scenarios, with all sections fully written.
- **SC-006**: `npx shadcn add` successfully adds any standard shadcn/ui component without manual configuration changes required.
- **SC-007**: Hot Module Replacement reflects source changes in the browser within 2 seconds during development.

## Assumptions

- The development environment is Node.js 24 or later with npm 10 or later.
- Developers work on macOS, Linux, or Windows with WSL — supported platforms are macOS, Linux, and Windows with WSL.
- The project is a static site: all build output is static HTML, JS, and CSS.
- The initial scaffold includes a minimal `App.tsx` with placeholder content; full page layout and routing are covered by F-011 (Page Layout).
- shadcn/ui components follow the "New York" style with Neutral base color and CSS variables enabled, as configured in `components.json`.
- Tailwind CSS v4 is used; configuration uses the Vite plugin and CSS-based approach (distinct from v3 convention).
- Documentation files are maintained alongside the codebase and contain populated, relevant content.
