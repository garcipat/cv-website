# Feature List

## Features

### Core (Must Have)

- [x] F-001: Project setup — Vite + React + TypeScript scaffold, Tailwind, shadcn/ui, docs
- [x] F-002: Data model — TypeScript types + JSON files for CV content
- [ ] F-003: Display personality section — name, tagline, summary
- [ ] F-004: Display career timeline — company, role, period, highlights
- [ ] F-005: Display skills — categories with visual skill levels
- [ ] F-006: Display courses — title, provider, year
- [ ] F-007: Display studies / education — degree, institution, period
- [ ] F-008: Display certificates — name, issuer, date
- [ ] F-009: Display personal projects — name, description, tech stack, link
- [x] F-010: Design system — typography, spacing, colors, component tokens
- [ ] F-011: Page layout — section arrangement, scrolling structure, navigation
- [ ] F-012: Theme system — Preact Signals, `createLocalStorageSignal`, theme switcher infrastructure
- [x] F-013: Multilanguage — i18n EN/DE, locale signal, UI translations, CV data per locale
- [ ] F-014: IDE theme — file tree sidebar, tab bar, syntax-highlighted editor, status bar

### Should Have

- [ ] S-001: Print-friendly styling — `@media print` so CV doubles as printable resume
- [ ] S-002: SEO meta tags — Open Graph metadata for social media previews
- [ ] S-003: Scroll animations — subtle reveal animations as sections scroll into view
- [ ] S-004: Reusable timeline component — shared by Career (F-004) and Studies (F-007)
- [ ] S-005: 3D Room theme — floating panels, parallax depth, scroll-through spatial effect
- [ ] S-006: Retro Terminal theme — CRT green phosphor, scanlines, command-line interaction, `:help`

### Optional

- _TBD_

---

## Implementation Status

| #     | Feature                | Status         | Spec                                    | Implementation | Tests |
| ----- | ---------------------- | -------------- | --------------------------------------- | -------------- | ----- |
| F-001 | Project setup          | ✅ Done        | [spec](../specs/F-001-project-setup.md) | ✅             | ✅    |
| F-002 | Data model             | ✅ Done        | [spec](../specs/F-002-data-model/spec.md) | ✅             | ✅    |
| F-003 | Personality section    | 📋 Planned     | —                                       | ❌             | ❌    |
| F-004 | Career timeline        | 📋 Planned     | —                                       | ❌             | ❌    |
| F-005 | Skills display         | 📋 Planned     | —                                       | ❌             | ❌    |
| F-006 | Courses display        | 📋 Planned     | —                                       | ❌             | ❌    |
| F-007 | Studies / education    | 📋 Planned     | —                                       | ❌             | ❌    |
| F-008 | Certificates display   | 📋 Planned     | —                                       | ❌             | ❌    |
| F-009 | Personal projects      | 📋 Planned     | —                                       | ❌             | ❌    |
| F-010 | Design system          | ✅ Done        | [spec](../specs/F-010-design-system/spec.md) | ✅             | ✅    |
| F-011 | Page layout            | 📋 Planned     | —                                       | ❌             | ❌    |
| F-012 | Theme system           | 📋 Planned     | —                                       | ❌             | ❌    |
| F-013 | Multilanguage          | ✅ Done        | [spec](../specs/F-013-multilanguage/spec.md) | ✅             | ✅    |
| F-014 | IDE theme              | 📋 Planned     | [spec](../specs/F-014-ide-theme/spec.md) | ❌             | ❌    |
| S-001 | Print-friendly styling | 📋 Planned     | —                                       | ❌             | ❌    |
| S-002 | SEO meta tags          | 📋 Planned     | —                                       | ❌             | ❌    |
| S-003 | Scroll animations      | 📋 Planned     | —                                       | ❌             | ❌    |
| S-004 | Reusable timeline      | 📋 Planned     | —                                       | ❌             | ❌    |
| S-005 | 3D Room theme          | 📋 Planned     | —                                       | ❌             | ❌    |
| S-006 | Retro Terminal theme   | 📋 Planned     | —                                       | ❌             | ❌    |

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
    F001["✅ F-001: Project Setup"]
    F002["✅ F-002: Data Model"]
    F003["F-003: Personality"]
    F004["F-004: Career"]
    F005["F-005: Skills"]
    F006["F-006: Courses"]
    F007["F-007: Studies"]
    F008["F-008: Certificates"]
    F009["F-009: Projects"]
    F010["✅ F-010: Design System"]
    F011["F-011: Page Layout"]
    F012["F-012: Theme System"]
    F013["✅ F-013: Multilanguage"]
    F014["F-014: IDE Theme"]
    S001["S-001: Print-Friendly"]
    S002["S-002: SEO Meta Tags"]
    S003["S-003: Scroll Animations"]
    S004["S-004: Timeline Component"]
    S005["S-005: 3D Room Theme"]
    S006["S-006: Retro Terminal"]

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

    F012 --> F001
    F013 --> F001
    F013 --> F012
    F014 --> F012
    F014 --> F013
    F014 --> F002
    S005 --> F012
    S005 --> F013
    S005 --> F002
    S006 --> F012
    S006 --> F013
    S006 --> F002

    S001 --> F011
    S002 --> F001
    S003 --> F010
    S003 --> F011
    S004 --> F002
    S004 --> F010
    F004 --> S004
    F007 --> S004

    classDef done stroke:#FFD600,stroke-width:3px
    classDef inProgress stroke:#FF6F00,stroke-width:3px,stroke-dasharray:4
    classDef projectSetup fill:#1565C0,color:#ffffff
    classDef cvSections fill:#2E7D32,color:#ffffff
    classDef layoutNavigation fill:#E65100,color:#ffffff
    classDef themeInfrastructure fill:#6A1B9A,color:#ffffff
    classDef themes fill:#00838F,color:#ffffff
    classDef enhancements fill:#AD1457,color:#ffffff

    class F001 done
    class F002 done
    class F001,F002 projectSetup
    class F010 done
    class F013 done
    class F003,F004,F005,F006,F007,F008,F009 cvSections
    class F011,S001,S003 layoutNavigation
    class F012,F013 themeInfrastructure
    class F014,S005,S006 themes
    class S002,S004 enhancements
```

**Critical Path**: F-001 → F-012 → F-013 → F-002 → F-014 (foundation → theme system → multilanguage → data model → first theme, then content sections F-003 through F-009)
