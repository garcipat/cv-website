# Build Contract

**Feature**: F-001 Project Setup  
**Command**: `npm run build`  
**Composed of**: `tsc -b && vite build`

## Expected Behavior

### TypeScript Compilation (`tsc -b`)

- Uses project references in `tsconfig.json`
- Builds `tsconfig.app.json` (source) and `tsconfig.node.json` (config)
- Type errors cause non-zero exit code → build fails
- Incremental build info written to `node_modules/.tmp/`

### Vite Production Build (`vite build`)

- Runs only if `tsc -b` succeeds (exit code 0)
- Produces output in `dist/` directory
- Output structure:
  ```
  dist/
  ├── index.html              # Entry HTML (0.5 KB typical)
  ├── assets/
  │   ├── index-[hash].js     # Main JS bundle
  │   ├── index-[hash].css    # Main CSS bundle
  │   └── *.woff2             # Font files (if used)
  └── favicon.svg             # Copied from public/ (if present)
  ```

## Success Criteria

| Criteria           | Threshold                        | Measurement                                                           |
| ------------------ | -------------------------------- | --------------------------------------------------------------------- |
| Exit code          | 0                                | Shell `$?`                                                            |
| HTML output        | `dist/index.html` exists         | File check                                                            |
| JS bundle          | `dist/assets/index-*.js` exists  | Glob match                                                            |
| CSS bundle         | `dist/assets/index-*.css` exists | Glob match                                                            |
| Total gzipped size | < 200 KB                         | `gzip -c dist/assets/*.js dist/assets/*.css dist/index.html \| wc -c` |
| Build time         | < 30 s                           | `time npm run build`                                                  |
| Type errors        | Fatal (exit ≠ 0)                 | Introduce type error, verify build fails                              |

## Contract for Consuming Features

Subsequent features (F-002+) rely on:

1. Build succeeds → their TypeScript code compiles
2. `@/` path alias resolves → they can import from `@/components`, `@/lib`, `@/data`
3. Tailwind classes in `.tsx` are processed → visual output matches utility classes
