/**
 * Live whiteboard: the count on the board and which tap opens the big view.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import path from 'node:path';

import { beforeAll, test } from 'vitest';

import { loadFurnitureAssets } from '../../server/src/assetLoader.js';
import { isWhiteboard, whiteboardPlates } from '../src/office/engine/whiteboard.js';
import { buildDynamicCatalog, getCatalogEntry } from '../src/office/layout/furnitureCatalog.js';
import type { OfficeLayout } from '../src/office/types.js';
import { TILE_SIZE } from '../src/office/types.js';

beforeAll(async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) });
});

test('a plate sits centred on each whiteboard and carries the count', () => {
  const layout = {
    version: 1,
    cols: 20,
    rows: 11,
    tiles: [],
    furniture: [
      { uid: 'w', type: 'WHITEBOARD', col: 4, row: 0 },
      { uid: 'x', type: 'PLANT', col: 8, row: 3 },
    ],
  } as unknown as OfficeLayout;
  const plates = whiteboardPlates(layout, 3);
  assert.equal(plates.length, 1);
  assert.equal(plates[0].count, 3);
  assert.equal(plates[0].x, 4 * TILE_SIZE + TILE_SIZE);
  assert.equal(plates[0].y, TILE_SIZE);
});

test('only a whiteboard answers the tap', () => {
  assert.equal(isWhiteboard('WHITEBOARD'), true);
  assert.equal(isWhiteboard('DESK_FRONT'), false);
  assert.equal(isWhiteboard(undefined), false);
});

test('the small whiteboard is a 1x1 wall item with the same count and tap', () => {
  const entry = getCatalogEntry('WHITEBOARD_SMALL');
  assert.ok(entry);
  assert.equal(entry.footprintW, 1);
  assert.equal(entry.footprintH, 1);
  assert.equal(entry.canPlaceOnWalls, true);
  assert.equal(isWhiteboard('WHITEBOARD_SMALL'), true);

  const layout = {
    version: 1,
    cols: 20,
    rows: 11,
    tiles: [],
    furniture: [
      { uid: 's', type: 'WHITEBOARD_SMALL', col: 6, row: 1 },
      { uid: 'w', type: 'WHITEBOARD', col: 10, row: 0 },
    ],
  } as unknown as OfficeLayout;
  const [small, big] = whiteboardPlates(layout, 7);
  assert.deepEqual(small, {
    x: 6 * TILE_SIZE + TILE_SIZE / 2,
    y: TILE_SIZE + TILE_SIZE / 2,
    count: 7,
    bare: true,
  });
  assert.equal(big.count, 7);
  assert.equal(big.bare, undefined);

  // two digits are all the small face holds
  const [capped, full] = whiteboardPlates(layout, 140);
  assert.equal(capped.count, 99);
  assert.equal(full.count, 140);
});
