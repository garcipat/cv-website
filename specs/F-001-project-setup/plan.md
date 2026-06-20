# Implementation Plan: Project Setup (F-001)

**Branch**: `F-001-project-setup` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature spec from `specs/F-001-project-setup/spec.md`

## Summary

Scaffold the CV website development environment: Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui. Configure all tooling (build, lint, test), establish the `docs/` directory, and ensure a developer can clone → install → dev in under 3 minutes.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict mode) via `tsconfig.app.json`  
**Primary Dependencies**: React 19, Vite 8, Tailwind CSS 4 (via `@tailwindcss/vite`), shadcn CLI, ESLint 10, Prettier, Vitest (to be added), React Testing Library (to be added), jsdom (to be added)  
**Storage**: None — static site, no backend  
**Testing**: Vitest + React Testing Library + jsdom (per `docs/TestingGuide.md` and Constitution Principle II)  
**Target Platform**: Static HTML/CSS/JS served from any static host; dev on macOS / Linux / Windows (WSL) with Node.js 24+  
**Project Type**: Web (single static site) — no server, no API, no database  
**Performance Goals**: < 200 KB gzipped total page weight, < 30 s build time, < 1.5 s page load (per Constitution V)  
**Constraints**: No secrets, no env vars beyond build-time `VITE_BASE`, no external APIs  
**Scale/Scope**: Single developer, single static site, ~14 core features planned

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Typed Data Architecture
- **Status**: ✅ PASS
- **Evidence**: `src/types/` directory exists (to be populated in F-002). Strict TypeScript configured via `tsconfig.app.json` (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`). No `any` types in current source. Data pattern established in `docs/Architecture.md`.
- **Action**: No violations. This feature only scaffolds; data types come in F-002.

### II. Testing (NON-NEGOTIABLE)
- **Status**: ⚠️ GAP — test infrastructure not yet configured
- **Evidence**: No Vitest, React Testing Library, or jsdom in `devDependencies`. No `vitest.config.ts`. No `test` or `test:watch` scripts in `package.json`.
- **Action**: **MUST** install and configure Vitest + React Testing Library + jsdom before feature completion. Test scripts must be added to `package.json`. See Phase 2 implementation tasks.

### III. Code Quality and Component Standards
- **Status**: ✅ PASS
- **Evidence**: `components.json` configured with shadcn/ui (base-nova style, neutral base, CSS vars, lucide icons). ESLint configured with TypeScript + React Hooks + React Refresh. `cn()` utility in `src/lib/utils.ts` using `clsx` + `tailwind-merge`. Named exports used in `App.tsx` and `main.tsx`.
- **Action**: Add at least one shadcn/ui component (Button) to validate CLI workflow. Verify components land in `src/components/ui/`.

### IV. No Feature Bloat
- **Status**: ✅ PASS
- **Evidence**: Feature originates from spec `specs/F-001-project-setup/spec.md`. Scope is well-defined: scaffold only, no content or page layout. Feature list in `docs/Features.md` tracks status.
- **Action**: None — scope is bounded to scaffold.

### V. Performance and Static Delivery
- **Status**: ✅ PASS
- **Evidence**: Production build output: 60 KB JS gzipped + 4 KB CSS gzipped + 0.3 KB HTML gzipped ≈ 64 KB total (well under 200 KB target). Build time: 473 ms (well under 30 s target). No backend dependencies.
- **Action**: Monitor bundle size as dependencies are added (Vitest devDependencies don't affect production build). Verify build succeeds after all changes.

## Project Structure

### Documentation (this feature)

```
specs/F-001-project-setup/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (tooling contracts)
```

### Source Code (repository root)

```
src/
├── components/
│   └── ui/              # shadcn/ui components (Button to be added)
├── lib/
│   └── utils.ts         # cn() utility ✅
├── App.tsx              # Root component ✅
├── main.tsx             # Entry point ✅
└── index.css            # Tailwind + shadcn CSS ✅
```

### Configuration (repository root)

```
vite.config.ts           # Vite + React + Tailwind plugin + @/ alias ✅ (needs VITE_BASE)
tsconfig.json            # Project references ✅
tsconfig.app.json        # App TypeScript config (strict) ✅
tsconfig.node.json       # Node TypeScript config ✅
eslint.config.js         # ESLint flat config ✅
.prettierrc              # ❌ MISSING — Prettier config
components.json          # shadcn/ui config ✅
package.json             # Dependencies + scripts (needs engines, format script, test scripts)
.nvmrc                   # ❌ MISSING — Node version pin
vitest.config.ts         # ❌ MISSING — Vitest configuration
```

## Complexity Tracking

> No violations — fill only if Constitution Check finds unjustified complexity.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |

---

## Phase 0: Research

### Resolved Questions

| Unknown | Resolution |
|---------|------------|
| Tailwind CSS v4 configuration approach | Use `@tailwindcss/vite` plugin (already installed). CSS-based config via `@theme` block in `index.css` — the v4 approach. No `tailwind.config.js` needed. |
| shadcn/ui style and base color | "base-nova" style with "neutral" base color and CSS variables enabled. Already configured in `components.json`. |
| Vitest vs Jest for React testing | Vitest is the prescribed tool per Constitution II and `docs/TestingGuide.md`. Native ESM support, Vite integration, faster than Jest. |
| jsdom vs happy-dom | jsdom is prescribed per Constitution II and `docs/TestingGuide.md`. More comprehensive DOM implementation for React Testing Library. |
| `.nvmrc` content | Pin to latest Node 24 LTS. Use `24` (nvm/fnm resolve to latest 24.x). |
| `engines` field format | `"node": ">=24.0.0"` with `"npm": ">=10.0.0"` per spec assumptions. |

### Research Output

See [research.md](./research.md) for detailed findings and decision rationale.

---

## Phase 1: Design & Contracts

### Data Model

The "entities" for project setup are configuration artifacts, not runtime data. See [data-model.md](./data-model.md) for the configuration schema documentation.

### Contracts

Tooling contracts define expected behaviors of CLI commands and build outputs. See [contracts/](./contracts/) for:
- `build-contract.md` — Expected output format of `npm run build`
- `lint-contract.md` — ESLint rule set and expected behavior
- `test-contract.md` — Vitest configuration and test execution contract
- `dev-server-contract.md` — Dev server behavior expectations

### Quickstart

See [quickstart.md](./quickstart.md) for the developer onboarding guide.

---

## Phase 2: Implementation Outline

### Tasks

1. **Add `.nvmrc` and `engines` field** (FR-013)
   - Create `.nvmrc` with `24`
   - Add `"engines": { "node": ">=24.0.0", "npm": ">=10.0.0" }` to `package.json`

2. **Install and configure Prettier** (FR-004)
   - Install `prettier` and `eslint-config-prettier`
   - Create `.prettierrc` with project formatting rules
   - Add `"format": "prettier --write ."` script to `package.json`
   - Update ESLint config to disable conflicting rules via `eslint-config-prettier`

3. **Configure VITE_BASE support** (FR-014)
   - Update `vite.config.ts` to read `VITE_BASE` env variable (default `'/'`)

4. **Install and configure testing infrastructure** (Constitution II)
   - Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@testing-library/user-event`
   - Create `vitest.config.ts` with jsdom environment, `@/` path alias, and `setupFiles`
   - Create `src/test/setup.ts` with `@testing-library/jest-dom` import
   - Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`

5. **Add sample shadcn/ui component** (FR-009 validation)
   - Run `npx shadcn@latest add button` to create `src/components/ui/button.tsx`
   - Verify component files are created correctly

6. **Write smoke tests** (Constitution II — TDD)
   - Test: `App-renders-without-crashing` — renders App and finds "CV" text
   - Test: `cn-merges-tailwind-classes-correctly` — validates `cn()` utility behavior
   - Test: `Button-renders-with-variants` — shadcn Button renders with variant prop

7. **Update README.md** (FR-011)
   - Add getting-started instructions: clone, install, dev, build, preview, lint, format, test

8. **Update index.html title**
   - Change from "vite-scaffold" to "CV — Patrick Garcia"

9. **Verify all success criteria**
   - SC-001: Time `git clone` → `npm install && npm run dev` workflow
   - SC-002: Check gzipped bundle size < 200 KB
   - SC-003: Verify build time < 30 s
   - SC-004: Run `npm run lint` and `npm run format` — must report zero issues
   - SC-005: Verify all 5 docs have complete content
   - SC-006: Verify `npx shadcn add` works
   - SC-007: Verify HMR responsiveness

### Dependencies

- Tasks 1-3 are independent and can run in parallel
- Task 5 depends on existing `components.json` config (already ready)
- Task 6 depends on tasks 4 (testing infra) and 5 (shadcn component)
- Tasks 2, 7, 8 are independent of other changes
- Task 9 is final validation after all others

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| `vitest.config.ts` path alias doesn't match `vite.config.ts` | Use same `@/` → `./src` alias, validate with import test |
| jsdom environment incompatibility with CSS modules | Not applicable — project uses Tailwind (utility classes), not CSS modules |
| shadcn CLI version mismatch with installed shadcn package | Use `npx shadcn@latest` which auto-resolves to compatible version |
| Node 24 `engines` too restrictive for CI | `>=24.0.0` allows Node 24 and 25 — verify CI image availability |
