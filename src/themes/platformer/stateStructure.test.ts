import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * R-012's structural guard (FR-020). One feature-local file beside
 * `PlatformerState.test.ts`; R-009's `engine/render/guard.test.ts` is neither
 * imported nor extended (SI-8).
 *
 * Every check is a static scan over source text, so it fails when a removed
 * shape is reintroduced — the searched-for tokens are assembled from fragments
 * so this file's own source never matches them.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLATFORMER_ROOT = HERE;

/** Test-only `node:fs` scanning, the R-009/R-010/R-011/R-015 precedent. */
function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      files.push(...listSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.join(PLATFORMER_ROOT, relativePath), 'utf8');

/** Sources scanned by the layer/structural checks: every `.ts`/`.tsx` under the
 * theme, excluding test files (and this guard) unless a check says otherwise. */
const ALL_SOURCES = listSourceFiles(PLATFORMER_ROOT).map((absolute) => ({
  relativePath: toPosix(path.relative(PLATFORMER_ROOT, absolute)),
  source: fs.readFileSync(absolute, 'utf8'),
}));
const NON_TEST_SOURCES = ALL_SOURCES.filter(
  ({ relativePath }) => !/\.test\.tsx?$/.test(relativePath),
);

const countOccurrences = (source: string, token: string): number => source.split(token).length - 1;

