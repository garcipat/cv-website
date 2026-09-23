# Contract: onboarding (legend caption / sign fallback) and the low corridor

FR-015 and SC-007: Down's crouch meaning MUST be taught at first need — from the
upfront key legend by default, from a signpost at the low corridor only if the
caption genuinely cannot be placed without crowding the legend. The two are
alternatives, never both. FR-013/SC-005: the shipped level gains a one-tile
corridor built only from existing tiles, with no level-format change.

## A. Primary — the `ControlsOverlay` key legend caption

### i18n

Add to `src/i18n/locales/en.json` and `de.json` under
`platformer.controlsOverlay`:

| Key | en | de (draft) |
| --- | --- | --- |
| `crouch` | `Crouch` | `Ducken` |

`src/i18n/translations.ts` derives `Translation` from `en.json`, so the key is
type-checked; `de.json` is typed `Translation` and MUST gain the same key.

### Component

- `ControlsOverlay.tsx` renders a second caption inside the arrow cluster's own
  width (the sprite's arrow cluster spans ~47% of the image). The existing
  `move` caption shifts left within the cluster so `crouch` sits beside it
  without overlapping; both stay under the cluster.
- Reuse the file's existing absolutely-positioned caption pattern (a `span`
  with `left: <percent>%` and `-translate-x-1/2`) and the same font/text-shadow
  styling. No new dependency, no shadcn component.
- Exact percentages are tuned by eye in the manual browser check (constitution:
  visible behavior needs a browser check); they are data constants next to the
  existing `MOVE_LABEL_CENTER_PERCENT` etc.

### Acceptance

- A first-time visitor sees a Down/crouch caption in the legend without the
  captions overlapping in either locale (SC-007).

## B. Fallback — the S-009 signpost (only if A crowds)

Only if the browser check shows the caption cannot fit in either locale:

- Add `crouch` to `platformer.hints` in `en.json`/`de.json` (e.g. "Hold Down to
  crouch and crawl.").
- Add `'7': 'crouch'` to `LevelParser.ts`'s `SIGN_CHARS` and `'7'` to the
  `TileChar` union (the existing map/`TileChar` sync test covers the latter).
- Place a `7` sign marker on the corridor's approach row beside the low
  corridor; it is read through the existing sign mechanism (stand on it, press
  Up → `checkSignOverlap` + `HintTooltip`), unchanged.
- Update `docs/themes/platformer/LevelFormat.md`'s sign table with `7`.

If A ships, B is **not** implemented (FR-015: alternatives, never both).

The `7` sign character is a **sign-marker** addition through the existing
S-009 mechanism — not a terrain tile and not a terrain-format change, so
FR-013/SC-005 (no new terrain tile kind) still hold. It ships only in the
fallback path, never alongside the legend caption.

## C. The low corridor (`level/level.ts`)

- Add a short (~6 tile) one-tile-high corridor by writing `groundGrass`
  **ceiling** tiles at 0-based layout array row **8** over a stretch whose row
  **9** is empty (the corridor) and row **10** is already solid `groundGrass`
  (the floor). **All row and column numbers in this contract are 0-based array
  indices**, matching `LEVEL_1_LAYOUT` and the tests.
- Recommended columns **89–94** (0-based): at those columns row 8 is empty
  (ceiling slot), row 9 is empty (the corridor), and row 10 is solid `G` — this
  is the authored configuration. It avoids the `?` block marker at row 7 / col 88
  (0-based, which must stay reachable from below) and the bee marker at row 8 /
  col 95 (0-based).
- Do **not** add a `TileType`, a `TERRAIN_CHARS` entry, or any level-format
  field (FR-013). Update the layout's top doc comment to describe the corridor.
- Re-validate the exact columns in the Level Editor during implementation; the
  shape of the change (ceiling added, corridor row left empty, existing floor
  reused) is fixed.

## Invariants (asserted by `level.test.ts` / `ControlsOverlay.test.tsx` / `LevelParser.test.ts`)

1. The authored corridor's ceiling row (0-based row 8) is solid across its
   columns, its corridor row (0-based row 9) is `empty` across those columns,
   and its floor row (0-based row 10) is solid `groundGrass` — i.e. exactly one
   tile of clearance.
2. The corridor columns contain no `ENTITY_CHARS`/`SIGN_CHARS`/`HAZARD_CHARS`
   marker, and no `?` block marker sits directly above the corridor's ceiling in
   a way that would be walled off.
3. `TERRAIN_CHARS`/`ENTITY_CHARS`/`SIGN_CHARS`/`HAZARD_CHARS` and the `TileChar`
   union are unchanged by the corridor (no new tile kind); the module-load
   shared-character guard still passes.
4. `ControlsOverlay` renders `ui.platformer.controlsOverlay.crouch` when the
   overlay is shown, and the existing `move`/`jump`/`journal`/`interact`
   captions still render.
5. `en.json` and `de.json` have identical `platformer.controlsOverlay` keys
   (and, if B ships, identical `platformer.hints` keys).
