/**
 * Airfield in the task sky: plan tasks park on the left, a task moving to an active status
 * takes off and joins its orbit, a ready-to-merge task lands and parks on the right.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeEach, test } from 'vitest';

import { airfieldLayout } from '../src/office/engine/skyAirfield.js';
import {
  drawGroundPlanes,
  orbitOfStage,
  resetSkyMotion,
  setSkyNight,
  setSkyTasks,
  skyLinkAt,
  skyMotionKind,
  skyStateForTest,
  type SkyTask,
} from '../src/office/engine/skyTasks.js';

const W = 1100;
const H = 260;
const PX = 3;
const field = airfieldLayout(W, H, PX);

const task = (stage: SkyTask['stage']): SkyTask => ({ id: 'a', title: 'a', stage });
const at = (sec: number) => skyStateForTest('a', sec, W, H, PX);

beforeEach(() => {
  resetSkyMotion();
  setSkyNight(0);
});

test('only coding and review fly an orbit; plan, tests and ready wait on the ground', () => {
  assert.equal(orbitOfStage('plan'), null);
  assert.equal(orbitOfStage('tests'), null);
  assert.equal(orbitOfStage('coding'), 0);
  assert.equal(orbitOfStage('review'), 1);
  assert.equal(orbitOfStage('ready_to_merge'), null);
});

test('the airfield sits at the right of the sky, left lot before right lot', () => {
  assert.ok(field.left > W / 2);
  assert.ok(field.left + field.width <= W);
  assert.ok(field.lotL < field.runwayL && field.runwayL < field.runwayR);
  assert.ok(field.runwayR < field.lotR);
});

test('a plan task is parked in the left lot, a ready one in the right lot', () => {
  setSkyTasks([task('plan')]);
  const p = at(0);
  assert.equal(p?.mode, 'ground');
  assert.ok(p && p.x < field.runwayL);
  setSkyTasks([{ id: 'a', title: 'a', stage: 'ready_to_merge' }]);
  resetSkyMotion();
  const r = at(0);
  assert.equal(r?.mode, 'ground');
  assert.ok(r && r.x > field.runwayR);
});

test('a plan task moving to coding rolls up the left runway, takes off and cruises', () => {
  setSkyTasks([task('plan')]);
  at(0);
  setSkyTasks([task('coding')]);
  assert.equal(at(10)?.mode, 'ground');
  assert.equal(skyMotionKind('a'), 'takeoff');
  // late in the roll it is on the runway
  const roll = at(10 + 3);
  assert.equal(roll?.mode, 'ground');
  // after the roll it is in the air, then cruising on its orbit
  assert.equal(at(10 + 5.2)?.mode, 'air');
  assert.equal(at(10 + 20)?.mode, 'air');
  assert.equal(skyMotionKind('a'), 'cruise');
});

test('a cruising task that becomes ready lands on the right runway and parks right', () => {
  setSkyTasks([task('review')]);
  at(0);
  assert.equal(skyMotionKind('a'), 'cruise');
  setSkyTasks([{ id: 'a', title: 'a', stage: 'ready_to_merge' }]);
  let sec: number;
  let landed = false;
  for (sec = 0; sec < 120 && !landed; sec += 0.25) {
    at(sec);
    landed = skyMotionKind('a') === 'landing';
  }
  assert.ok(landed, 'it comes down within a lap');
  for (; sec < 160 && skyMotionKind('a') !== 'parked'; sec += 0.25) at(sec);
  assert.equal(skyMotionKind('a'), 'parked');
  const p = at(sec);
  assert.equal(p?.mode, 'ground');
  assert.ok(p && p.x > field.runwayR);
});

test('a coding task that moves to tests lands, taxies across to the left lot and parks there', () => {
  setSkyTasks([task('coding')]);
  at(0);
  setSkyTasks([task('tests')]);
  let sec = 0;
  let landed = false;
  for (; sec < 120 && !landed; sec += 0.25) {
    at(sec);
    landed = skyMotionKind('a') === 'landing';
  }
  assert.ok(landed, 'it comes down within a lap');
  for (; sec < 200 && skyMotionKind('a') !== 'parked'; sec += 0.25) at(sec);
  assert.equal(skyMotionKind('a'), 'parked');
  const p = at(sec);
  assert.equal(p?.mode, 'ground');
  assert.ok(p && p.x < field.runwayL, 'parked in the left lot');
});

test('a tests task moving to review takes off from the left lot', () => {
  setSkyTasks([task('tests')]);
  at(0);
  assert.equal(skyMotionKind('a'), 'parked');
  setSkyTasks([task('review')]);
  at(10);
  assert.equal(skyMotionKind('a'), 'takeoff');
  assert.equal(at(10 + 20)?.mode, 'air');
});

test('a merged task leaves the airfield', () => {
  setSkyTasks([task('plan')]);
  at(0);
  setSkyTasks([{ id: 'a', title: 'a', stage: 'merged' }]);
  assert.equal(at(1), null);
  assert.equal(skyMotionKind('a'), undefined);
});

test('at night a take-off is a rocket: it climbs straight up from the left lot, not down a runway', () => {
  setSkyNight(1);
  setSkyTasks([task('plan')]);
  const pad = at(0);
  setSkyTasks([task('coding')]);
  assert.equal(at(10)?.mode, 'ground');
  // the lights come on, then it lifts off and rises above the pad
  const up = at(10 + 3);
  assert.equal(up?.mode, 'rocket');
  assert.ok(pad && up && Math.abs(up.x - pad.x) < 8 * PX, 'it goes straight up');
  assert.ok(up && pad && up.y < pad.y);
  assert.ok(up && up.x < field.runwayL, 'never over the runway');
  for (let sec = 10; sec < 40; sec += 0.25) at(sec);
  assert.equal(skyMotionKind('a'), 'cruise');
});

test('at night a landing is a rocket coming down onto the right lot', () => {
  setSkyNight(1);
  setSkyTasks([task('review')]);
  at(0);
  setSkyTasks([{ id: 'a', title: 'a', stage: 'ready_to_merge' }]);
  let sec = 0;
  for (; sec < 120 && skyMotionKind('a') !== 'landing'; sec += 0.25) at(sec);
  assert.equal(skyMotionKind('a'), 'landing');
  const down = at(sec + 2);
  assert.equal(down?.mode, 'rocket');
  assert.ok(down && down.x > field.runwayR, 'above the right lot, never on the runway');
  for (; sec < 200 && skyMotionKind('a') !== 'parked'; sec += 0.25) at(sec);
  assert.equal(skyMotionKind('a'), 'parked');
});

test('a ready-to-merge task with a link is a button over its bay, day or night; other tasks are not', () => {
  const calls: unknown[] = [];
  const ctx = new Proxy(
    {},
    { get: () => () => calls.push(0), set: () => true },
  ) as unknown as CanvasRenderingContext2D;
  const url = 'https://github.com/o/r/pull/7';
  for (const night of [0, 1]) {
    resetSkyMotion();
    setSkyNight(night);
    setSkyTasks([{ id: 'a', title: 'a', stage: 'ready_to_merge', url }]);
    const p = at(0);
    assert.ok(p);
    drawGroundPlanes(ctx, W, H, PX, 0);
    assert.equal(skyLinkAt(p.x, p.y), url);
    assert.equal(skyLinkAt(p.x + 5 * PX, p.y + 4 * PX), url);
    assert.equal(skyLinkAt(p.x - 20 * PX, p.y), null);
  }
  // no link, or not ready to merge: nothing to press
  resetSkyMotion();
  setSkyNight(0);
  setSkyTasks([{ id: 'a', title: 'a', stage: 'ready_to_merge' }]);
  const q = at(0);
  drawGroundPlanes(ctx, W, H, PX, 0);
  assert.equal(q && skyLinkAt(q.x, q.y), null);
  setSkyTasks([{ id: 'a', title: 'a', stage: 'tests', url }]);
  resetSkyMotion();
  const t = at(0);
  drawGroundPlanes(ctx, W, H, PX, 0);
  assert.equal(t && skyLinkAt(t.x, t.y), null);
});