const countItCases = (relativePath: string): number =>
  (readSource(relativePath).match(/\bit\(/g) ?? []).length;

// Fragments, so this guard's own text never contains the searched tokens.
const LOAD = 'load';
const IMAGE = 'Image(';
const FONT = 'Font(';

describe('SI-1 — no longhand reset coordinator', () => {
  const stateSource = readSource('PlatformerState.ts');

  it('platformerState-declaresEachPublicSeamExactlyOnce', () => {
    expect(countOccurrences(stateSource, 'export function resetGame(')).toBe(1);
    expect(countOccurrences(stateSource, 'export function resetGameProgress(')).toBe(1);
  });

  it('neitherSeamBody-containsASignalAssignment', () => {
    const bodyOf = (name: string): string => {
      const start = stateSource.indexOf(`export function ${name}(`);
      const end = stateSource.indexOf('\n}', start);
      return stateSource.slice(start, end);
    };
    // `resetGameProgress` calls the `resetGame` seam; scope the check to each
    // body's own statements.
    expect(bodyOf('resetGame')).not.toMatch(/\.value\s*=/);
    expect(bodyOf('resetGameProgress').replace('  resetGame();', '')).not.toMatch(/\.value\s*=/);
  });

  it('resetGameProgress-clearsCheckpointMemoryBeforeTheRespawnFanOut', () => {
    const body = stateSource.slice(stateSource.indexOf('export function resetGameProgress('));
    expect(body.indexOf('checkpointStore.resetFull(')).toBeGreaterThanOrEqual(0);
    expect(body.indexOf('checkpointStore.resetFull(')).toBeLessThan(body.indexOf('resetGame();'));
  });

  it('theFrozenDomainModules-eachExportTheirResetHook', () => {
    const withBoth = [
      'state/playerStore.ts',
      'state/blockStore.ts',
      'state/enemyStore.ts',
      'state/collectibleStore.ts',
      'state/deployableItemStore.ts',
      'state/hazardTimerStore.ts',
      'state/effectStore.ts',
    ];
    for (const module of withBoth) {
      const source = readSource(module);
      expect(source, module).toContain('export function reset(');
      expect(source, module).toContain('export function resetFull(');
      // One rule body per module: `resetFull()` is exactly `reset(false)`.
      const resetFullBody = source.slice(source.indexOf('export function resetFull('));
      expect(resetFullBody, module).toMatch(/resetFull\(\): void \{\s*reset\(false\);\s*\}/);
    }
    for (const module of ['state/checkpointStore.ts', 'state/progressStore.ts']) {
      const source = readSource(module);
      expect(source, module).toContain('export function resetFull(');
      expect(source, module).not.toContain('export function reset(');
    }
  });
});

describe('SI-2 — no page-level asset loading', () => {
  const pageSource = readSource('PlatformerPage.tsx');

  it('page-containsNoLoadPrimitiveCalls', () => {
    expect(pageSource).not.toContain(LOAD + IMAGE);
    expect(pageSource).not.toContain(LOAD + FONT);
  });

  it('page-declaresNoneOfTheFrozenPerSheetRefs', () => {
    const removedRefs = [
      'tilesetRef',
      'groundAtlasRef',
      'backgroundLayersRef',
      'backgroundLayerGrassRef',
      'backgroundLayerRiverRef',
      'ambientCloudsRef',
      'backgroundAtlasRef',
      'staticObjectsRef',
      'decorationsRef',
      'torchRef',
      'mushroomRef',
      'playerSpriteRef',
      'playerJumpSpriteRef',
      'heartsSpriteRef',
      'coinSpriteRef',
      'fruitSpriteRef',
      'chestClosedSpriteRef',
      'keySpriteRef',
      'checkpointSpriteRef',
    ];
    for (const ref of removedRefs) {
      expect(pageSource, ref).not.toContain(ref);
    }
  });

  it('page-declaresExactlyOneSpriteLookup', () => {
    expect(countOccurrences(pageSource, 'useRef<SpriteLookup>')).toBe(1);
  });
});

describe('SI-3 — one loader, one manifest', () => {
  it('manifestAndLoaderFactory-areDeclaredExactlyOnce', () => {
    const declaring = (declaration: string) =>
      NON_TEST_SOURCES.filter(({ source }) => source.includes(declaration)).map(
        ({ relativePath }) => relativePath,
      );
    expect(declaring('export const SPRITE_MANIFEST')).toEqual([
      'entities/sprites/SpriteManifest.ts',
    ]);
    expect(declaring('export function createAssetLoader(')).toEqual(['engine/AssetLoader.ts']);
  });

  it('loadPrimitives-onlyLiveInTheAllowedNonTestSources', () => {
    const withToken = (token: string) =>
      NON_TEST_SOURCES.filter(({ source }) => source.includes(token))
        .map(({ relativePath }) => relativePath)
        .sort();

    expect(withToken(LOAD + IMAGE)).toEqual([
      'editor/EditorCanvasPane.tsx',
      'engine/AssetLoader.ts',
      'engine/SpriteLoader.ts',
    ]);
    expect(withToken(LOAD + FONT)).toEqual(['engine/AssetLoader.ts', 'engine/FontLoader.ts']);
  });

  it('theLoaderFactory-hasExactlyOneCallSiteAndItIsTheSession', () => {
    const callSites = NON_TEST_SOURCES.filter(({ source }) =>
      source.includes('createAsset' + 'Loader('),
    ).map(({ relativePath }) => relativePath);
    // The declaration itself plus the single session call site.
    expect(callSites.sort()).toEqual(['PlatformerSession.ts', 'engine/AssetLoader.ts']);
    expect(readSource('PlatformerPage.tsx')).not.toContain('createAsset' + 'Loader(');
  });

  it('theSpearInstaller-isCalledOnlyByTheLoaderAndItsOwnModule', () => {
    const withInstaller = NON_TEST_SOURCES.filter(({ source }) =>
      source.includes('setSpearTip' + 'Mask'),
    ).map(({ relativePath }) => relativePath);
    expect(withInstaller.sort()).toEqual(['engine/AssetLoader.ts', 'entities/hazards/SpearArt.ts']);
  });
});

describe('SI-4 — no inline HUD composition', () => {
  const pageSource = readSource('PlatformerPage.tsx');

  it('page-namesNoneOfTheInlineHudTokens', () => {
    for (const token of [
      'hudCounter' + 'X',
      'hudCounter' + 'Width',
      'sheetFrame' + 'Counter',
      'scaledImage' + 'Counter',
      'icon' + 'Frame',
      'advance' + 'Width',
      'SLIME_GREEN' + '_SHEET',
      'blockFrame' + 'Source',
      'CHEST_COUNTER' + '_X',
      'CHEST_CLOSED' + '_WIDTH',
      'CHEST_COUNTER_ICON' + '_HEIGHT',
      'BOMB_COUNTER_ICON' + '_HEIGHT',
    ]) {
      expect(pageSource, token).not.toContain(token);
    }
  });

  it('theLayoutModelAndDrawEntryPoint-areEachDeclaredExactlyOnce', () => {
    const declaring = (name: string) =>
      NON_TEST_SOURCES.filter(({ source }) => source.includes(`export function ${name}(`)).map(
        ({ relativePath }) => relativePath,
      );
    expect(declaring('hudCounter' + 'X')).toEqual(['engine/render/HudLayout.ts']);
    expect(declaring('hudCounter' + 'Width')).toEqual(['engine/render/HudLayout.ts']);
    expect(declaring('formatHud' + 'CounterText')).toEqual(['engine/render/HudLayout.ts']);
    expect(declaring('draw' + 'Hud')).toEqual(['engine/render/HudLayout.ts']);
    expect(declaring('build' + 'HudModel')).toEqual(['state/hudModel.ts']);
  });
});

describe('SI-5 — no raw-marker vocabulary in the state layer or the preview', () => {
  const exempt = 'state/levelSession.ts';
  const scanned = NON_TEST_SOURCES.filter(
    ({ relativePath }) =>
      relativePath !== exempt &&
      (relativePath.startsWith('state/') || relativePath === 'editor/ops/caveLightingPreview.ts'),
  );

  it('nonExemptModules-containNoRawMarkerTokens', () => {
    const tokens = ['markerAt' + '(', 'marker' + '.kind', 'marker' + '.strength'];
    for (const { relativePath, source } of scanned) {
      for (const token of tokens) {
        expect(source, `${relativePath} contains ${token}`).not.toContain(token);
      }
      // The strength default may only be reached through `placeTorches`.
      expect(source, `${relativePath} imports the torch strength default`).not.toMatch(
        /import[^;]*DEFAULT_TORCH_STRENGTH[^;]*from/,
      );
    }
  });

  it('nonExemptModules-readNoMarkerFieldsAndImportNoRawMarkerTypes', () => {
    for (const { relativePath, source } of scanned) {
      // A marker field read reached through an intermediate binding
      // (`const m = markerAt(...); m.kind`) is caught by name, so a token match
      // on `marker.kind` alone cannot be evaded. Other discriminated unions
      // (a deployable item's own `kind`) are legitimate and not scanned.
      expect(source, relativePath).not.toMatch(/\b(m|marker|entry|cell)\s*\.\s*(kind|strength)\b/);
      for (const rawType of ['MarkerEntry', 'MarkerGrid', 'MarkerPlacement']) {
        expect(source, `${relativePath} imports ${rawType}`).not.toMatch(
          new RegExp(`import[^;]*\\b${rawType}\\b[^;]*from\\s+['"]\\.\\./level/`),
        );
      }
    }
  });

  it('levelSession-exemptionIsExplicitAndNeverReadsAMarkerField', () => {
    // Positive assertion (OQ-3): the exempt module owns the raw layer but must
    // not itself read a marker's fields.
    const source = readSource(exempt);
    expect(source).toContain('MarkerPlacement');
    expect(source).toContain('currentMarkers');
    expect(source).not.toMatch(/\.(kind|strength)\b/);
  });

  it('placeTorches-isDeclaredOnceAndConsumedByBothSides', () => {
    const declaring = NON_TEST_SOURCES.filter(({ source }) =>
      source.includes('export function placeTorches('),
    ).map(({ relativePath }) => relativePath);
    expect(declaring).toEqual(['level/TorchMapper.ts']);
    expect(readSource('state/levelPlacements.ts')).toContain('placeTorches');
    expect(readSource('editor/ops/caveLightingPreview.ts')).toContain('placeTorches');
  });
});

describe('SI-6 — no compatibility shim', () => {
  it('platformerState-reexportsOnlyMovedButLiveSymbols', () => {
    const movedSymbols = new Set([
      'playerStateAtTile',
      'spawnPlayerState',
      'playerState',
      'cameraPositionX',
      'cameraPositionY',
      'darknessLevel',
      'tickDarkness',
      'fogLevel',
      'tickFog',
      'torchPositions',
      'collectiblePlacements',
      'baseCoinPlacements',
      'skillFactPool',
      'spawnedCoinPlacements',
      'allCollectiblePlacements',
      'enemyPlacements',
      'blockPlacements',
      'chestPlacements',
      'levelTotals',
      'signPlacements',
      'hazardPlacements',
      'enemyStates',
      'blockStates',
      'cratesDestroyed',
      'enemiesDefeated',
      'chestStates',
      'checkpointPlacements',
      'checkpointStates',
      'activeCheckpointId',
      'activeRespawnPlacement',
      'respawnPlayerState',
      'respawnCenter',
      'endingScreenShown',
      'endingScreenOpen',
      'controlsOverlayDismissed',
      'fruitStates',
      'heartPickupStates',
      'keyPickupStates',
      'collectedKeys',
      'MAX_BOMBS',
      'carriedBombs',
      'bombPickupStates',
      'pickupStores',
      'pickupGroups',
      'collectedFacts',
      'activeEffects',
      'spawnEffect',
      'refreshSpeechBubbleText',
      'activeJournalSection',
      'spawnCenter',
      'lifecycleState',
      'ropeLadderPlacements',
      'deployableItems',
      'chestsOpened',
      'activeLevel',
      'tickDeployableItems',
      'applyDeployableItemConsequences',
      'mushroomSquashStates',
      'tickMushroomSquashes',
      'floorSpikeTimerStates',
      'armHazardTrigger',
      'tickFloorSpikes',
      'crumblingFloorTimerStates',
      'armCrumblingFloorTrigger',
      'tickCrumblingFloors',
      'fallingStalactiteTimerStates',
      'tickFallingStalactites',
      'hazardPlacementsForTick',
      'PickupStore',
      'DeployableItem',
    ]);
    const source = readSource('PlatformerState.ts');
    const reexported: string[] = [];
    for (const match of source.matchAll(/export \{([^}]*)\} from/g)) {
      for (const name of match[1].split(',')) {
        const trimmed = name.trim();
        if (trimmed) reexported.push(trimmed);
      }
    }
    for (const match of source.matchAll(/export type \{([^}]*)\} from/g)) {
      for (const name of match[1].split(',')) {
        const trimmed = name.trim();
        if (trimmed) reexported.push(trimmed);
      }
    }
    expect(reexported.length).toBeGreaterThan(0);
    for (const name of reexported) {
      expect(movedSymbols.has(name), `${name} is not a moved-but-live symbol`).toBe(true);
    }
  });

  it('thePageAndTheAssemblyRootMentionNoRemovedShape', () => {
    const pageAndRoot = ['PlatformerPage.tsx', 'PlatformerState.ts'];
    for (const removed of ['tilesetRef', 'chestCounter' + 'Width']) {
      for (const relativePath of pageAndRoot) {
        expect(readSource(relativePath), `${relativePath} mentions ${removed}`).not.toContain(
          removed,
        );
      }
    }
  });
});

