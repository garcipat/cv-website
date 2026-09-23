# Quickstart: Platformer Tile Meta Layer

Manual verification after implementation. Run `npm run dev`, open `/platformer/editor`, and
`/platformer`. Every scenario below is a browser check — a passing test suite is not
evidence the layer looks or feels right (constitution workflow rule).

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. Mark a wall without punching a hole (User Story 1)

1. In the editor, paint a run of `#` wall, then select the **Patrol Boundary** tool.
2. Click one of the wall cells.
3. **Expect**: the cell still shows the wall with the patrol glyph (`⇄`) over it — no gap.
4. Select the **Ground Grass** tool and paint a different tile over the same cell.
5. **Expect**: the tile is replaced and the patrol glyph stays.
6. Select the Patrol Boundary tool, then right-click the cell.
7. **Expect**: the glyph is gone and the terrain under it is exactly what it was.
8. Select the Eraser (`.`) and click a marked cell.
9. **Expect**: the terrain clears; the marker stays (FR-011 / Edge Case).

## 2. A marker on an empty cell (Edge Case)

1. Select the Patrol Boundary tool and click a cell in open air.
2. **Expect**: the glyph appears with nothing else in the cell.
3. Save the level, reload it, and reopen the editor.
4. **Expect**: the marker is still on the same cell, and the level's extent now includes
   that cell (it was not cropped away — FR-017).

## 3. Save, reload and stamp rooms (User Story 2)

1. Switch to the Blueprint canvas, select the **Connection Point** tool, and click border
   cells of a small room (paint its terrain too).
2. Save the blueprint, reload the page, and reopen it.
3. **Expect**: every connection point is back on the same border cell.
4. Switch to the Level canvas, arm the blueprint, and place it.
5. **Expect**: the placed room's border is solid at every marked cell, with the connection
   point glyph drawn over it in the editor.
6. Play the level and walk into the room's border.
7. **Expect**: the border blocks the player everywhere — the marker changed nothing.

## 4. Patrol behaviour is unchanged (User Story 3, SC-004)

1. Paint a solid floor, place an enemy on it, and paint a Patrol Boundary on a floor cell
   ahead of it (over the terrain).
2. Play the level.
3. **Expect**: the enemy reverses when its visible leading edge reaches exactly that cell,
   the same as it did when the boundary replaced the floor.
4. Walk through the marked cell.
5. **Expect**: the player is blocked or passes according to the terrain alone.

## 5. A sign shows its hint (User Story 4, SC-007)

1. Select the **Sign** tool and click an empty cell.
2. **Expect**: a `T` signpost appears with the top-left badge `1` (the default hint).
3. Click the same sign again, several times.
4. **Expect**: the badge cycles `2`, `3`, … through the registered hints, and the sign art
   itself never changes.
5. Hover the sign.
6. **Expect**: a tooltip names the hint's own translated text (FR-029).
7. Save, reload, reopen the editor.
8. **Expect**: the sign still shows the same hint code.
9. Play the level, walk onto the sign, and read the in-game bubble.
10. **Expect**: the bubble shows the same translated hint (FR-032).
11. Right-click the sign with the Sign tool.
12. **Expect**: the sign is removed entirely — the `T` terrain and its marker are both gone.
13. Place a sign again, then erase it with the Eraser tool.
14. **Expect**: it is removed the same way, with no orphaned badge left behind.

## 6. Decorative vs falling stalactite (User Story 5, SC-008)

1. Select the **Stalactite** (`⊤`) tool and paint a cell under a ceiling.
2. **Expect**: the ordinary, untinted stalactite.
3. Select the **Falling Stalactite** tool and paint another ceiling cell.
4. **Expect**: the same `⊤` art, tinted red (the existing editor tint).
5. Save, reload, reopen.
6. **Expect**: the decorative one is still untinted and the falling one is still tinted.
7. Play the level, walk beneath the falling one.
8. **Expect**: it shakes and drops exactly as before; the decorative one never falls
   (FR-032).

## 7. Migration of an existing file (SC-002, FR-015/FR-022)

1. Hand-author a legacy level JSON whose `layout` still contains `P`, `+`, `1`–`6` and a
   `T` falling stalactite (or reuse a pre-feature file), drop it in
   `src/themes/platformer/level/levels/`, and load it in the editor.
2. **Expect**: the terrain under each marker is empty; each `P`/`+` shows its glyph; each
   digit is a `T` sign carrying the same hint; the `T` hazard is a `⊤` tile with the red
   falling tint.
