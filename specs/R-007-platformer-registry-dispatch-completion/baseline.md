# Pre-refactor baseline (R-007)

**Captured**: 2026-09-25 (T001)

The byte-for-byte behaviour-preservation baseline this refactor must keep green
(SC-005/FR-011). No dependency, data, level/marker/sprite change is expected.

## Commands

```bash
npm test
npm run build
```

## Results

- `npm test` — **175 test files passed, 3992 tests passed**, exit 0 (Vitest + jsdom).
- `npm run build` — **tsc -b && vite build succeeded**, exit 0 (only the pre-existing
  >500 kB chunk-size advisory; not an error).

## Notes

- `npm install` added nothing (no new runtime or dev dependency; constitution Principle V).
- This file records the green baseline only; it is not a shipped artifact.
