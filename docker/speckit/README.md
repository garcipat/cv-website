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
and does **not** create `.opencode/agents/*`. OpenCode V2 commands do support
`agent:` plus `subagent: true` (and agents support `mode: subagent`), so
`scripts/speckit-opencode-split.sh` rewrites each command into a thin wrapper
that dispatches to a matching subagent. See
<https://opencode.ai/v2/docs/commands>.

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

### Required post-step: restore the command wrappers

After any `integration switch`/`upgrade`, run **both** scripts from the
repository root, in this order:

```bash
scripts/speckit-opencode-split.sh          # commands → agents + thin wrappers
scripts/speckit-apply-local-edits.py       # re-apply the local agent overlays
```

The integration overwrites `.opencode/commands/*` with full prompts and does not
create `.opencode/agents/*`, so the splitter restores the command → subagent
wrappers. The splitter also regenerates the agents from the upstream prompts,
which drops this project's overlays, so the applier then re-applies the
`question`-tool and feature-ID edits to the `specify`, `clarify` and `analyze`
agents. Both scripts are idempotent.

Only `description` is carried from the upstream command frontmatter into the
agent. `handoffs:` is Copilot-oriented and `tools:` is a Copilot-era command
allow-list; neither is an OpenCode V2 command/agent field (V2 uses
`agent`/`subagent`/`mode`/`model`/`permissions`), so both are intentionally
dropped.

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
