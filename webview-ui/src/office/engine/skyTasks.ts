/**
 * Tasks in the sky. The server sends the board (one entry per branch + PR);
 * by day each is a plane with a white contrail, by night a satellite with
 * blinking lights. Every flyer arcs across the whole sky from left to right.
 * There are five orbits, the same arc shifted up one gap each, and the orbit is the
 * status, low to high: plan, coding, tests, review, ready to merge.
 * A merged task leaves the sky. Tasks on one orbit are spread round it with a gap between them. The trail
 * is a white line (solid by day, dashed by night); a merged flyer fades out at the
 * right edge.
 */
import {
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

/**
 * Pure: the orbit of each task, low to high by status (plan, coding, tests, review, ready to merge), and its place on
 * it: tasks on one orbit are spread evenly round it, so there is always a gap.
 */
export function placeTasks(list: SkyTask[]): TaskPlace[] {
  const orbitOf = (stage: SkyTaskStage): number =>
    Math.min(SKY_TASK_TRACKS - 1, Math.max(0, SKY_TASK_STAGES.indexOf(stage)));
  const byOrbit = new Map<number, number[]>();
  list.forEach((t, i) => {
    const o = orbitOf(t.stage);
    byOrbit.set(o, [...(byOrbit.get(o) ?? []), i]);
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

/** Pure: where a task's flyer is at `sec`, and the arc it follows (canvas pixels). */
export function flyerPose(
  task: SkyTask,
  sec: number,
  w: number,
  horizonY: number,
  px: number,
  place: TaskPlace,
): FlyerPose {
  const si = Math.max(0, SKY_TASK_STAGES.indexOf(task.stage));
  const track = place.orbit;
  // one speed per orbit, so tasks sharing an orbit keep the gap between them
  const speed = track / (SKY_TASK_TRACKS - 1);
  const cross =
    SKY_TASK_CROSS_SEC_SLOWEST + (SKY_TASK_CROSS_SEC_FASTEST - SKY_TASK_CROSS_SEC_SLOWEST) * speed;
  const u = (sec / cross + place.phase) % 1;
  // every task has its own track: the same arc shifted up by one track gap per track, so
  // the tracks run parallel and each flyer starts at its own point at the left edge
  const ground = horizonY * (SKY_TASK_GROUND - track * SKY_TASK_TRACK_GAP);
  const rise = horizonY * SKY_TASK_RISE;
  const span = w + 16 * px;
  const at = (k: number): [number, number] => [
    Math.round((-8 * px + k * span) / px) * px,
    Math.round((ground - rise * Math.sin(Math.PI * k)) / px) * px,
  ];
  const [x, y] = at(u);
  const slope = Math.max(-0.5, Math.min(0.5, -(rise * Math.PI * Math.cos(Math.PI * u)) / span));
  return {
    x,
    y,
    alpha: task.stage === 'merged' ? 1 - u * u : 1,
    stageIndex: si,
    slope,
    at,
  };
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
  const places = placeTasks(tasks);
  for (const [i, task] of tasks.entries()) {
    const p = flyerPose(task, sec, w, horizonY, px, places[i]);
    const u0 = (p.x + 8 * px) / (w + 16 * px);
    trail(ctx, p, u0, px, alpha * p.alpha, false, SKY_TASK_PLANE_TRAIL_GAP);
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
  const places = placeTasks(tasks);
  for (const [i, task] of tasks.entries()) {
    const p = flyerPose(task, sec, w, horizonY, px, places[i]);
    const a = alpha * p.alpha;
    const u0 = (p.x + 8 * px) / (w + 16 * px);
    trail(ctx, p, u0, px, a, true, SKY_TASK_SAT_TRAIL_GAP);
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
