# Dev Server Contract

**Feature**: F-001 Project Setup  
**Command**: `npm run dev`  
**Underlying**: `vite` (Vite dev server)

## Expected Behavior

### Startup

- Starts HTTP server on `localhost` (default port 5173)
- Prints URL to terminal (e.g., `http://localhost:5173/`)
- Serves `index.html` as entry point
- Hot Module Replacement (HMR) enabled via WebSocket

### Hot Module Replacement (HMR)

- Source file edits reflected in browser within 2 seconds
- No full page reload for `.tsx`, `.css` changes
- React component state preserved across HMR updates (Vite React plugin)
- Type errors shown in terminal AND browser overlay

### Path Resolution

- `@/` alias resolves to `src/` (e.g., `@/components/ui/button` → `src/components/ui/button.tsx`)
- `.tsx` and `.ts` extensions resolved automatically
- `index.html` served at root path

### TypeScript Error Reporting

- Type errors shown in:
  1. Terminal (Vite's console output)
  2. Browser overlay (Vite's error overlay)
- Error includes file path, line number, and error message
- Dev server continues running despite type errors (does not exit)

### CSS Processing

- Tailwind utility classes compiled on-demand (JIT)
- shadcn/ui CSS variables available in browser
- Dark mode via `.dark` class on `<html>` element

## Success Criteria

| Criteria          | Expected                           |
| ----------------- | ---------------------------------- |
| Server starts     | URL printed, browser loads page    |
| Page renders      | "CV" text visible (from App.tsx)   |
| HMR latency       | < 2 s from save to browser update  |
| Type errors shown | Browser overlay + terminal message |
| CSS works         | Tailwind classes applied correctly |

## Acceptance Test

```bash
npm run dev
# Open http://localhost:5173
# 1. Verify page loads with "CV" heading
# 2. Edit src/App.tsx — change text, save, verify browser updates
# 3. Introduce type error — verify overlay appears
# 4. Fix error, save — verify overlay disappears
```
