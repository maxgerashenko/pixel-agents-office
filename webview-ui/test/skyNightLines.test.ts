/**
 * The night sky's swirl brushstrokes are hairlines: every stroke pixel is one sprite pixel thick.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import { SKY_STROKE_THICKNESS_SPRITE_PX } from '../src/constants.js';
import { paintNightFrame } from '../src/office/engine/skyDraw.js';

test('night sky strokes are one sprite pixel thick', () => {
  const rects: number[][] = [];
  const ctx = {
    fillStyle: '',
    fillRect: (...a: number[]) => rects.push(a),
  };
  const fakeDocument = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };
  (globalThis as unknown as { document: unknown }).document = fakeDocument;
  try {
    paintNightFrame(80, 60, 0, [{ x: 40, y: 30, r: 20 }], { sw: 80, sh: 60, ox: 0, oy: 0 });
  } finally {
    delete (globalThis as unknown as { document?: unknown }).document;
  }
  assert.equal(SKY_STROKE_THICKNESS_SPRITE_PX, 1);
  const strokes = rects.slice(1); // the first rect is the base fill
  assert.ok(strokes.length > 0);
  for (const [, , w, h] of strokes) {
    assert.equal(w, 1);
    assert.equal(h, 1);
  }
});
