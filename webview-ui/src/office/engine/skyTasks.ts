/**
 * Tasks in the sky. The server sends the board (one entry per branch + PR);
 * by day each flying task is a plane with a white contrail, by night a satellite with
 * blinking lights. The airfield at the right (skyAirfield) is where a task waits: plan and tests
 * tasks park in the left lot (a technician at work; tests has an amber beacon, plan none), ready-to-merge
 * tasks in the right lot (green beacons). A task that moves to an active status (coding,
 * review) taxis to the left runway, takes off and joins its orbit; orbits arc across the whole
 * sky from left to right, the same arc shifted up one gap each, and the orbit is the status,
 * low to high. A task that moves to tests or ready to merge stays on its orbit until it comes
 * round to the airfield, glides down onto the right runway, lands and parks (tests taxies on
 * across to the left lot). A merged task leaves the sky (with a celebration at the sky button). Tasks on one orbit are spread round it with a gap
 * between them, and never closer than SKY_TASK_MIN_GAP: a take-off waits for a clear joining point, a newcomer
 * is placed in the widest gap, and flyers that still end up too close drift apart slowly. The trail is a white line (solid by day, dashed by night).
 */
import {
  SKY_AIRFIELD_CLEARANCE,
  SKY_AIRFIELD_CLIMB_DX,
  SKY_AIRFIELD_CLIMB_SEC,
  SKY_AIRFIELD_FADE_FROM,
  SKY_AIRFIELD_FOLD_FROM,
  SKY_AIRFIELD_GLIDE_DX,
  SKY_AIRFIELD_GLIDE_SEC,
  SKY_AIRFIELD_LANDING_CROSS_SEC,
  SKY_AIRFIELD_LANDING_ROLL_SEC,
  SKY_AIRFIELD_LANDING_TAXI_SEC,
  SKY_AIRFIELD_LIFT_BLEND,
  SKY_AIRFIELD_LOT_W,
  SKY_AIRFIELD_SLOT_PITCH,
  SKY_AIRFIELD_TAKEOFF_ROLL_SEC,
  SKY_AIRFIELD_TAKEOFF_TAXI_SEC,
  SKY_ROCKET_DESCENT_SEC,
  SKY_ROCKET_FADE_FROM,
  SKY_ROCKET_FAR_SCALE,
  SKY_ROCKET_HOLD_SEC,
  SKY_ROCKET_NIGHT_MIN,
  SKY_ROCKET_PITCH_FROM,
  SKY_ROCKET_RISE_SEC,
  SKY_ROCKET_SETTLE_SEC,
  SKY_ROCKET_TRACK_DX,
  SKY_TASK_BLINK_ALT,
  SKY_TASK_BLINK_ON,
  SKY_TASK_BLINK_SEC,
  SKY_TASK_COLORS,
  SKY_TASK_CROSS_SEC_FASTEST,
  SKY_TASK_CROSS_SEC_SLOWEST,
  SKY_TASK_FLYING_STAGES,
  SKY_TASK_GROUND,
  SKY_TASK_JOIN_STEP_SEC,
  SKY_TASK_MIN_GAP,
  SKY_TASK_NUDGE_PX_PER_SEC,
  SKY_TASK_PANEL_COLOR,
  SKY_TASK_PLANE_SCALE,
  SKY_TASK_PLANE_TRAIL_GAP,
  SKY_TASK_RISE,
  SKY_TASK_SAT_TRAIL_GAP,
  SKY_TASK_STAGES,
  SKY_TASK_TRACK_GAP,
  SKY_TASK_TRACKS,
  SKY_TASK_TRAIL_COLOR,
  SKY_TASK_WING_COLOR,
} from '../../constants.js';
import { announceSkyMerge } from './mergeCelebrationEvents.js';
import {
  type Airfield,
  airfieldLayout,
  type AirfieldLot,
  drawGroundCrew,
  drawGroundPlane,
  drawRocket,
  drawTurningPlane,
  type Heading,
  PLANE_TOP_LENGTH,
  slotPoint,
} from './skyAirfield.js';

export type SkyTaskStage = (typeof SKY_TASK_STAGES)[number];
export interface SkyTask {
  id: string;
  title: string;
  stage: SkyTaskStage;
  /** The pull request's web page (ready to merge: a tap on its plane opens it; a plan: its files, the documents). */
  url?: string;
}

/** Merged tasks have left the sky, so only the rest are kept. */
let tasks: SkyTask[] = [];