describe('SI-7 — layer edges', () => {
  // R-015's list, redeclared verbatim: the constant is test-local there and is
  // not exported (frozen expectation).
  const FORBIDDEN_EDGES: readonly (readonly [string, string])[] = [
    ['contracts', 'engine'],
    ['contracts', 'entities'],
    ['contracts', 'level'],
    ['contracts', 'tiles'],
    ['contracts', 'state'],
    ['level', 'engine'],
    ['engine', 'state'],
    ['tiles', 'entities'],
    ['tiles', 'engine'],
  ];
  const IMPORT_SPECIFIER_RE = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
  const layerOf = (relativePath: string) =>
    relativePath.includes('/') ? relativePath.slice(0, relativePath.indexOf('/')) : 'root';

  it('theRedeclaredForbiddenEdgeList-isFrozen', () => {
    expect(FORBIDDEN_EDGES).toHaveLength(9);
    expect(FORBIDDEN_EDGES).toContainEqual(['engine', 'state']);
    expect(FORBIDDEN_EDGES).toContainEqual(['level', 'engine']);
    expect(FORBIDDEN_EDGES).toContainEqual(['contracts', 'state']);
  });

  it('noSourceDeclaresAForbiddenEdge', () => {
    for (const { relativePath, source } of ALL_SOURCES) {
      const from = layerOf(relativePath);
      for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
        const specifier = match[1];
        if (!specifier.startsWith('.')) continue;
        const resolved = path.posix.normalize(
          path.posix.join(path.posix.dirname(relativePath), specifier),
        );
        const to = layerOf(resolved);
        for (const [fromLayer, toLayer] of FORBIDDEN_EDGES) {
          expect(
            from === fromLayer && to === toLayer,
            `${relativePath} declares ${fromLayer} → ${toLayer} (${specifier})`,
          ).toBe(false);
        }
      }
    }
  });
});

