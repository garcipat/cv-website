# Idea: Skills Section as Fake Markdown Source

## Status: Design Exploration

## Summary

The skills section in the IDE theme displays as a raw markdown source file rendered in the editor pane. It uses monospace font, visible markdown syntax characters (`#`, `##`, `-`), syntax-highlighted headings, and real `ProgressBar` components embedded inline for the skill level visualization.

## Visual style

```
# Skills                               ← H1, purple (like code keyword)
                                       
## Frontend                            ← H2, blue
                                       
- React          [██████████████████░░] Expert   ← list item, green bar, yellow label
- TypeScript     [████████████████░░░░] Expert
- Next.js        [███████████████░░░░░] Advanced
- CSS / Tailwind [████████████████░░░░] Expert
- Storybook      [███████████████░░░░░] Advanced
- Vitest / Jest  [███████████████░░░░░] Advanced
                                       
## Backend & Tools                     
                                       
- Node.js        [███████████░░░░░░░░░] Proficient
- GraphQL        [██████████░░░░░░░░░░] Proficient
- Docker         [████████░░░░░░░░░░░░] Proficient
- PostgreSQL     [████████░░░░░░░░░░░░] Proficient
                                       
## Design & Collaboration              
                                       
- Figma          [████████████░░░░░░░░] Advanced
- Design Systems [████████████████░░░░] Expert
- Agile / Scrum  [███████████████░░░░░] Advanced
```

### Syntax coloring
- `#` heading marker → purple (`#cba6f7`) — code keyword color
- Heading text → matching the heading marker color
- `-` list marker → default text color
- Skill name → default text color
- Progress bar `[...]` → green (`#a6e3a1`) for the brackets and fill
- Level label → yellow (`#f9e2af`)

### Alignment
- Skill names are left-aligned, bars follow after a fixed gap
- Labels right-aligned after the bar
- All lines in monospace so the bars form a rough column

### Component integration

The `ProgressBar` component (see `symbol-progress-bar.md`) is used for each skill entry. It handles the bracket rendering, fill level, and translated label.

The `SkillsSection` component maps over `SkillCategory[]` and renders:
- `# Skills` as a static header
- `## {category}` for each category
- `- {skill.name} <ProgressBar value={skill.level} />` for each skill

## Data model

Uses the existing `SkillCategory[]` from `src/types/cv.ts`. No changes needed.

## Integration

Replaces the current IDE `SkillsSection` component. The `EditorPane` already routes `'skills.tsx'` to `SkillsSection`, so only the component internals change.

## Future considerations
- Could add a "copy raw" button to get the plain-text markdown
- Colour scheme could follow the active IDE colour theme
- Same approach could be used for other sections (experience as `.ts`, about as `.tsx`, etc.)