export function setSkyTasks(next: SkyTask[]): void {
  // a task that was in the sky and now arrives merged has just merged: celebrate it at the sky button
  const known = new Set(tasks.map((t) => t.id));
  const justMerged = next.filter((t) => t.stage === 'merged' && known.has(t.id)).length;
  tasks = next.filter((t) => t.stage !== 'merged');
  announceSkyMerge(justMerged);
}
export function getSkyTasks(): SkyTask[] {
  return tasks;
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export interface FlyerPose {
  x: number;
  y: number;
  alpha: number;
  stageIndex: number;
  /** Climb (+) or dive (-), as rise per run, for tilting the sprite. */
  slope: number;
  /** The arc as a function of progress 0..1, in canvas pixels. */
  at: (u: number) => [number, number];
}

export interface TaskPlace {
  /** 0 = lowest orbit. */
  orbit: number;
  /** Where on the orbit it starts, 0..1. */
  phase: number;
}

/** The orbit a status flies on (coding, review), or null when the task waits on the airfield. */
export function orbitOfStage(stage: SkyTaskStage): number | null {
  const i = (SKY_TASK_FLYING_STAGES as readonly SkyTaskStage[]).indexOf(stage);
  return i >= 0 ? i : null;
}

/** The lot a waiting status parks in: plan and tests in the left lot, ready to merge in the right one. */
export function lotOfStage(stage: SkyTaskStage): AirfieldLot | null {
  if (stage === 'plan' || stage === 'tests') return 'plan';
  return stage === 'ready_to_merge' ? 'ready' : null;
}

/**
 * Pure: the orbit of each flying task, low to high by status (coding, tests, review), and its place on
 * it: tasks on one orbit are spread evenly round it, so there is always a gap. Tasks resting on the
 * airfield get orbit 0 and are not counted.
 */
export function placeTasks(list: SkyTask[]): TaskPlace[] {
  const byOrbit = new Map<number, number[]>();
  list.forEach((t, i) => {
    const o = orbitOfStage(t.stage);
    if (o !== null) byOrbit.set(o, [...(byOrbit.get(o) ?? []), i]);
  });
  const out: TaskPlace[] = list.map(() => ({ orbit: 0, phase: 0 }));
  for (const [orbit, members] of byOrbit) {
    members
      .sort((a, b) => (list[a].id < list[b].id ? -1 : 1))
      .forEach((i, k) => {
        out[i] = { orbit, phase: (k / members.length + orbit * 0.17) % 1 };
      });
  }
  return out;
}

const mod1 = (v: number): number => ((v % 1) + 1) % 1;
const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Shortest distance round the orbit between two progress values, 0..0.5. */
const circ = (a: number, b: number): number => {
  const d = mod1(a - b);
  return Math.min(d, 1 - d);
};

/** Progress gap that flyers keep: the minimum in pixels, or an even share when the orbit is crowded. */
export function minGapU(count: number, span: number, px: number): number {
  const even = count > 0 ? 0.95 / count : 1;
  return Math.min((SKY_TASK_MIN_GAP * px) / span, even);
}

/**
 * Pure: pushes flyers (progress values round an orbit) apart where closer than `gap`, moving each at
 * most `step` this call. A pinned flyer never moves, its neighbours give way instead. Returns the
 * progress change of each.
 */
export function separateFlyers(
  us: number[],
  pinned: boolean[],
  gap: number,
  step: number,
): number[] {
  const n = us.length;
  const moved = us.map(() => 0);
  if (n < 2) return moved;
  const order = us.map((_, i) => i).sort((a, b) => us[a] - us[b]);
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const j = order[(k + 1) % n];
    const d = mod1(us[j] + moved[j] - (us[i] + moved[i]));
    if (d >= gap) continue;
    const deficit = gap - d;
    const roomI = pinned[i] ? 0 : step + moved[i];
    const roomJ = pinned[j] ? 0 : step - moved[j];
    if (roomI <= 0 && roomJ <= 0) continue;
    const half = deficit / 2;
    let backI = Math.min(roomI, pinned[j] ? deficit : half);
    let fwdJ = Math.min(roomJ, pinned[i] ? deficit : half);
    // one side out of room: the other takes the rest, still within its own room
    if (backI < half) fwdJ = Math.min(roomJ, deficit - backI);
    else if (fwdJ < half) backI = Math.min(roomI, deficit - fwdJ);
    moved[i] -= Math.max(0, backI);
    moved[j] += Math.max(0, fwdJ);
  }
  return moved;
}

/** Seconds a flyer takes to go once round the given orbit; the higher the orbit the faster. */
export function orbitCrossSec(orbit: number): number {
  const speed = orbit / (SKY_TASK_TRACKS - 1);
  return (
    SKY_TASK_CROSS_SEC_SLOWEST + (SKY_TASK_CROSS_SEC_FASTEST - SKY_TASK_CROSS_SEC_SLOWEST) * speed
  );
}

/**
 * Pure: an orbit as a function of progress 0..1, in canvas pixels. Every orbit is the same arc
 * shifted up by one track gap, so the tracks run parallel; over the airfield each lifts above it.
 */
export function orbitArc(
  orbit: number,
  w: number,
  horizonY: number,
  px: number,
  field?: Airfield,
  snap = true,
): (k: number) => [number, number] {
  const ground = horizonY * (SKY_TASK_GROUND - orbit * SKY_TASK_TRACK_GAP);
  const rise = horizonY * SKY_TASK_RISE;
  const span = w + 16 * px;
  const lift = field
    ? field.top - SKY_AIRFIELD_CLEARANCE * px - orbit * horizonY * SKY_TASK_TRACK_GAP
    : 0;
  const blend = SKY_AIRFIELD_LIFT_BLEND * px;
  return (k: number): [number, number] => {
    const x = -8 * px + k * span;
    let y = ground - rise * Math.sin(Math.PI * k);
    if (field) {
      const wgt = smooth((x - (field.left - blend)) / blend);
      y = y * (1 - wgt) + Math.min(y, lift) * wgt;
    }
    return snap ? [Math.round(x / px) * px, Math.round(y / px) * px] : [x, y];
  };
}

/** Pure: where a task's flyer is at `sec`, and the arc it follows (canvas pixels). */
export function flyerPose(
  task: SkyTask,
  sec: number,
  w: number,
  horizonY: number,
  px: number,
  place: TaskPlace,
  field?: Airfield,
): FlyerPose {
  const si = Math.max(0, SKY_TASK_STAGES.indexOf(task.stage));
  const u = mod1(sec / orbitCrossSec(place.orbit) + place.phase);
  const at = orbitArc(place.orbit, w, horizonY, px, field);
  const [x, y] = at(u);
  return {
    x,
    y,
    alpha: task.stage === 'merged' ? 1 - u * u : 1,
    stageIndex: si,
    // the tilt comes from the exact curve: off the pixel-snapped one it flickers between steps
    slope: slopeAt(orbitArc(place.orbit, w, horizonY, px, field, false), u),
    at,
  };
}

