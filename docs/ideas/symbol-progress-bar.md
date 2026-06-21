# Idea: Symbol Progress Bar for Skills

## Status: Design Exploration

## Summary

A reusable progress bar component that uses Unicode block characters (█░) inside brackets to visualize skill levels as a spectrum. The bar replaces the current CSS-based bar in the IDE skills section and fits the "markdown fake" aesthetic — looking like rendered text inside a code block while remaining interactive/styled.

## Design

```
[████████████████░░░░]  Advanced
───── 20 chars ──────   ← translated level label
█ = filled · ░ = empty
Monospace font · inline-flex layout
```

### Level thresholds

| Range     | Label (en)   | Label (de)      |
|-----------|--------------|-----------------|
| 0–24      | Skilled      | Erfahren        |
| 25–49     | Proficient   | Fortgeschritten |
| 50–74     | Advanced     | Spezialisiert   |
| 75–100    | Expert       | Experte         |

Labels live in translation JSON (`skills.levels.*`) so they switch with locale.

### Component API

```
ProgressBar(value: number, width?: number)

value: 0–100 skill level
width: character count inside brackets (default 20)

Renders: [████░░░░░░░░░░░░░░]  Label
```

Placed in `src/components/ui/progress-bar.tsx` following shadcn/ui conventions.

### Integration

The existing `SkillsSection` in the IDE theme replaces its CSS bar (`<div className="h-2 rounded-full ...">`) with `<ProgressBar value={skill.level} />`. Skill name stays on the left, bar + label on the right.

### Future considerations

- Could be used in other themes (terminal's markdown sections, space theme)
- Width could become responsive based on container
- Could support different bracket styles (`|...|`, `(...)`, `[...]`)
