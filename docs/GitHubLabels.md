# GitHub Labels

These are the canonical labels used for feature ideas and bugs on the GitHub repo. They are stored on the repository itself, not in this file — use the `gh` commands below to seed or update them.

| Label | Color | Description |
| ----- | ----- | ----------- |
| `idea` | `#FBCA04` | Rough idea, not yet accepted as a feature |
| `feature` | `#0E8A16` | Accepted feature to build |
| `refactor` | `#8250DF` | Restructuring already-shipped code — no behaviour change (`R-NNN`) |
| `bug` | `#D73A4A` | Something isn't working |
| `documentation` | `#0075CA` | Improvements or additions to documentation |
| `tier:core` | `#B60205` | Must-have feature |
| `tier:should` | `#D93F0B` | Should-have feature |
| `tier:optional` | `#FBCA04` | Optional / nice-to-have feature |
| `area:platformer` | `#1D76DB` | 2D platformer theme |
| `area:editor` | `#5319E7` | Platformer level editor |
| `area:theme` | `#006B75` | Themes and theming |
| `area:content` | `#C2E0C6` | CV content and data |
| `area:testing` | `#FBCA04` | Testing and test tooling |
| `area:tooling` | `#BFD4F2` | Agent, CLI, and developer tooling |

## Seeding

```bash
gh label create idea --color FBCA04 --description "Rough idea, not yet accepted as a feature" --force
gh label create feature --color 0E8A16 --description "Accepted feature to build" --force
gh label create refactor --color 8250DF --description "Restructuring already-shipped code — no behaviour change (R-NNN)" --force
gh label create bug --color D73A4A --description "Something isn't working" --force
gh label create documentation --color 0075CA --description "Improvements or additions to documentation" --force
gh label create tier:core --color B60205 --description "Must-have feature" --force
gh label create tier:should --color D93F0B --description "Should-have feature" --force
gh label create tier:optional --color FBCA04 --description "Optional / nice-to-have feature" --force
gh label create area:platformer --color 1D76DB --description "2D platformer theme" --force
gh label create area:editor --color 5319E7 --description "Platformer level editor" --force
gh label create area:theme --color 006B75 --description "Themes and theming" --force
gh label create area:content --color C2E0C6 --description "CV content and data" --force
gh label create area:testing --color FBCA04 --description "Testing and test tooling" --force
gh label create area:tooling --color BFD4F2 --description "Agent, CLI, and developer tooling" --force
```