/** Climb (+) or dive (-) of an arc at progress `u`, for tilting a sprite. */
function slopeAt(at: (k: number) => [number, number], u: number): number {
  const d = 0.02;
  const [x0, y0] = at(Math.max(0, u - d));
  const [x1, y1] = at(Math.min(1, u + d));
  if (x1 === x0) return 0;
  return Math.max(-0.5, Math.min(0.5, -(y1 - y0) / (x1 - x0)));
}

// ── What each task is doing: parked, taking off, cruising, landing ─────────

type Motion =
  | { kind: 'parked'; lot: AirfieldLot; slot: number }
  | { kind: 'takeoff'; t0: number; slot: number; orbit: number; rocket: boolean }
  | {
      kind: 'cruise';
      orbit: number;
      phase: number;
      landAt?: number;
      landRocket?: boolean;
      landLot?: AirfieldLot;
    }
  | { kind: 'landing'; t0: number; slot: number; orbit: number; rocket: boolean; lot: AirfieldLot };

export type SkyMotionKind = Motion['kind'];

const motions = new Map<string, Motion>();
/** When the motions were last brought up to date, so a nudge is scaled by elapsed time. */
let lastSyncSec: number | null = null;

export function skyMotionKind(id: string): SkyMotionKind | undefined {
  return motions.get(id)?.kind;
}
export function resetSkyMotion(): void {
  motions.clear();
  lastSyncSec = null;
}

interface Geo {
  w: number;
  horizonY: number;
  px: number;
  field: Airfield;
  span: number;
}
function geoOf(w: number, horizonY: number, px: number): Geo {
  return { w, horizonY, px, field: airfieldLayout(w, horizonY, px), span: w + 16 * px };
}

interface Leg {
  x: number;
  y: number;
  dur: number;
  ease: 'lin' | 'in' | 'out';
}
interface Ground {
  x: number;
  y: number;
  heading: Heading;
}
const EASE = {
  lin: (s: number): number => s,
  in: (s: number): number => s * s,
  out: (s: number): number => 1 - (1 - s) * (1 - s),
};

/** Walks `legs` from `start`; the plane heads along each leg. Axis-aligned legs only. */
function followLegs(start: [number, number], legs: Leg[], dt: number, px: number): Ground {
  let [x, y] = start;
  let heading: Heading = 'up';
  let t = dt;
  for (const leg of legs) {
    const dx = leg.x - x;
    const dy = leg.y - y;
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) heading = dx > 0 ? 'right' : 'left';
    else if (dy !== 0) heading = dy > 0 ? 'down' : 'up';
    if (t < leg.dur) {
      const e = EASE[leg.ease](Math.max(0, t) / leg.dur);
      return {
        x: Math.round((x + dx * e) / px) * px,
        y: Math.round((y + dy * e) / px) * px,
        heading,
      };
    }
    t -= leg.dur;
    x = leg.x;
    y = leg.y;
  }
  return { x, y, heading };
}

const sum = (legs: Leg[]): number => legs.reduce((a, l) => a + l.dur, 0);

/** Park -> side taxi column -> down to the taxiway -> along it to the runway -> up the runway. */
function takeoffLegs(f: Airfield, slot: number): { start: [number, number]; legs: Leg[] } {
  const start = slotPoint(f, 'plan', slot);
  const [a, b, c] = SKY_AIRFIELD_TAKEOFF_TAXI_SEC;
  return {
    start,
    legs: [
      { x: f.gapL, y: start[1], dur: a, ease: 'lin' },
      { x: f.gapL, y: f.taxiY, dur: b, ease: 'lin' },
      { x: f.runwayL, y: f.taxiY, dur: c, ease: 'lin' },
      { x: f.runwayL, y: f.runwayTop, dur: SKY_AIRFIELD_TAKEOFF_ROLL_SEC, ease: 'in' },
    ],
  };
}

/**
 * Down the landing runway -> along the taxiway -> up the side taxi column -> into the bay. The
 * right lot is the next column over; the left lot (tests) is the whole width of the field away.
 */
function landingLegs(
  f: Airfield,
  slot: number,
  lot: AirfieldLot,
): { start: [number, number]; legs: Leg[] } {
  const target = slotPoint(f, lot, slot);
  const [a, b, c] = SKY_AIRFIELD_LANDING_TAXI_SEC;
  const gap = lot === 'ready' ? f.gapR : f.gapL;
  return {
    start: [f.runwayR, f.runwayTop],
    legs: [
      { x: f.runwayR, y: f.taxiY, dur: SKY_AIRFIELD_LANDING_ROLL_SEC, ease: 'out' },
      {
        x: gap,
        y: f.taxiY,
        dur: lot === 'ready' ? a : SKY_AIRFIELD_LANDING_CROSS_SEC,
        ease: 'lin',
      },
      { x: gap, y: target[1], dur: b, ease: 'lin' },
      { x: target[0], y: target[1], dur: c, ease: 'lin' },
    ],
  };
}

/** 0..1: how dark the sky is now. A flight that starts at night is a rocket's. */
let night = 0;
export function setSkyNight(next: number): void {
  night = next;
}
const isNight = (): boolean => night >= SKY_ROCKET_NIGHT_MIN;

const takeoffSec = (g: Geo, m: { slot: number; rocket: boolean }): number =>
  m.rocket
    ? SKY_ROCKET_HOLD_SEC + SKY_ROCKET_RISE_SEC
    : sum(takeoffLegs(g.field, m.slot).legs) + SKY_AIRFIELD_CLIMB_SEC;
