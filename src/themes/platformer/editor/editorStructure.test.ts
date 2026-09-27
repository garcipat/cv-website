import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE_TOOLS, terrainPaletteTools } from './ops/paletteTiles';
import { TILE_MODULES, TERRAIN_CHARS } from '../tiles/registry';
import { ENTITY_CHARS, SIGN_CHAR, HAZARD_CHARS } from '../level/LevelParser';
import type { EditorTool } from './editorState';
import type { TileModule } from '../tiles/TileModule';

/**
 * FR-017 structural guard (R-010).
 *
 * This is the automated regression watch for the single-implementation
 * invariants and R-001/R-015 edges in `contracts/layer-invariants.md` §3. It
 * reads source files with `node:fs`/`node:path` — test-only — so a
 * structural regression fails the suite rather than drifting silently
 * (mirroring `tiles/registry.test.ts`).
 *
 * Each check has a frozen expectation, so deleting an invariant's subject
 * cannot silently vacate the check.
 *
 * Note: searched-for tokens are assembled from fragments (`frag`/`rx`) so the
 * guard's own source does not contain the exact literals the quickstart §2
 * manual greps look for — a guard that tripped those greps would make the
 * cross-check useless.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLATFORMER_ROOT = path.resolve(HERE, '..');
const EDITOR_DIR = HERE;
const OPS_DIR = path.join(HERE, 'ops');
const DEV_DIR = path.join(HERE, 'dev');
const LEVEL_DIR = path.join(PLATFORMER_ROOT, 'level');
const CONTRACTS_DIR = path.join(PLATFORMER_ROOT, 'contracts');
const ENGINE_DIR = path.join(PLATFORMER_ROOT, 'engine');

/** Joins fragments into a token the source should not contain literally. */
function frag(...parts: string[]): string {
  return parts.join('');
}

