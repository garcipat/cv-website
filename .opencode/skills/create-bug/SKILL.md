---
name: create-bug
description: Use when a bug, defect, regression, crash, error, or unexpected behavior needs to be filed — including reports that something is broken or "not working" and must be tracked as a GitHub Issue
---

# Create Bug

## Overview

Files a bug as a GitHub Issue on `github.com/garcipat/cv-website`. Every bug gets the `bug` label plus **exactly one** `area:*` label. Bugs get **no** F/S/O feature ID — those are reserved for features.

## Prerequisites

- `gh` must be installed and authenticated (`gh auth status`).
- On Windows, if `gh` is not on PATH, call it by full path: `& "C:\Program Files\GitHub CLI\gh.exe"`.
- The canonical label list lives in `docs/GitHubLabels.md`. Do not invent labels.

## Workflow

### 1. Gather

Collect these from the user/report:

- **One-line summary** — becomes the issue title.
- **Area** — map to exactly one `area:*` label (see table below).
- **Steps to reproduce** — numbered, concrete, from a clean start.
- **Expected vs actual behavior** — what should happen vs what happens.
- **Additional context** — browser/theme/level, screenshots, error text, frequency.

Use the `question` tool for anything missing that you cannot infer from context.

| Area                 | Label             |
| -------------------- | ----------------- |
| Platformer theme     | `area:platformer` |
| Platformer editor    | `area:editor`     |
| Themes and theming   | `area:theme`      |
| CV content and data  | `area:content`    |

### 2. Create the issue

Title = the concise summary. Labels = `bug` plus the chosen `area:*` label.

The issue body template lives in `.opencode/skills/create-bug/template.md`. Copy it, replace every `{{...}}` placeholder, write the result to a temp file, then pass it with `--body-file` — far more reliable than inline `--body` for multi-line bodies on Windows/PowerShell.

| Placeholder     | Fill with                                                          |
| --------------- | ------------------------------------------------------------------ |
| `{{SUMMARY}}`   | the one-line summary                                               |
| `{{STEPS}}`     | numbered, concrete reproduction steps from a clean start           |
| `{{EXPECTED}}`  | what should happen                                                 |
| `{{ACTUAL}}`    | what actually happens                                              |
| `{{CONTEXT}}`   | theme/browser/level, screenshots, frequency — or `None`            |

```powershell
$body = Get-Content -LiteralPath ".opencode/skills/create-bug/template.md" -Raw
# replace every {{...}} placeholder, then:
$tmp = Join-Path $env:TEMP "bug-body.md"
Set-Content -LiteralPath $tmp -Value $body -Encoding utf8

& "C:\Program Files\GitHub CLI\gh.exe" issue create `
  --repo garcipat/cv-website `
  --title "<concise summary>" `
  --label bug `
  --label "area:platformer" `
  --body-file $tmp

Remove-Item -LiteralPath $tmp
```

`gh issue create` prints the new issue URL on success. Verify with:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" issue view <n> --json title,labels
```

## Common Mistakes

| Mistake                                          | Fix                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Assigning an F/S/O ID (e.g. `F-010`)             | Bugs get no feature ID — labels only                                    |
| Forgetting the `area:*` label                    | Every bug needs exactly one `area:*` label                              |
| Adding two or more `area:*` labels               | Pick the single best-fitting area                                       |
| Vague repro steps ("it breaks")                  | Numbered, concrete steps starting from a clean state                    |
| Omitting expected vs actual                      | Always state both, even if the difference seems obvious                 |
| Using `--body` with a multi-line string          | Write to a temp file and use `--body-file`                              |
| `gh` not found on Windows                        | Use `& "C:\Program Files\GitHub CLI\gh.exe"`                            |

## Reference

- Canonical labels: `docs/GitHubLabels.md`
