import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Structural guard for the hit-effect invariants: one generic vocabulary, one
 * resolver entry, no inline damage code, no kind-level hit pipeline, no bomb
 * internals in the page, and the layer edges. It scans source text with
 * `node:fs`/`node:path` (test-only) so a regression fails the suite.
 *
 * Searched-for tokens are assembled from fragments so the guard's own source
 * does not contain the literals it looks for.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLATFORMER_ROOT = path.resolve(HERE, '..');

function frag(...parts: string[]): string {
  return parts.join('');
}

function rx(...parts: string[]): RegExp {
  return new RegExp(frag(...parts));
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

function relative(file: string): string {
  return toPosix(path.relative(PLATFORMER_ROOT, file));
}

const ALL_FILES = listSourceFiles(PLATFORMER_ROOT);
const SOURCE_FILES = ALL_FILES.filter((file) => !/\.test\.tsx?$/.test(file));
const SOURCES: Record<string, string> = Object.fromEntries(
  SOURCE_FILES.map((file) => [relative(file), fs.readFileSync(file, 'utf8')]),
);

function filesMatching(pattern: RegExp): string[] {
  return Object.entries(SOURCES)
    .filter(([, source]) => pattern.test(source))
    .map(([rel]) => rel);
}

const IMPORT_SPECIFIER_RE = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

function relativeImports(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
    if (match[1].startsWith('.')) specifiers.push(match[1]);
  }
  return specifiers;
}

function layerOf(relativePath: string): string {
  const normalized = toPosix(relativePath);
  const slash = normalized.indexOf('/');
  return slash === -1 ? 'root' : normalized.slice(0, slash);
}

const FORBIDDEN_EDGES: readonly (readonly [string, string])[] = [
  ['contracts', 'engine'],
  ['contracts', 'entities'],
  ['contracts', 'level'],
  ['contracts', 'tiles'],
  ['contracts', 'state'],
  ['contracts', 'editor'],
  ['contracts', 'components'],
  ['level', 'engine'],
  ['engine', 'state'],
  ['tiles', 'entities'],
  ['tiles', 'engine'],
];

describe('guard — one generic vocabulary', () => {
  it('hitEffect-isDeclaredOnlyInTheContractsLeaf', () => {
    expect(filesMatching(rx('\\btype\\s+Hit', 'Effect\\b'))).toEqual(['contracts/HitEffect.ts']);
    expect(filesMatching(rx('\\binterface\\s+Hit', 'Effect\\b'))).toEqual([]);
  });

  it('theVocabulary-declaresOnlyTheThreePrimitives', () => {
    const source = SOURCES['contracts/HitEffect.ts'];
    expect(source).toBeDefined();
    const literals = [...source.matchAll(/type: '([a-z]+)'/g)].map((match) => match[1]).sort();
    expect(literals).toEqual(['damage', 'reaction', 'velocity']);
    expect(relativeImports(source)).toEqual([]);
  });
});

describe('guard — one resolver entry point', () => {
  it('resolveHitEffects-isTheOnlyExportedResolutionEntry', () => {
    expect(filesMatching(rx('export function resolve', 'HitEffects\\b'))).toEqual([
      'engine/HitResolver.ts',
    ]);
  });

  it('resolveBlasts-isTheOnlyExportedBlastEntry', () => {
    expect(filesMatching(rx('export function resolve', 'Blasts\\b'))).toEqual([
      'engine/BombSystem.ts',
    ]);
  });
});

describe('guard — no inline player-damage code', () => {
  const TAKE_DAMAGE_ALLOWED = new Set(['engine/HitResolver.ts', 'entities/Health.ts']);
  const REACTION_ALLOWED = new Set(['engine/HitResolver.ts', 'entities/Player.ts']);

  it('takeDamageCalls-liveOnlyInTheResolverAndHealth', () => {
    expect(
      filesMatching(rx('take', 'Damage\\(')).filter((file) => !TAKE_DAMAGE_ALLOWED.has(file)),
    ).toEqual([]);
  });

  it('playerReactionCalls-liveOnlyInTheResolverAndPlayer', () => {
    const calls = [
      ...filesMatching(rx('applyHit', 'Reaction\\(')),
      ...filesMatching(rx('beginPitFall', 'Reaction\\(')),
    ];
    expect(calls.filter((file) => !REACTION_ALLOWED.has(file))).toEqual([]);
  });

  it('thePlayerHitPointsAliveShape-livesOnlyInTheResolver', () => {
    const shape = filesMatching(rx('hitPoints\\s*,\\s*alive'));
    expect(shape.filter((file) => file !== 'engine/HitResolver.ts')).toEqual([]);
  });
});

