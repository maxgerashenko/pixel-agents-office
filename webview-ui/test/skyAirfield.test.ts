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
  orbitOfStage,
  resetSkyMotion,
  setSkyTasks,
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

beforeEach(() => resetSkyMotion());

test('only coding, tests and review fly an orbit', () => {
  assert.equal(orbitOfStage('plan'), null);
  assert.equal(orbitOfStage('coding'), 0);
  assert.equal(orbitOfStage('review'), 2);
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

test('a merged task leaves the airfield', () => {
  setSkyTasks([task('plan')]);
  at(0);
  setSkyTasks([{ id: 'a', title: 'a', stage: 'merged' }]);
  assert.equal(at(1), null);
  assert.equal(skyMotionKind('a'), undefined);
});
