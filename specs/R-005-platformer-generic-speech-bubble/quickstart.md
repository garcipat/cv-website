# Quickstart: Platformer Generic Speech Bubble (R-005)

**Feature**: `specs/R-005-platformer-generic-speech-bubble/` | **Date**: 2026-09-25

Runnable scenarios that prove the generalisation is complete and behaviour-preserving. The acceptance
bar is US4/FR-019: **the game must not change**, only its internal names, homes, and registration. The
effect registry gains exactly one kind (`speechBubble`); the mushroom squash stays a keyed timed tile,
not an effect kind.

---

## Prerequisites

- Node/npm; dependencies installed (`npm install`).
- Test stack: Vitest + React Testing Library + jsdom per [docs/TestingGuide.md](../../docs/TestingGuide.md).
- A browser for the manual pass (SC-005).

---

## 1. Automated checks

```bash
npm test          # full suite (Vitest, single run)
npm run build     # production build must succeed (FR-016/SC-004)
```

Expected: the suite passes with **assertions unchanged** except renamed symbols/import paths (and the
effect-registry kind tables, which legitimately changed), and the build succeeds.

New/changed coverage to look for:
- `engine/effects/speechBubble.test.ts` — phase machine, singleton/replace/no-op/restart rules,
  transient dwell, growth/opacity curves, the migrated `drawSpeechBubble` primitive tests, plus the new
  text coverage: `startSpeechBubble` stores the resolved `text`, the draw reads `state.text`, and the
  language-change refresh (`withSpeechBubbleText` / `refreshSpeechBubbleText`) rewrites the bubble only
  when the text actually differs (no steady-state collection write).
- `entities/blocks/Mushroom.test.ts` — the migrated `>= duration` prune, `dt <= 0` no-rewind, dip
  formula, per-cell replace, `mushroomSquashDipAt`, plus the migrated `mushroomEntry`/`mushroomHasCap`
  art-helper tests.
- `level/HintCatalog.test.ts` — `SignHintId`/`BubbleMessageId` split, unchanged `HINT_IDS` order/codes,
  `isSignHintId` rejects UI-only messages.
- `engine/effects/effectRegistry.test.ts` — the kind list gains `speechBubble` as the first entry (`EFFECT_REGISTRY[0]`, before `flyingText`) and contains no
  `mushroomSquash`; keyed slots are `counterPopup` + `speechBubble`.
- `PlatformerState.test.ts` / `PlatformerPage.test.tsx` — bubble outcomes read from `activeEffects`
  (kind-filtered), not the deleted signal; squash outcomes still read `mushroomSquashStates`.

---

## 2. Search-based acceptance (SC-001/SC-002/SC-003)

These greps must come back empty for the retired names and find the new homes:

```bash
# SC-001: no sign-named bubble vocabulary survives
rg "HintTooltip|hintTooltipState|drawSignBubble|\bHintId\b" src
# -> no matches

# SC-002: no standalone squash module and no squash effect kind
rg "engine/MushroomSquash" src    # -> no matches (module path only; MushroomSquashState/startMushroomSquash names are retained)
rg "kind: 'mushroomSquash'" src  # -> no matches
# the squash timer + art helpers all resolve from entities/blocks/Mushroom.ts:
rg "blocks/Mushroom|'\./Mushroom'" src   # -> Renderer, PlatformerState, PlatformerPage + the co-located test

# Exactly one registration of the new kind
rg "kind: 'speechBubble'" src/engine/effects/effectRegistry.ts   # -> 1

# No render-context text lookup was introduced: the bubble carries its own text
rg "bubbleText" src              # -> no matches

# The hint-text signal is the only direct reader of the translation hints
rg "currentUI\.value\.platformer\.hints" src   # -> only state/hintText.ts (+ its test)
```

> The retired names may still appear in spec/plan/contract prose; only `src/` matters.

---

## 3. Manual browser pass (SC-005/US4)

Run the dev server (`npm run dev`), navigate to the platformer theme, and confirm **no visible or
behavioural difference** against the pre-refactor build:

1. **Sign hint** — stand on a hint sign and press Up/W. The bubble appears above the character's head
   with the same wording, grows from its bottom edge, and leaves when you walk off.
2. **Locked chest** — stand on a closed chest holding no keys and press Up/W. The same bubble shows
   "I need a key."; a sign tile overlapping a closed chest still wins.
3. **Transient no-bombs** — press `B` with zero bombs. The bubble shows "I have no bombs." and dismisses
   itself after its dwell, without a leave-overlap event.
4. **Live language switch** — with a bubble on screen, switch language from the theme's controls. The
   on-screen text updates in the same frame (the render loop refresh rewrites only the bubble's stored
   `text`, and only because it differs; no `bubbleText` render-context lookup exists).
5. **Re-press while shown** — press Up/W again while the same bubble is fully shown: nothing restarts.
   Walk off and immediately press again while it is exiting: the entrance restarts.
6. **Mushroom cap dip** — bounce on a bouncy-mushroom cap: the cap dips by 2 px over 0.1 s; two caps can
   squash independently; a re-bounce restarts that cap's dip. The cap art is pixel-identical.
7. **Death/respawn** — die with a bubble up: it disappears immediately (no freeze through the death
   animation, no flash at the new spawn), and the mushroom dips are cleared. Restart and confirm the
   effects that survived before still survive.
8. **Full reset** — open the journal and click Reset Game: the bubble and every effect are cleared.

---

## 4. Related runnable guides

- Effect-subsystem contracts: [`contracts/effect-render-context.md`](./contracts/effect-render-context.md),
  [`contracts/speech-bubble-kind.md`](./contracts/speech-bubble-kind.md).
- Mushroom home / timed-tile contract:
  [`contracts/mushroom-timed-tile.md`](./contracts/mushroom-timed-tile.md).
- Hint vocabulary contract: [`contracts/hint-vocabulary.md`](./contracts/hint-vocabulary.md).
- Entity/relationship detail: [`data-model.md`](./data-model.md).
- Contributor recipe (updated by this feature):
  [`docs/TransientEffectRecipe.md`](../../docs/TransientEffectRecipe.md).
