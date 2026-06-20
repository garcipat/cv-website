# Idea: Retro Terminal Theme

## Status: Design Exploration

## Summary

A retro CRT terminal aesthetic. The entire CV is rendered as if displayed on an old-school green phosphor monitor. Monospaced font, scanlines, box-drawing characters, blinking cursor, and a command-line interaction metaphor. Strong personality, playful, speaks directly to developer culture.

## Layout

```
┌──────────────────────────────────────────────┐
│  $ cat cv/readme.txt                         │
│  ══════════════════════════════════════════  │
│                                              │
│  JANE CHEN — Software Architect              │
│  I design & build distributed systems.       │
│                                              │
│  > EXPERIENCE                                │
│    Staff Engineer @ Acme Corp [2020—]        │
│    Sr Engineer @ Beta Inc [2017—2020]        │
│                                              │
│  > PROJECTS                                  │
│    EventBridge — 10M events/sec pipeline     │
│    TypeForge — schema validation engine      │
│                                              │
│  > SKILLS                                    │
│    Rust · Go · TypeScript · Kafka · K8s      │
│                                              │
│  > PERSONALITY                               │
│    I care about developer experience...      │
│                                              │
│  ══════════════════════════════════════════  │
│  $ ./contact                                 │
│  email: jane@example.com                     │
│  github: github.com/janechen                 │
│                                              │
│  $ █                                         │
├──────────────────────────────────────────────┤
│  screen 80x24 · 9600 baud · vt100            │
└──────────────────────────────────────────────┘
```

## Key Elements

### CRT Effect

- **Phosphor glow**: Text has a subtle green glow (`text-shadow` with green blur)
- **Scanlines**: Horizontal repeating lines overlay (CSS `repeating-linear-gradient`)
- **Screen curvature** (optional): Subtle `border-radius` and vignette shadow at edges
- **Color**: Classic green-on-black (`#33ff33` on `#0a0a0a`), could offer amber or white phosphor variants

### Command-Line Interaction

- Sections are "commands" — `cat about.md`, `ls experience/`, `./run skills`
- A blinking block cursor at the bottom
- Could support typing commands for navigation (nice-to-have)
- Box-drawing characters (`┌─┐│└┘`) for ASCII borders

### Available Commands

- `:help` — lists all available commands
- `:theme <ide|space|terminal>` — switch visual theme
- `:lang <en|de>` — switch language
- `:about` / `:exp` / `:projects` / `:skills` / `:personality` / `:contact` — jump to section
- `:clear` — clear terminal output
- `:top` — scroll to top

### Typography

- Monospaced font stack: `'IBM Plex Mono', 'Courier New', monospace`
- Fixed-width layout like a terminal (80-character column feel)
- Section headers use `>` prefix like shell prompts

### Navigation

- Scroll-driven within the terminal output
- Or "command" links at the bottom that jump to sections
- Could type section names (hitting Tab autocompletes) — fun but complex to implement

## Concerns

- **Readability**: Green-on-black and scanlines reduce contrast — may be tiring for long reading
- **Accessibility**: Should have a simplified fallback (no scanlines, higher contrast)
- **Content fit**: Some CV content (long descriptions, rich formatting) may not fit the monospace constraint
- **Maintenance**: CRT effects require careful CSS — could be fragile across browsers

## State (Preact Signals)

| Signal           | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `activeSection`  | Which CV section is currently displayed in the terminal output                 |
| `commandHistory` | Typed commands history (for up-arrow recall if interactive input is supported) |
| `currentInput`   | Current command line input value                                               |
| `cursorVisible`  | Blinking cursor on/off state                                                   |
| `currentTheme`    | Shared signal — which theme is active (IDE / 3D / Terminal)                    |

## Desktop-First

Terminal emulators are inherently desktop experiences. Not designed for mobile.
