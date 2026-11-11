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

import { canPlaceFurniture } from '../src/office/editor/editorActions.js';
import type { OfficeLayout } from '../src/office/types.js';
import { TileType } from '../src/office/types.js';

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

test('stands against a wall like the arcade: top over the wall, body on the floor', async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) });
  const COLS = 12;
  const ROWS = 8;
  // Top row and right column are walls
  const l = {
    version: 1,
    cols: COLS,
    rows: ROWS,
    tiles: Array.from({ length: COLS * ROWS }, (_, i) =>
      i < COLS || i % COLS === COLS - 1 ? TileType.WALL : TileType.FLOOR_1,
    ),
    furniture: [],
  } as OfficeLayout;
  assert.ok(canPlaceFurniture(l, 'VENDING_MACHINE_FRONT_OFF', 6, 0), 'top tile on the top wall');
  assert.ok(canPlaceFurniture(l, 'VENDING_MACHINE_FRONT_OFF', 6, 3), 'free-standing in the room');
  assert.ok(!canPlaceFurniture(l, 'VENDING_MACHINE_FRONT_OFF', COLS - 1, 3), 'body on a wall');
  for (const type of [
    'VENDING_MACHINE_SIDE_OFF',
    'VENDING_MACHINE_SIDE_OFF:left',
    'VENDING_MACHINE_BACK_OFF',
  ]) {
    assert.ok(canPlaceFurniture(l, type, 6, 0), `${type} against the top wall`);
  }
});
