/**
 * Unit tests for the fit-to-width view: the whole-number zoom that fits the
 * office's drawn width to the canvas, and the pan that puts the office's
 * middle in the middle of the screen.
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import { fitWidthView, layoutContentBounds } from '../src/office/projection.js';
import { TileType } from '../src/office/types.js';

const V = TileType.VOID;
const F = TileType.FLOOR_1;
const W = TileType.WALL;

function solid(cols: number, rows: number, tile: number = F) {
  return { cols, rows, tiles: new Array<number>(cols * rows).fill(tile) };
}

test('picks the largest whole zoom whose width fits; a full grid stays centred', () => {
  // 20 cols * 16 px = 320 px at 1x; 1000 / 320 = 3.125 → 3
  assert.deepEqual(fitWidthView(1000, solid(20, 10), 1, 10), { zoom: 3, panX: 0, panY: 0 });
  assert.equal(fitWidthView(1280, solid(20, 10), 1, 10).zoom, 4);
});

test('clamps to the zoom range', () => {
  assert.equal(fitWidthView(100, solid(20, 10), 1, 10).zoom, 1);
  assert.equal(fitWidthView(100_000, solid(20, 10), 1, 10).zoom, 10);
});

test('VOID margins are ignored: fits and centres the drawn office', () => {
  // 4x2 grid, content only in cols 0..1 of row 1 (left half, bottom row).
  const layout = { cols: 4, rows: 2, tiles: [V, V, V, V, F, F, V, V] };
  assert.deepEqual(layoutContentBounds(layout), { x: 0, y: 16, w: 32, h: 16 });
  const view = fitWidthView(64, layout, 1, 10); // 64 / 32 → 2x
  assert.equal(view.zoom, 2);
  // Grid centre (32, 16) vs content centre (16, 24) → pan (+16, -8) world px, ×2.
  assert.deepEqual({ x: view.panX, y: view.panY }, { x: 32, y: -16 });
});

test('a wall top row reserves the tile its sprite rises into', () => {
  const layout = { cols: 2, rows: 3, tiles: [V, V, W, W, F, F] };
  assert.deepEqual(layoutContentBounds(layout), { x: 0, y: 0, w: 32, h: 48 });
});

test('an all-VOID layout falls back to the grid', () => {
  assert.equal(layoutContentBounds(solid(4, 4, V)), null);
  assert.deepEqual(fitWidthView(128, solid(4, 4, V), 1, 10), { zoom: 2, panX: 0, panY: 0 });
});

test('the free band moves the vertical target and caps the zoom by height', () => {
  // Width allows 3x (320 px wide); a 500 px band fits 160 px tall only at 3x.
  assert.deepEqual(fitWidthView(1000, solid(20, 10), 1, 10, { height: 500, centerOffsetY: -40 }), {
    zoom: 3,
    panX: 0,
    panY: -40,
  });
  // A 400 px band fits 160 px tall only at 2x, though width allows 3x.
  assert.equal(fitWidthView(1000, solid(20, 10), 1, 10, { height: 400, centerOffsetY: 0 }).zoom, 2);
});
