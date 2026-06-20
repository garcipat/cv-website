<!--
Sync Impact Report
- Version change: 1.2.0 -> 3.0.0
- Project rename: "El Nopal Constitution" -> "Bingo Anything Constitution"
- Modified principles (complete replacement):
  - I. Layered Boundaries and Reusable Domain Contracts -> I. Code Quality
  - II. API and UI Contract Parity -> II. Testing (NON-NEGOTIABLE)
  - III. Test-Backed Changes (NON-NEGOTIABLE) -> III. User Experience
  - IV. Deployment and Environment Fidelity -> IV. Performance
  - V. Security and Operational Readiness -> Removed (absorbed into Technical Constraints)
- Added sections:
  - Technical Constraints (formal table from root speckit.constitution.md)
  - Performance targets with rationale
- Removed sections:
  - Documentation and Visualization Standards (not applicable to this project)
  - React/Vite/TypeScript frontend constraints (not applicable — Blazor Server project)
  - TanStack React Query / Preact Signals references (not applicable)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check placeholder already compatible)
  - ✅ .specify/templates/spec-template.md (requirements and scenarios compatible)
  - ✅ .specify/templates/tasks-template.md (task structure compatible)
  - ✅ .specify/templates/commands/*.md (directory does not exist in this repository)
- Follow-up TODOs:
  - None
-->

# Bingo Anything Constitution

## Core Principles

### I. Code Quality

All code MUST adhere to C# coding conventions with clear separation of concerns.
Features MUST be organized by subdomain (e.g. `Lists/`, `Rooms/`, `Players/`)
across all projects — never by file type.
Service layer abstractions MUST be defined in `BingoAnything.Abstractions` before
implementation.
Rationale: this project uses clean architecture with multi-project layering;
preserving these boundaries prevents coupling and regression spread.
See [docs/Architecture.md](docs/Architecture.md) and
[docs/CodingGuidelines.md](docs/CodingGuidelines.md).

### II. Testing (NON-NEGOTIABLE)

Test-Driven Development is mandatory. Tests MUST be written and approved before
implementation.
All tests MUST pass before any merge. Minimum 80% coverage on critical business
logic paths.
Unit tests MUST use `BingoAnything.Fake` (fake repositories) to isolate business
logic.
Integration tests MUST use SQLite in-memory via `BingoAnything.Persistence`.
Tests MUST use xUnit, Moq, and AwesomeAssertions as the testing framework.
Rationale: CI already enforces build and test pipelines; this must remain the
minimum quality gate for all contributions.
See [docs/TestingGuide.md](docs/TestingGuide.md).

### III. User Experience

All UI MUST use MudBlazor. Interactions MUST provide immediate feedback (loading
states, validation, error messages).
Error messages MUST be user-friendly — never expose stack traces.
Rationale: a Blazor Server application requires responsive UI with clear
feedback to maintain user trust in real-time interactions.
See [docs/CodingGuidelines.md](docs/CodingGuidelines.md).

### IV. Performance

Initial page load < 2 s. Subsequent interactions < 500 ms. Session operations
< 1 s.
Prevent N+1 queries with eager loading. Index frequently queried columns.
Rationale: Blazor Server relies on low-latency SignalR connections; performance
degradation directly impacts perceived application responsiveness.

## Technical Constraints

| Concern               | Rule                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| Business logic        | `BingoAnything.Application` only                                                     |
| Persistence           | `BingoAnything.Persistence` only (DbContext + repositories)                          |
| Repository interfaces | `BingoAnything.Abstractions` — services never touch DbContext directly               |
| Fakes                 | `BingoAnything.Fake` — registered in web project, never in Application               |
| DI registration       | `ServiceConfiguration.cs` per project; web `Program.cs` decides persistence vs fakes |
| Configuration         | Options Pattern (`BingoAnythingOptions`); secrets via environment variables only     |
| Logging               | `Microsoft.Extensions.Logging`; never log sensitive user data                        |

See [docs/Architecture.md](docs/Architecture.md) and
[docs/RepositoryStructure.md](docs/RepositoryStructure.md).

## Development Workflow and Quality Gates

- All changes via feature branches and pull requests — no direct commits to
  `main`
- Specification-first delivery applies to net-new features:
  constitution → specification → plan → tasks → implementation
- Constitution Check in planning MUST enumerate principle-specific pass/fail
  outcomes and documented mitigations for any exception
- Pull requests MUST keep CI passing for all projects
- Commit messages MUST be clear and represent one logical unit of work
- Review approval MUST verify:
  1. Layer boundaries are respected
  2. Test coverage for changed behavior is present and passing
  3. Performance constraints are documented and met
  4. UX guidelines (MudBlazor, feedback, error handling) are followed
  5. Secret-handling and configuration rules are preserved

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

**Version**: 3.0.0 | **Ratified**: 2026-05-23 | **Last Amended**: 2026-06-03
