/**
 * Tasks in the sky. The server sends the board (one entry per branch + PR);
 * by day each flying task is a plane with a white contrail, by night a satellite with
 * blinking lights. The airfield at the right (skyAirfield) is where a task rests: plan tasks
 * park in the left lot, ready-to-merge tasks in the right lot. A task that moves to an active
 * status (coding, tests, review) taxis to the left runway, takes off and joins its orbit;
 * orbits arc across the whole sky from left to right, the same arc shifted up one gap each,
 * and the orbit is the status, low to high. A task that becomes ready to merge stays on its
 * orbit until it comes round to the airfield, glides down onto the right runway, lands and
 * parks. A merged task leaves the sky. Tasks on one orbit are spread round it with a gap
 * between them. The trail is a white line (solid by day, dashed by night).
 */
import {
  SKY_AIRFIELD_CLEARANCE,
  SKY_AIRFIELD_CLIMB_DX,
  SKY_AIRFIELD_CLIMB_SEC,
  SKY_AIRFIELD_GLIDE_DX,
  SKY_AIRFIELD_GLIDE_SEC,
  SKY_AIRFIELD_LANDING_ROLL_SEC,
  SKY_AIRFIELD_LANDING_TAXI_SEC,
  SKY_AIRFIELD_LIFT_BLEND,
  SKY_AIRFIELD_TAKEOFF_ROLL_SEC,
  SKY_AIRFIELD_TAKEOFF_TAXI_SEC,
  SKY_TASK_BLINK_ALT,
  SKY_TASK_BLINK_ON,
  SKY_TASK_BLINK_SEC,
  SKY_TASK_COLORS,
  SKY_TASK_CROSS_SEC_FASTEST,
  SKY_TASK_CROSS_SEC_SLOWEST,
  SKY_TASK_GROUND,
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
import {
  type Airfield,
  airfieldLayout,
  type AirfieldLot,
  drawGroundPlane,
  drawTurningPlane,
  type Heading,
  slotPoint,
} from './skyAirfield.js';

export type SkyTaskStage = (typeof SKY_TASK_STAGES)[number];
export interface SkyTask {
  id: string;
  title: string;
  stage: SkyTaskStage;
}

/** Merged tasks have left the sky, so only the rest are kept. */
let tasks: SkyTask[] = [];

export function setSkyTasks(next: SkyTask[]): void {
  tasks = next.filter((t) => t.stage !== 'merged');
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

/** The orbit a status flies on (coding, tests, review), or null when the task rests on the airfield. */
export function orbitOfStage(stage: SkyTaskStage): number | null {
  const i = SKY_TASK_STAGES.indexOf(stage);
  return i >= 1 && i <= SKY_TASK_TRACKS ? i - 1 : null;
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
    return [Math.round(x / px) * px, Math.round(y / px) * px];
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
    slope: slopeAt(at, u),
    at,
  };
}

/** Climb (+) or dive (-) of an arc at progress `u`, for tilting a sprite. */
function slopeAt(at: (k: number) => [number, number], u: number): number {
  const d = 0.004;
  const [x0, y0] = at(Math.max(0, u - d));
  const [x1, y1] = at(Math.min(1, u + d));
  if (x1 === x0) return 0;
  return Math.max(-0.5, Math.min(0.5, -(y1 - y0) / (x1 - x0)));
}

// ── What each task is doing: parked, taking off, cruising, landing ─────────

type Motion =
  | { kind: 'parked'; lot: AirfieldLot; slot: number }
  | { kind: 'takeoff'; t0: number; slot: number; orbit: number }
  | { kind: 'cruise'; orbit: number; phase: number; landAt?: number }
  | { kind: 'landing'; t0: number; slot: number; orbit: number };

export type SkyMotionKind = Motion['kind'];

const motions = new Map<string, Motion>();

export function skyMotionKind(id: string): SkyMotionKind | undefined {
  return motions.get(id)?.kind;
}
export function resetSkyMotion(): void {
  motions.clear();
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

/** Down the landing runway -> along the taxiway -> up the side taxi column -> into the bay. */
function landingLegs(f: Airfield, slot: number): { start: [number, number]; legs: Leg[] } {
  const target = slotPoint(f, 'ready', slot);
  const [a, b, c] = SKY_AIRFIELD_LANDING_TAXI_SEC;
  return {
    start: [f.runwayR, f.runwayTop],
    legs: [
      { x: f.runwayR, y: f.taxiY, dur: SKY_AIRFIELD_LANDING_ROLL_SEC, ease: 'out' },
      { x: f.gapR, y: f.taxiY, dur: a, ease: 'lin' },
      { x: f.gapR, y: target[1], dur: b, ease: 'lin' },
      { x: target[0], y: target[1], dur: c, ease: 'lin' },
    ],
  };
}

const takeoffSec = (g: Geo, slot: number): number =>
  sum(takeoffLegs(g.field, slot).legs) + SKY_AIRFIELD_CLIMB_SEC;
const landingSec = (g: Geo, slot: number): number =>
  SKY_AIRFIELD_GLIDE_SEC + sum(landingLegs(g.field, slot).legs);

/** Progress along the orbit where the climb ends / the glide starts. */
const uJoin = (g: Geo): number =>
  mod1((g.field.runwayL + SKY_AIRFIELD_CLIMB_DX * g.px + 8 * g.px) / g.span);
const uGlide = (g: Geo): number =>
  mod1((g.field.runwayR - SKY_AIRFIELD_GLIDE_DX * g.px + 8 * g.px) / g.span);

function freeSlot(lot: AirfieldLot, except?: string): number {
  const used = new Set<number>();
  for (const [id, m] of motions) {
    if (id === except) continue;
    if (m.kind === 'parked' && m.lot === lot) used.add(m.slot);
    if (m.kind === 'landing' && lot === 'ready') used.add(m.slot);
  }
  let s = 0;
  while (used.has(s)) s++;
  return s;
}

function park(id: string, lot: AirfieldLot): Motion {
  return { kind: 'parked', lot, slot: freeSlot(lot, id) };
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
    const ready = t.stage === 'ready_to_merge';
    let m = motions.get(t.id);
    if (!m) {
      // first sight: a flying task is already up, the others are parked
      motions.set(
        t.id,
        orbit !== null
          ? { kind: 'cruise', orbit, phase: places[i].phase }
          : park(t.id, ready ? 'ready' : 'plan'),
      );
      return;
    }
    if (m.kind === 'takeoff' && sec >= m.t0 + takeoffSec(g, m.slot)) {
      const end = m.t0 + takeoffSec(g, m.slot);
      m = { kind: 'cruise', orbit: m.orbit, phase: mod1(uJoin(g) - end / orbitCrossSec(m.orbit)) };
      motions.set(t.id, m);
    }
    if (m.kind === 'landing' && sec >= m.t0 + landingSec(g, m.slot) && ready) {
      m = { kind: 'parked', lot: 'ready', slot: m.slot };
      motions.set(t.id, m);
    }
    if (t.stage === 'plan') {
      if (m.kind !== 'parked' || m.lot !== 'plan') motions.set(t.id, park(t.id, 'plan'));
      return;
    }
    if (ready) {
      if (m.kind === 'parked' && m.lot === 'plan') {
        motions.set(t.id, park(t.id, 'ready'));
      } else if (m.kind === 'cruise') {
        const cross = orbitCrossSec(m.orbit);
        const u = mod1(sec / cross + m.phase);
        const landAt = m.landAt ?? sec + mod1(uGlide(g) - u) * cross;
        if (sec >= landAt) {
          motions.set(t.id, {
            kind: 'landing',
            t0: landAt,
            slot: freeSlot('ready', t.id),
            orbit: m.orbit,
          });
        } else m.landAt = landAt;
      }
      // a take-off in progress climbs out first and lands on its first lap
      return;
    }
    if (orbit === null) return;
    // an active status
    if (m.kind === 'parked') {
      motions.set(t.id, {
        kind: 'takeoff',
        t0: sec,
        slot: m.lot === 'plan' ? m.slot : freeSlot('plan', t.id),
        orbit,
      });
    } else if (m.kind === 'takeoff') {
      m.orbit = orbit;
    } else if (m.kind === 'landing') {
      motions.set(t.id, { kind: 'cruise', orbit, phase: places[i].phase });
    } else {
      m.landAt = undefined;
      if (m.orbit !== orbit) {
        // change orbit without jumping along it
        const u = sec / orbitCrossSec(m.orbit) + m.phase;
        m.phase = mod1(u - sec / orbitCrossSec(orbit));
        m.orbit = orbit;
      }
    }
  });
}

