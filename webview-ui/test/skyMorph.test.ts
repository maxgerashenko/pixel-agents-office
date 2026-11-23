/**
 * A flying task is a plane by day and a satellite by night; over dusk and dawn one turns
 * into the other instead of the two fading separately.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeEach, test } from 'vitest';

import { SKY_TASK_PANEL_COLOR, SKY_TASK_WING_COLOR } from '../src/constants.js';
import {
  drawSkyFlyers,
  resetSkyMotion,
  setSkyNight,
  setSkyTasks,
} from '../src/office/engine/skyTasks.js';

const W = 1100;
const H = 260;
const PX = 3;

/** The fill colours a draw touched, by how many rects each got. */
function fillsAt(night: number): Map<string, number> {
  resetSkyMotion();
  setSkyTasks([{ id: 'a', title: 'a', stage: 'coding' }]);
  setSkyNight(night);
  const seen = new Map<string, number>();
  let style = '';
  const ctx = {
    globalAlpha: 1,
    set fillStyle(v: string) {
      style = v;
    },
    fillRect() {
      seen.set(style, (seen.get(style) ?? 0) + 1);
    },
  } as unknown as CanvasRenderingContext2D;
  drawSkyFlyers(ctx, W, H, PX, 1000);
  return seen;
}

beforeEach(() => {
  resetSkyMotion();
  setSkyNight(0);
});

test('by day the flyer is a plane: wings, no solar panels', () => {
  const seen = fillsAt(0);
  assert.ok((seen.get(SKY_TASK_WING_COLOR) ?? 0) > 0);
  assert.equal(seen.get(SKY_TASK_PANEL_COLOR) ?? 0, 0);
});

test('by night the flyer is a satellite: solar panels, no wings', () => {
  const seen = fillsAt(1);
  assert.ok((seen.get(SKY_TASK_PANEL_COLOR) ?? 0) > 0);
  assert.equal(seen.get(SKY_TASK_WING_COLOR) ?? 0, 0);
});

test('midway through dusk both are on screen, so the plane is turning into the satellite', () => {
  const seen = fillsAt(0.5);
  assert.ok((seen.get(SKY_TASK_WING_COLOR) ?? 0) > 0);
  assert.ok((seen.get(SKY_TASK_PANEL_COLOR) ?? 0) > 0);
});
