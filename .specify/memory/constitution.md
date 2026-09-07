# CV Website Constitution

## Core Principles

### I. Typed Data Architecture

All CV content MUST reside in typed JSON files under `src/data/`. Type definitions
MUST be declared in `src/types/` before data files are created. Components MUST
import typed data directly — no runtime parsing, no API calls, no database
queries. TypeScript strict mode MUST be enabled with no `any` types in the
codebase.

Rationale: A static CV website's data is its foundation. Typed JSON provides
compile-time safety, autocomplete, and makes content changes trivial without
touching component code. See [docs/Architecture.md](docs/Architecture.md).

### II. Testing (NON-NEGOTIABLE)

Test-Driven Development is mandatory. Tests MUST be written and reviewed before
implementation. All tests MUST pass before merge. Coverage targets: 100% for
`src/lib/` utilities, 80%+ for `src/components/`. Tests MUST use Vitest + React
Testing Library + jsdom. Test naming MUST follow the
`{method}-{Condition}-{ExpectedResult}` pattern.

Rationale: TDD ensures every feature is validated before code is written,
preventing regressions in a project where typed data drives the entire UI.
See [docs/TestingGuide.md](docs/TestingGuide.md).

### III. Code Quality and Component Standards

Components MUST use named arrow function exports with typed props destructured
inline. Props interfaces MUST be defined in the same file. The `cn()` utility
from `@/lib/utils` MUST be used for conditional Tailwind classes. shadcn/ui
components MUST be added via `npx shadcn@latest add <name>` only — never
copy-pasted from other projects or hand-edited. All shadcn/ui components MUST
live in `src/components/ui/`. PascalCase for components and types, camelCase for
variables and functions. Named exports only — avoid default exports.

Rationale: Consistent component patterns and CLI-managed UI primitives reduce
divergence and simplify long-term maintenance.
See [docs/CodingGuidelines.md](docs/CodingGuidelines.md).

### IV. No Feature Bloat

The application MUST remain minimal and startable at all times. Every feature
MUST originate from a specification document in `specs/` before any
implementation begins. No exploratory changes — features are built as discrete,
specified units. The feature list in `docs/Features.md` MUST be kept current
(tracked status, dependency diagram updated on completion).

New work MUST be tracked as a feature, with its own ID and spec folder. Roadmaps
and numbered step lists MUST NOT be used to schedule work: a feature that proves
too large MUST be split into more features rather than into steps beneath one.
Work that is not yet done is an unchecked feature in `docs/Features.md` or an
explicitly flagged open requirement inside a feature's spec — never a step in a
list that lives outside the feature registry.

Rationale: A CV website has a well-defined, bounded scope. Preventing feature
creep keeps the project focused, maintainable, and always deployable. A step
list lets scope grow unobserved, because the registry keeps showing one item
however much work collects beneath it; splitting into features instead keeps
the real size of the work visible.
See [docs/Features.md](docs/Features.md).

### V. Performance and Static Delivery

As a static site, initial page load MUST be under 1.5 s on broadband.
Subsequent interaction feedback MUST be under 200 ms. Bundle sizes MUST be
monitored — no dependency added without justification. Images and assets MUST be
optimized for web delivery.

Rationale: A CV website must load instantly; any delay undermines its purpose
as a professional presentation. Static delivery imposes no server-side
latency, but client-side bloat can still degrade the experience.

## Technical Constraints

| Concern         | Rule                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| Build tool      | Vite 6+ (bundler + dev server)                                                             |
| Framework       | React 19+ with TypeScript strict mode                                                      |
| Styling         | Tailwind CSS 4+ via `@tailwindcss/vite` plugin                                             |
| UI components   | shadcn/ui — added via CLI (`npx shadcn@latest add <name>`), stored in `src/components/ui/` |
| Data source     | Typed JSON files in `src/data/`, imported directly by components                           |
| Types           | `src/types/` — declare interfaces before writing data files                                |
| Utilities       | `src/lib/` — pure functions only, no React dependency                                      |
| Testing         | Vitest + React Testing Library + jsdom                                                     |
| Package manager | npm                                                                                        |
| Configuration   | No secrets, no environment variables — fully build-time static                             |
| Backend         | None. No server, no API calls, no database — everything is pre-rendered HTML/CSS/JS        |

See [docs/Architecture.md](docs/Architecture.md) and
[docs/RepositoryStructure.md](docs/RepositoryStructure.md).

## Development Workflow and Quality Gates

- **No auto-commits**: Never commit changes automatically. Always wait for the user to explicitly request a commit.
- All changes via feature branches and pull requests — no direct commits to
  `main`. Each unit of work gets its own branch off `main` and lands via its own
  pull request directly into `main`; there is no intermediate integration branch,
  and the branch is deleted after merging.
- Specification-first delivery: clarify → spec → plan → tasks → analyze → implementation.
- Constitution Check in planning MUST enumerate principle-specific pass/fail
  outcomes and document mitigations for any exception.
- Pull requests MUST pass all tests and linting (when configured).
- Changes with visible behavior MUST additionally be verified by a manual browser
  check before review — a passing test suite is not evidence that the change looks
  or feels right.
- Commit messages MUST be clear and represent one logical unit of work.
- Feature completion tracking: when implementation and tests are fully done,
  update `docs/Features.md` immediately (check off the feature, update
  status table, mark node as done in the dependency diagram).
- Review approval MUST verify:
  1. Typed data pattern is correctly followed (types before data).
  2. Test coverage for changed behavior is present and passing.
  3. shadcn/ui components are CLI-managed, not hand-edited or copy-pasted.
  4. No secrets, API calls, or database dependencies introduced.
  5. Performance impact is considered and acceptable.
  6. Feature completion tracking is updated if applicable.

## Governance

This constitution is the highest-priority engineering policy for this
repository.

Amendments require:

1. A documented rationale and impact statement.
2. A semantic version decision (MAJOR, MINOR, PATCH).
3. Updates or explicit validation of dependent templates and guidance files.

Versioning policy:

- MAJOR: incompatible governance changes or principle removals/redefinitions.
- MINOR: new principle/section or materially expanded requirements.
- PATCH: clarifications and wording-only refinements.

Compliance review expectations:

- Every plan MUST include a Constitution Check aligned to these principles.
- Every pull request review MUST verify constitutional compliance.
- Any approved exception MUST be explicit, time-bounded, and tracked as
  follow-up work.

**Version**: 1.0.1 | **Ratified**: 2026-06-20 | **Last Amended**: 2026-09-06
