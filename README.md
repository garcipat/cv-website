# CV — Patrick Garcia

A personal CV website built with Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui.

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

## Project Layout

```
cv-website/
├── docs/              # Architecture, conventions, features, testing guide
├── public/            # Static assets
├── specs/             # Feature specifications and plans
├── src/
│   ├── components/    # React components
│   │   └── ui/        # shadcn/ui components (CLI-managed)
│   ├── lib/           # Utility functions
│   ├── App.tsx        # Root component
│   └── main.tsx       # React entry point
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── vite.config.ts     # Vite bundler configuration
```

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

Components are installed to `src/components/ui/`.

## Documentation

See the [docs/](docs/) directory for detailed documentation:

- [Architecture](docs/Architecture.md) — Tech stack, data flow, project structure
- [Coding Guidelines](docs/CodingGuidelines.md) — Naming conventions, component structure
- [Features](docs/Features.md) — Feature roadmap and status
- [Testing Guide](docs/TestingGuide.md) — Test setup, types, and conventions
- [Repository Structure](docs/RepositoryStructure.md) — Directory tree overview

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
