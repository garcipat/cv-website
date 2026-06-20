# Feature List

## Features

### Core (Must Have)

- [ ] F-001: Project setup — Vite + React + TypeScript scaffold, Tailwind, shadcn/ui, docs
- [ ] F-002: Data model — TypeScript types + JSON files for CV content
- [ ] F-003: Display personality section — name, tagline, summary
- [ ] F-004: Display career timeline — company, role, period, highlights
- [ ] F-005: Display skills — categories with visual skill levels
- [ ] F-006: Display courses — title, provider, year
- [ ] F-007: Display studies / education — degree, institution, period
- [ ] F-008: Display certificates — name, issuer, date
- [ ] F-009: Display personal projects — name, description, tech stack, link
- [ ] F-010: Design system — typography, spacing, colors, component tokens
- [ ] F-011: Page layout — section arrangement, scrolling structure, navigation

### Should Have

- [ ] S-001: Print-friendly styling — `@media print` so CV doubles as printable resume
- [ ] S-002: SEO meta tags — Open Graph metadata for social media previews
- [ ] S-003: Scroll animations — subtle reveal animations as sections scroll into view
- [ ] S-004: Reusable timeline component — shared by Career (F-004) and Studies (F-007)

### Optional

- _TBD_

---

## Implementation Status

| # | Feature | Status | Spec | Implementation | Tests |
| - | ------- | ------ | ---- | -------------- | ----- |
| F-001 | Project setup | 🔄 In Progress | [spec](../specs/2026-06-20-project-scaffold-design.md) | ❌ | ❌ |
| F-002 | Data model | 📋 Planned | — | ❌ | ❌ |
| F-003 | Personality section | 📋 Planned | — | ❌ | ❌ |
| F-004 | Career timeline | 📋 Planned | — | ❌ | ❌ |
| F-005 | Skills display | 📋 Planned | — | ❌ | ❌ |
| F-006 | Courses display | 📋 Planned | — | ❌ | ❌ |
| F-007 | Studies / education | 📋 Planned | — | ❌ | ❌ |
| F-008 | Certificates display | 📋 Planned | — | ❌ | ❌ |
| F-009 | Personal projects | 📋 Planned | — | ❌ | ❌ |
| F-010 | Design system | 📋 Planned | — | ❌ | ❌ |
| F-011 | Page layout | 📋 Planned | — | ❌ | ❌ |
| S-001 | Print-friendly styling | 📋 Planned | — | ❌ | ❌ |
| S-002 | SEO meta tags | 📋 Planned | — | ❌ | ❌ |
| S-003 | Scroll animations | 📋 Planned | — | ❌ | ❌ |
| S-004 | Reusable timeline | 📋 Planned | — | ❌ | ❌ |

---

## Workflow

1. **Specification** — Write feature spec in `specs/{feature}.md`
2. **Planning** — Create implementation plan from spec
3. **Implementation** — Write tests first (TDD), then implementation
4. **Review** — Architecture compliance + test coverage
5. **Merge** — Mark feature as implemented in this list

See [docs/Architecture.md](Architecture.md) and [docs/TestingGuide.md](TestingGuide.md) for structure and practices.

---

## Feature Dependencies

The following diagram shows feature dependencies and recommended implementation order:

```mermaid
graph RL
    F001["F-001: Project Setup"]
    F002["F-002: Data Model"]
    F003["F-003: Personality"]
    F004["F-004: Career"]
    F005["F-005: Skills"]
    F006["F-006: Courses"]
    F007["F-007: Studies"]
    F008["F-008: Certificates"]
    F009["F-009: Projects"]
    F010["F-010: Design System"]
    F011["F-011: Page Layout"]
    S001["S-001: Print-Friendly"]
    S002["S-002: SEO Meta Tags"]
    S003["S-003: Scroll Animations"]
    S004["S-004: Timeline Component"]

    F003 --> F002
    F004 --> F002
    F005 --> F002
    F006 --> F002
    F007 --> F002
    F008 --> F002
    F009 --> F002
    F002 --> F001
    F010 --> F001
    F011 --> F010

    F003 --> F011
    F004 --> F011
    F005 --> F011
    F006 --> F011
    F007 --> F011
    F008 --> F011
    F009 --> F011

    S001 --> F011
    S002 --> F001
    S003 --> F010
    S003 --> F011
    S004 --> F002
    S004 --> F010
    F004 --> S004
    F007 --> S004

    classDef done fill:#4caf50,color:#ffffff
    classDef inProgress fill:#ff9800,color:#000000
    classDef planned fill:#9e9e9e,color:#ffffff
    classDef projectSetup fill:#e3f2fd,color:#000000
    classDef cvSections fill:#e8f5e9,color:#000000
    classDef layoutNavigation fill:#fff3e0,color:#000000
    classDef enhancements fill:#fce4ec,color:#000000

    class F001 inProgress
    class F002,F003,F004,F005,F006,F007,F008,F009,F010,F011 planned
    class S001,S002,S003,S004 planned
    class F001,F002,F010 projectSetup
    class F003,F004,F005,F006,F007,F008,F009 cvSections
    class F011,S001,S003 layoutNavigation
    class S002,S004 enhancements
```

**Critical Path**: F-001 → F-010 → F-011 → F-002 → F-003 (foundation → design system → layout → data model → first content section drives reusable patterns for F-004 through F-009)
