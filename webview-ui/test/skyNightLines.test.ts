/**
 * The night sky's swirl brushstrokes come in two looks a tap on the moon switches between:
 * hairlines (one sprite pixel thick, the default) and the original thick 3x2 blocks.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { afterEach, test } from 'vitest';

import { SKY_STROKE_STYLES } from '../src/constants.js';
import {
  getNightLineStyle,
  paintNightFrame,
  skyMoonAt,
  toggleNightLineStyle,
} from '../src/office/engine/skyDraw.js';

function strokeRects(style?: 'thin' | 'thick'): number[][] {
  const rects: number[][] = [];
  const ctx = { fillStyle: '', fillRect: (...a: number[]) => rects.push(a) };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };
  try {
    paintNightFrame(80, 60, 0, [{ x: 40, y: 30, r: 20 }], { sw: 80, sh: 60, ox: 0, oy: 0 }, style);
  } finally {
    delete (globalThis as unknown as { document?: unknown }).document;
  }
  return rects.slice(1); // the first rect is the base fill
}

afterEach(() => {
  if (getNightLineStyle() !== 'thin') toggleNightLineStyle();
});

test('strokes are one sprite pixel thick by default', () => {
  assert.equal(getNightLineStyle(), 'thin');
  const strokes = strokeRects();
  assert.ok(strokes.length > 0);
  for (const [, , w, h] of strokes) {
    assert.equal(w, 1);
    assert.equal(h, 1);
  }
});

test('the thick look is the original 3x2 blocks', () => {
  assert.deepEqual(SKY_STROKE_STYLES.thick, { w: 3, h: 2, step: 2 });
  const strokes = strokeRects('thick');
  assert.ok(strokes.length > 0);
  for (const [, , w, h] of strokes) {
    assert.equal(w, 3);
    assert.equal(h, 2);
  }
});

test('toggling switches between the two looks', () => {
  assert.equal(toggleNightLineStyle(), 'thick');
  assert.equal(getNightLineStyle(), 'thick');
  assert.equal(toggleNightLineStyle(), 'thin');
});

test('no moon is hit before one has been drawn', () => {
  assert.equal(skyMoonAt(100, 100), false);
});
