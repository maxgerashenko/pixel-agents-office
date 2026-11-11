/**
 * Fish tank: a floor decor item whose fish swim while an agent works near
 * the desk it stands on. Loads the real manifest through the real loader.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import path from 'node:path';

import { test } from 'vitest';

import { loadFurnitureAssets } from '../../server/src/assetLoader.js';
import {
  buildDynamicCatalog,
  getAnimationFrames,
  getCatalogByCategory,
  getCatalogEntry,
  getOnStateType,
} from '../src/office/layout/furnitureCatalog.js';

test('fish tank loads as a decor item that lights up with 3 swimming frames', async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  for (const id of ['FISH_TANK_OFF', 'FISH_TANK_ON_1', 'FISH_TANK_ON_2', 'FISH_TANK_ON_3']) {
    assert.ok(loaded.sprites.has(id), `${id} sprite loaded`);
  }
  assert.ok(
    buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) }),
  );

  const entry = getCatalogEntry('FISH_TANK_OFF');
  assert.ok(entry);
  assert.equal(entry.category, 'decor');
  assert.ok(!entry.canPlaceOnSurfaces);
  assert.ok(getCatalogByCategory('decor').some((e) => e.type === 'FISH_TANK_OFF'));
  assert.ok(!getCatalogByCategory('decor').some((e) => e.type === 'FISH_TANK_ON_2'));

  const on = getOnStateType('FISH_TANK_OFF');
  assert.notEqual(on, 'FISH_TANK_OFF');
  assert.equal(getAnimationFrames(on)?.length, 3);
});
