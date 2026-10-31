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
  assert.deepEqual(fitWidthView({ width: 1000, height: 1000 }, solid(20, 10), 1, 10), {
    zoom: 3,
    panX: 0,
    panY: 0,
  });
  assert.equal(fitWidthView({ width: 1280, height: 1000 }, solid(20, 10), 1, 10).zoom, 4);
});

test('clamps to the zoom range', () => {
  assert.equal(fitWidthView({ width: 100, height: 100 }, solid(20, 10), 1, 10).zoom, 1);
  assert.equal(fitWidthView({ width: 100_000, height: 100_000 }, solid(20, 10), 1, 10).zoom, 10);
});

test('VOID margins are ignored: fits and centres the drawn office', () => {
  // 4x2 grid, content only in cols 0..1 of row 1 (left half, bottom row).
  const layout = { cols: 4, rows: 2, tiles: [V, V, V, V, F, F, V, V] };
  assert.deepEqual(layoutContentBounds(layout), { x: 0, y: 16, w: 32, h: 16 });
  const view = fitWidthView({ width: 64, height: 32 }, layout, 1, 10); // 64 / 32 → 2x
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
  assert.deepEqual(fitWidthView({ width: 128, height: 128 }, solid(4, 4, V), 1, 10), {
    zoom: 2,
    panX: 0,
    panY: 0,
  });
});

// 20x10 office = 320x160 world px.
const office = solid(20, 10);

test('a corner panel the office clears does not lower the zoom', () => {
  // 3x → 960x480 centred in a 1000x600 canvas: x 20..980, y 60..540.
  // A toolbar in the bottom-left corner below the office leaves 3x alone.
  const view = fitWidthView({ width: 1000, height: 600 }, office, 1, 10, {
    top: 0,
    obstacles: [{ x: 10, y: 550, w: 300, h: 40 }],
  });
  assert.deepEqual(view, { zoom: 3, panX: 0, panY: 0 });
});

test('a panel that would cover it moves the office above the panel first', () => {
  // Centred, 3x spans y 60..540 and hits a toolbar at y 520. Above it, the
  // 0..520 band centres it at y 20..500 — clear, so still 3x.
  const view = fitWidthView({ width: 1000, height: 600 }, office, 1, 10, {
    top: 0,
    obstacles: [{ x: 10, y: 520, w: 300, h: 70 }],
  });
  assert.deepEqual(view, { zoom: 3, panX: 0, panY: -40 });
});

test('zoom drops a step only when no placement clears the panels', () => {
  // Top panels end at y 100 and a toolbar starts at y 500: 400 px free, so
  // 3x (480 tall) can't fit; 2x (320 tall) centres in 100..500 → y 140..460.
  const view = fitWidthView({ width: 1000, height: 600 }, office, 1, 10, {
    top: 100,
    obstacles: [{ x: 10, y: 500, w: 300, h: 90 }],
  });
  assert.equal(view.zoom, 2);
  // Below the top panels (100..600) centred = y 190..510, hits the toolbar;
  // above it (100..500) = 300 centre → pan 300 - 300 = 0.
  assert.equal(view.panY, 0);
});
