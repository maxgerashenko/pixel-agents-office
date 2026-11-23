/**
 * A merged pull request is celebrated at the sky button: a rocket and module for the ISS by night,
 * a plane and parachute for the balloon by day.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { afterEach, test } from 'vitest';

import { SKY_MERGE_DAY, SKY_MERGE_NIGHT } from '../src/constants.js';
import {
  celebrationSec,
  dayFrame,
  moduleDocked,
  nightFrame,
} from '../src/office/engine/mergeCelebration.js';
import { onSkyMerge } from '../src/office/engine/mergeCelebrationEvents.js';
import { resetSkyMotion, setSkyTasks } from '../src/office/engine/skyTasks.js';

const REACH = { left: 200, right: 12 };
const STEP = 0.02;
const times = (kind: 'day' | 'night'): number[] =>
  Array.from({ length: Math.round(celebrationSec(kind) / STEP) + 1 }, (_, i) => i * STEP);

afterEach(() => {
  setSkyTasks([]);
  resetSkyMotion();
});

test('night: the rocket climbs past the ISS and leaves, the module docks and goes', () => {
  const N = SKY_MERGE_NIGHT;
  assert.ok((nightFrame(0).rocket?.y ?? 0) > 40, 'starts far below');
  assert.equal(nightFrame(N.releaseAt).module?.x, N.rocketX, 'the module leaves from the rocket');
  assert.equal(nightFrame(N.rocketEnd + 0.1).rocket, null, 'the rocket has gone');
  const docked = nightFrame(N.releaseAt + N.approachSec + N.dockSec + 0.1);
  assert.ok(moduleDocked(N.releaseAt + N.approachSec + N.dockSec + 0.1));
  assert.deepEqual([docked.module?.x, docked.module?.y], [0, N.dockY]);
  assert.equal(nightFrame(celebrationSec('night')).module, null, 'the module disappears');
});

test('night: panels fold, open again, and the ISS blinks exactly twice', () => {
  const N = SKY_MERGE_NIGHT;
  const frames = times('night').map((t) => nightFrame(t));
  assert.equal(frames[0].fold, 1);
  assert.ok(Math.abs(Math.min(...frames.map((f) => f.fold)) - N.foldMin) < 1e-9);
  assert.equal(frames[frames.length - 1].fold, 1, 'ends unfolded');
  let blinks = 0;
  frames.forEach((f, i) => {
    if (f.flash > 0.5 && (i === 0 || frames[i - 1].flash <= 0.5)) blinks++;
  });
  assert.equal(blinks, 2);
});

test('day: the plane enters from the left, drops the packet and leaves past the right border', () => {
  const D = SKY_MERGE_DAY;
  const start = dayFrame(0, REACH).plane;
  assert.ok(start && start.x < -REACH.left, 'starts off screen');
  assert.equal(dayFrame(D.dropAt - 0.001, REACH).chute, null, 'nothing falls before the drop');
  assert.equal(dayFrame(D.dropAt, REACH).chute?.x, D.dropX);
  assert.equal(dayFrame(D.exitAt, REACH).plane, null, 'the plane is gone');
  const xs = times('day').flatMap((t) => dayFrame(t, REACH).plane?.x ?? []);
  assert.ok(Math.max(...xs) > REACH.right, 'it left through the right border');
});

test('day: the parachute settles into the basket, then the flame, then two full turns', () => {
  const D = SKY_MERGE_DAY;
  const last = dayFrame(D.dropAt + D.chuteSec - 0.02, REACH).chute;
  assert.ok(last && Math.abs(last.x) <= 1 && last.y >= D.basketY - 1);
  assert.equal(dayFrame(D.dropAt + D.chuteSec + 0.01, REACH).chute, null, 'the packet is inside');
  assert.equal(dayFrame(D.flames[0][0] + 0.1, REACH).flame, 1);
  assert.equal(dayFrame(D.flames[0][1] + 0.1, REACH).flame, 0);
  const end = dayFrame(celebrationSec('day'), REACH);
  assert.ok(Math.abs(end.spin - 4 * Math.PI) < 1e-9, 'turned twice');
  assert.equal(end.lift, 0);
  assert.equal(dayFrame(0, REACH).spin, 0);
});

test('a task that arrives merged after being in the sky announces a merge, once', () => {
  let seen = 0;
  const off = onSkyMerge((n) => (seen += n));
  setSkyTasks([{ id: 'a', title: 'a', stage: 'merged' }]);
  assert.equal(seen, 0, 'a merged task the sky never knew is not celebrated');
  setSkyTasks([
    { id: 'a', title: 'a', stage: 'review' },
    { id: 'b', title: 'b', stage: 'ready_to_merge' },
  ]);
  setSkyTasks([
    { id: 'a', title: 'a', stage: 'merged' },
    { id: 'b', title: 'b', stage: 'ready_to_merge' },
  ]);
  assert.equal(seen, 1);
  setSkyTasks([
    { id: 'a', title: 'a', stage: 'merged' },
    { id: 'b', title: 'b', stage: 'ready_to_merge' },
  ]);
  assert.equal(seen, 1, 'a repeat of the board is not a second merge');
  off();
});
