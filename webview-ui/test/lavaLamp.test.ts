/**
 * Lava lamp: a desk-top decor item whose lava flows while an agent works at
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

test('lava lamp loads as a decor item that lights up with 3 flowing frames', async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  for (const id of ['LAVA_LAMP_OFF', 'LAVA_LAMP_ON_1', 'LAVA_LAMP_ON_2', 'LAVA_LAMP_ON_3']) {
    assert.ok(loaded.sprites.has(id), `${id} sprite loaded`);
  }
  assert.ok(
    buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) }),
  );

  const entry = getCatalogEntry('LAVA_LAMP_OFF');
  assert.ok(entry);
  assert.equal(entry.category, 'decor');
  assert.equal(entry.canPlaceOnSurfaces, true);
  assert.ok(getCatalogByCategory('decor').some((e) => e.type === 'LAVA_LAMP_OFF'));
  assert.ok(!getCatalogByCategory('decor').some((e) => e.type === 'LAVA_LAMP_ON_2'));

  const on = getOnStateType('LAVA_LAMP_OFF');
  assert.notEqual(on, 'LAVA_LAMP_OFF');
  assert.equal(getAnimationFrames(on)?.length, 3);
});
