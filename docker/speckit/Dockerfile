# Spec Kit CLI (`specify`) without installing uv or the CLI on the host.
#
# Build:
#   docker build -t speckit:1.0.11 docker/speckit
#
# Run against this project (from the repo root):
#   docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 version
#   docker run --rm -it -v "${PWD}:/workspace" speckit:1.0.11 integration status
#
# The repo is mounted at /workspace, so the CLI edits the real project files.

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# git is used by Spec Kit's git extension hooks and by project init.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pinned release from PyPI: https://pypi.org/project/specify-cli/
ARG SPECIFY_VERSION=1.0.11
RUN uv tool install "specify-cli==${SPECIFY_VERSION}"

ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /workspace
ENTRYPOINT ["specify"]
CMD ["--help"]
