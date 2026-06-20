# Research: Project Setup (F-001)

**Date**: 2026-06-20 | **Status**: Complete

## Research Questions

### 1. Tailwind CSS v4 Configuration Pattern

**Decision**: Use `@tailwindcss/vite` plugin exclusively. CSS-based configuration via `@theme` block in `index.css`. No `tailwind.config.js` file.

**Rationale**: Tailwind CSS v4 eliminated the JavaScript config file in favor of CSS-based configuration. The `@tailwindcss/vite` plugin (v4.3.1) handles JIT compilation during dev and production builds. CSS `@theme` blocks define custom design tokens. The project already has this implemented correctly:
- `vite.config.ts` imports and uses `tailwindcss()` plugin
- `src/index.css` uses `@import "tailwindcss"` and `@theme inline { ... }`
- Custom tokens defined for shadcn/ui (colors, radii, sidebar, charts)

**Alternatives considered**:
- PostCSS approach (`postcss.config.js` + `@tailwindcss/postcss`) — rejected because Vite plugin is the recommended v4 approach for Vite projects
- Tailwind v3 config file — not applicable; project uses v4

### 2. shadcn/ui v4 Component Add Workflow

**Decision**: Use `npx shadcn@latest add <component>` — exactly as documented. Components land in `src/components/ui/`. The CLI uses `components.json` for path resolution.

**Rationale**: shadcn v4 ("base-nova" style) is installed and configured. The `shadcn` package (v4.11.0) is a dependency. Running `npx shadcn@latest` ensures the CLI resolves to a version compatible with the installed package. The `components.json` is already configured with:
- `style: "base-nova"` (new v4 style, equivalent to "new-york" from v3)
- `baseColor: "neutral"`
- `cssVariables: true`
- `iconLibrary: "lucide"`
- Path aliases to `@/components`, `@/lib/utils`, `@/components/ui`

**Alternatives considered**:
- Copy-pasting components from shadcn/ui website — explicitly rejected per Constitution III and AGENTS.md
- Using `npx shadcn-ui@latest` (v3 CLI) — not compatible with v4 config

### 3. Testing Framework Selection

**Decision**: Vitest + React Testing Library + jsdom. Version compatibility: Vitest 4.x+ for Vite 8 compatibility, RTL 16.x+ for React 19.

**Rationale**: Prescribed by Constitution II and `docs/TestingGuide.md`. Vitest is the standard for Vite-based projects with native ESM support and config sharing. jsdom provides a full DOM implementation for component rendering tests. React Testing Library provides semantic queries (`getByText`, `getByRole`) rather than implementation details.

