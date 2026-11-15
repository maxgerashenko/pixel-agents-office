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
  assert.deepEqual(v, { zoom: 4, panX: 0, panY: 0, steps: 0, maxSteps: 0, minSteps: 0 });
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

test('open space above is kept: zoom steps down until it is left over', () => {
  const canvas = { width: 2266, height: 1488 };
  const space = { top: 0, bottom: 100, bottomMargin: 50 };
  const tall = fitContainView(canvas, solid(20, 11), 1, 10, space);
  const open = fitContainView(canvas, solid(20, 11), 1, 10, { ...space, minOpenTop: 446 });
  assert.ok(open.zoom < tall.zoom);
  const top = canvas.height / 2 + open.panY - (11 * 16 * open.zoom) / 2;
  assert.ok(top >= 446 - 0.5);
});

test('size steps go up from the fit, never past the width or the sky', () => {
  const canvas = { width: 2266, height: 1488 };
  const base = {
    top: 300,
    bottom: 0,
    bottomMargin: 50,
    minOpenTop: 149,
    extraMinOpenTop: 40,
    maxExtraSteps: 4,
  };
  const fit = fitContainView(canvas, solid(20, 11), 1, 10, base);
  assert.equal(fit.zoom, 5);
  assert.equal(fit.steps, 0);
  assert.equal(fit.maxSteps, 1); // 6x leaves the sky its 40px; 7x would not
  const big = fitContainView(canvas, solid(20, 11), 1, 10, { ...base, extraSteps: 9 });
  assert.equal(big.zoom, 6);
  assert.equal(big.steps, 1);
  assert.ok(20 * 16 * big.zoom <= canvas.width);
  const bottomEdge = canvas.height / 2 + big.panY + (11 * 16 * big.zoom) / 2;
  assert.equal(bottomEdge, canvas.height - 50);
  assert.equal(big.panX, 0);
});

test('no steps are offered unless asked for', () => {
  const v = fitContainView({ width: 2266, height: 1488 }, solid(20, 11), 1, 10, {
    top: 0,
    bottom: 0,
  });
  assert.equal(v.maxSteps, 0);
});

test('size steps go below the fit too, never under minZoom', () => {
  const canvas = { width: 2266, height: 1488 };
  const base = {
    top: 0,
    bottom: 0,
    bottomMargin: 50,
    minOpenTop: 149,
    maxExtraSteps: 1,
    maxLessSteps: 5,
  };
  const fit = fitContainView(canvas, solid(20, 11), 1, 10, base);
  assert.equal(fit.minSteps, 5);
  const small = fitContainView(canvas, solid(20, 11), 1, 10, { ...base, extraSteps: -9 });
  assert.equal(small.steps, -5);
  assert.equal(small.zoom, fit.zoom - 5 < 1 ? 1 : fit.zoom - 5);
  const bottomEdge = canvas.height / 2 + small.panY + (11 * 16 * small.zoom) / 2;
  assert.equal(bottomEdge, canvas.height - 50);
  assert.equal(small.panX, 0);
});
