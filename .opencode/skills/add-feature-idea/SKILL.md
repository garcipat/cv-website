---
name: add-feature-idea
description: Use when capturing a new feature idea in the cv-website project — adding it to the GitHub Issue tracker, assigning a feature ID, recording dependencies, or keeping the docs/Features.md dependency diagram in sync
---

# Add Feature Idea

## Overview

Feature ideas live in **GitHub Issues**, which are the source of truth. Capturing an idea means creating an issue with the right ID, labels, and dependency line, then keeping the Mermaid dependency diagram in `docs/Features.md` in sync.

- **Feature IDs** (`F-NNN` core, `S-NNN` should-have, `O-NNN` optional) appear in **issue titles**: `O-017: Platformer Wall Vines`.
- **Dependencies** are recorded in the **issue body** as an unordered list under `## Dependencies`.
- The **issue body is the home of the idea** — its full content (design notes, open questions, sub-sections) goes under `## Details`. There is no separate idea document: migrate any existing `docs/ideas/*.md` content into the issue and delete the doc.
- `docs/Features.md` holds **only** the Mermaid dependency diagram.

## Prerequisites

- `gh` is installed and authenticated (`gh auth status`).
- On Windows, if `gh` is not on PATH, use the full path: `& "C:\Program Files\GitHub CLI\gh.exe"`.
- Issues are enabled on the repo.
- Labels come from `docs/GitHubLabels.md` — the canonical taxonomy. This skill uses `feature`, one of `tier:core` / `tier:should` / `tier:optional`, and one `area:*` label.

## Workflow

### 1. Read current state

```powershell
gh issue list --repo garcipat/cv-website --state all --limit 1000 --json number,title,labels,body
```

From the output:

- Find the **highest existing number for each prefix** (F/S/O) so you can assign the next one. IDs live in titles (`X-NNN: ...`), not in labels.
- Collect each feature's **issue `number`, ID, and title** — dependencies are written as `ID: Title (#number)` so GitHub registers the cross-reference.
- Read bodies as needed to infer dependencies.

Then read `docs/Features.md` to see the current Mermaid diagram (direction, `classDef`s, and category class lines).

### 2. Ask clarifying questions

Use the `question` tool. Ask only what you cannot infer. Typical questions:

**Feature name** _(free text)_

> What should this feature be called? (short, imperative — e.g. "Platformer Wall Vines")

**Area** _(options + free text)_ → maps to the `area:*` label

> Which area does this feature belong to?
>
> - Platformer (`area:platformer`)
> - Editor (`area:editor`)
> - Theme (`area:theme`)
> - Content (`area:content`)
> - Other (describe — check `docs/GitHubLabels.md` for the closest existing label)

**Tier** _(options)_ → maps to the `tier:*` label and the ID prefix

> What tier is this feature?
>
> - F — Core (Must Have) → `tier:core`
> - S — Should Have → `tier:should`
> - O — Optional / Nice-to-Have → `tier:optional`

**One-line description** _(free text)_

> Describe what this feature does in one sentence from the user's perspective (e.g. "Player can climb vine tiles like ladders").

Skip any question whose answer is already clear from context (e.g. the user already gave the name or description).

### 3. Infer dependencies

Do **not** ask the user about dependencies. Reason over the issues you read in step 1:

- A CV content section (personality, career, skills, courses, studies, certificates, projects) always requires **F-002** (Data Model)
- All features that render UI components require **F-001** (Project Setup)
- F-002 itself requires **F-001** (Project Setup)
- Layout/Navigation features require at least one content section (typically **F-003**)
- Platformer features build on **F-015** (2D Platformer Theme); editor features build on **F-019** (Level Editor)
- A feature that extends or enhances another specific feature requires that feature
- A feature with no obvious relationship to existing features has no dependencies

State the inferred dependencies as a list **before** creating the issue, one `ID: Title (#number)` per line (e.g. `F-015: 2D Platformer Theme (#12)`).

### 4. Assign the next number

Take the highest existing `X-NNN` for the chosen prefix and add 1. Format with zero-padded three digits (`S-001`, `O-001`, not `S-1`/`O-1`).

### 5. Create the issue

The issue body template lives in `.opencode/skills/add-feature-idea/template.md`. Copy it, replace every `{{...}}` placeholder, write the result to a temp file, then pass it with `--body-file` (reliable multi-line bodies on Windows/PowerShell):