type FlyerState =
  | { mode: 'ground'; x: number; y: number; heading: Heading; stageIndex: number }
  | { mode: 'air'; pose: FlyerPose; trail: boolean }
  | { mode: 'turn'; x: number; y: number; angle: number; wing: number; stageIndex: number };

/**
 * A plane easing from `from` to `to` over progress s (0..1) while it turns between its two
 * views: `up` true climbs out (nose up and seen from above, to nose right and side on), false
 * comes in to land (the reverse, ending nose down the runway).
 */
function turning(
  task: SkyTask,
  from: [number, number],
  to: [number, number],
  s: number,
  up: boolean,
): FlyerState {
  const k = smooth(s);
  return {
    mode: 'turn',
    x: from[0] + (to[0] - from[0]) * k,
    y: from[1] + (to[1] - from[1]) * k,
    angle: up ? (-Math.PI / 2) * (1 - k) : (Math.PI / 2) * k,
    wing: up ? 1 - k : k,
    stageIndex: Math.max(0, SKY_TASK_STAGES.indexOf(task.stage)),
  };
}

/** Where a task is at `sec`, on the ground or in the air. */
function stateOf(task: SkyTask, m: Motion, sec: number, g: Geo): FlyerState {
  const f = g.field;
  const stageIndex = Math.max(0, SKY_TASK_STAGES.indexOf(task.stage));
  if (m.kind === 'parked') {
    const [x, y] = slotPoint(f, m.lot, m.slot);
    return { mode: 'ground', x, y, heading: 'up', stageIndex };
  }
  if (m.kind === 'cruise') {
    const pose = flyerPose(task, sec, g.w, g.horizonY, g.px, m, f);
    return { mode: 'air', pose, trail: true };
  }
  const at = orbitArc(m.orbit, g.w, g.horizonY, g.px, f);
  const dt = sec - m.t0;
  if (m.kind === 'takeoff') {
    const { start, legs } = takeoffLegs(f, m.slot);
    const groundSec = sum(legs);
    if (dt < groundSec) {
      const r = followLegs(start, legs, dt, g.px);
      return { mode: 'ground', ...r, stageIndex };
    }
    return turning(
      task,
      [f.runwayL, f.runwayTop],
      at(uJoin(g)),
      (dt - groundSec) / SKY_AIRFIELD_CLIMB_SEC,
      true,
    );
  }
  // landing
  if (dt < SKY_AIRFIELD_GLIDE_SEC) {
    return turning(
      task,
      at(uGlide(g)),
      [f.runwayR, f.runwayTop],
      dt / SKY_AIRFIELD_GLIDE_SEC,
      false,
    );
  }
  const { start, legs } = landingLegs(f, m.slot);
  const r = followLegs(start, legs, dt - SKY_AIRFIELD_GLIDE_SEC, g.px);
  return { mode: 'ground', ...r, stageIndex };
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
): { mode: 'ground' | 'air'; x: number; y: number } | null {
  const hit = statesNow(sec, w, horizonY, px).find(([t]) => t.id === id);
  if (!hit) return null;
  const s = hit[1];
  if (s.mode === 'air') return { mode: 'air', x: s.pose.x, y: s.pose.y };
  return { mode: s.mode === 'turn' ? 'air' : 'ground', x: s.x, y: s.y };
}

