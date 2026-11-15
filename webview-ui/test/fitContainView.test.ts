/**
 * Unit tests for the view-mode fit: the whole-number zoom at which the whole
 * office fits the band between the top and bottom panels, resting on its bottom.
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fitContainView } from '../src/office/projection.js';
import { TileType } from '../src/office/types.js';

function solid(cols: number, rows: number) {
  return { cols, rows, tiles: new Array<number>(cols * rows).fill(TileType.FLOOR_1) };
}

test('height can be the limit: 20x11 tiles in a short band', () => {
  // 320x176 px at 1x. Width allows 4 (1280/320), height 704/176 = 4 → 4; a
  // shorter band of 600 allows only 3.
  const layout = solid(20, 11);
  assert.equal(fitContainView({ width: 1280, height: 704 }, layout, 1, 10).zoom, 4);
  assert.equal(fitContainView({ width: 1280, height: 600 }, layout, 1, 10).zoom, 3);
});

test('the panels are reserved: the office never reaches into them', () => {
  const layout = solid(20, 11);
  const canvas = { width: 1280, height: 900 };
  const space = { top: 100, bottom: 120 };
  const v = fitContainView(canvas, layout, 1, 10, space);
  const drawnH = 11 * 16 * v.zoom;
  const centreY = canvas.height / 2 + v.panY;
  assert.ok(centreY - drawnH / 2 >= space.top - 0.5);
  assert.ok(centreY + drawnH / 2 <= canvas.height - space.bottom + 0.5);
  assert.equal(v.panX, 0);
});

test('an exact fit is centred on the canvas', () => {
  const v = fitContainView({ width: 1280, height: 704 }, solid(20, 11), 1, 10);
  assert.deepEqual(v, { zoom: 4, panX: 0, panY: 0 });
});

test('spare height goes above: the office rests near the bottom of the band', () => {
  const canvas = { width: 1280, height: 1400 };
  const space = { top: 0, bottom: 100 };
  const v = fitContainView(canvas, solid(20, 11), 1, 10, space);
  const drawnH = 11 * 16 * v.zoom;
  const bottom = canvas.height / 2 + v.panY + drawnH / 2;
  const gap = canvas.height - space.bottom - bottom;
  assert.ok(gap > 0 && gap <= 4 * v.zoom, `gap ${gap}`);
});

test('clamps to the zoom range and tolerates an empty band', () => {
  assert.equal(fitContainView({ width: 100, height: 100 }, solid(20, 11), 1, 10).zoom, 1);
  assert.equal(
    fitContainView({ width: 1000, height: 100 }, solid(20, 11), 1, 10, { top: 60, bottom: 60 })
      .zoom,
    1,
  );
});
