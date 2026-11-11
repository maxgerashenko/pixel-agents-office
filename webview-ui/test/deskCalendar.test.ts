/**
 * Desk calendar: a 1x1 decor item that sits on desks.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import path from 'node:path';

import { test } from 'vitest';

import { loadFurnitureAssets } from '../../server/src/assetLoader.js';
import {
  buildDynamicCatalog,
  getCatalogByCategory,
  getCatalogEntry,
} from '../src/office/layout/furnitureCatalog.js';

test('desk calendar loads as a surface-placeable decor item', async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  assert.ok(loaded.sprites.has('DESK_CALENDAR'));
  assert.ok(
    buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) }),
  );
  const entry = getCatalogEntry('DESK_CALENDAR');
  assert.ok(entry);
  assert.equal(entry.category, 'decor');
  assert.equal(entry.canPlaceOnSurfaces, true);
  assert.ok(getCatalogByCategory('decor').some((e) => e.type === 'DESK_CALENDAR'));
});
