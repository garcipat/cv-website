import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TILE_MODULES, TERRAIN_CHARS, TILE_FOG_EXEMPT, isFogExempt } from './registry';
import type { TileModule } from './TileModule';
import { parseLevel } from '../level/LevelParser';
import { tileAt } from '../level/Terrain';

/**
 * Structural guard for the tile module registry.
 *
 * This is the automated regression watch for the layer invariants. It reads
 * source files with `node:fs`/`node:path` — test-only — so a structural
 * regression fails the suite rather than drifting silently.
 *
 * Check (3), the rule-branch absence scan, is **relaxed during ** (its
 * targets `engine/Physics.ts`/`engine/Standable.ts`/`level/Terrain.ts` are not
 * registry-wired until ). It is enabled in / by flipping
 * `RULE_BRANCH_CHECK_ENABLED` to `true`.
 */

// The frozen shipped-kind list. Pinning it is what makes the exhaustiveness
// check non-vacuous: `TileType` is derived from `TILE_MODULES`, so deleting a
// kind would otherwise silently shrink the union and the registry together.
const SHIPPED_TILE_KINDS = [
  'groundGrass',
  'groundRock',
  'wall',
  'bridge',
  'ladder',
  'chain',
  'bush',
  'fence',
  'cobweb',
  'crystalCluster',
  'stalactite',
  'stalagmite',
  'torch',
  'ladderBundle',
  'ropeLadder',
  'bouncyMushroom',
  'decorativeMushroom',
  'crumblingFloor',
  'empty',
] as const;

// Registry-only kinds that are never author-placeable and so declare no `char`.
const REGISTRY_ONLY_KINDS = ['ropeLadder'] as const;

// Enabled in / now that Physics/Standable/Terrain are wired to the registry.
const RULE_BRANCH_CHECK_ENABLED = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLATFORMER_ROOT = path.resolve(HERE, '..');
const TILES_DIR = HERE;

/** The registry widened to the contract type for string-indexed access. */
const MODULES_BY_KIND = TILE_MODULES as Record<string, TileModule>;

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

/** Recursively lists every `.ts`/`.tsx` file under `dir`. */
function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
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

/** The first path segment of a platformer-relative path, or `'root'`. */
function layerOf(relativePath: string): string {
  const normalized = toPosix(relativePath);
  const slash = normalized.indexOf('/');
  return slash === -1 ? 'root' : normalized.slice(0, slash);
}

// Matches `from '...'`, side-effect `import '...'` and dynamic `import('...')`.
const IMPORT_SPECIFIER_RE = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

/** Every relative import specifier in a source file. */
function relativeImports(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) specifiers.push(specifier);
  }
  return specifiers;
}

// `contracts/` is a leaf, and these two edges are the new invariants.
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

interface EdgeViolation {
  file: string;
  specifier: string;
  from: string;
  to: string;
}

function findForbiddenEdges(): EdgeViolation[] {
  const violations: EdgeViolation[] = [];
  for (const absolute of listSourceFiles(PLATFORMER_ROOT)) {
    const relFile = toPosix(path.relative(PLATFORMER_ROOT, absolute));
    const from = layerOf(relFile);
    const source = fs.readFileSync(absolute, 'utf8');
    const importerDir = path.dirname(relFile);
    for (const specifier of relativeImports(source)) {
      const resolved = toPosix(path.normalize(path.join(importerDir, specifier)));
      const to = layerOf(resolved);
      if (FORBIDDEN_EDGES.some(([a, b]) => a === from && b === to)) {
        violations.push({ file: relFile, specifier, from, to });
      }
    }
  }
  return violations;
}

