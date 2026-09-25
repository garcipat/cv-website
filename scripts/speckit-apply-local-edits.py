#!/usr/bin/env python3
"""Re-apply the cv-website local overlays to the Spec Kit opencode subagents.

`scripts/speckit-opencode-split.sh` regenerates `.opencode/agents/speckit-*.md`
from the upstream `.opencode/commands/` full prompts, which drops this project's
local customizations. Run this applier immediately after the splitter to restore
them.

It edits exactly three agents — specify, clarify and analyze — and is:

* **idempotent** — a file whose overlays are already present is left untouched;
* **fail-loud** — if neither the new text nor the anchoring old text is found for
  a given overlay the whole run aborts with a non-zero exit code and no file is
  written, so a half-applied state can never be produced.

Run from the repository root:

    scripts/speckit-apply-local-edits.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTS_DIR = ROOT / ".opencode" / "agents"

# agent file -> ordered (label, upstream_text, local_text) replacements.
OVERLAYS: dict[str, list[tuple[str, str, str]]] = {
    "speckit-specify.md": [
        ("specify-feature-id-note-qualifier",
         '   If a `before_specify` hook ran successfully in the Pre-Execution Checks above, it will have created/switched to a git branch and output JSON containing `BRANCH_NAME` and `FEATURE_NUM`. Note these values for reference, but the branch name does **not** dictate the spec directory name.\n',
         '   If a `before_specify` hook ran successfully in the Pre-Execution Checks above, it will have created/switched to a git branch and output JSON containing `BRANCH_NAME` and `FEATURE_NUM`. Note these values for reference, but the branch name does **not** dictate the spec directory name (except in `feature-id` mode, where it does — see step 3).\n'),
        ("specify-feature-id-directory",
         '      - If `"timestamp"`: prefix is `YYYYMMDD-HHMMSS` (current timestamp)\n',
         '      - If `"feature-id"`: use the `before_specify` hook\'s `BRANCH_NAME` output (e.g. `F-008-player-roster`) and set `SPECIFY_FEATURE_DIRECTORY = specs/<BRANCH_NAME>`. If no hook ran, ask the user for the feature ID (`F-/S-/O-/R-NNN`), generate a 2-4 word short name, and use `specs/<FEATURE_ID>-<short-name>`.\n      - If `"timestamp"`: prefix is `YYYYMMDD-HHMMSS` (current timestamp)\n'),
        ("specify-question-tool-clarification",
         '        3. For each clarification needed (max 3), present options to user in this format:\n\n           ```markdown\n           ## Question [N]: [Topic]\n\n           **Context**: [Quote relevant spec section]\n\n           **What we need to know**: [Specific question from NEEDS CLARIFICATION marker]\n\n           **Suggested Answers**:\n\n           | Option | Answer | Implications |\n           |--------|--------|--------------|\n           | A      | [First suggested answer] | [What this means for the feature] |\n           | B      | [Second suggested answer] | [What this means for the feature] |\n           | C      | [Third suggested answer] | [What this means for the feature] |\n           | Custom | Provide your own answer | [Explain how to provide custom input] |\n\n           **Your choice**: _[Wait for user response]_\n           ```\n\n        4. **CRITICAL - Table Formatting**: Ensure markdown tables are properly formatted:\n           - Use consistent spacing with pipes aligned\n           - Each cell should have spaces around content: `| Content |` not `|Content|`\n           - Header separator must have at least 3 dashes: `|--------|`\n           - Test that the table renders correctly in markdown preview\n        5. Number questions sequentially (Q1, Q2, Q3 - max 3 total)\n        6. Present all questions together before waiting for responses\n        7. Wait for user to respond with their choices for all questions (e.g., "Q1: A, Q2: Custom - [details], Q3: B")\n        8. Update the spec by replacing each [NEEDS CLARIFICATION] marker with the user\'s selected or provided answer\n        9. Re-run validation after all clarifications are resolved\n',
         '        3. For each clarification needed (max 3), use the `question` tool to present it. Always use the `question` tool for presenting options — never raw markdown tables or lists. For each question:\n           - `header`: Short topic label (e.g., "Auth Scope")\n           - `question`: Full question including context and recommendation. Include the context and the recommended answer with reasoning in the question text.\n           - `options`: Array of answer options. The first option should be the recommended one. Each must have:\n             - `label`: Concise option name (e.g., "A - OAuth2 only")\n             - `description`: Brief implication summary (1-2 sentences)\n           - Keep `multiple` unset (defaults to single selection).\n           - The automatic "Type your own answer" option covers custom input.\n        4. Present all questions together in a single `question` tool call (pass an array of question objects).\n        5. After the user responds, update the spec by replacing each [NEEDS CLARIFICATION] marker with the user\'s selected or provided answer for each question.\n        6. Re-run validation after all clarifications are resolved\n'),
    ],
    "speckit-clarify.md": [
        ("clarify-question-tool-loop",
         '4. Generate (internally) a prioritized queue of candidate clarification questions (maximum 5). Do NOT output them all at once. Apply these constraints:\n    - Maximum of 5 total questions across the whole session.\n    - Each question must be answerable with EITHER:\n       - A short multiple‑choice selection (2–5 distinct, mutually exclusive options), OR\n       - A one-word / short‑phrase answer (explicitly constrain: "Answer in <=5 words").\n    - Only include questions whose answers materially impact architecture, data modeling, task decomposition, test design, UX behavior, operational readiness, or compliance validation.\n    - Ensure category coverage balance: attempt to cover the highest impact unresolved categories first; avoid asking two low-impact questions when a single high-impact area (e.g., security posture) is unresolved.\n    - Exclude questions already answered, trivial stylistic preferences, or plan-level execution details (unless blocking correctness).\n    - Favor clarifications that reduce downstream rework risk or prevent misaligned acceptance tests.\n    - If more than 5 categories remain unresolved, select the top 5 by (Impact * Uncertainty) heuristic.\n\n5. Sequential questioning loop (interactive):\n    - Present EXACTLY ONE question at a time.\n    - **Question writing quality (applies to every question, MC or short-answer):**\n       - Lead with `**Question:**` followed by a full interrogative that ends with `?`. The question text before the `?` must make sense on its own.\n       - NEVER use a topic label, section heading, or requirement id as the question itself. For example, `Acceptance device/runtime matrix (FR-023)` is INVALID — it is a label, not a question.\n       - After the `?`, the only permitted suffix is an optional parenthesized requirement/question id. Exact format: `**Question:** <interrogative>?` or `**Question:** <interrogative>? (FR-023)`. Never put the id before the `?`, and never use the id (alone or with a topic label) as the whole prompt.\n       - Immediately after the question line, add one plain-language "Why it matters" sentence (the stake for acceptance or shipping) before the recommendation/options.\n       - Use everyday wording; introduce jargon only if defined in the same sentence. Self-check: a reader who does not know Spec Kit must be able to answer from the Question line alone. Terse is fine; cryptic labels are not.\n    - For multiple‑choice questions:\n       - **Analyze all options** and determine the **most suitable option** based on:\n          - Best practices for the project type\n          - Common patterns in similar implementations\n          - Risk reduction (security, performance, maintainability)\n          - Alignment with any explicit project goals or constraints visible in the spec\n       - Present your **recommended option prominently** at the top with clear reasoning (1-2 sentences explaining why this is the best choice).\n       - Format as: `**Recommended:** Option [X] - <reasoning>`\n       - Then render all options as a Markdown table:\n\n       | Option | Description |\n       |--------|-------------|\n       | A | <Option A description> |\n       | B | <Option B description> |\n       | C | <Option C description> (add D/E as needed up to 5) |\n       | Short | Provide a different short answer (<=5 words) (Include only if free-form alternative is appropriate) |\n\n       - After the table, add: `You can reply with the option letter (e.g., "A"), accept the recommendation by saying "yes" or "recommended", or provide your own short answer.`\n    - For short‑answer style (no meaningful discrete options):\n       - Provide your **suggested answer** based on best practices and context.\n       - Format as: `**Suggested:** <your proposed answer> - <brief reasoning>`\n       - Then output: `Format: Short answer (<=5 words). You can accept the suggestion by saying "yes" or "suggested", or provide your own answer.`\n    - After the user answers:\n       - If the user replies with "yes", "recommended", or "suggested", use your previously stated recommendation/suggestion as the answer.\n       - Otherwise, validate the answer maps to one option or fits the <=5 word constraint.\n       - If ambiguous, ask for a quick disambiguation (count still belongs to same question; do not advance).\n       - Once satisfactory, record it in working memory (do not yet write to disk) and move to the next queued question.\n    - Stop asking further questions when:\n       - All critical ambiguities resolved early (remaining queued items become unnecessary), OR\n       - User signals completion ("done", "good", "no more"), OR\n       - You reach 5 asked questions.\n    - Never reveal future queued questions in advance.\n    - If no valid questions exist at start, immediately report no critical ambiguities.\n',
         '3a. Edge Case Clarification (MANDATORY - runs before the questioning loop):\n   - Scan the spec for ALL edge cases listed under `### Edge Cases` or similar sections.\n   - For each edge case, determine if it is sufficiently resolved (has a clear answer/behavior defined) or still needs clarification.\n   - Present unresolved edge cases to the user using the `question` tool — one at a time or grouped when related — to reach a definitive answer.\n   - After an edge case is resolved (answer accepted), immediately edit the spec to:\n     - Add the resolved answer inline to the edge case bullet\n     - Prefix the edge case bullet with a ✅ emoji to mark it as handled\n     - Example: `- ✅ What happens when X? — [resolved answer]`\n   - Already-resolved edge cases (ones that already have a clear, definitive answer in the spec) should also be prefixed with ✅.\n   - Edge case clarification questions count toward the 5-question maximum.\n\n4. Generate (internally) a prioritized queue of candidate clarification questions (maximum 5). Do NOT output them all at once. Apply these constraints:\n   - Maximum of 5 total questions across the whole session.\n   - Each question must be answerable via the `question` tool:\n     - A short multiple-choice selection (2-5 distinct, mutually exclusive options), OR\n     - A one-word / short-phrase answer (use the automatic "Type your own answer" option).\n   - Only include questions whose answers materially impact architecture, data modeling, task decomposition, test design, UX behavior, operational readiness, or compliance validation.\n   - Ensure category coverage balance: attempt to cover the highest impact unresolved categories first; avoid asking two low-impact questions when a single high-impact area (e.g., security posture) is unresolved.\n   - Exclude questions already answered, trivial stylistic preferences, or plan-level execution details (unless blocking correctness).\n   - Favor clarifications that reduce downstream rework risk or prevent misaligned acceptance tests.\n   - If more than 5 categories remain unresolved, select the top 5 by (Impact * Uncertainty) heuristic.\n\n5. Sequential questioning loop (interactive using `question` tool):\n   - Present EXACTLY ONE question at a time. Always use the `question` tool to present options — never raw markdown tables or lists.\n   - **Question writing quality (applies to every question, MC or short-answer):**\n     - Lead with `**Question:**` followed by a full interrogative that ends with `?`. The question text before the `?` must make sense on its own.\n     - NEVER use a topic label, section heading, or requirement id as the question itself. For example, `Acceptance device/runtime matrix (FR-023)` is INVALID — it is a label, not a question.\n     - After the `?`, the only permitted suffix is an optional parenthesized requirement/question id. Exact format: `**Question:** <interrogative>?` or `**Question:** <interrogative>? (FR-023)`. Never put the id before the `?`, and never use the id (alone or with a topic label) as the whole prompt.\n     - Immediately after the question line, add one plain-language "Why it matters" sentence (the stake for acceptance or shipping) before the recommendation/options.\n     - Use everyday wording; introduce jargon only if defined in the same sentence. Self-check: a reader who does not know Spec Kit must be able to answer from the Question line alone. Terse is fine; cryptic labels are not.\n   - For each question, determine the format:\n     - **Multiple-choice** (preferred when 2-5 clear options exist):\n       - **Analyze all options** and determine the **most suitable option** based on:\n         - Best practices for the project type\n         - Common patterns in similar implementations\n         - Risk reduction (security, performance, maintainability)\n         - Alignment with any explicit project goals or constraints visible in the spec\n       - Present your **recommended option prominently** in the question text with clear reasoning (1-2 sentences).\n       - Call the `question` tool with:\n         - `header`: Short topic label (e.g., "User Role Scope")\n         - `question`: Full question text including recommendation (e.g., "**Recommended:** Option A - ...")\n         - `options`: Array of option objects. The first option should be the recommended one. Each must have:\n           - `label`: Concise option identifier (e.g., "A - All authenticated users")\n           - `description`: Brief implication summary (1-2 sentences)\n         - Keep `multiple` unset (defaults to single selection).\n       - The `question` tool automatically includes "Type your own answer" for custom input, replacing the old "Short" option.\n     - **Free-form** (when no meaningful discrete options exist):\n       - Provide your **suggested answer** in the question text with reasoning.\n       - Call the `question` tool with a single option (e.g., "Accept suggestion") as the recommended choice; the user can type their own answer via the automatic custom input.\n   - After the user answers via the tool:\n     - If the user selected a named option, record that as the answer.\n     - If the user selected "Type your own answer", validate it fits the <=5 word constraint.\n     - If ambiguous, ask for a quick disambiguation using the `question` tool again (count still belongs to same question; do not advance).\n     - Once satisfactory, record it in working memory (do not yet write to disk) and move to the next queued question.\n   - Stop asking further questions when:\n     - All critical ambiguities resolved early (remaining queued items become unnecessary), OR\n     - User signals completion ("done", "good", "no more"), OR\n     - You reach 5 asked questions.\n   - Never reveal future queued questions in advance.\n   - If no valid questions exist at start, immediately report no critical ambiguities.\n'),
        ("clarify-edge-case-marking",
         '       - Edge case / negative flow → Add a new bullet under Edge Cases / Error Handling (or create such subsection if template provides placeholder for it).\n',
         '       - Edge case / negative flow → Add a new bullet under Edge Cases / Error Handling (or create such subsection if template provides placeholder for it). Prefix resolved edge cases with ✅ emoji and append the resolved answer inline.\n'),
    ],
    "speckit-analyze.md": [
        ("analyze-read-only-default",
         '**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report. Offer an optional remediation plan (user must explicitly approve before any follow-up editing commands would be invoked manually).\n',
         '**READ-ONLY by default**: Do not modify files during the analysis pass (steps 1-7). After user approves remediation selections in step 8, apply the approved edits directly to the relevant files.\n'),
        ("analyze-question-tool-remediation",
         '### 8. Offer Remediation\n\nAsk the user: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply them automatically.)\n',
         '### 8. Address All Findings with the Question Tool\n\nAfter the analysis report, use the `question` tool to present ALL findings to the user for resolution — not just the top N. Process:\n\n1. Present all findings (CRITICAL → HIGH → MEDIUM → LOW) grouped by severity using the `question` tool with `multiple: true`, so the user can select which ones to remediate.\n2. Include a "Fix all" option to select everything at once.\n3. After the user selects, immediately apply the fixes by editing the relevant files (spec.md, plan.md, tasks.md, etc.) — do not just suggest edits.\n4. Mark each resolved finding in the report with ✅ once fixed.\n5. If no findings exist, skip this step gracefully.\n'),
    ],
}


def apply_overlays(name: str, path: Path) -> bool:
    """Return True if the file changed, False if it was already up to date."""
    text = path.read_text(encoding="utf-8")
    original = text

    for label, old, new in OVERLAYS[name]:
        if new in text:
            if text.count(new) != 1:
                raise ValueError(
                    f"{path}: overlay '{label}' already present but appears "
                    f"{text.count(new)} times; refusing to guess"
                )
            print(f"  ok (already applied): {label}")
            continue
        if old not in text:
            raise ValueError(
                f"{path}: cannot apply overlay '{label}'. Neither the local "
                f"text nor the upstream anchor was found. The command body may "
                f"have changed upstream; update the overlay in this script."
            )
        if text.count(old) != 1:
            raise ValueError(
                f"{path}: overlay '{label}' anchor appears {text.count(old)} "
                f"times; refusing to apply an ambiguous replacement"
            )
        text = text.replace(old, new)
        print(f"  applied: {label}")

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> int:
    changed = 0
    try:
        for name in OVERLAYS:
            path = AGENTS_DIR / name
            if not path.is_file():
                raise ValueError(
                    f"{path}: agent file is missing; run "
                    f"scripts/speckit-opencode-split.sh first"
                )
            print(f"{name}:")
            if apply_overlays(name, path):
                changed += 1
            else:
                print("  unchanged (all overlays already present)")
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"done: {changed} agent(s) updated, {len(OVERLAYS) - changed} unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
