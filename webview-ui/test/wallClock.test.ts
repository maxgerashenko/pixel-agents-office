/**
 * Wall clock: the CLOCK item shows the device's local time (the sky runs on its
 * own hourly loop). The hands are plain sprite-pixel cells.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import path from 'node:path';

import { test } from 'vitest';

import { loadFurnitureAssets } from '../../server/src/assetLoader.js';
import {
  CLOCK_HOUR_HAND_LENGTH,
  CLOCK_MINUTE_HAND_LENGTH,
  CLOCK_PIVOT_COL,
  CLOCK_PIVOT_ROW,
} from '../src/constants.js';
import { clockHands, currentClockTime, setClockTime } from '../src/office/engine/clockHands.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import { layoutToFurnitureInstances } from '../src/office/layout/layoutSerializer.js';

const at = (h: number, m: number, s = 0) => new Date(2026, 10, 23, h, m, s);
const tip = (cells: Array<{ col: number; row: number }>) => cells[cells.length - 1];

test('at 12:00 both hands point straight up from the pivot', () => {
  const { hour, minute } = clockHands(at(12, 0));
  assert.equal(tip(hour).col, CLOCK_PIVOT_COL);
  assert.equal(tip(hour).row, CLOCK_PIVOT_ROW - CLOCK_HOUR_HAND_LENGTH);
  assert.equal(tip(minute).col, CLOCK_PIVOT_COL);
  assert.equal(tip(minute).row, CLOCK_PIVOT_ROW - CLOCK_MINUTE_HAND_LENGTH);
});

test('at 3:00 the hour hand points right and the minute hand up', () => {
  const { hour, minute } = clockHands(at(15, 0));
  assert.equal(tip(hour).row, CLOCK_PIVOT_ROW);
  assert.equal(tip(hour).col, CLOCK_PIVOT_COL + CLOCK_HOUR_HAND_LENGTH);
  assert.equal(tip(minute).col, CLOCK_PIVOT_COL);
});

test('at 6:30 the minute hand points down and the hour hand sits past the 6', () => {
  const { hour, minute } = clockHands(at(6, 30));
  assert.equal(tip(minute).col, CLOCK_PIVOT_COL);
  assert.equal(tip(minute).row, CLOCK_PIVOT_ROW + CLOCK_MINUTE_HAND_LENGTH);
  assert.ok(tip(hour).row > CLOCK_PIVOT_ROW);
});

test('the hands move with the time and the PM hour reads like the AM one', () => {
  assert.notDeepEqual(clockHands(at(9, 15)).minute, clockHands(at(9, 45)).minute);
  assert.deepEqual(clockHands(at(3, 20)), clockHands(at(15, 20)));
});

test('the clock can be pinned and released back to the real time', () => {
  setClockTime(at(4, 0));
  assert.equal(currentClockTime().getHours(), 4);
  setClockTime(null);
  assert.ok(Math.abs(currentClockTime().getTime() - Date.now()) < 1000);
});

test('a placed CLOCK is flagged for hands, other items are not', async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  assert.ok(
    buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) }),
  );
  const other = loaded.catalog.find((e) => e.id !== 'CLOCK' && e.category !== 'wall')?.id;
  assert.ok(other);
  const out = layoutToFurnitureInstances([
    { uid: 'a', type: 'CLOCK', col: 1, row: 1 },
    { uid: 'b', type: other, col: 4, row: 4 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].clock, true);
  assert.equal(out[1].clock, undefined);
});

test('the CLOCK sprite has no hands baked in (only the face and rim)', async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  const sprite = loaded.sprites.get('CLOCK');
  assert.ok(sprite);
  const hand = String.fromCharCode(35) + '73787e';
  assert.ok(!sprite.flat().some((px) => px.toLowerCase().startsWith(hand)));
});