Testing stack versions (compatible with project's Vite 8 / React 19):
- `vitest`: ^4.0.0
- `@testing-library/react`: ^16.3.0
- `@testing-library/jest-dom`: ^6.6.0
- `@testing-library/user-event`: ^14.6.0
- `jsdom`: ^26.0.0

**Alternatives considered**:
- Jest — rejected: slower, requires transform config for TypeScript/ESM, not Vite-native
- happy-dom — rejected: less comprehensive DOM implementation, some RTL features not supported
- Cypress/Playwright for component tests — rejected: overkill for utility/component unit tests; could be added later for visual regression if needed

### 4. Vitest Configuration Approach

**Decision**: Separate `vitest.config.ts` that extends `vite.config.ts` via `mergeConfig`. Use `defineConfig` from `vitest/config`. Include jsdom environment, `@/` path alias, and `setupFiles` for `@testing-library/jest-dom`.

**Rationale**: Separating Vitest config from Vite config keeps concerns clean while sharing the `@/` alias. The `setupFiles` array loads `@testing-library/jest-dom` matchers globally (`toBeInTheDocument`, etc.). jsdom environment enables DOM APIs in test context.

Configuration shape:
```typescript
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))
```

**Alternatives considered**:
- Inline test config in `vite.config.ts` — rejected: Vitest-specific types would pollute the Vite config; separation is cleaner
- `vitest.config.ts` without extending Vite config — would need to duplicate `@/` alias definition
- Using `vitest` `/// <reference types="vitest" />` in `vite.config.ts` — works but muddles config boundaries

### 5. Node.js Version Pinning

**Decision**: `.nvmrc` with `24` (unqualified, resolves to latest 24.x). `engines` field with `"node": ">=24.0.0"` and `"npm": ">=10.0.0"`.

**Rationale**: The spec (FR-013, Assumptions) requires Node.js 24+. Using `24` (not `24.x.x`) in `.nvmrc` lets nvm/fnm resolve to the latest patch. The `engines` field in `package.json` uses `>=24.0.0` to be inclusive of Node 25 when available, while still warning on Node 22 and below. npm 10+ is standard with Node 24.

**Alternatives considered**:
- Exact version pin (e.g., `24.5.0`) — rejected: requires updating `.nvmrc` on every Node patch release
- No `.nvmrc` / no `engines` — rejected: spec explicitly requires both (FR-013)
- `"node": "^24.0.0"` — rejected: caret range would allow 25.x in practice but is semantically misleading; `>=24.0.0` is clearer

### 6. VITE_BASE Environment Variable Pattern

**Decision**: Use Vite's `envDir` + `loadEnv` pattern. Read `VITE_BASE` from environment with default `'/'`. Apply to `base` config option.

**Rationale**: The spec (FR-014, Edge Case 5) requires sub-path deployment support. Vite's `base` option controls asset paths. Using an environment variable with a default keeps the standard case (`/`) simple while allowing CI/CD to override for sub-path deploys (e.g., `VITE_BASE=/cv/`).

Vite loads `.env` files automatically, but the `base` option is needed at config resolution time. The pattern in `vite.config.ts`:
```typescript
export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE ?? '/'
  return {
    base,
    // ... rest of config
  }
})
```

Or simpler with just reading `process.env.VITE_BASE` (Vite exposes prefixed env vars).

**Alternatives considered**:
- Build-time argument (`--base /cv/`) — rejected: not standard across different hosting platforms; env var is more universal
- Hardcoded `/` — rejected: spec requires configurability
- Vite's `envPrefix` override — unnecessary; Vite already exposes `VITE_` prefixed vars

### 7. Prettier Configuration

**Decision**: Prettier with `eslint-config-prettier` to disable conflicting ESLint rules. Run via `npm run format` script.

**Rationale**: Prettier handles code formatting (indentation, quotes, line width, trailing commas) while ESLint focuses on code quality rules. `eslint-config-prettier` disables ESLint rules that conflict with Prettier's formatting. This separation of concerns is standard practice.

Configuration in `.prettierrc`:
- `semi: true` — semicolons always
- `singleQuote: true` — single quotes for consistency
- `tabWidth: 2`
- `trailingComma: "all"`
- `printWidth: 100`

**Alternatives considered**:
- ESLint stylistic rules only — rejected: Prettier is more opinionated and consistent for formatting; ESLint's formatting rules are deprecated in favor of Prettier
- dprint or Biome — rejected: Prettier is the ecosystem standard and simplest for this project size
- Prettier as ESLint plugin — rejected: deprecated; standalone Prettier + `eslint-config-prettier` is the recommended approach

### 8. Test File Organization

**Decision**: Co-locate tests with source files (`Component.test.tsx` next to `Component.tsx`). For `src/lib/` utilities, use `utils.test.ts` next to `utils.ts`.

**Rationale**: Per `docs/TestingGuide.md` and project conventions. Co-location keeps tests discoverable and maintainable. Test naming follows `{method}-{condition}-{expected-result}` pattern in kebab-case. Test files use `.test.ts` / `.test.tsx` extension (Vitest default).

**Alternatives considered**:
- `__tests__` directories — rejected: adds nesting without benefit for this project's scale
- `spec/` directory — rejected: project already uses `specs/` at root for feature specs; would cause confusion

---

## Dependency Verification

| Dependency | Required Version | Installed | Compatible |
|-----------|-----------------|-----------|------------|
| vite | ^8.0.0 | 8.0.12 | ✅ |
| react | ^19.0.0 | 19.2.6 | ✅ |
| react-dom | ^19.0.0 | 19.2.6 | ✅ |
| typescript | ~6.0.0 | 6.0.2 | ✅ |
| @tailwindcss/vite | ^4.0.0 | 4.3.1 | ✅ |
| tailwindcss | ^4.0.0 | 4.3.1 | ✅ |
| shadcn | ^4.0.0 | 4.11.0 | ✅ |
| clsx | ^2.0.0 | 2.1.1 | ✅ |
| tailwind-merge | ^3.0.0 | 3.6.0 | ✅ |
| eslint | ^10.0.0 | 10.3.0 | ✅ |
| @eslint/js | ^10.0.0 | 10.0.1 | ✅ |
| @vitejs/plugin-react | ^6.0.0 | 6.0.1 | ✅ |
| prettier | ^3.0.0 | ❌ NOT INSTALLED | ⚠️ |
| eslint-config-prettier | ^10.0.0 | ❌ NOT INSTALLED | ⚠️ |
| vitest | ^4.0.0 | ❌ NOT INSTALLED | ⚠️ |
| @testing-library/react | ^16.0.0 | ❌ NOT INSTALLED | ⚠️ |
| @testing-library/jest-dom | ^6.0.0 | ❌ NOT INSTALLED | ⚠️ |
| jsdom | ^26.0.0 | ❌ NOT INSTALLED | ⚠️ |

---

## Summary

All research questions resolved. No blocking unknowns. The project follows established patterns for Vite + React + Tailwind v4 + shadcn/ui.

**Key actions from research**:
1. Install Vitest + RTL + jsdom at specified versions
2. Create `vitest.config.ts` extending Vite config
3. Create `src/test/setup.ts` for jest-dom matchers
4. Install Prettier + `eslint-config-prettier`, create `.prettierrc`
5. Create `.nvmrc` with `24`
6. Add `engines` field to `package.json`
7. Add `VITE_BASE` support to `vite.config.ts`
8. Validate shadcn CLI by adding `button` component
