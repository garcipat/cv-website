# Idea: A Dedicated Control/Marker Layer for the Platformer Level Format

## Status: Unscheduled — deliberately not acted on

## Summary

A level cell holds exactly one tile kind. Painting an invisible, editor-only marker onto a
cell therefore **replaces** whatever terrain was there rather than overlaying it. A separate
marker layer, independent of the terrain layer, would let a marker and a tile occupy the
same cell.

## Why it was raised

Two markers exist today and they hit this differently:

- **Patrol markers** ship with the tradeoff and are fine in practice, because a patrol
  marker is almost always placed over open ground, where there was no terrain to lose.
- **Blueprint connection points** are the case that hurts. A connection point marks where
  another room may attach, so it belongs on a room's *border* — which is typically a wall.
  Painting one there removes the wall, and the result can be an invisible, non-solid gap in
  a shipped level.

## Why it has not been built

Blueprint placement does not read or validate connection points today (see
[O-006](../../specs/O-006-platformer-blueprints/spec.md)). Whatever eventually consumes
them may convert or strip connection points at placement time rather than leaving literal
gaps behind — which would make a separate layer unnecessary.

Revisit only once placement actually reads connection points and this either does or does
not turn out to be a real problem. Building a second layer now would be solving a problem
that may never occur, at the cost of touching the level format, the parser, the renderer,
and the editor.
