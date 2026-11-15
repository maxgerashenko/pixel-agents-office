/**
 * Unit tests for the view-mode fit: the whole-number zoom at which the whole
 * office fits the band between the top and bottom panels, centred in it.
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

test('without panels it is centred on the canvas', () => {
  const v = fitContainView({ width: 1280, height: 704 }, solid(20, 11), 1, 10);
  assert.deepEqual(v, { zoom: 4, panX: 0, panY: 0 });
});

test('clamps to the zoom range and tolerates an empty band', () => {
  assert.equal(fitContainView({ width: 100, height: 100 }, solid(20, 11), 1, 10).zoom, 1);
  assert.equal(
    fitContainView({ width: 1000, height: 100 }, solid(20, 11), 1, 10, { top: 60, bottom: 60 })
      .zoom,
    1,
  );
});

test('the office sits at the bottom of the band with the margin, centred sideways', () => {
  // 20x11 at zoom 3 (960x528) in 1400x1000: spare width and height.
  const canvas = { width: 1400, height: 1000 };
  const v = fitContainView(canvas, solid(20, 11), 1, 10, { top: 0, bottom: 60, bottomMargin: 16 });
  assert.equal(v.zoom, 4);
  const drawnH = 11 * 16 * v.zoom;
  const bottomEdge = canvas.height / 2 + v.panY + drawnH / 2;
  assert.equal(bottomEdge, canvas.height - 60 - 16);
  assert.equal(v.panX, 0);
});

test('the margin shrinks before the office reaches the top panels', () => {
  const canvas = { width: 1280, height: 764 };
  const v = fitContainView(canvas, solid(20, 11), 1, 10, { top: 60, bottom: 0, bottomMargin: 40 });
  const drawnH = 11 * 16 * v.zoom;
  const top = canvas.height / 2 + v.panY - drawnH / 2;
  assert.ok(top >= 60 - 0.5);
});
