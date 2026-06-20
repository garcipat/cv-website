---
description: "Create a feature branch using feature ID (e.g., F-008-player-roster)"
---

# Create Feature Branch

Create and switch to a new git feature branch for the given specification. This command handles **branch creation only** — the spec directory and files are created by the core `/speckit.specify` workflow.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Feature ID Extraction

Ask the user for the feature ID in format `F-NNN`, `S-NNN`, or `O-NNN` (where NNN is the feature number):

- **F-NNN**: Core features (e.g., `F-008`)
- **S-NNN**: Should Have features (e.g., `S-001`)
- **O-NNN**: Optional features (e.g., `O-001`)

If the feature ID is provided in the user input or feature description, extract it. Otherwise, ask the user: "What is the feature ID? (e.g., F-008)"

## Environment Variable Override

If the user explicitly provided `GIT_BRANCH_NAME` (e.g., via environment variable, argument, or in their request), pass it through to the script by setting the `GIT_BRANCH_NAME` environment variable before invoking the script. When `GIT_BRANCH_NAME` is set:

- The script uses the exact value as the branch name, bypassing all prefix/suffix generation
- Feature ID is extracted from the name if it starts with a feature prefix (F-, S-, O-) or numeric prefix, otherwise set to the full branch name

## Prerequisites

- Verify Git is available by running `git rev-parse --is-inside-work-tree 2>/dev/null`
- If Git is not available, warn the user and skip branch creation

## Execution

Generate a concise short name (2-4 words) for the branch:

- Analyze the feature description and extract the most meaningful keywords
- Use action-noun format when possible (e.g., "add-user-auth", "fix-payment-bug")
- Preserve technical terms and acronyms (OAuth2, API, JWT, etc.)

Run the appropriate script based on your platform with the feature ID:

- **PowerShell**: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -FeatureId "<feature-id>" -ShortName "<short-name>" "<feature description>"`
  - Example: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -FeatureId "F-008" -ShortName "player-roster" "Player Roster Display"`
  - Output: `F-008-player-roster`

**IMPORTANT**:

- Always include the `-FeatureId` parameter (e.g., `-FeatureId "F-008"`)
- Always include the `-ShortName` parameter for consistent naming
- Always include the `-Json` flag so the output can be parsed reliably
- You must only ever run this script once per feature
- The JSON output will contain `BRANCH_NAME` (e.g., `F-008-player-roster`) and `FEATURE_NUM` (e.g., `F-008`)

## Graceful Degradation

If Git is not installed or the current directory is not a Git repository:

- Branch creation is skipped with a warning: `[specify] Warning: Git repository not detected; skipped branch creation`
- The script still outputs `BRANCH_NAME` and `FEATURE_NUM` so the caller can reference them

## Output

The script outputs JSON with:

- `BRANCH_NAME`: The feature branch name in format `F-NNN-short-name` (e.g., `F-008-player-roster`)
- `FEATURE_NUM`: The feature ID used as prefix (e.g., `F-008`)