| Placeholder        | Fill with                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `{{DESCRIPTION}}`  | the one-line description                                                                 |
| `{{DEPENDENCIES}}` | an unordered list, one `- ID: Title (#number)` per line, or `- None` when there are none |
| `{{DETAILS}}`      | the full idea content — design notes, open questions, extra sub-sections — or `_None yet._` |

Example `{{DEPENDENCIES}}`:

```markdown
- F-015: 2D Platformer Theme (#12)
- F-018: Destroyable Blocks (#15)
```

Each item must be `ID: Title (#number)`. The `#number` is an **autolinked reference** — GitHub turns it into a link and records it on the target issue's timeline. The ID and title stay as plain text so the body is readable (GitHub renders only `#12`, with the title on hover). A bare markdown link such as `[F-015](url)` is **not** registered as a cross-reference.

```powershell
gh issue create --repo garcipat/cv-website `
  --title "O-017: Platformer Wall Vines" `
  --label feature --label tier:optional --label area:platformer `
  --body-file "$env:TEMP\feature-body.md"
```

- Title: `X-NNN: Feature Name`
- Labels: `feature` + exactly one `tier:*` + exactly one `area:*`
- `--label` may be repeated (shown above) or comma-separated.

### 6. Update the Mermaid diagram in `docs/Features.md`

Make targeted edits only — never rewrite the whole diagram.

#### A. Add the node declaration

Inside the `graph RL` block, after the last node declaration of the same prefix:

```
    XNNN["X-NNN: Feature Name"]
```

Node ID uses no hyphen (`S001`, `O017`, `F010`). New features are **not** implemented, so do **not** add the ✅ prefix or the `done` class.

#### B. Add dependency edges

After the node declarations, one line per dependency:

```
    XNNN --> XYYY
```

If there are no dependencies, add a comment so the node is still reachable:

```
    %% X-NNN has no dependencies
```

#### C. Add the class assignment

Map the `area:*` label to the matching `classDef` in the diagram:

| Area label        | Default classDef   | Use instead when…                                   |
| ----------------- | ------------------ | --------------------------------------------------- |
| `area:platformer` | `themes`           | —                                                   |
| `area:editor`     | `enhancements`     | —                                                   |
| `area:theme`      | `themes`           | `themeInfrastructure` for theme-system plumbing     |
| `area:content`    | `layoutNavigation` | `projectSetup` for foundational/data-model features |

The diagram's existing `classDef`s and class lines are the authority — if unsure, add the node to the class whose existing members are most similar.

Add the node id to its category's existing class line:

```diff
- class F015,F016,F017,F018,S007,S008 themes
+ class F015,F016,F017,F018,S007,S008,O017 themes
```

If no class line exists for that category yet, append one:

```
    class XNNN <category>
```

## Common Mistakes

| Mistake                                                        | Fix                                                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Editing a checklist in `docs/Features.md`                      | Issues are the source of truth. `docs/Features.md` only holds the Mermaid diagram.                              |
| Putting the ID in the body instead of the title                | IDs go in titles: `O-017: Feature Name`                                                                        |
| Forgetting to add the node to the Mermaid diagram              | Always do steps 6A-6C — the diagram must stay in sync                                                           |
| Using the wrong zero-padding                                   | Always three digits: `S-001`, `O-001` — not `S-1` or `O-1`                                                      |
| Wrong prefix for the tier                                      | F = `tier:core`, S = `tier:should`, O = `tier:optional`                                                         |
| Missing or freeform labels                                     | Use `feature` + one `tier:*` + one `area:*` from `docs/GitHubLabels.md`                                         |
| Leaving `## Dependencies` empty or comma-separated             | Always include it as an unordered list, one `- ID: Title (#number)` per line, or `- None`                   |
| Dependency listed without `#number`                            | Every dependency needs `ID: Title (#number)` — the `#number` is what GitHub cross-references               |
| Dependency listed as only `#12`                                | Add the ID and title as text too — GitHub shows only the number, the title is on hover                      |
| Using a markdown link `[F-015](url)` as the reference           | GitHub does not track it — use the `#number` autolink syntax instead                                        |
| Adding ✅ or the `done` class to a new feature                  | New features are unimplemented — no ✅ prefix, no `done` class                                                  |
| Diagram uses `graph TD`                                        | This project uses `graph RL` — always match the existing diagram direction                                      |
| Creating a spec file                                           | Do **not** create `specs/feature-slug.md` — the spec is written separately after the issue exists              |
