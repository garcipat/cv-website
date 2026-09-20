---
name: create-pr
description: Use when a branch in the cv-website repo is ready to become a pull request, including when a feature or bug fix must be linked to its GitHub issue so merging auto-closes it
---

# Create PR

## Overview

Opens a pull request against `main` on `github.com/garcipat/cv-website` and links it to its GitHub issue with a **closing keyword**, so merging the PR closes the issue automatically. Runs the local checks first, and keeps `docs/Features.md` in sync when the PR completes a feature.

Closing keywords fire only when the PR is **merged into the default branch** (`main`) — not when it is opened.

| Issue type        | Keyword   |
| ----------------- | --------- |
| Bug (`bug` label) | `Fixes`   |
| Feature           | `Closes`  |

Each linked issue needs its **own line**: `Closes #42` then `Closes #43`. A keyword buried in the title or a commit message is not reliable — put it in the PR **body**.

## Prerequisites

- `gh` is installed and authenticated (`gh auth status`).
- On Windows, if `gh` is not on PATH, call it by full path: `& "C:\Program Files\GitHub CLI\gh.exe"`.
- You are on a feature branch — **never** open a PR from `main`.
- The branch is pushed and up to date with `origin`.
- Labels come from `docs/GitHubLabels.md`.

## Workflow

### 1. Confirm the branch

```powershell
git branch --show-current
git status --short
git log --oneline main..HEAD
```

Stop if the current branch is `main`, or if the working tree has uncommitted changes that belong in the PR.

### 2. Resolve the linked issue

Feature and bug branches are named after their issue ID (`O-017-merge-mixed-pots`, `F-014-ide-theme`). Extract the `[FSO]-\d{3}` prefix from the branch name, then find the issue:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" issue list `
  --repo garcipat/cv-website --state all --limit 1000 `
  --json number,title,labels
```

Match the issue whose title starts with `"<ID>:"`. Bugs carry no F/S/O ID, so match them by title keywords instead. If nothing matches, or two issues are ambiguous, ask with the `question` tool — do not guess the issue number.

From the matched issue read:

- **`number`** → the `#N` in the closing keyword.
- **`labels`** → if it contains `bug`, use `Fixes`; otherwise use `Closes`.
- **`title`** → the PR title.

### 3. Run the checks

Run all three and stop on the first failure. Do not open the PR until they pass.

```powershell
npm run lint
npm test
npm run build
```

### 4. Sync `docs/Features.md` (features only)

Skip this step for bugs — they are not in the dependency diagram.

When the linked issue is a **feature** whose implementation **and** tests are complete, update the Mermaid diagram in `docs/Features.md` (see AGENTS.md):

1. Prefix the node label with `✅ `: `O017["✅ O-017: Merge Pots of Different Colors"]`
2. Add `class O017 done` alongside the existing category class.

Do **not** mark a feature done while any task or test is still outstanding.

### 5. Build the PR body

The template lives in `.github/PULL_REQUEST_TEMPLATE.md` — the single source shared with the web UI. Copy it, replace every `{{...}}` placeholder, write the result to a temp file, then pass it with `--body-file` — far more reliable than inline `--body` for multi-line bodies on Windows/PowerShell.

| Placeholder           | Fill with                                                                     |
| --------------------- | ----------------------------------------------------------------------------- |
| `{{SUMMARY}}`         | 1–3 bullets: what changed and why                                             |
| `{{CLOSING_KEYWORD}}` | `Fixes` for a bug, `Closes` for a feature                                     |
| `{{ISSUE_NUMBER}}`    | the issue number, digits only (no `#`)                                        |
| `{{TESTING}}`         | the commands run and their results                                            |
| `{{LINT}}`            | `x` once `npm run lint` passes                                                |
| `{{TEST}}`            | `x` once `npm test` passes                                                    |
| `{{BUILD}}`           | `x` once `npm run build` passes                                               |
| `{{DOCS}}`            | `x` when affected docs are updated (or none are needed), else `" "`           |
| `{{FEATURES}}`        | `x` when step 4 applied (feature complete); `" "` for bugs                    |

The checklist boxes are pre-ticked from what the workflow verified — a `x` fills the box (`- [x]`), a single space leaves it empty (`- [ ]`). Tick `{{DOCS}}` only after updating any docs the change affects; if docs are stale, update them before opening the PR.

```powershell
$body = Get-Content -LiteralPath ".github/PULL_REQUEST_TEMPLATE.md" -Raw
$body = $body.Replace("{{SUMMARY}}", $summary)
$body = $body.Replace("{{CLOSING_KEYWORD}}", $keyword)
$body = $body.Replace("{{ISSUE_NUMBER}}", "$issueNumber")
$body = $body.Replace("{{TESTING}}", $testing)
$body = $body.Replace("{{LINT}}", "x")
$body = $body.Replace("{{TEST}}", "x")
$body = $body.Replace("{{BUILD}}", "x")
$body = $body.Replace("{{DOCS}}", $docs)      # "x" or " "
$body = $body.Replace("{{FEATURES}}", $features)  # "x" or " "
$tmp = Join-Path $env:TEMP "pr-body.md"
Set-Content -LiteralPath $tmp -Value $body -Encoding utf8
```

### 6. Push and create the PR

```powershell
git push -u origin (git branch --show-current)

& "C:\Program Files\GitHub CLI\gh.exe" pr create `
  --repo garcipat/cv-website `
  --base main `
  --title "O-017: Merge Pots of Different Colors" `
  --body-file $tmp

Remove-Item -LiteralPath $tmp
```

- `--base main` — closing keywords only fire for PRs merged into the default branch.
- `--title` — use the linked issue's title verbatim so the PR and issue line up.
- `gh pr create` prints the new PR URL on success.

### 7. Verify

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" pr view <url> --json body,baseRefName
```

Confirm the body contains the closing keyword and `baseRefName` is `main`.

## Common Mistakes

| Mistake                                              | Fix                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| Putting the closing keyword in the title or a commit | It must be in the PR **body**                                       |
| Two issues on one line (`Closes #1 #2`)              | One closing keyword per line: `Closes #1` / `Closes #2`             |
| Targeting a base other than `main`                   | Closing keywords only fire on merge into the default branch         |
| Guessing the issue number from the branch name       | Look up the issue and confirm the `#number`                         |
| Using `Closes` for a bug                             | Bugs use `Fixes`; features use `Closes`                             |
| Marking a feature done in `docs/Features.md` early   | Only when implementation **and** tests are complete                 |
| Adding a bug to the dependency diagram               | Bugs are not in the diagram — skip step 4                           |
| Opening a PR from `main`                             | Always branch first                                                 |
| Forgetting to push the branch                        | `git push -u origin <branch>` before `gh pr create`                 |
| Using `--body` with a multi-line string              | Write to a temp file and use `--body-file`                          |
| Ticking checklist boxes that did not pass            | Only pre-tick boxes the workflow actually verified                  |
| Opening the PR with stale docs                       | Update affected docs, then tick `Documentation updated`             |
| `gh` not found on Windows                            | Use `& "C:\Program Files\GitHub CLI\gh.exe"`                        |

## Reference

- Feature IDs, tiers, and the `docs/Features.md` update rules: `AGENTS.md`
- PR body template (shared with the web UI): `.github/PULL_REQUEST_TEMPLATE.md`
- Canonical labels: `docs/GitHubLabels.md`
- Filing the issue this PR closes: `create-bug` and `add-feature-idea` skills