3. Save it.
4. **Expect**: the file now has a `markers` field of typed objects and no `P`/`+`/digits in
   its `layout`; a sign is `T`, a falling stalactite is `⊤` + a marker.
5. Play it and compare against the pre-migration version.
6. **Expect**: identical gameplay — same patrol turns, same hint text, same shake-and-drop.

## 8. Markers never grow the canvas (FR-010)

1. Select a marker tool and click far outside the painted area.
2. **Expect**: nothing is added; the canvas extent does not change.
3. Paint terrain there instead.
4. **Expect**: the canvas grows as usual.

## 9. Markers are always visible (FR-011)

1. Paint a marker, then switch the active layer to **Background**.
2. **Expect**: the marker glyph is still drawn over the dimmed foreground.
3. Switch back to Foreground and select a different tool.
4. **Expect**: the marker is still drawn — an author can never unknowingly paint over one.

## 10. Regression checks

1. Load the shipped `main` level.
2. **Expect**: it plays/renders exactly as before; its saved file carries the new `markers`
   shape and no `P`/`+`/digits in `layout`.
3. Load the `empty` scratch level and play it.
4. **Expect**: unchanged.
5. Open the editor and open **Export** for the shipped level.
6. **Expect**: the JSON matches the level's own content, markers included.

## 11. Export shows the complete JSON (FR-033/FR-034, SC-010)

1. Paint some foreground terrain, some background material, a patrol boundary, and a sign;
   open **Export**.
2. **Expect**: the textarea holds the complete level JSON — `name`, `layout`, `background`
   (when painted) and `markers` — with each marker a typed object
   (`{ "col": …, "row": …, "marker": { … } }`), not the old layout-rows block.
3. Copy it and compare with the file the Save control writes (or `levelFileJson`'s output).
4. **Expect**: byte-identical.
5. Open Export on a level with no markers.
6. **Expect**: the `markers` field is absent, and the rest of the JSON matches the saved
   file.

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Marker vocabulary / migration | `level/LevelParser.test.ts` | `P`/`+`/digits/`T` lift to typed markers; terrain emptied (`⊤` for legacy `T`); stored-field merge; unknown kind ignored; `T` generation rule; `T`/`P`/`+` no longer in `TERRAIN_CHARS`/`TileChar`; `T` no longer in `HAZARD_CHARS` |
| Hint catalog | `level/HintCatalog.test.ts` | order preserves `1`–`6`; default is first; `hintCode`/`nextHintId`/`isHintId` |
| Layer predicate | `level/Terrain.test.ts` | `markerAt` present/absent/out-of-bounds; marker kinds are not `TileType` |
| Sign/hazard discovery | `level/LevelParser.test.ts` | `findSignTiles` pairs `T` + `sign.hintId` and defaults when absent; `findHazardTiles` returns character hazards and marker-derived falling stalactites in one list |
| Level merge | `level/level.test.ts` | `currentLevel` merges `currentMarkers`; `SIGN_TILES`/`HAZARD_TILES` read the layer |
| Enemy movement | `entities/enemies/movement/patrol.test.ts`, `engine/EnemyAI.test.ts` | a `patrolBoundary` marker reverses at the same cell (SC-004) |
| Rendering | `engine/Renderer.test.ts` | a marker draws nothing; the `⊤` hazard art still draws from placements |
| Editor paint | `editor/paintMarkerCell.test.ts` | write/overwrite/erase; never grows; sign default/cycle |
| Editor actions | `editor/editorActions.test.ts` | marker paint/dirty/snapshot; growth shift; placement stamp/overwrite; undo |
| Crop | `editor/cropLevelForExport.test.ts`, `editor/exportLayout.test.ts` | box includes a marker on an empty cell; markers serialize relative to the origin |
| Storage | `editor/saveLevelFile.test.ts`, `editor/saveBlueprintFile.test.ts` | `markers` omitted when empty, present when not; typed shape |
| Placement | `editor/placeBlueprint.test.ts`, `editor/blueprintFit.test.ts` | markers stamped; markers never block |
| Palette / canvas | `editor/Palette.test.tsx`, `editor/EditorCanvas.test.tsx` | marker tools gated by canvas; clicks write the marker grid; sign badge/tooltip/tint |
| Toolbar | `editor/EditorToolbar.test.tsx` | the Export textarea shows the complete level JSON (`levelFileJson`) with markers, and Copy copies it |
| Game integration | `PlatformerPage.test.tsx` | enemy turns at a marker; player passes through; the sign bubble shows the marker's hint |