const landingSec = (g: Geo, m: { slot: number; rocket: boolean; lot: AirfieldLot }): number =>
  m.rocket
    ? SKY_ROCKET_DESCENT_SEC + SKY_ROCKET_SETTLE_SEC
    : SKY_AIRFIELD_GLIDE_SEC + sum(landingLegs(g.field, m.slot, m.lot).legs);

/** Progress along the orbit where the climb ends / the glide starts. */
const uJoin = (g: Geo, rocket: boolean): number =>
  mod1(
    ((rocket
      ? g.field.lotL + SKY_ROCKET_TRACK_DX * g.px
      : g.field.runwayL + SKY_AIRFIELD_CLIMB_DX * g.px) +
      8 * g.px) /
      g.span,
  );
const uGlide = (g: Geo, rocket: boolean, lot: AirfieldLot): number =>
  mod1(
    ((rocket
      ? lot === 'ready'
        ? g.field.lotR - SKY_ROCKET_TRACK_DX * g.px
        : g.field.lotL - SKY_ROCKET_TRACK_DX * g.px
      : g.field.runwayR - SKY_AIRFIELD_GLIDE_DX * g.px) +
      8 * g.px) /
      g.span,
  );

function freeSlot(lot: AirfieldLot, except?: string): number {
  const used = new Set<number>();
  for (const [id, m] of motions) {
    if (id === except) continue;
    if (m.kind === 'parked' && m.lot === lot) used.add(m.slot);
    if (m.kind === 'landing' && m.lot === lot) used.add(m.slot);
  }
  let s = 0;
  while (used.has(s)) s++;
  return s;
}

function park(id: string, lot: AirfieldLot): Motion {
  return { kind: 'parked', lot, slot: freeSlot(lot, id) };
}

/** Where on its orbit a flyer is (or will be, for a take-off still climbing) at `sec`, 0..1; null if it is not on that orbit. */
function orbitU(m: Motion, orbit: number, sec: number, g: Geo): number | null {
  if (m.kind === 'cruise' && m.orbit === orbit) return mod1(sec / orbitCrossSec(orbit) + m.phase);
  if (m.kind === 'takeoff' && m.orbit === orbit) {
    const end = m.t0 + takeoffSec(g, m);
    return mod1(uJoin(g, m.rocket) + (sec - end) / orbitCrossSec(orbit));
  }
  return null;
}

/** How many flyers are, or are about to be, on an orbit. */
function crowd(orbit: number, except: string | undefined, sec: number, g: Geo): number {
  let n = 0;
  for (const [id, m] of motions) if (id !== except && orbitU(m, orbit, sec, g) !== null) n++;
  return n;
}

/** The closest any other flyer is to progress `u` on an orbit at `sec`, in progress units (1 when alone). */
function nearestOther(
  orbit: number,
  u: number,
  except: string | undefined,
  sec: number,
  g: Geo,
): number {
  let best = 1;
  for (const [id, m] of motions) {
    if (id === except) continue;
    const o = orbitU(m, orbit, sec, g);
    if (o !== null) best = Math.min(best, circ(o, u));
  }
  return best;
}

/** Where a flyer can be put on an orbit now: its even-spread phase if that is clear, else the middle of the widest gap. */
function freePhase(orbit: number, wanted: number, id: string, sec: number, g: Geo): number {
  const cross = orbitCrossSec(orbit);
  const gap = minGapU(crowd(orbit, id, sec, g) + 1, g.span, g.px);
  const wantedU = mod1(sec / cross + wanted);
  if (nearestOther(orbit, wantedU, id, sec, g) >= gap) return wanted;
  const us: number[] = [];
  for (const [other, m] of motions) {
    if (other === id) continue;
    const o = orbitU(m, orbit, sec, g);
    if (o !== null) us.push(o);
  }
  us.sort((a, b) => a - b);
  let at = wantedU;
  let widest = -1;
  us.forEach((o, i) => {
    const d = mod1((us[(i + 1) % us.length] ?? o) - o) || 1;
    if (d > widest) {
      widest = d;
      at = mod1(o + d / 2);
    }
  });
  return mod1(at - sec / cross);
}

/**
 * Seconds a take-off waits on the ground so that it joins its orbit, and climbs onto it, clear of
 * the flyers already there (or about to be). The wait is the shortest that is clear, or the one
 * that leaves the most room when the orbit is full.
 */
function joinDelay(
  m: { slot: number; orbit: number; rocket: boolean },
  id: string,
  sec: number,
  g: Geo,
): number {
  const cross = orbitCrossSec(m.orbit);
  const dur = takeoffSec(g, m);
  const join = uJoin(g, m.rocket);
  const gap = minGapU(crowd(m.orbit, id, sec, g) + 1, g.span, g.px);
  // checked as the climb starts to fade in and when it lands on the track
  const clearance = (wait: number): number => {
    let c = 1;
    for (const back of [0, SKY_AIRFIELD_CLIMB_SEC * (1 - SKY_AIRFIELD_FADE_FROM)]) {
      const t = sec + wait + dur - back;
      c = Math.min(c, nearestOther(m.orbit, mod1(join - back / cross), id, t, g));
    }
    return c;
  };
  let best = 0;
  let bestClear = -1;
  for (let wait = 0; wait <= cross; wait += SKY_TASK_JOIN_STEP_SEC) {
    const c = clearance(wait);
    if (c >= gap) return wait;
    if (c > bestClear) {
      bestClear = c;
      best = wait;
    }
  }
  return best;
}

/**
 * Flyers still too close on an orbit (a task changed orbit, a landing came back, the board changed)
 * drift apart a little each frame instead of jumping. A flyer already committed to a landing stays
 * put and its neighbours give way.
 */
