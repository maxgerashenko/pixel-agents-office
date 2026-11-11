/**
 * Vending machine: stands like the arcade (bottom tile is the body, the row
 * above is background) and rotates through all four directions, lit while an
 * agent works nearby. Loads the real manifest through the real loader.
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
  getCatalogEntry,
  getOnStateType,
  getRotatedType,
} from '../src/office/layout/furnitureCatalog.js';

test('vending machine rotates in 4 directions and lights up with 3 frames', async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  assert.ok(
    buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) }),
  );

  const front = getCatalogEntry('VENDING_MACHINE_FRONT_OFF');
  assert.ok(front);
  assert.equal(front.category, 'electronics');
  assert.equal(front.footprintH, 2);
  assert.equal(front.backgroundTiles, 1);
  assert.ok(!front.canPlaceOnSurfaces);

  // Rotating four times visits four distinct orientations and comes back.
  const seen = new Set<string>();
  let type = 'VENDING_MACHINE_FRONT_OFF';
  for (let i = 0; i < 4; i++) {
    seen.add(type);
    const next = getRotatedType(type, 'cw');
    assert.ok(next, `rotation ${i} exists`);
    type = next;
  }
  assert.equal(seen.size, 4);
  assert.equal(type, 'VENDING_MACHINE_FRONT_OFF');

  for (const t of seen) {
    const on = getOnStateType(t.replace(':left', ''));
    assert.equal(getAnimationFrames(on)?.length, 3, `${t} lights up with 3 frames`);
  }
});
