---
description: Create a feature branch with feature-id, sequential, or timestamp numbering
mode: subagent
---
<!-- Extension: git -->
<!-- Config: .specify/extensions/git/ -->
# Create Feature Branch

Create and switch to a new git feature branch for the given specification. This command handles **branch creation only** — the spec directory and files are created by the core `/speckit.specify` workflow.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Environment Variable Override

If the user explicitly provided `GIT_BRANCH_NAME` (e.g., via environment variable, argument, or in their request), pass it through to the script by setting the `GIT_BRANCH_NAME` environment variable before invoking the script. When `GIT_BRANCH_NAME` is set:
- The script uses the exact value as the branch name, bypassing all prefix/suffix generation
- `--short-name`, `--number`, and `--timestamp` flags are ignored
- `FEATURE_NUM` is extracted from the name if it starts with a numeric prefix, otherwise set to the full branch name

## Prerequisites

- Verify Git is available by running `git rev-parse --is-inside-work-tree 2>/dev/null`
- If Git is not available, warn the user and skip branch creation

## Branch Numbering Mode

Determine the branch numbering strategy by checking configuration in this order:

1. Check `.specify/extensions/git/git-config.yml` for `branch_numbering` value
2. Check `.specify/init-options.json` for `branch_numbering` value (backward compatibility)
3. Default to `sequential` if neither exists

## Feature ID Mode

If the strategy is `feature-id`:

1. **Extract or ask for the feature ID** — If the user input contains a feature ID in the format `F-NNN`, `S-NNN`, or `O-NNN` (e.g., `F-001: Create Bingo List`), extract it. Otherwise, ask the user: "What is the feature ID? (e.g., F-008)"
2. **Validate** the feature ID matches one of: `F-NNN` (Core), `S-NNN` (Should Have), `O-NNN` (Optional)
3. **Pass `-FeatureId`** to the script alongside `-ShortName`

## Execution

Generate a concise short name (2-4 words) for the branch:
- Analyze the feature description and extract the most meaningful keywords
- Use action-noun format when possible (e.g., "add-user-auth", "fix-payment-bug")
- Preserve technical terms and acronyms (OAuth2, API, JWT, etc.)

Run the appropriate script based on your platform:

- **PowerShell (feature-id)**: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -FeatureId "<feature-id>" -ShortName "<short-name>" "<feature description>"`
  - Example: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -FeatureId "F-008" -ShortName "player-roster" "Player Roster Display"`
- **PowerShell (sequential)**: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -ShortName "<short-name>" "<feature description>"`
- **PowerShell (timestamp)**: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -Timestamp -ShortName "<short-name>" "<feature description>"`

**IMPORTANT**:
- In `feature-id` mode, always include the `-FeatureId` parameter
- Do NOT pass `--number` — the script determines the correct next number automatically
- Always include the JSON flag (`-Json` for PowerShell) so the output can be parsed reliably
- You must only ever run this script once per feature
- The JSON output will contain `BRANCH_NAME` and `FEATURE_NUM`

## Graceful Degradation

If Git is not installed or the current directory is not a Git repository:
- Branch creation is skipped with a warning: `[specify] Warning: Git repository not detected; skipped branch creation`
- The script still outputs `BRANCH_NAME` and `FEATURE_NUM` so the caller can reference them

## Output

The script outputs JSON with:
- `BRANCH_NAME`: The branch name (e.g., `F-008-player-roster`, `003-user-auth`, or `20260319-143022-user-auth`)
- `FEATURE_NUM`: The feature ID, numeric, or timestamp prefix used
