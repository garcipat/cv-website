---
name: create-bug
description: Use when a bug, defect, regression, crash, error, or unexpected behavior needs to be filed — including reports that something is broken or "not working" and must be tracked as a GitHub Issue
---

# Create Bug

## Overview

Files a bug as a GitHub Issue on `github.com/garcipat/cv-website`. Every bug gets the `bug` label plus **exactly one** `area:*` label. Bugs get **no** F/S/O/R feature ID — those are reserved for features and refactors.

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

> [!CAUTION]
> **Never pass a multi-line body inline via `--body`.** When PowerShell hands an
> argument to a native executable it flattens every embedded newline to a space, so
> `gh issue create --body "line1`nline2"` silently produces a **single-line** issue body:
> every `##` heading stops being a heading and every repro step collapses into one
> paragraph. `--body-file` is the only supported way to create or edit an issue body.

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

Then **read the body back** and confirm it kept its line structure — a collapsed body
is the most common failure here, and it is silent:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" issue view <n> --json body --jq '.body' |
  Set-Content "$env:TEMP\verify.md" -Encoding utf8
```

Read `$env:TEMP\verify.md` and check that the first line is exactly `## Summary`, that
every `## ` heading starts its own line, and that each repro step is on its own line.
A body of one or two lines is collapsed: rebuild it from the template and re-apply with
`gh issue edit <n> --body-file <file>`.

> Do not pipe `gh ... --json body` through the PowerShell console and inspect the
> output directly: the console re-encodes UTF-8 as the OEM code page and turns
> `→`, `—` and `§` into mojibake. Redirect to a file and read the file.

## Common Mistakes

| Mistake                                          | Fix                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Assigning an F/S/O ID (e.g. `F-010`)             | Bugs get no feature ID — labels only                                    |
| Forgetting the `area:*` label                    | Every bug needs exactly one `area:*` label                              |
| Adding two or more `area:*` labels               | Pick the single best-fitting area                                       |
| Vague repro steps ("it breaks")                  | Numbered, concrete steps starting from a clean state                    |
| Omitting expected vs actual                      | Always state both, even if the difference seems obvious                 |
| Using `--body` with a multi-line string          | PowerShell flattens newlines to spaces for native exes — the body lands as one line. Write to a temp file and use `--body-file`; if a body was already created collapsed, rebuild it and `gh issue edit <n> --body-file <file>` |
| Not reading the body back after creating          | A collapsed body is silent — `gh` reports success. Read it back and check the headings and repro steps are on their own lines |
| Reading `gh --json body` through the console      | The console mis-decodes UTF-8 (`→` → `ÔåÆ`). Redirect to a file and read the file |
| `gh` not found on Windows                        | Use `& "C:\Program Files\GitHub CLI\gh.exe"`                            |

## Reference

- Canonical labels: `docs/GitHubLabels.md`
