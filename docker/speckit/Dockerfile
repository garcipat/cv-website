# Spec Kit CLI (`specify`) in a container, so nothing is installed on the host.
#
# Only Docker is required: the image bundles Python and uv, and installs the
# pinned `specify` CLI inside the image.
#
# Build:
#   docker build -t speckit:1.0.11 docker/speckit
#
# Run against this project (from the repo root):
#   Bash/WSL:   docker run --rm -it -v "$PWD:/workspace" speckit:1.0.11 version
#   PowerShell: docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 version
#   Linux, keeping files owned by you:
#     docker run --rm -it --user "$(id -u):$(id -g)" -e HOME=/tmp \
#       -v "$PWD:/workspace" speckit:1.0.11 integration status

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# git is used by Spec Kit's git extension hooks and by project init.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install system-wide (not under /root) so `specify` is available to any runtime
# user, including `--user $(id -u):$(id -g)` on Linux.
# Pinned release from PyPI: https://pypi.org/project/specify-cli/
ARG SPECIFY_VERSION=1.0.11
ENV UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_TOOL_DIR=/opt/uv-tools
RUN uv tool install "specify-cli==${SPECIFY_VERSION}"

WORKDIR /workspace
ENTRYPOINT ["specify"]
CMD ["--help"]