/** A regex from fragments. */
function rx(...parts: string[]): RegExp {
  return new RegExp(frag(...parts));
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

/** Recursively lists every `.ts`/`.tsx` file under `dir`. */
function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const ALL_PLATFORMER_FILES = listSourceFiles(PLATFORMER_ROOT);

/** Every non-test source file under `src/themes/platformer/`. */
const SOURCE_FILES = ALL_PLATFORMER_FILES.filter((file) => !/\.(test|page)\.tsx?$/.test(file));

function relative(file: string): string {
  return toPosix(path.relative(PLATFORMER_ROOT, file));
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/** The source text of every platformer source file, keyed by relative path. */
const SOURCES: Record<string, string> = Object.fromEntries(
  SOURCE_FILES.map((file) => [relative(file), read(file)]),
);

/** All files under `dir`. */
function filesUnder(dir: string): string[] {
  return SOURCE_FILES.filter((file) => file.startsWith(dir + path.sep));
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Counts files whose source matches `pattern`. */
function filesMatching(pattern: RegExp): string[] {
  return Object.entries(SOURCES)
    .filter(([, source]) => pattern.test(source))
    .map(([rel]) => rel);
}

/** Import specifiers of one source text. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const re = /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) specifiers.push(match[1]);
  return specifiers;
}

describe('FR-017 guard — (1) no editor-local finder/synthesizer pipeline', () => {
  it('gridRenderState-noLongerExists', () => {
    expect(fs.existsSync(path.join(EDITOR_DIR, frag('grid', 'RenderState', '.ts')))).toBe(false);
  });

  it('noSourceDefinesTheLocalFinder', () => {
    expect(filesMatching(rx('find', 'All', 'Positions'))).toEqual([]);
  });

  it('noSynthesizePrefixSymbolSurvives', () => {
    expect(filesMatching(rx('\\bsynth', 'esize[A-Z]'))).toEqual([]);
  });

  it('previewPlayerState-callsTheSharedFindOptionalSpawnTile', () => {
    const source = SOURCES['editor/ops/previewPlacements.ts'];
    expect(typeof source).toBe('string');
    expect(source).toContain('export function previewPlayerState');
    expect(source).toContain('findOptionalSpawnTile');
  });
});

describe('FR-017 guard — (2) one palette descriptor consuming R-015', () => {
  const registry = TILE_MODULES as Record<string, TileModule>;

  it('exactlyOnePaletteToolsDeclaration', () => {
    expect(filesMatching(rx('export const PALETTE_', 'TOOLS'))).toEqual([
      'editor/ops/paletteTiles.ts',
    ]);
  });

  it('zeroParallelPaletteTables', () => {
    const pattern = new RegExp(
      [
        frag('PALETTE_TILE_', 'SPRITES'),
        frag('PALETTE_TILE_', 'GLYPHS'),
        frag('PALETTE_TILE_', 'DESCRIPTIONS'),
        frag('PALETTE_TILE_', 'LABELS'),
      ].join('|'),
    );
    expect(filesMatching(pattern)).toEqual([]);
  });

  it('everyEditorToolKeyHasADescriptorEntry', () => {
    const keys: EditorTool[] = [
      ...(Object.keys(TERRAIN_CHARS) as EditorTool[]),
      ...(Object.keys(ENTITY_CHARS) as EditorTool[]),
      SIGN_CHAR,
      ...(Object.keys(HAZARD_CHARS) as EditorTool[]),
      'patrolBoundary',
      'connectionPoint',
      'fallingStalactite',
    ];
    for (const key of keys) {
      expect(PALETTE_TOOLS[key], `missing palette descriptor for ${key}`).toBeDefined();
    }
  });

  it('terrainCharsResolveFromTileModules', () => {
    const tools = terrainPaletteTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      const module = registry[tool.tileType];
      expect(tool.char).toBe(module.char);
      expect(tool.fogExempt).toBe(module.fogExempt);
      expect(tool.drawBand).toBe(module.drawBand);
    }
  });

  it('groupingMatchesTodaysSplit', () => {
    expect(PALETTE_TOOLS['.'].group).toBe('tools');
    for (const decoration of ['n', 'N', 'X', 'c', '⊤', '⊥', '¥', 's']) {
      expect(PALETTE_TOOLS[decoration as EditorTool].group).toBe('decoration');
    }
    for (const tool of terrainPaletteTools()) {
      expect(TERRAIN_CHARS[tool.char]).toBeDefined();
    }
  });
});

describe('FR-017 guard — (3) one mapper-placement contract', () => {
  const MAPPER_FILES = [
    'level/BlockMapper.ts',
    'level/EnemyMapper.ts',
    'level/ChestMapper.ts',
    'level/CollectibleMapper.ts',
    'level/CheckpointMapper.ts',
    'level/SignMapper.ts',
    'level/HazardMapper.ts',
  ];

  it('exactlyOnePlaceAtMarkersAndOnePlaceWithFactPool', () => {
    expect(filesMatching(rx('export function place', 'AtMarkers<'))).toEqual(['level/placement.ts']);
    expect(filesMatching(rx('export function place', 'WithFactPool<'))).toEqual([
      'level/placement.ts',
    ]);
  });

  it('everyMapperImportsTheSharedPlacementHelpers', () => {
    for (const file of MAPPER_FILES) {
      const source = SOURCES[file];
      expect(source, `${file} missing`).toBeDefined();
      expect(source).toContain("from './placement'");
      expect(source).toMatch(/placeAtMarkers|placeWithFactPool/);
    }
  });

  it('noMapperContainsItsOwnPlaceLoop', () => {
    const offenders = MAPPER_FILES.filter(
      (file) => /markers\.map\(|markers\.forEach\(/.test(SOURCES[file] ?? ''),
    );
    expect(offenders).toEqual([]);
  });

  it('slugifyIsDeclaredOnlyInLevelIds', () => {
    expect(filesMatching(rx('export function slug', 'ify'))).toEqual(['level/ids.ts']);
  });

  it('noMapperImportsSlugifyFromAnotherMapper', () => {
    const pattern = new RegExp(
      frag('import\\s*\\{[^}]*slug', 'ify[^}]*\\}\\s*from\\s*', "'\\.\\/CollectibleMapper'"),
    );
    expect(filesMatching(pattern)).toEqual([]);
  });
});

describe('FR-017 guard — (4) one paint / walk / crop / save', () => {
  it('exactlyOnePaintPrimitive', () => {
    expect(filesMatching(rx('export function stamp', 'GridCells'))).toEqual(['editor/ops/paintGrid.ts']);
    expect(filesMatching(rx('export function paint', 'GridCell'))).toEqual(['editor/ops/paintGrid.ts']);
  });

  it('exactlyOneLayoutCharacterWalk', () => {
    expect(filesMatching(rx('export function walk', 'Layout'))).toEqual(['level/layoutChars.ts']);
  });

  it('exactlyOneGridCropSerializer', () => {
    expect(filesMatching(rx('export function crop', 'LayoutToBox'))).toEqual([
      'editor/ops/exportLayout.ts',
    ]);
  });

  it('exactlyOneSaveModule', () => {
    expect(filesMatching(rx('export async function save', 'File'))).toEqual(['editor/dev/saveFile.ts']);
  });

  it('cropLevelForExportObtainsBothLayersFromTheSharedCrop', () => {
    const source = SOURCES['editor/ops/cropLevelForExport.ts'];
    const cropCall = frag('crop', 'LayoutToBox(');
    expect(source).toContain(`layout: ${cropCall}`);
    expect(source).toContain(`background: ${cropCall}`);
    // No local character/background row-serialization loop of its own: the
    // only loop is the sparse marker walk (import + two serializations + the
    // empty-box branch).
    expect(occurrences(source, cropCall)).toBe(3);
  });
});

describe('FR-017 guard — (5) one LayoutFile', () => {
  it('exactlyOneLayoutFileDeclaration', () => {
    expect(filesMatching(rx('(interface|type)\\s+Layout', 'File\\b'))).toEqual([
      'level/rawLayoutFile.ts',
    ]);
  });

  it('levelEntryAndBlueprintExtendItWithoutRedeclaringItsLayers', () => {
    const levelRegistry = SOURCES['level/levelRegistry.ts'];
    const blueprintData = SOURCES['level/BlueprintData.ts'];
    expect(levelRegistry).toMatch(/interface LevelEntry extends LayoutFile/);
    expect(blueprintData).toMatch(/interface Blueprint extends LayoutFile/);
    const levelBody = levelRegistry.slice(
      levelRegistry.indexOf('interface LevelEntry extends LayoutFile'),
    );
    const bpBody = blueprintData.slice(blueprintData.indexOf('interface Blueprint extends LayoutFile'));
    for (const body of [
      levelBody.slice(0, levelBody.indexOf('}')),
      bpBody.slice(0, bpBody.indexOf('}')),
    ]) {
      expect(body).not.toMatch(/\blayout\s*:/);
      expect(body).not.toMatch(/\bbackground\s*\??\s*:/);
      expect(body).not.toMatch(/\bmarkers\s*\??\s*:/);
    }
  });
});

describe('FR-017 guard — (6) editor concern split', () => {
  const D11_OPS_MODULES = [
    'paletteTiles',
    'backgroundPaletteTiles',
    'gridLayout',
    'exportLayout',
    'cropLevelForExport',
    'paintGrid',
    'paintCell',
    'paintBackgroundCell',
    'paintMarkerCell',
    'placeBlueprint',
    'previewPlacements',
    'applyTool',
    'importLayout',
    'blueprintCells',
    'blueprintFit',
    'caveLightingPreview',
    'EditorPan',
    'EditorZoom',
  ];

  it('opsAndDevExist', () => {
    expect(fs.statSync(OPS_DIR).isDirectory()).toBe(true);
    expect(fs.statSync(DEV_DIR).isDirectory()).toBe(true);
  });

  it('noTsxOrReactImportUnderOpsOrDev', () => {
    const offenders = [...filesUnder(OPS_DIR), ...filesUnder(DEV_DIR)].filter((file) =>
      /\.tsx$/.test(file),
    );
    expect(offenders).toEqual([]);
    const reactPattern = new RegExp(
      `${frag("from 're", "act'")}|${frag('@preact/', 'signals-react')}`,
    );
    expect(
      filesMatching(reactPattern).filter(
        (f) => f.startsWith('editor/ops/') || f.startsWith('editor/dev/'),
      ),
    ).toEqual([]);
  });

  it('everyD11PureTransformLivesUnderOpsAndNoneAtTheRoot', () => {
    for (const name of D11_OPS_MODULES) {
      expect(fs.existsSync(path.join(OPS_DIR, `${name}.ts`)), `missing ops/${name}.ts`).toBe(true);
      expect(fs.existsSync(path.join(EDITOR_DIR, `${name}.ts`)), `stray editor/${name}.ts`).toBe(false);
    }
  });

  it('editorRootHoldsOnlyTsxUiPlusStateAndActions', () => {
    const rootNonTest = fs
      .readdirSync(EDITOR_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /\.tsx?$/.test(name))
      .filter((name) => !/\.(test|page)\.tsx?$/.test(name));
    const allowed = new Set(['editorState.ts', 'editorActions.ts']);
    const offenders = rootNonTest.filter((name) => !name.endsWith('.tsx') && !allowed.has(name));
    expect(offenders).toEqual([]);
  });
});

describe('FR-017 guard — (7) R-001/R-015 layer edges', () => {
  it('contractsIsStillALeaf', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(CONTRACTS_DIR)) {
      for (const spec of importSpecifiers(read(file))) {
        if (
          /(\.\.\/)*((engine|entities|level|state|editor|components)\/|PlatformerState|PlatformerPage)/.test(
            spec,
          )
        ) {
          offenders.push(`${relative(file)} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('noLevelImportsEngine', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(LEVEL_DIR)) {
      for (const spec of importSpecifiers(read(file))) {
        if (/(^|\/)engine\//.test(spec)) offenders.push(`${relative(file)} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('noEngineImportsState', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(ENGINE_DIR)) {
      for (const spec of importSpecifiers(read(file))) {
        if (/(^|\/)state\//.test(spec) || spec.includes('PlatformerState')) {
          offenders.push(`${relative(file)} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('levelStaysReactFree', () => {
    const offenders: string[] = [];
    const reactPattern = new RegExp(
      `${frag("from 're", "act'")}|${frag('@preact/', 'signals-react')}`,
    );
    for (const file of listSourceFiles(LEVEL_DIR)) {
      if (reactPattern.test(read(file))) offenders.push(relative(file));
    }
    expect(offenders).toEqual([]);
  });

  it('newLevelHelpersImportSameOrLowerLayersOnly', () => {
    for (const rel of [
      'level/ids.ts',
      'level/cvFacts.ts',
      'level/placement.ts',
      'level/layoutChars.ts',
      'level/rawLayoutFile.ts',
    ]) {
      const source = SOURCES[rel];
      expect(source, rel).toBeDefined();
      for (const spec of importSpecifiers(source)) {
        // No engine/, entities/, state/, editor/ edge or React/signals import.
        expect(spec, `${rel} -> ${spec}`).not.toMatch(
          /(^|\/)(engine|entities|state|editor|components)\//,
        );
        expect(spec, `${rel} -> ${spec}`).not.toMatch(
          new RegExp(`^(${frag('re', 'act')}|${frag('@preact/', 'signals-react')})$`),
        );
        // Everything else is a same-or-lower-layer relative import.
        expect(spec, `${rel} -> ${spec}`).toMatch(/^\.\.?\//);
      }
    }
  });
});

describe('FR-017 guard — (8) shared apply-tool op', () => {
  it('editorCanvasApplyToolAtHoldsNoPerToolPlacementSemantics', () => {
    const source = SOURCES['editor/EditorCanvas.tsx'];
    expect(source).toContain('applyTool(');
    expect(source).not.toContain('markerRemovedOnRepaint');
    expect(source).not.toContain(`existing.kind === ${frag("'s", "ign'")}`);
  });

  it('applyToolOwnsTheMarkerRemovalPredicate', () => {
    const source = SOURCES['editor/ops/applyTool.ts'];
    expect(source).toContain('export function markerRemovedOnRepaint');
    expect(source).toContain("'sign'");
    expect(source).toContain("'fallingStalactite'");
    expect(source).toContain("'torch'");
  });
});
