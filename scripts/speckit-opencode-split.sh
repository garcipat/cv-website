#!/usr/bin/env bash
# Convert full-prompt Spec Kit opencode commands into thin wrappers that invoke
# per-command subagents. Idempotent: already-wrapped commands are skipped.
#
# Run after any `specify integration upgrade/switch opencode`.
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
CMD_DIR="$ROOT/.opencode/commands"
AGENT_DIR="$ROOT/.opencode/agents"
mkdir -p "$AGENT_DIR"

shopt -s nullglob
for cmd in "$CMD_DIR"/speckit.*.md; do
  base=$(basename "$cmd" .md)          # speckit.specify | speckit.git.commit
  agent_id=${base//./-}                # speckit-specify  | speckit-git-commit

  if grep -q '^subagent: true$' "$cmd"; then
    echo "skip (already wrapped): $base"
    continue
  fi

  desc=$(awk '/^description:/{d=$0; sub(/^description:[[:space:]]*/,"",d); print d; exit}' "$cmd")
  [ -n "$desc" ] || { echo "ERROR: no description in $cmd" >&2; exit 1; }

  # Body = lines after the closing frontmatter delimiter.
  body=$(awk 'BEGIN{n=0} /^---[[:space:]]*$/{n++; next} n>=2{print}' "$cmd")
  [ -n "$body" ] || { echo "ERROR: empty body in $cmd" >&2; exit 1; }

  {
    printf -- '---\n'
    printf 'description: %s\n' "$desc"
    printf 'mode: subagent\n'
    printf -- '---\n\n'
    printf '%s\n' "$body"
  } > "$AGENT_DIR/$agent_id.md"

  {
    printf -- '---\n'
    printf 'description: %s\n' "$desc"
    printf 'agent: %s\n' "$agent_id"
    printf 'subagent: true\n'
    printf -- '---\n\n'
    printf '$ARGUMENTS\n'
  } > "$cmd"

  echo "wrapped: $base -> agent $agent_id"
done
