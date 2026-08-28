# CV Website — Claude Code Instructions

Static CV website. Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui.
No backend — all content lives in typed JSON under `src/data/`.

## Governance

@.specify/memory/constitution.md

The constitution above is the highest-priority engineering policy for this repo
(typed data architecture, TDD, component standards, no feature bloat, performance
budgets). Follow it over any conflicting default behavior. Amend it deliberately
(versioned), not by drifting away from it in code.

## Environment

- OS: Linux. Shell: Bash — use it for all terminal scripting.

## Interaction Style

- For design/feature decisions with 2+ options (implementation approach, architecture
  choice, UX variant), use the `AskUserQuestion` tool instead of free-text discussion —
  it keeps context clear and reduces back-and-forth.
- Subagents do not have access to `AskUserQuestion`. When a task needs user
  clarification with multiple options (e.g. a `/speckit.clarify`-style step), handle it
  directly rather than delegating to a subagent.
- Never ask to read git history/log/blame for context — everything needed lives in the
  repository files, specs, and docs.

## Project Conventions

- **Specs**: design documents live in `specs/` at the project root. Every feature
  originates from a spec before implementation begins.
- **shadcn/ui**: add components with `npx shadcn@latest add <name>` only — never
  copy-paste from other projects or hand-edit. Components live in `src/components/ui/`.
- **Data pattern**: types in `src/types/` before data in `src/data/`. Components import
  typed data directly.

## Key Principles

- **No auto-commits**: never commit unless the user explicitly asks.
- **No feature bloat**: keep the app minimal and startable; build features as separate
  specs, not exploratory changes.

## Feature Completion Tracking

When a feature's implementation **and** tests are fully done, immediately update
`docs/Features.md` in three places:

1. **Feature list** — change `- [ ]` to `- [x]` on the feature's bullet.
2. **Implementation Status table** — update all three columns to `✅ Done` / `✅`.
3. **Dependency diagram** — prefix the node label with `✅ ` and add `class XNNN done`
   alongside the existing category class.

Feature IDs use the prefix of their tier: `F-NNN` (Core), `S-NNN` (Should Have),
`O-NNN` (Optional). The node ID in the diagram omits the hyphen: `F002`, `S001`, `O001`.
Prefix the node label with `✅ ` and add `class <NodeID> done` alongside its existing
category class.