describe('TILE_MODULES registry shape', () => {
  it('keys-resolveToExactlyTheFrozenNineteenShippedKinds', () => {
    // Arrange
    const shipped = [...SHIPPED_TILE_KINDS].sort();
    // Act
    const keys = [...Object.keys(TILE_MODULES)].sort();
    // Assert
    expect(keys).toEqual(shipped);
    expect(keys).toHaveLength(19);
  });

  it('entries-areOneDistinctModuleObjectPerKindWithNoDuplicates', () => {
    // Arrange
    const modules = Object.values(TILE_MODULES);
    // Act
    const distinct = new Set(modules);
    // Assert
    expect(distinct.size).toBe(modules.length);
    expect(distinct.size).toBe(Object.keys(TILE_MODULES).length);
  });

  it('everyEntry-declaresABooleanFogExemptAndAKnownDrawBand', () => {
    // Arrange / Act / Assert
    for (const [kind, module] of Object.entries(MODULES_BY_KIND)) {
      expect(typeof module.fogExempt, kind).toBe('boolean');
      expect(['terrain', 'afterHazards', 'deployable'], kind).toContain(module.drawBand);
    }
  });
});

describe('TERRAIN_CHARS derivation', () => {
  it('maps-everyAuthorPlaceableKindExactlyOnce', () => {
    // Arrange
    const modulesWithChar = Object.entries(MODULES_BY_KIND).filter(
      ([, module]) => module.char !== undefined,
    );
    // Act
    const charValues = Object.values(TERRAIN_CHARS).filter(
      (tile): tile is NonNullable<typeof tile> => tile !== undefined,
    );
    // Assert
    expect(charValues).toHaveLength(modulesWithChar.length);
    for (const [kind, module] of modulesWithChar) {
      expect(TERRAIN_CHARS[module.char as string], kind).toBe(kind);
      expect(MODULES_BY_KIND[kind].char).toBe(module.char);
    }
    expect(new Set(charValues).size).toBe(charValues.length);
  });

  it('neverMapsAnyCharToTheRegistryOnlyRopeLadder', () => {
    // Arrange / Act
    const values = Object.values(TERRAIN_CHARS);
    // Assert
    for (const registryOnly of REGISTRY_ONLY_KINDS) {
      expect(values).not.toContain(registryOnly);
      expect(MODULES_BY_KIND[registryOnly].char).toBeUndefined();
    }
  });

  it('everyParsedChar-resolvesToARealModule', () => {
    // Arrange
    const chars = Object.keys(TERRAIN_CHARS).join('');
    // Act / Assert
    for (const char of chars) {
      const tile = TERRAIN_CHARS[char];
      if (tile === undefined) continue;
      expect(TILE_MODULES[tile], char).toBeDefined();
    }
  });

  it('parsedLevel-tileAtNeverReturnsAMarker', () => {
    // Arrange — a layout exercising terrain, an entity marker, a sign and a
    // legacy marker; none may surface through `tileAt`.
    const level = parseLevel(['GTS', 'P.T']);
    // Act / Assert
    for (let row = 0; row < level.height; row++) {
      for (let col = 0; col < level.width; col++) {
        const tile = tileAt(level, col, row);
        expect(TILE_MODULES[tile], `(${col},${row})`).toBeDefined();
      }
    }
  });
});

describe('TILE_FOG_EXEMPT exhaustiveness', () => {
  it('has-aBooleanEntryForEveryTileType', () => {
    // Arrange
    const kinds = Object.keys(TILE_MODULES);
    // Act
    const fogKeys = Object.keys(TILE_FOG_EXEMPT).sort();
    // Assert
    expect(fogKeys).toEqual([...kinds].sort());
    for (const kind of kinds) {
      expect(typeof TILE_FOG_EXEMPT[kind as keyof typeof TILE_FOG_EXEMPT], kind).toBe('boolean');
      expect(isFogExempt(kind as keyof typeof TILE_FOG_EXEMPT)).toBe(
        TILE_FOG_EXEMPT[kind as keyof typeof TILE_FOG_EXEMPT],
      );
    }
  });
});

describe('stateful-kind declarations', () => {
  it('onlyTheBouncyMushroomAndCrumblingFloor-declareState', () => {
    // Arrange / Act
    const withState = Object.entries(MODULES_BY_KIND)
      .filter(([, module]) => module.state !== undefined)
      .map(([kind]) => kind)
      .sort();
    // Assert
    expect(withState).toEqual(['bouncyMushroom', 'crumblingFloor']);
  });

  it('declaredState-carriesTheFrozenDurationsAndPolicies', () => {
    // Arrange / Act
    const mushroom = MODULES_BY_KIND.bouncyMushroom.state;
    const crumbling = MODULES_BY_KIND.crumblingFloor.state;
    // Assert
    expect(mushroom?.duration).toBe(0.1);
    expect(mushroom?.rearm).toBe('replace');
    expect(mushroom?.prune).toBe(true);
    expect(crumbling?.duration).toBeCloseTo(0.9 + 1.5 + 0.4, 10);
    expect(crumbling?.rearm).toBe('noop');
    expect(crumbling?.prune).toBe(true);
  });
});

