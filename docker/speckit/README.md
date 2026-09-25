# Spec Kit CLI container

Runs the [Spec Kit](https://github.com/github/spec-kit) `specify` CLI without
installing **uv**, **Python**, or the CLI on the host. The image already bundles
Python 3.12 and uv, and installs a pinned `specify-cli` release. The repository
is bind-mounted at `/workspace`, so `specify` edits the real project files.

Pinned to `specify-cli` **1.0.11** (PyPI). Override with
`--build-arg SPECIFY_VERSION=...`.

## Requirements

Only Docker (Desktop or Engine) with a running daemon. No host Python or uv.

## Build

From the repository root:

```bash
docker build -t speckit:1.0.11 docker/speckit
```

## Run

Run from the repository root so the mount points at the project. Use `"$PWD"` in
bash/WSL and `"${PWD}"` in PowerShell:

```bash
docker run --rm -it -v "$PWD:/workspace" speckit:1.0.11 version
docker run --rm -it -v "$PWD:/workspace" speckit:1.0.11 integration status
```

`ENTRYPOINT` is `specify`, so everything after the image name is passed to the
CLI.

### Linux: avoid root-owned files

On Linux a bind mount lets the container write files as root, which then belong
to root on the host. Run as your own user instead:

```bash
docker run --rm -it --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/workspace" speckit:1.0.11 integration status
```

The CLI is installed to `/usr/local/bin`, so it works for that user too.

### Alias

```bash
# bash / zsh
alias specify='docker run --rm -it --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/workspace" speckit:1.0.11'
```

```powershell
# PowerShell
function specify { docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 @args }
```

## Seed Spec Kit for OpenCode v2

This project uses the Spec Kit `opencode` integration with PowerShell scripts.
The bundled integration writes `.opencode/commands/speckit.*.md` as full prompts
and does **not** create `.opencode/agents/*`. This repo instead keeps each command
as a thin wrapper (`agent:` + `subagent: true`) that dispatches to a matching
`.opencode/agents/speckit-*.md` subagent (`mode: subagent`). OpenCode V2 supports
both. See <https://opencode.ai/v2/docs/commands>.

### Upgrade

Switch or upgrade the integration from the repository root:

```bash
docker run --rm -it --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/workspace" speckit:1.0.11 \
  integration switch opencode --script ps
```

- `integration switch opencode --script ps` is the 1.0.11 upgrade path. Do **not**
  use the old `init --here --force --non-interactive --integration opencode`
  recipe: it can reinstall the bundled `git` extension.
- `--script ps` keeps PowerShell scripts (`.specify/scripts/powershell`) to match
  the project configuration (`.specify/integration.json` records
  `"script": "ps"`); use `--script sh` for Bash scripts instead.

### Upgrades overwrite the command files

The integration rewrites `.opencode/commands/*.md` with full upstream prompts and
does not create `.opencode/agents/*`. This repo's command → subagent wrappers are
maintained by hand under `.opencode/`, so after an upgrade re-create the thin
wrappers (one per command, with `agent:` and `subagent: true`) and treat
`.opencode/agents/*.md` as the source of truth for the prompts — the integration
does not touch them. Review the diff before committing.

OpenCode V2 command frontmatter defines `agent`, `subagent`, `mode`, `model`; the
upstream `handoffs:` (Copilot) and `tools:` (Copilot-era allow-list) fields are
not OpenCode V2 command/agent fields and are intentionally not used.

- Never pass `--refresh-shared-infra`: it overwrites customized shared infra,
  including the custom `.specify/scripts/powershell/common.ps1`. Core scripts
  are refreshed by a targeted copy instead.
- Never install the bundled `git` extension: it lacks `--feature-id`, which this
  project's `F-/S-/O-/R-` workflow relies on. Keep the forked extension.

Then review the diff before committing:

```bash
git diff
```

Check what is installed/active and refresh later:

```bash
docker run --rm -it --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/workspace" speckit:1.0.11 integration status
docker run --rm -it --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/workspace" speckit:1.0.11 integration upgrade opencode --script ps
```

## Generated scripts: `--script`

The container is Linux, so Spec Kit defaults to `sh` scripts. This project ships
`.specify/scripts/powershell` and pins `"script": "ps"` in
`.specify/integration.json`, so pass `--script ps` on `integration switch` and
`integration upgrade` to keep the `.ps1` files. Running those scripts on this
host needs a PowerShell runtime (`pwsh`); PowerShell 7.6.6 is installed
user-space for that. The `.ps1` files are not executed inside the container, and
`specify` does not need to run them.

## Notes

- This container only provides the Spec Kit CLI and its scaffolding. The coding
  agent (OpenCode) still runs on the host and reads `.opencode/` from the repo.
- Check `git diff` after a run before committing.
