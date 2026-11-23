/**
 * Flyers on one orbit keep a minimum gap: take-offs wait for a clear joining point, newcomers are
 * placed in the widest gap, and flyers that end up too close drift apart instead of jumping.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeEach, test } from 'vitest';

import { SKY_TASK_MIN_GAP } from '../src/constants.js';
import {
  minGapU,
  resetSkyMotion,
  separateFlyers,
  setSkyNight,
  setSkyTasks,
  skyMotionKind,
  skyStateForTest,
  type SkyTask,
} from '../src/office/engine/skyTasks.js';

const W = 1100;
const H = 260;
const PX = 3;
const SPAN = W + 16 * PX;
const MIN_PX = SKY_TASK_MIN_GAP * PX;

const t = (id: string, stage: SkyTask['stage']): SkyTask => ({ id, title: id, stage });

beforeEach(() => {
  resetSkyMotion();
  setSkyNight(0);
});

/** The closest two cruising flyers are along the orbit, in canvas pixels (Infinity when fewer than two). */
function closest(ids: string[], sec: number): number {
  const xs = ids
    .filter((id) => {
      const p = skyStateForTest(id, sec, W, H, PX);
      return p && skyMotionKind(id) === 'cruise';
    })
    .map((id) => skyStateForTest(id, sec, W, H, PX)!.x);
  let best = Infinity;
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) {
      const d = Math.abs(xs[i] - xs[j]);
      best = Math.min(best, d, SPAN - d);
    }
  return best;
}

test('separateFlyers pushes two close flyers apart, a little per call', () => {
  const moved = separateFlyers([0.5, 0.52], [false, false], 0.1, 0.01);
  assert.ok(moved[0] < 0 && moved[1] > 0);
  assert.ok(Math.abs(moved[0]) <= 0.01 && Math.abs(moved[1]) <= 0.01);
});

test('separateFlyers leaves flyers that are far enough apart alone', () => {
  assert.deepEqual(separateFlyers([0.1, 0.5], [false, false], 0.1, 0.01), [0, 0]);
});

test('separateFlyers never moves a pinned flyer; its neighbour gives way', () => {
  const moved = separateFlyers([0.5, 0.52], [true, false], 0.1, 0.05);
  assert.equal(moved[0], 0);
  assert.ok(moved[1] > 0);
});

test('separateFlyers works round the seam of the orbit', () => {
  const moved = separateFlyers([0.99, 0.01], [false, false], 0.1, 0.01);
  assert.ok(moved[0] < 0 && moved[1] > 0);
});

test('a crowded orbit shares its length evenly instead of asking for the impossible', () => {
  assert.ok(minGapU(100, SPAN, PX) <= 1 / 100);
  assert.equal(minGapU(2, SPAN, PX), MIN_PX / SPAN);
});

test('flyers that start together on one orbit are spread beyond the minimum gap', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  setSkyTasks(ids.map((id) => t(id, 'coding')));
  assert.ok(closest(ids, 0) >= MIN_PX);
});

test('several take-offs at once never end up closer than the minimum gap', () => {
  const ids = ['a', 'b', 'c', 'd'];
  setSkyTasks(ids.map((id) => t(id, 'plan')));
  skyStateForTest('a', 0, W, H, PX);
  setSkyTasks(ids.map((id) => t(id, 'coding')));
  let worst = Infinity;
  for (let sec = 1; sec < 150; sec += 0.1) {
    for (const id of ids) skyStateForTest(id, sec, W, H, PX);
    worst = Math.min(worst, closest(ids, sec));
  }
  assert.ok(worst >= MIN_PX - 2 * PX, `closest was ${worst}px, wanted ${MIN_PX}px`);
});

test('a take-off waits on the ground while the joining point is taken', () => {
  // one flyer sitting where a plane would join: the newcomer is held back
  setSkyTasks([t('a', 'coding'), t('b', 'plan')]);
  skyStateForTest('a', 0, W, H, PX);
  setSkyTasks([t('a', 'coding'), t('b', 'coding')]);
  let held = false;
  for (let sec = 1; sec < 60; sec += 0.25) {
    const b = skyStateForTest('b', sec, W, H, PX);
    const a = skyStateForTest('a', sec, W, H, PX);
    if (skyMotionKind('b') === 'cruise' && b && a) {
      const d = Math.abs(a.x - b.x);
      assert.ok(Math.min(d, SPAN - d) >= MIN_PX - 2 * PX);
      held = true;
      break;
    }
  }
  assert.ok(held, 'b joined the orbit');
});

test('a task that changes orbit onto an occupied spot drifts clear without jumping', () => {
  setSkyTasks([t('a', 'coding'), t('b', 'review')]);
  skyStateForTest('a', 0, W, H, PX);
  // find the moment b is level with a, then move b to a's orbit
  let sec = 0;
  let level = 0;
  for (; sec < 40; sec += 0.1) {
    const a = skyStateForTest('a', sec, W, H, PX)!;
    const b = skyStateForTest('b', sec, W, H, PX)!;
    if (Math.abs(a.x - b.x) < 2 * PX) level++;
    if (level > 0) break;
  }
  setSkyTasks([t('a', 'coding'), t('b', 'coding')]);
  let prev = skyStateForTest('b', sec, W, H, PX)!.x;
  for (let s = sec + 0.05; s < sec + 60; s += 0.05) {
    skyStateForTest('a', s, W, H, PX);
    const b = skyStateForTest('b', s, W, H, PX)!;
    const d = Math.abs(b.x - prev);
    assert.ok(Math.min(d, SPAN - d) < 3 * PX, 'no jump along the orbit');
    prev = b.x;
  }
  assert.ok(closest(['a', 'b'], sec + 60) >= MIN_PX - 2 * PX);
});

test('the gap holds at night too, where a rocket climbs to the track', () => {
  setSkyNight(1);
  const ids = ['a', 'b', 'c'];
  setSkyTasks(ids.map((id) => t(id, 'plan')));
  skyStateForTest('a', 0, W, H, PX);
  setSkyTasks(ids.map((id) => t(id, 'review')));
  let worst = Infinity;
  for (let sec = 1; sec < 150; sec += 0.1) {
    for (const id of ids) skyStateForTest(id, sec, W, H, PX);
    worst = Math.min(worst, closest(ids, sec));
  }
  assert.ok(worst >= MIN_PX - 2 * PX, `closest was ${worst}px`);
});

test('a lone flyer is never moved', () => {
  assert.deepEqual(separateFlyers([0.3], [false], 0.1, 0.01), [0]);
});

test('two pinned flyers too close stay put rather than moving either', () => {
  assert.deepEqual(separateFlyers([0.5, 0.51], [true, true], 0.1, 0.05), [0, 0]);
});