describe('palette read model', () => {
  it('everyKind-exposesItsRegistryMetadataForThePalette', () => {
    // can build the palette from `TILE_MODULES` alone: every kind exposes
    // its fog flag and draw band, and every author-placeable kind its char.
    for (const kind of Object.keys(TILE_MODULES)) {
      const module = MODULES_BY_KIND[kind];
      expect(typeof module.fogExempt, kind).toBe('boolean');
      expect(['terrain', 'afterHazards', 'deployable'], kind).toContain(module.drawBand);
      if (module.char !== undefined) {
        expect(TERRAIN_CHARS[module.char], kind).toBe(kind);
      }
      expect('draw' in module, kind).toBe(module.draw !== undefined);
    }
  });

  it('tileModules-isTheOnlyTileTableInTheTheme', () => {
    // Arrange / Act — no other source file declares a second `TILE_MODULES`
    // (a competing tile/palette registry would break ).
    const declarers = listSourceFiles(PLATFORMER_ROOT).filter((file) =>
      /export\s+const\s+TILE_MODULES\b/.test(fs.readFileSync(file, 'utf8')),
    );
    // Assert
    expect(declarers.map((file) => toPosix(path.relative(PLATFORMER_ROOT, file)))).toEqual([
      'tiles/registry.ts',
    ]);
  });
});

describe('layer edges', () => {
  it('sourceTree-containsNoForbiddenLayerEdge', () => {
    // Arrange / Act
    const violations = findForbiddenEdges();
    // Assert
    expect(violations).toEqual([]);
  });

  it('tilesDirectory-isOneModulePerKindPlusContractAndRegistry', () => {
    // Arrange / Act
    const tileFiles = fs
      .readdirSync(TILES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    // Assert — contract, registry and this guard must exist; every other file
    // is `draw.ts` or a `<kind>.ts` module.
    expect(tileFiles).toContain('TileModule.ts');
    expect(tileFiles).toContain('registry.ts');
    expect(tileFiles).toContain('registry.test.ts');
  });
});

/**
 * Check (3) — no scattered rule branches. The scan runs over the three files
 * that must consume the registry instead of comparing tile types directly.
 */
describe('rule-branch absence', () => {
  const RULE_FILES = ['engine/Physics.ts', 'engine/Standable.ts', 'level/Terrain.ts'] as const;

  // The pure run classifiers in level/Terrain.ts select run *sprites* by
  // comparing `tileAt(...)` to a tile name — they are explicitly exempt.
  const EXEMPT_FUNCTIONS = new Set(['bridgeRunPosition', 'chainRunLength']);

  it('ruleFiles-containNoTileTypeEqualityComparison', () => {
    // Arrange
    if (!RULE_BRANCH_CHECK_ENABLED) return;
    const tileLiteralAlternation = [...SHIPPED_TILE_KINDS]
      .map((kind) => kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const comparison = new RegExp(`[!=]==?\\s*['"](${tileLiteralAlternation})['"]`);
    // Act
    const offenders: string[] = [];
    for (const relative of RULE_FILES) {
      const lines = fs.readFileSync(path.join(PLATFORMER_ROOT, relative), 'utf8').split(/\r?\n/);
      let currentFunction = '';
      lines.forEach((line, index) => {
        const declaration = line.match(/^\s*(?:export\s+)?function\s+(\w+)/);
        if (declaration) currentFunction = declaration[1];
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        if (!comparison.test(line)) return;
        if (EXEMPT_FUNCTIONS.has(currentFunction)) return;
        offenders.push(`${relative}:${index + 1}: ${trimmed}`);
      });
    }
    // Assert
    expect(offenders).toEqual([]);
  });
});