function relaxOrbits(sec: number, g: Geo): void {
  const dt = lastSyncSec === null ? 0 : Math.max(0, Math.min(0.25, sec - lastSyncSec));
  lastSyncSec = sec;
  if (dt === 0) return;
  const step = ((SKY_TASK_NUDGE_PX_PER_SEC * g.px) / g.span) * dt;
  for (let orbit = 0; orbit < SKY_TASK_TRACKS; orbit++) {
    const flyers: Array<Extract<Motion, { kind: 'cruise' }>> = [];
    for (const m of motions.values()) if (m.kind === 'cruise' && m.orbit === orbit) flyers.push(m);
    if (flyers.length < 2) continue;
    const cross = orbitCrossSec(orbit);
    const moved = separateFlyers(
      flyers.map((m) => mod1(sec / cross + m.phase)),
      flyers.map((m) => m.landAt !== undefined),
      minGapU(flyers.length, g.span, g.px),
      step,
    );
    flyers.forEach((m, i) => {
      m.phase = mod1(m.phase + moved[i]);
    });
  }
}

/**
 * Brings every task's motion in line with its status at `sec`: the only place a motion changes.
 * Idempotent for one `sec`, so the day and night passes can both call it.
 */
function syncSkyMotion(sec: number, g: Geo): void {
  const live = new Set(tasks.map((t) => t.id));
  for (const id of [...motions.keys()]) if (!live.has(id)) motions.delete(id);
  const places = placeTasks(tasks);
  tasks.forEach((t, i) => {
    const orbit = orbitOfStage(t.stage);
    const lot = lotOfStage(t.stage);
    let m = motions.get(t.id);
    if (!m) {
      // first sight: a flying task is already up, the others are parked
      motions.set(
        t.id,
        orbit !== null
          ? { kind: 'cruise', orbit, phase: freePhase(orbit, places[i].phase, t.id, sec, g) }
          : park(t.id, lot ?? 'plan'),
      );
      return;
    }
    if (m.kind === 'takeoff' && sec >= m.t0 + takeoffSec(g, m)) {
      const end = m.t0 + takeoffSec(g, m);
      m = {
        kind: 'cruise',
        orbit: m.orbit,
        phase: mod1(uJoin(g, m.rocket) - end / orbitCrossSec(m.orbit)),
      };
      motions.set(t.id, m);
    }
    if (m.kind === 'landing' && lot && sec >= m.t0 + landingSec(g, m)) {
      m = m.lot === lot ? { kind: 'parked', lot, slot: m.slot } : park(t.id, lot);
      motions.set(t.id, m);
    }
    if (t.stage === 'plan') {
      if (m.kind !== 'parked' || m.lot !== 'plan') motions.set(t.id, park(t.id, 'plan'));
      return;
    }
    if (lot) {
      // tests (left lot) or ready to merge (right lot): come down from the orbit onto that lot
      if (m.kind === 'parked') {
        if (m.lot !== lot) motions.set(t.id, park(t.id, lot));
      } else if (m.kind === 'cruise') {
        const cross = orbitCrossSec(m.orbit);
        const u = mod1(sec / cross + m.phase);
        const rocket = m.landAt !== undefined ? !!m.landRocket : isNight();
        if (m.landLot !== lot) m.landAt = undefined;
        const landAt = m.landAt ?? sec + mod1(uGlide(g, rocket, lot) - u) * cross;
        if (sec >= landAt) {
          motions.set(t.id, {
            kind: 'landing',
            t0: landAt,
            slot: freeSlot(lot, t.id),
            orbit: m.orbit,
            rocket,
            lot,
          });
        } else {
          m.landAt = landAt;
          m.landRocket = rocket;
          m.landLot = lot;
        }
      }
      // a take-off in progress climbs out first and lands on its first lap
      return;
    }
    if (orbit === null) return;
    // an active status
    if (m.kind === 'parked') {
      const start = {
        slot: m.lot === 'plan' ? m.slot : freeSlot('plan', t.id),
        orbit,
        rocket: isNight(),
      };
      // held on the ground until the orbit is clear where it will join
      motions.set(t.id, { kind: 'takeoff', t0: sec + joinDelay(start, t.id, sec, g), ...start });
    } else if (m.kind === 'takeoff') {
      m.orbit = orbit;
    } else if (m.kind === 'landing') {
      motions.set(t.id, {
        kind: 'cruise',
        orbit,
        phase: freePhase(orbit, places[i].phase, t.id, sec, g),
      });
    } else {
      m.landAt = undefined;
      m.landRocket = undefined;
      m.landLot = undefined;
      if (m.orbit !== orbit) {
        // change orbit without jumping along it
        const u = sec / orbitCrossSec(m.orbit) + m.phase;
        m.phase = mod1(u - sec / orbitCrossSec(orbit));
        m.orbit = orbit;
      }
    }
  });
  relaxOrbits(sec, g);
}

type FlyerState =
  | {
      mode: 'rocket';
      x: number;
      y: number;
      /** Radians, -PI/2 = nose up. */
      angle: number;
      scale: number;
      flame: number;
      dust: number;
      /** Standing on its pad (not yet lifted off / already down). */
      onPad: boolean;
      /** 0..1: how far the sky satellite has taken over. */
      fade: number;
      stageIndex: number;
    }
  | {
      mode: 'ground';
      x: number;
      y: number;
      heading: Heading;
      stageIndex: number;
      /** Resting in a lot (as opposed to taxiing): a rocket at night, a plane by day. */
      parked?: boolean;
      /** 0..1, spreads the beacons' flashes so parked planes don't all pulse together. */
      seed: number;
    }
  | { mode: 'air'; pose: FlyerPose; trail: boolean }
  | {
      mode: 'turn';
      x: number;
      y: number;
      angle: number;
      wing: number;
      /** 1 on the runway, smaller the farther away. */
      scale: number;
      /** 0..1: how far the far-off sky flyer has taken over from the turning plane. */
      fade: number;
      stageIndex: number;
    };