describe('SI-8 — the renderer split stays untouched', () => {
  it('r009sGuard-stillExistsWithItsFrozenRemovedCounterList', () => {
    const source = readSource('engine/render/guard.test.ts');
    expect(source).toContain('REMOVED_COUNTER_SYMBOLS');
    expect(source).toContain('drawChestCounter');
  });

  it('thisGuard-doesNotImportOrExtendTheRendererGuard', () => {
    const source = readSource('stateStructure.test.ts');
    expect(source).not.toContain('from ' + "'./engine/render/" + 'guard' + "'");
  });
});

describe('SI-9 — no test was weakened', () => {
  it('everyFrozenSuiteStillHoldsAtLeastItsBaselineItCount', () => {
    const baselines: ReadonlyArray<readonly [string, number]> = [
      ['PlatformerState.test.ts', 161],
      ['PlatformerPage.test.tsx', 245],
      ['engine/render/HudRenderer.test.ts', 31],
      ['engine/render/SceneRenderer.test.ts', 210],
      ['engine/GameLifecycle.test.ts', 40],
    ];
    for (const [relativePath, baseline] of baselines) {
      expect(countItCases(relativePath), relativePath).toBeGreaterThanOrEqual(baseline);
    }
    expect(countItCases('engine/render/guard.test.ts')).toBe(7);
  });
});

describe('SI-10 — the page never writes the lifecycle state', () => {
  const pageSource = readSource('PlatformerPage.tsx');

  it('page-assignsNoLifecycleStateBecauseTheSessionOwnsThePhase', () => {
    // FR-016: every phase transition goes through `PlatformerSession`
    // (beginIntro/beginDeath/advanceLifecycle/restart/...), so a reintroduced
    // `lifecycleState.value = ...` in the page is a regression. This is the
    // check the guard was missing while the theme-switch effect and the frame
    // body still seeded the phase themselves.
    expect(pageSource).not.toMatch(/lifecycleState\.value\s*=/);
  });

  it('page-asksTheSessionForThePhaseInsteadOfReDerivingGating', () => {
    // Gating is asked of the controller (`session.phase()`), not re-derived
    // from the signal at the call site (FR-016).
    expect(pageSource).not.toContain('lifecycleState.value.phase');
  });
});