/** The planes that are on the airfield (parked, taxiing, rolling): drawn above the field, whatever the hour. */
export function drawGroundPlanes(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  px: number,
  sec: number,
): void {
  for (const [, s] of statesNow(sec, w, horizonY, px)) {
    if (s.mode === 'air') continue;
    const colour = SKY_TASK_COLORS[s.stageIndex];
    if (s.mode === 'ground') drawGroundPlane(ctx, s.x, s.y, px, s.heading, colour);
    else if (s.mode === 'turn') drawTurningPlane(ctx, s.x, s.y, px, s.angle, s.wing, colour);
  }
}

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

export function drawDayFlyers(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  px: number,
  sec: number,
  alpha: number,
): void {
  for (const [, s] of statesNow(sec, w, horizonY, px)) {
    if (s.mode !== 'air') continue;
    const p = s.pose;
    const u0 = (p.x + 8 * px) / (w + 16 * px);
    if (s.trail) trail(ctx, p, u0, px, alpha * p.alpha, false, SKY_TASK_PLANE_TRAIL_GAP);
    ctx.globalAlpha = alpha * p.alpha;
    const u = px * SKY_TASK_PLANE_SCALE;
    for (const [dx, dy, ww, wing] of PLANE) {
      ctx.fillStyle = wing ? SKY_TASK_WING_COLOR : SKY_TASK_COLORS[p.stageIndex];
      for (let k = 0; k < ww; k++) {
        const sx = dx + k - 7;
        ctx.fillRect(p.x + sx * u, p.y + (dy + Math.round(sx * p.slope)) * u, u, u);
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function drawNightFlyers(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  px: number,
  sec: number,
  alpha: number,
): void {
  for (const [task, s] of statesNow(sec, w, horizonY, px)) {
    if (s.mode !== 'air') continue;
    const p = s.pose;
    const a = alpha * p.alpha;
    const u0 = (p.x + 8 * px) / (w + 16 * px);
    if (s.trail) trail(ctx, p, u0, px, a, true, SKY_TASK_SAT_TRAIL_GAP);
    ctx.globalAlpha = a;
    // two solar panels either side of a body tinted by stage
    ctx.fillStyle = SKY_TASK_PANEL_COLOR;
    ctx.fillRect(p.x - 4 * px, p.y, 3 * px, 2 * px);
    ctx.fillRect(p.x + 2 * px, p.y, 3 * px, 2 * px);
    ctx.fillStyle = SKY_TASK_COLORS[p.stageIndex];
    ctx.fillRect(p.x - px, p.y - px, 3 * px, 3 * px);
    // two lights alternate on and off
    const on = Math.floor(sec / SKY_TASK_BLINK_SEC + hash01(task.id) * 5) % 2 === 0;
    ctx.fillStyle = on ? SKY_TASK_BLINK_ON : SKY_TASK_BLINK_ALT;
    ctx.fillRect(on ? p.x - px : p.x + px, p.y - px, px, px);
  }
  ctx.globalAlpha = 1;
}
