---
name: nano-banana
description: "Generate or edit images using the nano-banana MCP server. Use when the user wants to create images, edit photos, restore old images, generate icons, or patterns. Triggers: 'generate image', 'nano banana', 'create image', 'edit image', 'make an image', 'image with nb', 'nb generate'."
argument-hint: "Describe what you want — e.g. 'a watercolor fox in snow' or 'edit portrait.jpg to change background'"
tools:
  - mcp_nano-banana_generate_image
---

# Nano Banana

Generates or edits images via the `nano-banana` MCP server directly inside VS Code Copilot.

Output directory: `.generated/` (inside the vault root)

Reference note: [[Nano Banana]]

## When to Use

- User wants to create an image from a text description
- User wants to edit or modify an existing image
- User wants to restore a damaged or old photo
- User wants to generate an icon or pattern/texture

## Procedure

### 1. Load the ask-questions tool

Use `tool_search_tool_regex` with pattern `vscode_askQuestions` to load the interactive questions tool before doing anything.

### 2. Determine the operation and prompt

Call `vscode_askQuestions` with:

| Header | Question | Type |
|---|---|---|
| `Operation` | `What do you want to do?` | options: `Generate (text → image)` (recommended), `Edit existing image`, `Restore old/damaged photo`, `Generate icon`, `Generate seamless pattern/texture` |
| `Prompt` | `Describe what you want in detail. Be specific about style, mood, content, and any reference material.` | free text |

### 3. Gather options

Call `vscode_askQuestions` with the following. If the user's prompt already clearly states a value, pre-fill or skip that question — otherwise always ask:

| Header | Question | Type |
|---|---|---|
| `Style / mood` | `What style or mood should the image have? (e.g. watercolor, oil painting, photorealistic, pixel art, minimalist, cinematic, dark, whimsical — leave blank to let the model decide)` | free text |
| `Aspect ratio` | `Aspect ratio` | options: `1:1` (square, default), `16:9`, `9:16`, `4:3`, `3:4`, `4:5`, `5:4`, `3:2`, `2:3`, `21:9`, `Custom (specify below)` |
| `Quality` | `Quality level` | options: (blank / server default), `fast` — drafts, `balanced`, `quality` — final |
| `Purpose` | `Intended use — helps tune composition and lighting (e.g. social media post, presentation slide, poster, website hero — or leave blank)` | free text |
| `Consistent character` | `Does the image feature a recurring character that should look the same throughout?` | options: `No` (recommended), `Yes` |
| `World knowledge` | `Does the prompt reference real-world places, people, or historical facts?` | options: `No` (recommended), `Yes` |

For **Edit** or **Restore**, also ask:

| Header | Question | Type |
|---|---|---|
| `Input image path` | `Absolute path to the source image` | free text |
| `Aspect ratio` | `Aspect ratio` | options: `Keep current (same as input)`, `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `4:5`, `5:4`, `3:2`, `2:3`, `21:9`, `Custom (specify below)` |

> The **Edit/Restore** aspect ratio question overrides the general one above — only ask one or the other.

If the user selected **Custom (specify below)** for aspect ratio (in any operation), call `vscode_askQuestions` again with:

| Header | Question | Type |
|---|---|---|
| `Custom aspect ratio` | `Enter the aspect ratio (e.g. 16:9, 3:1, 7:5)` | free text |

### 4. Prepare the call parameters

- If operation is **Generate icon**: append `"as a clean icon with a transparent background"` to the prompt.
- If operation is **Generate pattern**: append `"as a seamless tileable pattern with no visible edges"` to the prompt.
- If `Style / mood` was provided, append it to the prompt (e.g. `"in a watercolor style, with a whimsical mood"`).
- Set `maintainCharacterConsistency: true` if the user answered Yes to consistent character.
- Set `useWorldKnowledge: true` if the user answered Yes to world knowledge.
- For `aspectRatio`:
  - If user chose **Keep current (same as input)**: omit `aspectRatio` from the call entirely.
  - If user chose **Custom (specify below)**: use the value they entered in the follow-up question.
  - Otherwise: use the selected preset (default: `"1:1"`).

### 5. Call `mcp_nano-banana_generate_image`

**Call the tool immediately — do NOT ask the user for confirmation before making the tool call.**

Pass:
- `prompt` — the full description with style details
- `aspectRatio` — always pass this unless "Keep current" was selected (default: `"1:1"`)
- `quality` — if provided (omit if blank)
- `purpose` — if provided (omit if blank)
- `inputImagePath` — absolute path (for Edit / Restore only)
- `maintainCharacterConsistency` — if applicable
- `useWorldKnowledge` — if applicable

### 6. Report the result

Tell the user the output file path in `.generated/<image-name>.png`.

**CRITICAL: Do NOT call `view_image`, `open_browser_page`, or any other tool that opens or previews the file. Do NOT attempt to display or render the image. Just report the path as plain text — opening the image crashes the conversation.**
