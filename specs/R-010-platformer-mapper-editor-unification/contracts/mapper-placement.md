# Contract — Mapper Placement, Ids & CV Flattening

**Feature**: `R-010-platformer-mapper-editor-unification`
**Requirements**: FR-003, FR-004, FR-005, FR-006; SC-002
**Consumers**: `level/BlockMapper.ts`, `EnemyMapper.ts`, `ChestMapper.ts`, `CollectibleMapper.ts`,
`CheckpointMapper.ts`, `SignMapper.ts`, `HazardMapper.ts`, `level/placement.ts`, `level/ids.ts`,
`level/cvFacts.ts`

---

## 1. `placeAtMarkers` — the only marker→placement loop

```ts
export interface MarkerPosition { col: number; row: number }

export interface PlaceAtMarkersDescriptor<M extends MarkerPosition, P> {
  idPrefix: string;
  /** Override for ids embedding more than prefix+cell (sign hintId, hazard type, chest def id). */
  id?: (marker: M, index: number) => string;
  /** Everything except the helper-assigned `id`/`x`/`y`. */
  build: (marker: M, index: number) => Omit<P, 'id' | 'x' | 'y'>;
}

export function placeAtMarkers<M extends MarkerPosition, P>(
  markers: readonly M[],
  descriptor: PlaceAtMarkersDescriptor<M, P>,
): P[];
```

Rules:

- `id` = `descriptor.id?.(marker, index) ?? \`${descriptor.idPrefix}-${marker.col}-${marker.row}\``.
- `x`/`y` = `tileToPixel(marker.col, marker.row)`.
- The returned object is `{ id, x, y, ...build(marker, index) }` with `id`/`x`/`y` authoritative.
- Every `level/*Mapper.ts` place function MUST route through `placeAtMarkers` (directly or via
  `placeWithFactPool`, §2). No mapper may contain its own `markers.map(...)`/`forEach` place loop.
- Every id produced MUST equal the pre-refactor id byte-for-byte (list in
  [data-model.md §4](../data-model.md)).

## 2. `placeWithFactPool` — the one proportional slice

```ts
export interface FactPoolPlacement extends MarkerPosition { id: string; x: number; y: number;
  fact?: CollectedFact; extraFacts?: CollectedFact[] }

export function placeWithFactPool<M extends MarkerPosition, P extends FactPoolPlacement>(
  markers: readonly M[],
  pool: readonly CollectedFact[],
  descriptor: { idPrefix: string; build: (marker: M, index: number) => Omit<P, keyof FactPoolPlacement> },
): P[];
```

Rules:

- Implemented **on top of `placeAtMarkers`** (it is not a second loop). For marker `i` of `n` with
  pool length `m`: `start = revealedFactCountFor(i, n, m)`, `end = revealedFactCountFor(i+1, n, m)`,
  `slice = pool.slice(start, end)`; then `fact = slice[0]`,
  `extraFacts = slice.length > 1 ? slice.slice(1) : undefined`.
- Used by `BlockMapper.placeCrates` and `EnemyMapper.placeGreenSlimes` only; neither carries a
  private copy of the algorithm.

## 3. Id vocabulary (one home: `level/ids.ts`)

```ts
export function slugify(label: string): string;                      // moved verbatim; no re-export elsewhere
export function slugId(prefix: string, ...parts: string[]): string;  // `${prefix}-${slugify(parts.join('-'))}`
```

Rules:

- `slugify` is declared exactly once and imported from `level/ids.ts` by every consumer; the
  previous cross-mapper import (`from './CollectibleMapper'`) is removed, and no re-export may
  remain in `CollectibleMapper.ts`.
- Derived id helpers (e.g. `block-edu-…`, `qmark-cert-…`, `enemy-course-…`, `chest-exp-…`,
  `coin-…`) are built on `slugId` in the owning mapper or in `level/ids.ts`; they do not re-derive
  slug rules inline.

## 4. CV flattening (one home: `level/cvFacts.ts`)

```ts
export function cvFact(
  sectionId: SectionId,
  sectionLabel: string,
  sourceType: CollectedFact['sourceType'],
  id: string,
  data: CVItemData | SkillCategoryFact,
): CollectedFact;
```

Rules:

- The `{ id, sectionId, sectionLabel, data, sourceType }` fact literal is constructed only here.
- The block, enemy, chest and collectible mappers build every def/fact through `slugId` + `cvFact`;
  the per-mapper section→def mapping (which CV section becomes which def kind) stays in the mapper
  as a small descriptor, so a new mapper is "a descriptor and a builder" rather than a fresh copy.
- `mapCVDataToBlocks`/`mapCVDataToEnemies`/`mapCVDataToChests`/`mapCVDataToSkillFactPool` output
  order and content are unchanged (ChestMapper still reverses `cv.experience`).
