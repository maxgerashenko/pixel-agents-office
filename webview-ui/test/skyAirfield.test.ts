/**
 * Airfield in the task sky: plan tasks park on the left, a task moving to an active status
 * takes off and joins its orbit, a ready-to-merge task lands and parks on the right (green siren, no technician),
 * and every parked task carries its pull request number.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeEach, test } from 'vitest';

import { SKY_BEACON_COLORS, SKY_TECH_VEST_COLOR } from '../src/constants.js';
import {
  airfieldLayout,
  prNumberOfTaskId,
  setAirfieldSite,
  slotPoint,
} from '../src/office/engine/skyAirfield.js';
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

test('a plan with a link is a button over its bay too', () => {
  const ctx = new Proxy(
    {},
    { get: () => () => 0, set: () => true },
  ) as unknown as CanvasRenderingContext2D;
  const url = 'https://github.com/o/r/pull/7/files';
  resetSkyMotion();
  setSkyNight(0);
  setSkyTasks([{ id: 'a', title: 'a', stage: 'plan', url }]);
  const p = at(0);
  assert.ok(p);
  drawGroundPlanes(ctx, W, H, PX, 0);
  assert.equal(skyLinkAt(p.x, p.y), url);
});

test('beside a full-size office the field narrows to a strip, a tiny gap off the office, parking on the right', () => {
  const office = { x: 100, y: 200, w: 1000, h: 400 };
  // 173px gap at 6px per sprite pixel: too narrow for the full field, wide enough for a strip
  const w = office.x + office.w + 173;
  setAirfieldSite({ h: 700, office });
  try {
    const f = airfieldLayout(w, 150, 6);
    assert.equal(f.strip, true);
    assert.ok(f.left > office.x + office.w && f.left - (office.x + office.w) <= 3 * 6);
    assert.ok(f.left + f.width <= w);
    assert.ok(f.runwayL === f.runwayR && f.runwayL < f.lotL);
    // plan bays above, ready bays below, in the one lot
    const [, planY] = slotPoint(f, 'plan', 0);
    const [, readyY] = slotPoint(f, 'ready', 0);
    assert.ok(readyY > planY);
    // a wide gap keeps the full field; none at all puts it on the skyline
    setAirfieldSite({ h: 700, office: { ...office, w: 600 } });
    assert.equal(airfieldLayout(w, 150, 6).strip, false);
  } finally {
    setAirfieldSite(null);
  }
});

// ── Ready to merge: a green siren, never a technician ──────────────────────

const GREEN_SIREN: string = SKY_BEACON_COLORS.ready_to_merge.dome;
const TECH_VEST: string = SKY_TECH_VEST_COLOR;

/** Draws the ground and returns every fill colour used by a rect inside the parked task's bay. */
function coloursAroundBay(w: number, h: number, px: number, sec: number): Set<string> {
  const p = skyStateForTest('a', sec, w, h, px);
  assert.ok(p);
  const used = new Set<string>();
  let style = '';
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) =>
        key === 'fillRect'
          ? (x: number, y: number) => {
              if (Math.abs(x - p.x) <= 12 * px && Math.abs(y - p.y) <= 8 * px) used.add(style);
            }
          : () => undefined,
      set: (_t, key, value) => {
        if (key === 'fillStyle') style = String(value);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  drawGroundPlanes(ctx, w, h, px, sec);
  return used;
}

function assertReadyCrew(w: number, h: number, px: number, sec: number): void {
  const used = colours(w, h, px, sec);
  assert.ok(used.has(GREEN_SIREN), 'the green siren is on');
  assert.ok(!used.has(TECH_VEST), 'no technician');
}
const colours = coloursAroundBay;

test('a parked ready-to-merge plane or rocket has the green siren and no technician, at every hour', () => {
  for (const night of [0, 0.3, 0.5, 0.8, 1]) {
    resetSkyMotion();
    setSkyNight(night);
    setSkyTasks([{ id: 'a', title: 'a', stage: 'ready_to_merge' }]);
    assertReadyCrew(W, H, PX, 0);
    assertReadyCrew(W, H, PX, 0.4);
  }
});