/** The turning plane ends exactly as big as the sky plane, which keeps its original size. */
const SKY_PLANE_LENGTH = 14;
const FAR_SCALE = (SKY_PLANE_LENGTH * SKY_TASK_PLANE_SCALE) / PLANE_TOP_LENGTH;

/**
 * A plane between the runway and its track. `k` is 0 on the runway end and 1 on the track.
 * Leaving, it flies straight off the runway, banks right onto the track, folds its wings to the
 * side view and ends exactly the size of the sky plane, which then takes over; `leaving` false
 * is the same path flown backwards.
 */
function turning(
  task: SkyTask,
  runway: [number, number],
  track: [number, number],
  k: number,
  leaving: boolean,
): FlyerState {
  // a curve that leaves the runway along its line and meets the track level
  const c: [number, number] = [runway[0], track[1]];
  const q = 1 - k;
  const x = q * q * runway[0] + 2 * q * k * c[0] + k * k * track[0];
  const y = q * q * runway[1] + 2 * q * k * c[1] + k * k * track[1];
  const dx = 2 * q * (c[0] - runway[0]) + 2 * k * (track[0] - c[0]);
  const dy = 2 * q * (c[1] - runway[1]) + 2 * k * (track[1] - c[1]);
  const way = leaving ? 1 : -1;
  return {
    mode: 'turn',
    x,
    y,
    angle: dx === 0 && dy === 0 ? 0 : Math.atan2(dy * way, dx * way),
    wing: 1 - smooth((k - SKY_AIRFIELD_FOLD_FROM) / (1 - SKY_AIRFIELD_FOLD_FROM)),
    scale: 1 + (FAR_SCALE - 1) * smooth(k / SKY_AIRFIELD_FADE_FROM),
    fade: smooth((k - SKY_AIRFIELD_FADE_FROM) / (1 - SKY_AIRFIELD_FADE_FROM)),
    stageIndex: Math.max(0, SKY_TASK_STAGES.indexOf(task.stage)),
  };
}

/**
 * A rocket between its pad and its track. `k` is 0 on the pad and 1 on the track. The field is
 * close to the viewer and the track far away, so it climbs with perspective: the farther it is,
 * the smaller it is and the slower it seems to rise. It leaves the pad upright, pitches over
 * towards the track's direction late in the flight and ends as small as the satellite that takes over.
 */
function rocketAt(
  task: SkyTask,
  pad: [number, number],
  track: [number, number],
  k: number,
  burn: { flame: number; dust: number; onPad: boolean },
): FlyerState {
  const far = SKY_ROCKET_FAR_SCALE;
  const depth = 1 + (1 / far - 1) * k;
  const near = (1 / depth - far) / (1 - far);
  const side = k * k;
  const pitch = smooth((k - SKY_ROCKET_PITCH_FROM) / (1 - SKY_ROCKET_PITCH_FROM));
  return {
    mode: 'rocket',
    x: pad[0] + (track[0] - pad[0]) * side,
    y: track[1] + (pad[1] - track[1]) * near,
    angle: (-Math.PI / 2) * (1 - pitch),
    scale: 1 / depth,
    flame: burn.flame * (1 - smooth((k - 0.8) / 0.2)),
    dust: burn.dust,
    onPad: burn.onPad,
    fade: smooth((k - SKY_ROCKET_FADE_FROM) / (1 - SKY_ROCKET_FADE_FROM)),
    stageIndex: Math.max(0, SKY_TASK_STAGES.indexOf(task.stage)),
  };
}

/** The sky flyer to draw for a state: the cruising one, or the one fading in as a plane turns. */
function skyPose(s: FlyerState, at: (k: number) => [number, number], px: number): FlyerPose | null {
  if (s.mode === 'air') return s.pose;
  if ((s.mode !== 'turn' && s.mode !== 'rocket') || s.fade <= 0) return null;
  return {
    x: Math.round(s.x / px) * px,
    y: Math.round(s.y / px) * px,
    alpha: s.fade,
    stageIndex: s.stageIndex,
    slope: 0,
    at,
  };
}

