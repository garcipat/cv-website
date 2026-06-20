# Development Instructions

## Environment

- **OS**: Linux
- **Shell**: Bash (use for all terminal scripting)

## Design Decisions & Interaction Style

**For design questions and feature decisions**: Use the `question` tool rather than free-text discussion. Provides clear options with suggested defaults, reducing back-and-forth while keeping context clear. This includes any prompt that involves choosing between 2+ options (implementation approach, architecture choice, UX variant, etc.).

**Subagents and the question tool**: Subagents launched via the `task` tool do NOT have access to the `question` tool. When an operation requires user clarification with multiple options (e.g., `/speckit.clarify`), handle it directly in the main agent rather than delegating to a subagent, so the `question` tool can be used properly.

**Git Repository**: Never ask for reading the git repository. All necessary information is available within the repository files themselves. Use the codebase, specs, and documentation to understand context—do not request git history, commits, or logs.

## Project Conventions

- **Stack**: Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui
- **No backend**: Static site — data lives in typed JSON files under `src/data/`, no server, no API calls, no database
- **shadcn/ui**: Add components with `npx shadcn add <name>` only — never copy-paste from other projects. Components go in `src/components/ui/`
- **Data pattern**: CV content is typed JSON. Define types in `src/types/`, data in `src/data/`. Components import the typed data directly.
- **Specs**: Design documents live in `specs/` at the project root
- **TypeScript strict**: No `any`, proper types for all data and component props

## Key Principles

- **No Auto-Commits**: Never commit changes unless explicitly asked by the user. Always wait for the user to request a commit.
- **No Feature Bloat**: Keep the application minimal and startable. Build features as separate specs, not exploratory changes.

## Feature Completion Tracking

When a feature's implementation **and** tests are fully done, immediately update `docs/Features.md` in three places:

1. **Feature list** — change `- [ ]` to `- [x]` on the feature's bullet
2. **Implementation Status table** — update all three columns to `✅ Done` / `✅`
3. **Dependency diagram** — prefix the node label with `✅ ` and add `class XNNN done` alongside the existing category class

Feature IDs use the prefix of their tier: `F-NNN` (Core), `S-NNN` (Should Have), `O-NNN` (Optional). The node ID in the diagram omits the hyphen: `F002`, `S001`, `O001`.

Example for F-002:

```diff
- F002["F-002: View List"]
+ F002["✅ F-002: View List"]

- class F001,F002,F003,F004,F018,F019 listManagement
+ class F001,F002,F003,F004,F018,F019 listManagement
+ class F002 done
```