test('a task that lands, or moves into ready to merge from tests or plan, is crewed by the siren alone', () => {
  for (const from of ['plan', 'tests', 'review'] as const) {
    resetSkyMotion();
    setSkyNight(0);
    setSkyTasks([task(from)]);
    at(0);
    setSkyTasks([task('ready_to_merge')]);
    let sec = 0;
    for (; sec < 300 && skyMotionKind('a') !== 'parked'; sec += 0.25) at(sec);
    assert.equal(skyMotionKind('a'), 'parked', from);
    assertReadyCrew(W, H, PX, sec);
    assertReadyCrew(W, H, PX, sec + 3);
  }
});

test('the strip beside the office crews a ready-to-merge plane the same way', () => {
  const office = { x: 100, y: 200, w: 1000, h: 400 };
  const w = office.x + office.w + 173;
  setAirfieldSite({ h: 700, office });
  try {
    for (const night of [0, 0.5, 1]) {
      resetSkyMotion();
      setSkyNight(night);
      setSkyTasks([task('ready_to_merge')]);
      assertReadyCrew(w, 150, 6, 0);
    }
  } finally {
    setAirfieldSite(null);
  }
});

test('every parked plane or rocket is labelled with its pull request number', () => {
  assert.equal(prNumberOfTaskId('airfield-x#96'), 96);
  assert.equal(prNumberOfTaskId('no-number'), null);
  for (const night of [0, 1]) {
    resetSkyMotion();
    setSkyNight(night);
    const texts: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) => (key === 'fillText' ? (t: string) => texts.push(t) : () => undefined),
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    setSkyTasks([
      { id: 'a#7', title: 'a', stage: 'ready_to_merge' },
      { id: 'b#8', title: 'b', stage: 'plan' },
    ]);
    drawGroundPlanes(ctx, W, H, PX, 0);
    assert.ok(texts.includes('#7') && texts.includes('#8'), texts.join());
  }
});

test('the ready-to-merge number stands outside the field edge beside its plane, when there is room', () => {
  const office = { x: 100, y: 200, w: 1000, h: 400 };
  const w = office.x + office.w + 173 + 120;
  setAirfieldSite({ h: 700, office });
  try {
    const f = airfieldLayout(w, 150, 6);
    resetSkyMotion();
    setSkyNight(0);
    setSkyTasks([{ id: 'a#5', title: 'a', stage: 'ready_to_merge' }]);
    const p = skyStateForTest('a#5', 0, w, 150, 6);
    assert.ok(p);
    const seen: { t: string; x: number; y: number; align: string }[] = [];
    let align = '';
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) =>
          key === 'fillText'
            ? (t: string, x: number, y: number) => seen.push({ t, x, y, align })
            : () => undefined,
        set: (_t, key, value) => {
          if (key === 'textAlign') align = String(value);
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    drawGroundPlanes(ctx, w, 150, 6, 0);
    const label = seen.filter((s) => s.t === '#5').pop(); // the last draw is the text, the first its shadow
    assert.ok(label);
    assert.equal(label.align, 'left');
    assert.ok(label.x >= f.left + f.width, 'past the field edge');
    assert.equal(label.y, p.y, 'level with the plane');
  } finally {
    setAirfieldSite(null);
  }
});

test('a plan or tests number stands outside the field edge on the left, level with its plane', () => {
  for (const stage of ['plan', 'tests'] as const) {
    resetSkyMotion();
    setSkyNight(0);
    setSkyTasks([{ id: 'a#6', title: 'a', stage }]);
    const p = skyStateForTest('a#6', 0, W, H, PX);
    assert.ok(p);
    const seen: { t: string; x: number; y: number; align: string }[] = [];
    let align = '';
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) =>
          key === 'fillText'
            ? (t: string, x: number, y: number) => seen.push({ t, x, y, align })
            : () => undefined,
        set: (_t, key, value) => {
          if (key === 'textAlign') align = String(value);
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    drawGroundPlanes(ctx, W, H, PX, 0);
    const label = seen.filter((s) => s.t === '#6').pop();
    assert.ok(label, stage);
    assert.equal(label.align, 'right');
    assert.ok(label.x <= field.left, 'left of the field edge');
  }
});
