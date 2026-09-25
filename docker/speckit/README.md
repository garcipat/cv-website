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

The current Spec Kit `opencode` integration is commands-only: it writes
`.opencode/commands/speckit.*.md` and does **not** create subagent agents or use
`subtask`/`subagent`, so a command resolves into normal prompt input and the
session gets a title.

Initialize (or re-initialize) this existing project for OpenCode v2. From the
repository root:

```bash
docker run --rm -it --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/workspace" speckit:1.0.11 \
  init --here --force --non-interactive --integration opencode --script ps
```

- `--here` targets the current directory (already a project).
- `--force` acknowledges initializing a non-empty directory; it only touches
  managed Spec Kit paths, not the rest of the app.
- `--non-interactive` skips the integration picker.
- `--script ps` keeps PowerShell scripts (`.specify/scripts/powershell`) to match
  the Windows host; use `--script sh` for Bash scripts instead.

Then review the diff before committing:

```bash
git diff
```

Check what is installed/active and refresh later:

```bash
docker run --rm -it -v "$PWD:/workspace" speckit:1.0.11 integration status
docker run --rm -it -v "$PWD:/workspace" speckit:1.0.11 integration upgrade opencode
```

## Generated scripts: `--script`

The container is Linux, so Spec Kit defaults to `sh` scripts. This project
currently ships `.specify/scripts/powershell` for a Windows host. If you keep
using PowerShell for those scripts, pass `--script ps` where supported (`init`,
`upgrade`) so the `.ps1` files are preserved. The `.ps1` files are not executed
inside the container, and `specify` does not need to run them.

## Notes

- This container only provides the Spec Kit CLI and its scaffolding. The coding
  agent (OpenCode) still runs on the host and reads `.opencode/` from the repo.
- Check `git diff` after a run before committing.
