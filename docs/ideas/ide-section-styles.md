# Idea: IDE Theme Section Rendering Styles

## Status: Design Exploration

## Summary

Each section in the IDE theme renders its content with a distinct "fake source code" style that matches the file extension in the tab bar. The styles form a consistent code-editor aesthetic while making each section's data structure readable.

## Section styles

### about.tsx — TypeScript object export

Single object with personality and contact fields.

```typescript
export const about = {
  name: "Jane Developer",
  role: "Senior Frontend Engineer & UI Architect",
  bio: "Senior frontend engineer with 8+ years...",
  contact: {
    email: "jane.developer@example.com",
    location: "Berlin, Germany",
    github: "jane-dev",
  },
};
```

### experience.tsx — Typed array of objects

Array of experience entries, each as an object with string fields and highlights/skills arrays.

```typescript
export const experience: Experience[] = [
  {
    company: "Tech Innovations Inc.",
    role: "Staff Frontend Engineer",
    period: "2021-04 - 2024-06",
    location: "Berlin, Germany",
    highlights: [
      "Led migration of legacy AngularJS to React 18",
      "Designed shared component library for 4 teams",
    ],
    skills: [/* skill objects with ProgressBar rendering */],
  },
];
```

Skills inline are rendered as `ProgressBar` components in a monospace inline layout.

### projects.tsx — Typed array of objects

```typescript
export const projects: Project[] = [
  {
    name: "Open Source Design System",
    description: "60+ accessible components, design tokens...",
    url: "https://opensourceds.example.com",
    githubUrl: "https://github.com/jane-dev/opensource-ds",
    skills: ["React", "TypeScript", "Storybook"],
  },
];
```

### skills.tsx — Raw markdown with progress bars

See `skills-markdown-section.md` for full design. Rendered as markdown source with `#` headings, `-` list items, and inline `ProgressBar` components.

### courses.tsx — Method-based with typed union param

Function definition with a typed literal union parameter that filters a catalog by category.

```typescript
type Category = "Frontend" | "Architecture" | "Testing";

function getCourses(category: Category): Course[] {
  const catalog = {
    Frontend: [
      { title: "Advanced React Patterns", provider: "Frontend Masters", year: 2024 },
    ],
    Architecture: [
      { title: "Building Scalable Design Systems", provider: "Smashing Magazine", year: 2023 },
    ],
    Testing: [
      { title: "TypeScript for Professionals", provider: "Egghead.io", year: 2022 },
    ],
  };
  return catalog[category];
}
```

The method signature (`getCourses(category: Category)`) makes the data feel like executable code. No usage block is shown — the definition alone communicates the structure.

### education.tsx — Typed array

```typescript
export const education: Education[] = [
  {
    degree: "B.Sc. Computer Science",
    institution: "Technical University of Berlin",
    period: "2013-10 - 2016-07",
    description: "Focused on software engineering...",
  },
];
```

### certificates.tsx — Typed array

Same pattern as experience/projects.

```typescript
export const certificates: Certificate[] = [
  {
    name: "AWS Solutions Architect Associate",
    issuer: "Amazon Web Services",
    date: "2023-06",
    url: "https://aws.amazon.com/verify/certificate",
    credentialId: "AWS-ASA-98765",
  },
];
```

## Color scheme (Catppuccin Mocha)

| Token | Color | Hex |
|-------|-------|-----|
| Keywords (`export`, `const`) | Mauve | `#cba6f7` |
| Identifiers / type names | Blue | `#89b4fa` |
| Property keys | Green | `#a6e3a1` |
| String values | Red | `#f38ba8` |
| Punctuation (`{`, `[`, `,`) | Yellow | `#f9e2af` |
| Comments | Overlay | `#6c7086` |
| Base text | Text | `#cdd6f4` |

All sections use monospace font (`'SF Mono', 'Fira Code', monospace`) and the Catppuccin Mocha dark background (`#1e1e2e`).

## Implementation approach

Each section component receives its typed data as props and renders it as syntax-highlighted React elements — colored `<span>` tags with inline styles or CSS variables. No actual syntax parser is needed; the structure is known at build time.

A shared helper (`src/themes/ide/components/Syntax.tsx` or similar) could provide colored span components for common patterns (keyword, string, property, punctuation, comment) to avoid repeating color values.

## Current sections mapping

| Tab | Component | Style |
|-----|-----------|-------|
| about.tsx | `AboutSection` | Single object export |
| experience.tsx | `ExperienceSection` | Typed array |
| skills.tsx | `SkillsSection` | Raw markdown + ProgressBar |
| projects.tsx | `ProjectsSection` | Typed array |
| education.tsx | `EducationSection` | Typed array |
| courses.tsx | `CoursesSection` | Method-based w/ typed param |
| certificates.tsx | `CertificatesSection` | Typed array |
