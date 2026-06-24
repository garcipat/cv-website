# CV — Patrick Garcia

> **Official repository:** This is the canonical source for Patrick Garcia's CV website: <https://github.com/garcipat/cv-website>.

A personal CV website showcasing modern web development practices. Built with **spec-driven AI development**, featuring a **signal-based reactive architecture**, **multi-theme system** (IDE, 3D Room, Terminal), and **full multilingual support** (English & German). This repository demonstrates professional-grade TypeScript development with strict type safety, automated testing, and production-ready tooling.

## Tech Stack & Architecture

### Core Technologies
- **Build**: Vite 6+ (fast, modern bundler)
- **Framework**: React 19+ with signals-based reactivity
- **Language**: TypeScript (strict mode, no `any`)
- **State Management**: Preact Signals for reactive, zero-config state
- **Styling**: Tailwind CSS 4+ with utility-first design
- **Components**: shadcn/ui (CLI-managed, fresh imports)
- **Testing**: Vitest + React Testing Library + jsdom
- **Linting**: ESLint + Prettier for code quality

### Architectural Highlights
- **Signals-based reactivity**: No React Context, no prop drilling — all state flows through Preact Signals for minimal re-renders
- **Theme isolation**: Three independent theme layouts (IDE, 3D Room, Terminal) sharing global signals but with self-contained DOM and styling
- **Type-first data**: CV content lives in typed JSON files (`src/data/`) — components are purely presentational
- **Multilingual i18n**: Two-layer translation system supporting English and German, with localStorage persistence
- **Static-first**: No backend, no database, no API calls — everything is build-time
- **Scalable structure**: Theme system designed to easily add new themes without touching core logic

### Key Features
- 🎨 **Multi-theme system**: IDE-inspired code editor, immersive 3D room, retro terminal — all sharing the same data
- 🌍 **Full multilingual support**: English and German translations with automatic browser locale detection
- 📱 **Responsive design**: Works seamlessly across desktop and mobile devices
- ⚡ **Optimized performance**: Signal-based updates with minimal re-renders, fast build times with Vite
- 🧪 **Comprehensive testing**: Automated tests for components and data integrity
- 📊 **Spec-driven development**: Features documented in formal specifications with clear rationale and decisions

### Essential Packages
**Core Runtime** (6 packages):
- `react@19.2+`, `react-dom@19.2+` — Modern React with Concurrent features
- `@preact/signals-react@3+` — Signal-based state management
- `@fontsource-variable/geist`, `@fontsource/inter`, `@fontsource/fira-code` — Professional font system

**Styling & Components** (5 packages):
- `tailwindcss@4+`, `@tailwindcss/vite@4+` — Modern utility-first CSS framework
- `shadcn@4+` — Component library built on Radix UI
- `lucide-react@1+` — Modern icon system
- `class-variance-authority@0.7+`, `clsx@2+`, `tailwind-merge@3+` — Utility functions

**Dev Stack** (13 packages):
- `vite@8+` — Next-gen frontend tooling
- `typescript@6+` — Strict type checking
- `eslint@10+`, `prettier@3+` — Code quality and formatting
- `vitest@4+`, `@testing-library/react@16+` — Testing frameworks
- Plus TypeScript support packages and Node.js types

## Prerequisites

- **Node.js 24+** — check with `node --version`
- **npm 10+** — comes with Node 24

## Getting Started

```bash
# Clone the repository
git clone <repo-url> cv-website
cd cv-website

# Install dependencies
npm install

# Start the development server (HMR at localhost:5173)
npm run dev

# Run lint
npm run lint

# Run tests (single run)
npm test

# Run tests in watch mode
npm run test:watch

# Format code
npm run format

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
cv-website/
├── docs/              # Architecture, coding guidelines, features, testing
├── specs/             # Feature specifications with design decisions
├── public/            # Static assets
├── src/
│   ├── components/    # Reusable components
│   │   └── ui/        # shadcn/ui components (added via CLI)
│   ├── themes/        # Theme layouts (ide/, terminal/, space/)
│   ├── state/         # Preact Signals (global reactive state)
│   ├── data/          # Typed JSON data (cv.en.json, cv.de.json)
│   ├── i18n/          # UI translations (en.ts, de.ts)
│   ├── types/         # TypeScript type definitions
│   ├── lib/           # Utility functions (cn(), signal helpers)
│   ├── App.tsx        # Root component (renders active theme)
│   └── main.tsx       # React entry point
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript strict mode
└── vite.config.ts     # Vite configuration
```

**Key patterns:**
- Themes are isolated, self-contained layout trees
- All state flows through Signals (no Context, no prop drilling)
- Data is typed JSON, components are purely presentational
- shadcn/ui components only added via CLI (`npx shadcn add <name>`)

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

Components are installed to `src/components/ui/`.

## Documentation

- [Architecture](docs/Architecture.md) — Signal-based state management, theme isolation, multilingual architecture, and design patterns
- [Coding Guidelines](docs/CodingGuidelines.md) — Naming conventions, component structure, and best practices
- [Features](docs/Features.md) — Feature roadmap and development status
- [Testing Guide](docs/TestingGuide.md) — Test setup, patterns, and testing conventions
- [Repository Structure](docs/RepositoryStructure.md) — Directory organization and file layout

## Scripts

| Command              | Description                         |
| -------------------- | ----------------------------------- |
| `npm run dev`        | Start Vite dev server with HMR      |
| `npm run build`      | Type-check and build for production |
| `npm run preview`    | Preview production build locally    |
| `npm run lint`       | Run ESLint                          |
| `npm run format`     | Format code with Prettier           |
| `npm test`           | Run tests (Vitest)                  |
| `npm run test:watch` | Run tests in watch mode             |
