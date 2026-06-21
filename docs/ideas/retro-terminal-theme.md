# Idea: Retro Terminal Theme

## Status: Design Exploration

## Summary

A retro CRT terminal aesthetic. The entire CV is rendered as if displayed on an old-school green phosphor monitor. Monospaced font, scanlines, box-drawing characters, blinking cursor, and a command-line interaction metaphor. Strong personality, playful, speaks directly to developer culture.

## Layout

### Starting Screen (minimal intro)

On first load, the terminal shows a brief introduction with the three primary commands, not the full CV. The full content appears only after a section command is typed.

```
┌──────────────────────────────────────────────┐
│                                              │
│  JANE CHEN                                   │
│  Software Architect — Distributed Systems ·  │
│  Developer Experience                        │
│  ──────────────────────────────────────────  │
│                                              │
│  Type a command to explore —                 │
│                                              │
│  :help   List all available commands and     │
│          sections                            │
│  :lang   <en | de> — switch language         │
│  :theme  <terminal | ide | space> — switch   │
│          visual theme                        │
│                                              │
│  github.com/janechen · jane@example.com      │
│                                              │
│  $ █                                         │
├──────────────────────────────────────────────┤
│  screen 80x24 · 9600 baud · vt100            │
└──────────────────────────────────────────────┘
```

### Full CV Output (after `:help` or section command)

Once a command is issued, the terminal scrolls to display all CV sections:

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
- `:me` / `:exp` / `:projs` / `:skills` / `:edu` / `:crs` / `:certs` / `:contact` — jump to section
- `:cls` — clear terminal output (blank)
- `:reset` — reset to initial intro screen

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

## Starting Screen Mockup (HTML Reference)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Terminal Theme Mockup</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap');

  :root {
    --bg: #0a0a0a;
    --text: #33ff33;
    --text-bright: #55ff55;
    --text-dim: #1a7a1a;
    --amber: #ffb000;
    --glow: rgba(51, 255, 51, 0.6);
    --scanline-color: rgba(0, 0, 0, 0.08);
    --crt-curve: 12px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #020202;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 40px 20px;
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
  }

  .crt-screen {
    width: 900px;
    max-width: 100%;
    background: var(--bg);
    color: var(--text);
    border-radius: var(--crt-curve);
    overflow: hidden;
    position: relative;
    box-shadow:
      0 0 60px rgba(0, 0, 0, 0.8),
      inset 0 0 120px rgba(0, 0, 0, 0.3),
      0 0 40px rgba(51, 255, 51, 0.08);
  }

  .crt-screen::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      var(--scanline-color) 2px,
      var(--scanline-color) 4px
    );
    pointer-events: none;
    z-index: 10;
    animation: scanlines 8s linear infinite;
  }

  @keyframes scanlines {
    0% { transform: translateY(0); }
    100% { transform: translateY(4px); }
  }

  .crt-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%);
    pointer-events: none;
    z-index: 9;
    border-radius: var(--crt-curve);
  }

  .terminal-container {
    position: relative;
    z-index: 1;
    padding: 20px 28px 0 28px;
    min-height: 600px;
    display: flex;
    flex-direction: column;
    font-size: 14px;
    line-height: 1.6;
  }

  .terminal-output {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .intro-block { padding: 40px 0; }

  .intro-name {
    display: block;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-bright);
    text-shadow:
      0 0 10px var(--glow),
      0 0 20px var(--glow),
      0 0 40px var(--glow);
    margin-bottom: 6px;
  }

  .intro-tagline {
    display: block;
    color: var(--text);
    margin-bottom: 20px;
  }

  .intro-hr {
    color: var(--text-dim);
    margin-bottom: 20px;
    letter-spacing: 2px;
  }

  .intro-hint {
    color: var(--text-dim);
    margin-bottom: 14px;
  }

  .intro-commands {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 32px;
  }

  .cmd-row {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }

  .cmd-name {
    color: var(--amber);
    text-shadow: 0 0 8px rgba(255, 176, 0, 0.4);
    font-weight: 700;
    min-width: 8ch;
  }

  .cmd-desc { color: var(--text); opacity: 0.85; }

  .intro-contact { color: var(--text-dim); }

  .command-line {
    display: flex;
    align-items: center;
    padding: 12px 0 16px 0;
    border-top: 1px solid rgba(51, 255, 51, 0.12);
  }

  .prompt {
    color: var(--text-bright);
    margin-right: 8px;
    text-shadow: 0 0 6px var(--glow);
  }

  .blinking-cursor {
    display: inline-block;
    background: var(--text);
    width: 9px;
    height: 17px;
    vertical-align: text-bottom;
    margin-left: 2px;
    animation: blink 1s step-end infinite;
    box-shadow: 0 0 8px var(--glow);
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    padding: 6px 28px;
    font-size: 11px;
    color: var(--text-dim);
    border-top: 1px solid var(--text-dim);
    position: relative;
    z-index: 1;
    opacity: 0.65;
  }

  .url-link { color: var(--amber); text-decoration: underline; }
</style>
</head>
<body>

<div class="crt-screen">
  <div class="terminal-container">
    <div class="terminal-output">

      <div class="intro-block">
        <span class="intro-name">JANE CHEN</span>
        <span class="intro-tagline">Software Architect — Distributed Systems · Developer Experience</span>

        <div class="intro-hr">────────────────────────────────────────────────────</div>

        <p class="intro-hint">Type a command to explore —</p>

        <div class="intro-commands">
          <div class="cmd-row">
            <span class="cmd-name">:help</span>
            <span class="cmd-desc">List all available commands and sections</span>
          </div>
          <div class="cmd-row">
            <span class="cmd-name">:lang</span>
            <span class="cmd-desc">&lt;en | de&gt; — switch language</span>
          </div>
          <div class="cmd-row">
            <span class="cmd-name">:theme</span>
            <span class="cmd-desc">&lt;terminal | ide | space&gt; — switch visual theme</span>
          </div>
        </div>

        <p class="intro-contact">github.com/janechen  ·  jane@example.com</p>
      </div>

    </div>

    <div class="command-line">
      <span class="prompt">$</span>
      <span class="blinking-cursor"></span>
    </div>
  </div>

  <div class="status-bar">
    <span>screen 80x24 · 9600 baud · vt100</span>
    <span>terminal · EN</span>
  </div>
</div>

</body>
</html>
```

## Desktop-First

Terminal emulators are inherently desktop experiences. Not designed for mobile.
