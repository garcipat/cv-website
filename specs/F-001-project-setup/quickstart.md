# Quickstart: Project Setup (F-001)

**Target audience**: Developers cloning the repository for the first time.

## Prerequisites

- **Node.js 24+** — check with `node --version`
  - Install via [nvm](https://github.com/nvm-sh/nvm): `nvm install 24 && nvm use 24`
  - Or [fnm](https://github.com/Schniz/fnm): `fnm install 24 && fnm use 24`
- **npm 10+** — comes with Node 24
- **Git** — for cloning the repository

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> cv-website
cd cv-website
npm install
```

Expected: all dependencies install without errors. If you see an `engines` warning, upgrade Node.js.

### 2. Start development server

```bash
npm run dev
```

Opens at `http://localhost:5173`. Edit `src/App.tsx` — changes appear instantly via HMR.

### 3. Run lint

```bash
npm run lint
```

Should report zero errors on a clean checkout.

### 4. Run tests

```bash
npm test
```

Runs all tests once. For watch mode:

```bash
npm run test:watch
```

### 5. Build for production

```bash
npm run build
```

TypeScript type-checks first, then Vite produces optimized output in `dist/`.

### 6. Preview production build

```bash
npm run preview
```

Serves the `dist/` directory locally to verify the production output.

### 7. Add shadcn/ui components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add separator
```

Components land in `src/components/ui/`. Import and use in your `.tsx` files.

## Project Layout

```
cv-website/
├── docs/          # Architecture, conventions, features, testing guide
├── public/        # Static assets (favicon, icons)
├── specs/         # Feature specifications and plans
├── src/
│   ├── components/ui/  # shadcn/ui components (CLI-managed)
│   ├── lib/            # Utility functions (cn(), etc.)
│   ├── App.tsx         # Root component
│   └── main.tsx        # React entry point
├── package.json   # Dependencies and scripts
├── tsconfig.json  # TypeScript configuration
└── vite.config.ts # Vite bundler configuration
```

## Common Issues

| Problem | Solution |
|---------|----------|
| `npm install` fails with engine mismatch | Upgrade Node to 24+: `nvm install 24 && nvm use 24` |
| `npm run build` fails with type error | Check terminal output for file and line; fix the error |
| HMR not working | Verify Vite dev server is running; check browser console for WebSocket errors |
| shadcn add fails | Ensure `node_modules` is installed; try `npx shadcn@latest add <name>` |
| Port 5173 already in use | Vite auto-increments to 5174, 5175, etc. |

## Next Steps

After verifying the scaffold works:
1. Proceed to **F-002: Data Model** — define TypeScript types for CV content
2. Then **F-012: Theme System** — set up Preact Signals for theme/locale state
3. See `docs/Features.md` for the full feature roadmap and dependency diagram