/** Where a task is at `sec`, on the ground or in the air. */
function stateOf(task: SkyTask, m: Motion, sec: number, g: Geo): FlyerState {
  const f = g.field;
  const stageIndex = Math.max(0, SKY_TASK_STAGES.indexOf(task.stage));
  if (m.kind === 'parked') {
    const [x, y] = slotPoint(f, m.lot, m.slot);
    return { mode: 'ground', x, y, heading: 'up', stageIndex, parked: true, seed: hash01(task.id) };
  }
  if (m.kind === 'cruise') {
    const pose = flyerPose(task, sec, g.w, g.horizonY, g.px, m, f);
    return { mode: 'air', pose, trail: true };
  }
  const at = orbitArc(m.orbit, g.w, g.horizonY, g.px, f);
  const dt = sec - m.t0;
  if (m.kind === 'takeoff' && m.rocket) {
    const pad = slotPoint(f, 'plan', m.slot);
    const track = at(uJoin(g, true));
    if (dt < SKY_ROCKET_HOLD_SEC) {
      const burn = smooth(dt / SKY_ROCKET_HOLD_SEC);
      return rocketAt(task, pad, track, 0, { flame: burn, dust: burn, onPad: true });
    }
    const s = (dt - SKY_ROCKET_HOLD_SEC) / SKY_ROCKET_RISE_SEC;
    return rocketAt(task, pad, track, EASE.in(Math.min(1, s)), {
      flame: 1,
      dust: 1 - smooth(s * 4),
      onPad: false,
    });
  }
  if (m.kind === 'landing' && m.rocket) {
    const pad = slotPoint(f, m.lot, m.slot);
    const track = at(uGlide(g, true, m.lot));
    if (dt < SKY_ROCKET_DESCENT_SEC) {
      const s = dt / SKY_ROCKET_DESCENT_SEC;
      return rocketAt(task, pad, track, 1 - EASE.out(s), {
        flame: 1,
        dust: smooth((s - 0.8) / 0.2),
        onPad: false,
      });
    }
    const settle = Math.min(1, (dt - SKY_ROCKET_DESCENT_SEC) / SKY_ROCKET_SETTLE_SEC);
    return rocketAt(task, pad, track, 0, {
      flame: 1 - smooth(settle * 2),
      dust: 1 - smooth(settle),
      onPad: true,
    });
  }
  if (m.kind === 'takeoff') {
    const { start, legs } = takeoffLegs(f, m.slot);
    const groundSec = sum(legs);
    if (dt < groundSec) {
      const r = followLegs(start, legs, dt, g.px);
      return { mode: 'ground', ...r, stageIndex, seed: 0 };
    }
    return turning(
      task,
      [f.runwayL, f.runwayTop],
      at(uJoin(g, false)),
      smooth((dt - groundSec) / SKY_AIRFIELD_CLIMB_SEC),
      true,
    );
  }
  // landing
  if (dt < SKY_AIRFIELD_GLIDE_SEC) {
    return turning(
      task,
      [f.runwayR, f.runwayTop],
      at(uGlide(g, false, m.lot)),
      1 - smooth(dt / SKY_AIRFIELD_GLIDE_SEC),
      false,
    );
  }
  const { start, legs } = landingLegs(f, m.slot, m.lot);
  const r = followLegs(start, legs, dt - SKY_AIRFIELD_GLIDE_SEC, g.px);
  return { mode: 'ground', ...r, stageIndex, seed: 0 };
}

function statesNow(
  sec: number,
  w: number,
  horizonY: number,
  px: number,
): Array<[SkyTask, FlyerState]> {
  const g = geoOf(w, horizonY, px);
  syncSkyMotion(sec, g);
  const out: Array<[SkyTask, FlyerState]> = [];
  for (const t of tasks) {
    const m = motions.get(t.id);
    if (m) out.push([t, stateOf(t, m, sec, g)]);
  }
  return out;
}

/** Test seam: where a task is at `sec` (settles its motion first). */
export function skyStateForTest(
  id: string,
  sec: number,
  w: number,
  horizonY: number,
  px: number,
): { mode: 'ground' | 'air' | 'rocket'; x: number; y: number } | null {
  const hit = statesNow(sec, w, horizonY, px).find(([t]) => t.id === id);
  if (!hit) return null;
  const s = hit[1];
  if (s.mode === 'air') return { mode: 'air', x: s.pose.x, y: s.pose.y };
  if (s.mode === 'rocket') return { mode: s.onPad ? 'ground' : 'rocket', x: s.x, y: s.y };
  return { mode: s.mode === 'turn' ? 'air' : 'ground', x: s.x, y: s.y };
}

interface LinkHit {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  url: string;
}
/** Where ready-to-merge and plan planes stand on the canvas as last drawn, in device pixels. */
let linkHits: LinkHit[] = [];

/** The pull request link of the ready-to-merge or plan plane, rocket or lot at a device-pixel point, if any. */
export function skyLinkAt(deviceX: number, deviceY: number): string | null {
  const hit = linkHits.find(
    (h) => deviceX >= h.x0 && deviceX <= h.x1 && deviceY >= h.y0 && deviceY <= h.y1,
  );
  return hit ? hit.url : null;
}

/** The planes that are on the airfield (parked, taxiing, rolling): drawn above the field, whatever the hour. */
export function drawGroundPlanes(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  px: number,
  sec: number,
): void {
  linkHits = [];
  for (const [task, s] of statesNow(sec, w, horizonY, px)) {
    if (s.mode === 'air') continue;
    if (
      s.mode === 'ground' &&
      s.parked &&
      (task.stage === 'ready_to_merge' || task.stage === 'plan') &&
      task.url
    ) {
      // the whole bay is the button: plane (or rocket), beacon and the lot round them
      const halfW = (SKY_AIRFIELD_LOT_W * px) / 2;
      const halfH = (SKY_AIRFIELD_SLOT_PITCH * px) / 2;
      linkHits.push({
        x0: s.x - halfW,
        x1: s.x + halfW,
        y0: s.y - halfH,
        y1: s.y + halfH,
        url: task.url,
      });
    }
    const colour = SKY_TASK_COLORS[s.stageIndex];
    if (s.mode === 'ground' && s.parked) {
      // a parked plane and rocket trade places over the same dusk and dawn window as the
      // sky flyers morph, so the airfield and the sky change together
      const m = smooth(night);
      if (m < 1) {
        ctx.globalAlpha = 1 - m;
        drawGroundPlane(ctx, s.x, s.y, px, s.heading, colour);
      }
      if (m > 0) {
        ctx.globalAlpha = m;
        drawRocket(ctx, s.x, s.y, px, -Math.PI / 2, 1, colour, 0, 0, sec);
      }
      ctx.globalAlpha = 1;
    } else if (s.mode === 'ground') drawGroundPlane(ctx, s.x, s.y, px, s.heading, colour);
    if (s.mode === 'ground' && s.parked)
      drawGroundCrew(ctx, s.x, s.y, px, SKY_TASK_STAGES[s.stageIndex], sec, s.seed);
    else if (s.mode === 'rocket') {
      ctx.globalAlpha = 1 - s.fade;
      drawRocket(ctx, s.x, s.y, px, s.angle, s.scale, colour, s.flame, s.dust, sec);
      ctx.globalAlpha = 1;
    } else if (s.mode === 'turn') {
      ctx.globalAlpha = 1 - s.fade;
      drawTurningPlane(ctx, s.x, s.y, px, s.angle, s.wing, colour, s.scale);
      ctx.globalAlpha = 1;
    }
  }
}

