# Idea: Theme Switcher

## Status: Design Exploration

## Summary

The CV website supports multiple visual themes that share the same underlying CV data. Users (and visitors) can switch between themes to view the same content in different presentations.

## Themes

| #   | Theme              | Description                                                                                                    |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| 1   | **IDE / Editor**   | Code editor aesthetic with file-tree sidebar, tabs, syntax highlighting, status bar (Catppuccin Mocha palette) |
| 2   | **3D Room**        | Pseudo-3D floating panels in a spatial room, parallax depth, scroll-through immersive effect                   |
| 3   | **Retro Terminal** | Green phosphor monospace CRT with scanlines, box-drawing characters, blinking cursor                           |

## Mechanism

- Theme switcher available in the UI (location TBD — could be a dropdown, a palette icon, or integrated into each theme's navigation)
- All themes read from the same `src/data/` JSON files — zero duplication of CV content
- Each theme is a separate layout/routing entry (e.g., `/ide`, `/3d`, `/terminal`) or a client-side state toggle that swaps the root layout component
- Theme preference could be stored in `localStorage` for persistence across visits

## State Management

- Use **Preact Signals** (`@preact/signals-react`) for shared state across themes
- Active theme is a signal (`activeTheme`) — all theme layouts react to it automatically
- Each theme can also use signals for its own internal state (e.g., IDE tab state, 3D scroll position, terminal command history)
- Signals keep state outside the React component tree, avoiding prop-drilling and unnecessary re-renders
- `localStorage` persistence via a `effect()` on the active theme signal

## Open Questions

- Should the theme be part of the URL path or a state toggle?
- Should the default theme be IDE or should we detect visitor preference?
- Should each theme have its own color palette, or share a unified design token system?

## Related Documents

- [IDE Theme](./ide-theme.md)
- [3D Room Theme](./3d-room-theme.md)
- [Retro Terminal Theme](./retro-terminal-theme.md)
- [Multilanguage Support](./multilanguage.md)