describe('guard — no kind-level hit pipeline or field vocabulary', () => {
  function kindFiles(): string[] {
    return Object.keys(SOURCES).filter(
      (file) => file.startsWith('entities/enemies/') || file.startsWith('entities/blocks/'),
    );
  }

  it('kinds-doNotCallTheEnemyHitPipeline', () => {
    const offenders = kindFiles().filter(
      (file) =>
        rx('take', 'Hit\\(').test(SOURCES[file]) ||
        rx('applyEnemy', 'Damage\\(').test(SOURCES[file]),
    );
    expect(offenders.filter((file) => file !== 'entities/enemies/shared.ts')).toEqual([]);
  });

  it('kindOutcomesAndTheContract-declareNoPerFieldVocabulary', () => {
    const fieldShape = rx(
      '\\b(self|damage',
      'Player|knock',
      'back|bounce',
      'Velocity)\\s*\\??\\s*:',
    );
    const offenders = [...kindFiles(), 'contracts/Outcome.ts'].filter((file) =>
      fieldShape.test(SOURCES[file]),
    );
    expect(offenders).toEqual([]);
  });

  it('outcomeContract-declaresNoSelfStateField', () => {
    const outcome = SOURCES['contracts/Outcome.ts'];
    expect(outcome).toBeDefined();
    expect(outcome).not.toMatch(rx('\\bself\\s*\\??\\s*:'));
    expect(outcome).toContain(frag('self', 'Effects'));
  });
});

describe('guard — no bomb internals in the page', () => {
  it('platformerPage-namesNoBlastGeometryOrDamage', () => {
    const source = SOURCES['PlatformerPage.tsx'];
    expect(source).toBeDefined();
    for (const token of [
      frag('blast', 'Tiles'),
      frag('blocks', 'InBlast'),
      frag('enemies', 'InBlast'),
      frag('player', 'InBlast'),
      frag('BOMB_', 'DAMAGE'),
    ]) {
      expect(source, token).not.toContain(token);
    }
  });
});

describe('guard — no compatibility shim', () => {
  it('noBarrelOrAliasReExportsARemovedPerSiteHelper', () => {
    const reExport = rx(
      'export\\s*\\{[^}]*\\b(applyHit',
      'Reaction|beginPitFall',
      'Reaction|take',
      'Damage)\\b',
    );
    expect(filesMatching(reExport)).toEqual([]);
  });
});

describe('guard — layer edges', () => {
  it('noForbiddenLayerEdgeExists', () => {
    const violations: string[] = [];
    for (const absolute of ALL_FILES) {
      const relFile = relative(absolute);
      const from = layerOf(relFile);
      const importerDir = path.dirname(relFile);
      for (const specifier of relativeImports(fs.readFileSync(absolute, 'utf8'))) {
        const resolved = toPosix(path.normalize(path.join(importerDir, specifier)));
        const to = layerOf(resolved);
        if (FORBIDDEN_EDGES.some(([a, b]) => a === from && b === to)) {
          violations.push(`${relFile} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('resolverAndBombSystem-importNoStateModule', () => {
    for (const file of ['engine/HitResolver.ts', 'engine/BombSystem.ts']) {
      for (const specifier of relativeImports(SOURCES[file])) {
        expect(specifier, `${file} -> ${specifier}`).not.toMatch(/(^|\/)state\//);
      }
    }
  });
});

describe('guard — parity suites', () => {
  it('theParitySuites-existInTheFrozenSet', () => {
    const required = [
      'engine/HitResolver.test.ts',
      'engine/BombSystem.test.ts',
      'engine/Collision.test.ts',
      'engine/Blast.test.ts',
      'PlatformerPage.test.tsx',
      'entities/Player.test.ts',
      'entities/Health.test.ts',
      'entities/Enemy.test.ts',
      'entities/enemies/SlimePurple.test.ts',
      'entities/enemies/Bee.test.ts',
      'entities/blocks/pot.test.ts',
    ];
    for (const file of required) {
      expect(fs.existsSync(path.join(PLATFORMER_ROOT, file)), file).toBe(true);
    }
  });
});
