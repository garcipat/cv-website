# Idea: Level Editor Zoom

## Status: Unscheduled — postponed deliberately

## Summary

The Level Editor's canvas has no zoom. It draws tiles at a fixed size, 1:1, with
middle-click-drag panning as the only way to reach content off screen. Zoom would give more
overview — most useful when lining a piece of level up against existing content.

## Why it was raised

Raised while designing blueprint placement
([O-006](../../specs/O-006-platformer-blueprints/spec.md)): dropping a room into an existing
level means judging how it sits against its surroundings, and a fixed 1:1 canvas shows only
a small window of a level that is hundreds of tiles wide.

## Why it has not been built

Zoom is a larger feature than it appears. Every draw call and every mouse-to-cell
calculation in the editor assumes a fixed tile size, so a zoom factor introduces new
coordinate math throughout — not a localized change.

The existing pan was judged sufficient for placement, since blueprints are typically small
rooms rather than large regions. Revisit only if placement in practice turns out to feel
cramped.
