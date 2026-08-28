# Idea: Platformer Multi-Level Support

## Status: Design Exploration

## Summary

Let the visitor switch between multiple hand-crafted levels via a dropdown
(à la `ThemeSelect`/`LanguageSelect`, likely another `FloatingControls`
entry), instead of the single fixed `level1`.

The readable-level-format and ASCII-entity-marker questions this idea
originally raised are resolved and already built (roadmap step 16):
`LevelParser.ts` owns `parseLevel`/`TERRAIN_CHARS`/`ENTITY_CHARS`, and
`level1.ts` is pure layout data using `S`/`E`/`M`/`C`/`F` markers for
spawn/enemies/coins/fruits. Any additional level file (`level2.ts`, ...)
follows the same pattern for free — that part of the groundwork is done.

Explicitly out of scope for S-006 v1 (see `specs/S-006-platformer-theme/spec.md`'s
Out of Scope section: "Multiple levels", "Level editor or user-created
content") — a deliberate v2+ candidate.

---

## Open Questions

- Does every level need to independently satisfy FR-013 (every non-empty CV
  item has a collectible/enemy somewhere), or only across levels collectively?
  Roadmap step 16 already establishes that a single level doesn't have to
  cover every CV item — markers decide what's on the map, not CVData's length.
- Should level choice persist (`localStorage`, like `currentTheme`/
  `currentLocale`) or always reset to a default on reload?
- Is the dropdown a permanent visitor-facing feature, or a dev/debug-only
  convenience (like `?debug=hitboxes`) for comparing layouts while designing?

---

## Next Step

Brainstorm properly (bounded-to-architectural depending on the dropdown's
scope) once there's a second level to actually switch to: propose the
registry shape and the open questions above, then implement.
