# Spec Kit CLI container

Runs the [Spec Kit](https://github.com/github/spec-kit) `specify` CLI in a
container so uv and the CLI are never installed on the host. The project is
bind-mounted into the container, so `specify` reads and writes the real files.

Pinned to `specify-cli` **1.0.11** (PyPI). Override with
`--build-arg SPECIFY_VERSION=...`.

## Requirements

Docker (Desktop or Engine) with a running daemon. The host also needs Python
only if you build a different base image — this image bundles its own Python.

## Build

From the repository root:

```powershell
docker build -t speckit:1.0.11 docker/speckit
```

## Run

Run from the repository root so `${PWD}` is the project:

```powershell
docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 version
docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 integration status
docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 integration list
```

`ENTRYPOINT` is `specify`, so any arguments after the image name are passed
straight to the CLI. Bash/WSL/macOS use the same command with `"$PWD"` instead
of `"${PWD}"`.

Handy alias for this shell:

```powershell
function specify { docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 @args }
```

## Refreshing the opencode integration

Check state first, then upgrade or install the integration:

```powershell
docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 integration status
docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 integration upgrade opencode
# if it reports no installed opencode integration:
docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 integration install opencode
```

## Generated scripts: `--script`

The container is Linux, so Spec Kit defaults to `sh` scripts. This project
currently has `.specify/scripts/powershell` for a Windows host. If you keep
using PowerShell to run those scripts, pass `--script ps` where the command
accepts it (for example `init` / `upgrade`) so the `.ps1` scripts are kept
rather than replaced with bash. The `.ps1` files cannot be executed inside the
container, but `specify` itself does not need to run them.

## Notes

- The mount means changes are owned by your host user; no `chown` needed on
  Docker Desktop for Windows.
- File name casing and line endings come from the mounted volume. If you see
  spurious diffs after a run, check `git diff` before committing.
- This container only manages the Spec Kit scaffolding. The coding agent
  (OpenCode) still runs on the host and reads `.opencode/` from the repo.
