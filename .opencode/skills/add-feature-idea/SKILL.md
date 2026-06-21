---
name: add-feature-idea
description: Use when a new feature idea needs to be added to the project — captures clarification, assigns a number, and updates docs/Features.md list and dependency diagram
---

# Add Feature Idea

## Overview

Captures a new feature idea through targeted clarifying questions, then adds it to `docs/Features.md` with the correct number, section, implementation-status row, and dependency diagram entry.

## Workflow

### 1. Read current state

Before asking anything, read `docs/Features.md` to:

- Find the **highest existing number for each prefix** (F-NNN, S-NNN, O-NNN) so you can assign the next one
- Know the existing feature names (to offer as dependency options)
- Understand which subdomain sections already exist

### 2. Ask clarifying questions

Use the `question` tool to collect what you need. Ask only questions whose answers you cannot infer. Typical questions:

**Feature name** _(free text)_

> What should this feature be called? (short, imperative — e.g. "Display Certificates Section")

**Category** _(options + free text)_

> Which area does this feature belong to?
>
> - Project Setup / Foundation
> - CV Content Sections
> - Layout & Navigation
> - Testing & Quality
> - Other (describe)

**Feature type** _(options)_

> What type is this feature?
>
> - F — Core (Must Have)
> - S — Should Have
> - O — Optional / Nice-to-Have

**One-line description** _(free text)_

> Describe what this feature does in one sentence from the user's perspective (e.g. "User sees their certificates listed by issuer with date earned")

Skip any question whose answer is already clear from context (e.g. if the user already provided the name or description in their message).

### 3. Infer dependencies

Do **not** ask the user about dependencies. Instead, reason over the feature list you already read:

- A CV content section (displaying personality, career, skills, courses, studies, certificates, projects) always requires **F-002** (Data Model)
- All features that render UI components require **F-001** (Project Setup)
- F-002 itself requires **F-001** (Project Setup)
- Layout/Navigation features require at least one content section to be implemented (typically **F-003** Personality as the first section)
- A feature that extends or enhances another specific feature requires that feature
- A feature with no obvious relationship to existing features has no dependencies

List each inferred dependency clearly before writing the file edits (e.g. "Dependencies: F-001, F-002").

### 4. Assign the next number

_(Do this after inferring dependencies so you have the full picture before touching the file.)_

Look at all **numbered features** in `docs/Features.md` for the chosen prefix (F, S, or O). Take the highest existing `X-NNN` for that prefix and add 1.  
Format: `X-NNN` with zero-padded three digits (e.g. `S-001`, `O-001`).

### 5. Determine the Mermaid node class

Map the category to the correct `classDef`:

| Category                   | classDef           |
| -------------------------- | ------------------ |
| Project Setup / Foundation | `projectSetup`     |
| CV Content Sections        | `cvSections`       |
| Layout & Navigation        | `layoutNavigation` |
| Testing & Quality          | `testingQuality`   |
| Enhacements / Other        | `enhancements`     |

### 6. Update `docs/Features.md`

Make **five targeted edits**:

#### A. Add feature entry to the correct subdomain section

Insert a new list item in the matching `##` subdomain section. Within each subdomain, items are ordered: F-features first, then S-features, then O-features.  
Format:

```markdown
- [ ] **X-NNN** **Feature Name** — One-line description
```

Append after the last item with the same prefix in that subdomain section.

#### B. Add a row to the Implementation Status table

Insert in logical order (F-features first by number, then S-features, then O-features):

```markdown
| X-NNN | Feature Name | 📋 Planned | — | ❌ | ❌ |
```

#### C. Add the node declaration to the Mermaid diagram

Inside the `graph RL` block, after the last node declaration of the same prefix, add:

```
    XNNN["X-NNN: Feature Name"]
```

(Node ID uses no hyphen: `S001`, `O001`, `F010`.)

New features are not yet implemented, so do **not** add the ✅ prefix. The ✅ prefix and `done` class are only added when a feature is marked as fully implemented in the status table.

#### D. Add dependency edges

After the node declarations, add one line per dependency using the correct node ID for each:

```
    XNNN --> XYYY
```

If there are no dependencies, add a comment instead so the node is still reachable:

```
    %% X-NNN has no dependencies
```

#### E. Add the class assignment

At the end of the `class` lines block, append:

```
    class XNNN featureClass
```

Also add the node to its category's existing class line. For example, if adding a CV Content Section feature:

```diff
- class F003,F004,F005,F006,F007,F008,F009 cvSections
+ class F003,F004,F005,F006,F007,F008,F009,F010 cvSections
```

## Common Mistakes

| Mistake                                                               | Fix                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Forgetting to add the node to the Mermaid diagram                     | Always do steps C-E — the diagram must stay in sync                                                    |
| Using the wrong zero-padding                                          | Always use three digits: `S-001`, `O-001` — not `S-1` or `O-1`                                         |
| Adding the feature under the wrong subdomain or with the wrong prefix | Confirm with the user if unsure — don't guess                                                          |
| Adding ✅ or `done` class to a new feature                            | New features are unimplemented — no ✅ prefix, no `done` class. Only add those when marking as done.   |
| Creating a spec file                                                  | Do **not** create `specs/feature-slug.md` — only add the markdown link; the spec is written separately |
| Diagram uses `graph TD`                                               | This project uses `graph RL` — always match the existing diagram direction                             |
