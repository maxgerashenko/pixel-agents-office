/**
 * Mission control furniture: the wall screen with the board's five status counts, and the
 * console desk whose seats are work seats. Loads the real manifests through the real loader.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import path from 'node:path';

import { beforeAll, test } from 'vitest';

import { loadFurnitureAssets } from '../../server/src/assetLoader.js';
import type { IssueBoardCardView } from '../src/office/engine/issueBoard.js';
import {
  digitRects,
  isMissionScreen,
  MISSION_SCREEN_COLUMNS,
  missionCounts,
  missionDigits,
} from '../src/office/engine/missionScreen.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import {
  buildDynamicCatalog,
  getAnimationFrames,
  getCatalogByCategory,
  getCatalogEntry,
  getOnStateType,
} from '../src/office/layout/furnitureCatalog.js';
import { layoutToFurnitureInstances } from '../src/office/layout/layoutSerializer.js';
import type { OfficeLayout } from '../src/office/types.js';
import { TILE_SIZE, TileType } from '../src/office/types.js';

beforeAll(async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) });
});

function card(number: number, status: IssueBoardCardView['status']): IssueBoardCardView {
  return { id: `r#${number}`, number, title: `t${number}`, status, url: '' } as IssueBoardCardView;
}

test('the screen stands on the floor: 9 wide, 1 deep plus a background row, never a work computer', () => {
  const entry = getCatalogEntry('MISSION_SCREEN');
  assert.ok(entry);
  assert.equal(entry.footprintW, 9);
  assert.equal(entry.footprintH - (entry.backgroundTiles ?? 0), 1);
  assert.ok(!entry.canPlaceOnWalls);
  assert.notEqual(entry.category, 'electronics');
  assert.ok(getCatalogByCategory('decor').some((e) => e.type === 'MISSION_SCREEN'));
});

test('counts follow the five columns and ignore every other status', () => {
  assert.deepEqual(
    MISSION_SCREEN_COLUMNS.map((c) => c.label),
    ['DESIGN', 'READY', 'PROGRESS', 'REVIEW', 'DECISION'],
  );
  const cards = [
    card(1, 'needs_design'),
    card(2, 'needs_design'),
    card(3, 'ready'),
    card(4, 'in_progress'),
    card(5, 'in_progress'),
    card(6, 'in_progress'),
    card(7, 'needs_decision'),
    card(8, 'new'),
    card(9, 'blocked'),
    card(10, 'done'),
  ];
  assert.deepEqual(missionCounts(cards), [2, 1, 3, 0, 1]);
  assert.deepEqual(missionCounts([]), [0, 0, 0, 0, 0]);
});

test('a count shows as two digits, capped at 99', () => {
  assert.equal(missionDigits(0), '00');
  assert.equal(missionDigits(7), '07');
  assert.equal(missionDigits(42), '42');
  assert.equal(missionDigits(250), '99');
});

test('seven-segment digits light the right bars and stay inside the digit box', () => {
  assert.equal(digitRects('8').length, 7);
  assert.equal(digitRects('1').length, 2);
  assert.equal(digitRects('0').length, 6);
  for (const d of '0123456789') {
    for (const [x, y, w, h] of digitRects(d)) {
      assert.ok(x >= 0 && y >= 0 && x + w <= 7 && y + h <= 10, `digit ${d}`);
    }
  }
});

test('a placed mission screen is flagged for the renderer; only it answers the tap', () => {
  const instances = layoutToFurnitureInstances([
    { uid: 'm', type: 'MISSION_SCREEN', col: 4, row: 0 },
    { uid: 'w', type: 'WHITEBOARD', col: 14, row: 0 },
  ]);
  assert.deepEqual(
    instances.map((i) => i.missionScreen === true),
    [true, false],
  );
  assert.equal(instances[0].x, 4 * TILE_SIZE);
  assert.equal(isMissionScreen('MISSION_SCREEN'), true);
  assert.equal(isMissionScreen('WHITEBOARD'), false);
  assert.equal(isMissionScreen(undefined), false);
});

test('the desk is 3 wide and 1 deep (plus a background row), in the Tech tab, with 3 lit frames', () => {
  const entry = getCatalogEntry('MISSION_DESK_OFF');
  assert.ok(entry);
  assert.equal(entry.category, 'electronics');
  assert.equal(entry.footprintW, 3);
  assert.equal(entry.footprintH - (entry.backgroundTiles ?? 0), 1);
  assert.ok(getCatalogByCategory('electronics').some((e) => e.type === 'MISSION_DESK_OFF'));
  assert.ok(!getCatalogByCategory('electronics').some((e) => e.type === 'MISSION_DESK_ON_2'));
  const on = getOnStateType('MISSION_DESK_OFF');
  assert.notEqual(on, 'MISSION_DESK_OFF');
  assert.equal(getAnimationFrames(on)?.length, 3);
});

test('a chair facing the desk is a work seat, and the desk lights up when its agent works', () => {
  const cols = 7;
  const rows = 6;
  const layout: OfficeLayout = {
    version: 1,
    cols,
    rows,
    tiles: new Array(cols * rows).fill(TileType.FLOOR_1),
    furniture: [
      { uid: 'desk', type: 'MISSION_DESK_OFF', col: 2, row: 1 },
      { uid: 'chair', type: 'WOODEN_CHAIR_BACK', col: 3, row: 3 },
      { uid: 'far', type: 'WOODEN_CHAIR_FRONT', col: 0, row: 5 },
    ],
  };
  const os = new OfficeState(layout);
  assert.equal(os.isWorkSeat('chair'), true);
  assert.equal(os.isWorkSeat('far'), false);

  os.addAgent(1, undefined, undefined, undefined, true);
  assert.equal(os.characters.get(1)?.seatId, 'chair');
  os.setAgentActive(1, true);
  const drawn = os.furniture.find((f) => f.x === 2 * TILE_SIZE && f.y === TILE_SIZE);
  assert.ok(drawn);
  const lit = ['MISSION_DESK_ON_1', 'MISSION_DESK_ON_2', 'MISSION_DESK_ON_3'].map(
    (t) => getCatalogEntry(t)?.sprite,
  );
  assert.ok(lit.includes(drawn.sprite), 'the desk shows a lit frame');
});
