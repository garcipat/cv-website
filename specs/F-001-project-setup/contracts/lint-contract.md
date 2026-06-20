# Lint Contract

**Feature**: F-001 Project Setup  
**Command**: `npm run lint`  
**Underlying**: `eslint .`

## Rule Set

ESLint flat config (`eslint.config.js`) with:

| Plugin/Preset | Scope |
|---------------|-------|
| `@eslint/js` (recommended) | Core JS rules |
| `typescript-eslint` (recommended) | TS-aware rules — no-unused-vars, no-explicit-any, etc. |
| `eslint-plugin-react-hooks` (flat recommended) | Rules of Hooks — exhaustive-deps |
| `eslint-plugin-react-refresh` (vite) | HMR-safe exports — no component from non-component file |
| `globalIgnores(['dist'])` | Ignore build output |

## Expected Behavior

### Success Mode
- Runs against all `**/*.{ts,tsx}` files (excluding `dist/`)
- Exit code 0 = no errors, no warnings
- Output: silent (ESLint default: no news is good news)

### Failure Mode
- Non-zero exit code for any error
- Descriptive message includes file path, line number, rule ID
- TypeScript-specific errors reference the TS rule (e.g., `@typescript-eslint/no-unused-vars`)

## Acceptance Test

```bash
# Should pass (clean codebase)
npm run lint && echo "PASS"

# Should fail (introduce unused variable)
echo "const unused = 1" >> src/App.tsx
npm run lint && echo "FAIL: should have errored" || echo "PASS: caught unused var"
git checkout src/App.tsx  # restore
```

## Contract for Consuming Features

1. All PRs must pass `npm run lint`
2. No `eslint-disable` comments without explicit justification
3. New `eslint.config.js` rules require Constitution amendment (Constitution III)
