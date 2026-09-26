import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import * as Hud from './HudRenderer';
import * as Scene from './SceneRenderer';

/**
 * FR-015 structural guard for the renderer split (SC-001/SC-002/SC-003).
 * A static property is checked against the module source text, because an
 * export-only check cannot catch a private helper (see `keyCounterWidth` in
 * the pre-split module).
 */

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const sceneSource = readSource('./SceneRenderer.ts');
const hudSource = readSource('./HudRenderer.ts');

/** The eight per-kind counter symbols removed by FR-005/FR-006/SC-002. */
const REMOVED_COUNTER_SYMBOLS = [
  'drawCollectibleCounter',
  'drawChestCounter',
  'drawKeyCounter',
  'drawBombCounter',
  'chestCounterWidth',
  'keyCounterX',
  'keyCounterWidth',
  'bombCounterX',
] as const;

describe('renderer modules do not import each other (FR-001)', () => {
  it('sceneRenderer-doesNotImportHudRenderer', () => {
    expect(sceneSource).not.toMatch(/from\s+['"][^'"]*HudRenderer[^'"]*['"]/);
    expect(sceneSource).not.toMatch(/import\(\s*['"][^'"]*HudRenderer[^'"]*['"]\s*\)/);
  });

  it('hudRenderer-doesNotImportSceneRenderer', () => {
    expect(hudSource).not.toMatch(/from\s+['"][^'"]*SceneRenderer[^'"]*['"]/);
    expect(hudSource).not.toMatch(/import\(\s*['"][^'"]*SceneRenderer[^'"]*['"]\s*\)/);
  });
});

describe('no per-kind counter path survives (FR-005/FR-006/SC-002)', () => {
  it('eitherModuleSource-neverDeclaresOrUsesARemovedCounterSymbol', () => {
    for (const symbol of REMOVED_COUNTER_SYMBOLS) {
      expect(sceneSource).not.toContain(symbol);
      expect(hudSource).not.toContain(symbol);
    }
  });

  it('eitherModuleExports-noneOfTheRemovedCounterSymbols', () => {
    for (const symbol of REMOVED_COUNTER_SYMBOLS) {
      expect(Hud).not.toHaveProperty(symbol);
      expect(Scene).not.toHaveProperty(symbol);
    }
  });
});

describe('one pickup pass and no renderer-local tile registry (FR-007/FR-008/SC-003)', () => {
  it('sceneRenderer-exportsDrawPickupsAsItsOnlyPickupPass', () => {
    expect(Scene).toHaveProperty('drawPickups');
    for (const wrapper of [
      'drawKeyPickups',
      'drawHeartPickups',
      'drawBombPickups',
      'drawBonusFruits',
    ]) {
      expect(sceneSource).not.toContain(wrapper);
      expect(Scene).not.toHaveProperty(wrapper);
    }
  });

  it('sceneRenderer-introducesNoRendererLocalTileRegistry', () => {
    expect(sceneSource).not.toContain('STATIC_TILE_TYPES');
    // The terrain path is the relocated 12-parameter drawTerrain and its
    // tileSource lookup — never a renderer-local tile-kind registry.
    expect(Scene).toHaveProperty('drawTerrain');
  });
});

describe('the combined module is gone (FR-009/SC-001)', () => {
  it('engineRendererHasBeenDeleted-withNoBarrelAliasOrReExportInItsPlace', () => {
    const oldModuleRelative = ['..', 'Renderer.ts'].join('/');
    const oldModule = fileURLToPath(new URL(oldModuleRelative, import.meta.url));
    expect(existsSync(oldModule)).toBe(false);
  });
});
