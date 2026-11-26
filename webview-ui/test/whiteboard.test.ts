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
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
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