const NO_ARC = (): [number, number] => [0, 0];

/** Plane facing right as [dx, dy, width] rows in sprite pixels; tilted by shearing rows along the slope. */
const PLANE: [number, number, number, boolean][] = [
  // long thin fuselage, nose to the right
  [1, 0, 14, false],
  // tail fin at the back
  [0, -1, 2, true],
  // thin swept wings, one either side of the middle
  [7, -1, 3, true],
  [8, -2, 2, true],
  [8, 1, 3, true],
];

/**
 * Vertical offset (canvas pixels) of the plane's body `along` canvas pixels from its middle, so the
 * body lies on the same path as its trail: the nose and tail sit on the orbit itself rather than on
 * a straight line at the tilt, and the trail continues from the tail without a kink. Flyers off the
 * orbit (turning, rising) have no path and keep the plain tilt.
 */
export function fuselageRise(p: FlyerPose, along: number, px: number): number {
  const span = p.at(1)[0] - p.at(0)[0];
  if (p.at === NO_ARC || span <= 0) return Math.round(along * p.slope);
  const [, y] = p.at((p.x + along + 8 * px) / span);
  return y - p.y;
}

const TRAIL_SPAN = 0.22;

function trail(
  ctx: CanvasRenderingContext2D,
  p: FlyerPose,
  u0: number,
  px: number,
  alpha: number,
  dashed: boolean,
  gap: number,
): void {
  ctx.fillStyle = SKY_TASK_TRAIL_COLOR;
  const steps = 70;
  // the line starts `gap` sprite pixels behind the tail, not at the middle of the flyer
  const start = u0 - (gap * px) / (p.at(1)[0] - p.at(0)[0]);
  for (let k = 1; k <= steps; k++) {
    if (dashed && k % 4 > 1) continue;
    const t = start - (k / steps) * TRAIL_SPAN;
    if (t < 0) break;
    const [tx, ty] = p.at(t);
    ctx.globalAlpha = alpha * (1 - k / steps) * (dashed ? 1 : 0.85);
    ctx.fillRect(tx, ty + (dashed ? px : 0), px, px);
  }
}

/**
 * The task flyers in the sky. A plane and a satellite are the same task at two hours, so as the
 * night comes in over dusk (and goes out over dawn) one turns into the other: the fuselage draws
 * in to the body while the solar panels unfold, the contrail breaks into dashes and the lights
 * start to blink. By day (night 0) it is a plane, by night (night 1) a satellite.
 */
export function drawSkyFlyers(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  px: number,
  sec: number,
): void {
  const m = smooth(night);
  for (const [task, s] of statesNow(sec, w, horizonY, px)) {
    const p = skyPose(s, NO_ARC, px);
    if (!p) continue;
    const u0 = (p.x + 8 * px) / (w + 16 * px);
    if (s.mode === 'air' && s.trail) {
      if (m < 1)
        trail(
          ctx,
          p,
          u0,
          px,
          (1 - m) * p.alpha,
          false,
          SKY_TASK_PLANE_TRAIL_GAP * (1 - m) + SKY_TASK_SAT_TRAIL_GAP * m,
        );
      if (m > 0)
        trail(
          ctx,
          p,
          u0,
          px,
          m * p.alpha,
          true,
          SKY_TASK_PLANE_TRAIL_GAP * (1 - m) + SKY_TASK_SAT_TRAIL_GAP * m,
        );
    }
    if (m < 1) {
      ctx.globalAlpha = p.alpha * (1 - m * m);
      const u = px * SKY_TASK_PLANE_SCALE;
      // the plane shortens towards its middle as the night comes in
      const reach = Math.round(7 * (1 - m)) + 1;
      for (const [dx, dy, ww, wing] of PLANE) {
        ctx.fillStyle = wing ? SKY_TASK_WING_COLOR : SKY_TASK_COLORS[p.stageIndex];
        for (let k = 0; k < ww; k++) {
          const sx = dx + k - 7;
          if (Math.abs(sx) > reach) continue;
          ctx.fillRect(p.x + sx * u, p.y + dy * u + fuselageRise(p, sx * u, px), u, u);
        }
      }
    }
    if (m > 0) {
      ctx.globalAlpha = p.alpha * Math.min(1, m * 1.5);
      // two solar panels either side of a body tinted by stage; the panels unfold from the body
      const pw = Math.max(1, Math.ceil(3 * m));
      ctx.fillStyle = SKY_TASK_PANEL_COLOR;
      ctx.fillRect(p.x - (1 + pw) * px, p.y, pw * px, 2 * px);
      ctx.fillRect(p.x + 2 * px, p.y, pw * px, 2 * px);
      ctx.fillStyle = SKY_TASK_COLORS[p.stageIndex];
      ctx.fillRect(p.x - px, p.y - px, 3 * px, 3 * px);
      // two lights alternate on and off
      if (m > 0.5) {
        const on = Math.floor(sec / SKY_TASK_BLINK_SEC + hash01(task.id) * 5) % 2 === 0;
        ctx.fillStyle = on ? SKY_TASK_BLINK_ON : SKY_TASK_BLINK_ALT;
        ctx.fillRect(on ? p.x - px : p.x + px, p.y - px, px, px);
      }
    }
  }
  ctx.globalAlpha = 1;
}
