# Test Contract

**Feature**: F-001 Project Setup  
**Framework**: Vitest + React Testing Library + jsdom  
**Commands**: `npm test` (single run), `npm run test:watch` (watch mode)

## Configuration

File: `vitest.config.ts` (extends `vite.config.ts`)

```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
);
```

## Expected Behavior

### Test Discovery

- Finds files matching `**/*.test.{ts,tsx}` and `**/*.spec.{ts,tsx}` in `src/`
- Does NOT discover tests in `node_modules/` or `dist/`

### Test Execution

- `npm test` — runs all tests once, reports results, exits
- `npm run test:watch` — runs tests, watches for changes, re-runs on save

### Test Environment

- jsdom provides DOM APIs (`document`, `window`, `HTMLElement`, etc.)
- `@testing-library/jest-dom` matchers available globally (`toBeInTheDocument`, `toHaveClass`, etc.)
- React Testing Library renders components into jsdom document
- `@/` path alias resolves same as in Vite (`@/lib/utils` → `src/lib/utils`)

### Coverage (future requirement per Constitution II)

| Layer             | Target |
| ----------------- | ------ |
| `src/lib/`        | 100%   |
| `src/components/` | 80%+   |

Coverage configuration not required for F-001 (no meaningful source to cover yet). Add `test.coverage` config in F-002+.

## Acceptance Test

```bash
# Install test dependencies (if not already)
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event

# Run tests
npm test && echo "PASS: test infrastructure works"
```

## Contract for Consuming Features

1. Every feature MUST include tests before implementation (TDD per Constitution II)
2. Test files co-locate with source: `Component.test.tsx` next to `Component.tsx`
3. Test naming: `{method}-{condition}-{expected-result}` in kebab-case
4. Use `// Arrange`, `// Act`, `// Assert` comments for multi-line sections
5. Coverage thresholds enforced in CI (future)
