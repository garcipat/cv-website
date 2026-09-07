# Idea: Platformer Polish Pass

## Status: Unscheduled

## Summary

A dedicated pass over the Platformer theme's animation and effects quality, paired with a
frame-rate check under load. Raised while building out the theme's mechanics, where the
priority was always "does it work" rather than "does it feel good".

## Scope

Two halves, related but separable:

**Animation and effects refinement.** Timing, easing, and weight across the theme's
existing feedback — the fact-reveal float and its flight into the journal icon, the
destruction sparkle on breaks and defeats, hit and knockback reactions, the journal's
open and close. None of these were tuned; they were made to work and left there.

**Frame-rate check under load.** The theme has never been measured with many collectibles,
enemies, and effects on screen at once. The constitution sets a 200 ms interaction-feedback
budget, and a canvas game redrawing every frame is the one part of this site that could
plausibly miss it. The check should establish whether there is a real problem before any
optimization is designed.

## Why it is not a feature yet

There is no stated target. "Feels better" is not a requirement, and optimizing before
measuring would be guesswork. This needs a brainstorming pass to decide what good looks
like — which specific animations are wrong and in what direction, and what frame budget the
theme should hold — before it can become a feature with a spec.
