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
  setSkyBorder,
  setSkyNight,
  setSkyTasks,
} from '../src/office/engine/skyTasks.js';

const W = 1100;
const H = 260;
const PX = 3;
const BAND = 60;

/** The fill colours a draw touched, by how many rects each got. */
function fillsAt(night: number, open?: number): Map<string, number> {
  resetSkyMotion();
  setSkyTasks([{ id: 'a', title: 'a', stage: 'coding' }]);
  setSkyNight(night);
  if (open !== undefined) setSkyBorder({ cx: 0, cy: 0, open, band: BAND });
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

test('a flyer turns when the day/night border passes over it, whatever the clock says', () => {
  // the global night is 0 (day) throughout; only the border decides
  const dayInside = fillsAt(0, 5000);
  assert.ok((dayInside.get(SKY_TASK_WING_COLOR) ?? 0) > 0);
  assert.equal(dayInside.get(SKY_TASK_PANEL_COLOR) ?? 0, 0);

  const nightBeyond = fillsAt(0, -5000);
  assert.ok((nightBeyond.get(SKY_TASK_PANEL_COLOR) ?? 0) > 0);
  assert.equal(nightBeyond.get(SKY_TASK_WING_COLOR) ?? 0, 0);

  // sweeping the border over the flyer, it is caught mid-turn at some point
  let midTurn = false;
  for (let open = 1500; open > -200; open -= 4) {
    const seen = fillsAt(0, open);
    if ((seen.get(SKY_TASK_WING_COLOR) ?? 0) > 0 && (seen.get(SKY_TASK_PANEL_COLOR) ?? 0) > 0) {
      midTurn = true;
    }
  }
  assert.ok(midTurn);
});

test('with no border the flyers follow the whole-sky night', () => {
  setSkyBorder(null);
  assert.ok((fillsAt(1).get(SKY_TASK_PANEL_COLOR) ?? 0) > 0);
});
