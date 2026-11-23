/**
 * What happens at the sky button when a pull request merges. By night a rocket climbs to the ISS and
 * drops a module that docks; the ISS folds and unfolds its panels, blinks twice, and the module goes.
 * By day a plane flies by the balloon and drops a packet on a parachute into the basket, leaves the
 * screen, then the balloon fires its burner and turns twice about its own axis. Pure: a frame is a
 * function of the seconds since it began, in sprite pixels from the centre of the button's sprite.
 */
import { SKY_MERGE_DAY, SKY_MERGE_NIGHT } from '../../constants.js';

export type CelebrationKind = 'day' | 'night';

export interface NightFrame {
  rocket: { x: number; y: number } | null;
  module: { x: number; y: number; vanish: number } | null;
  /** Panel width: 1 open, down to SKY_MERGE_NIGHT.foldMin folded. */
  fold: number;
  /** 0..1 brightness of a blink. */
  flash: number;
}
export interface DayFrame {
  plane: { x: number; y: number } | null;
  chute: { x: number; y: number; canopy: number } | null;
  /** 0 = no flame, else 1 (the flame is either burning or not). */
  flame: number;
  /** How far the balloon has risen on its burner, in sprite pixels. */
  lift: number;
  /** Turn about its own axis, radians. */
  spin: number;
  /** 1 while the packet has just dropped into the basket and it settles. */
  bob: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
const span = (t: number, from: number, to: number): number => clamp01((t - from) / (to - from));
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export function celebrationSec(kind: CelebrationKind): number {
  return kind === 'night' ? SKY_MERGE_NIGHT.total : SKY_MERGE_DAY.total;
}

/** The module's resting place, once docked. */
export function moduleDocked(t: number): boolean {
  const N = SKY_MERGE_NIGHT;
  return t >= N.releaseAt + N.approachSec + N.dockSec;
}

export function nightFrame(t: number): NightFrame {
  const N = SKY_MERGE_NIGHT;
  let rocket: NightFrame['rocket'] = null;
  if (t >= 0 && t < N.rocketEnd) {
    const y =
      t < N.releaseAt
        ? lerp(N.rocketFromY, N.releaseY, 1 - (1 - span(t, 0, N.releaseAt)) ** 2)
        : lerp(N.releaseY, N.rocketToY, span(t, N.releaseAt, N.rocketEnd) ** 2);
    rocket = { x: N.rocketX, y };
  }

  let module: NightFrame['module'] = null;
  const vanish = span(t, N.vanishAt, N.vanishAt + N.vanishSec);
  if (t >= N.releaseAt && vanish < 1) {
    const a = span(t, N.releaseAt, N.releaseAt + N.approachSec);
    const b = span(t, N.releaseAt + N.approachSec, N.releaseAt + N.approachSec + N.dockSec);
    const x = lerp(N.rocketX, 0, smooth(a));
    const y =
      b > 0 ? lerp(N.approachY, N.dockY, smooth(b)) : lerp(N.releaseY, N.approachY, smooth(a));
    module = { x, y, vanish };
  }

  const down = span(t, N.foldAt, N.foldAt + N.foldSec);
  const up = span(
    t,
    N.foldAt + N.foldSec + N.foldHoldSec,
    N.foldAt + 2 * N.foldSec + N.foldHoldSec,
  );
  const folded = up > 0 ? lerp(N.foldMin, 1, smooth(up)) : lerp(1, N.foldMin, smooth(down));

  let flash = 0;
  for (const [from, to] of N.blinks) {
    if (t >= from && t < to) flash = Math.sin(Math.PI * span(t, from, to));
  }
  return { rocket, module, fold: folded, flash };
}

export function dayFrame(t: number, reach: { left: number; right: number }): DayFrame {
  const D = SKY_MERGE_DAY;
  const startX = -reach.left - D.planeMargin;
  const endX = reach.right + D.planeMargin;
  let plane: DayFrame['plane'] = null;
  if (t >= 0 && t < D.exitAt) {
    const x =
      t < D.dropAt
        ? lerp(startX, D.dropX, 1 - (1 - span(t, 0, D.dropAt)) ** 2)
        : lerp(D.dropX, endX, span(t, D.dropAt, D.exitAt) ** 2);
    plane = { x, y: D.planeY };
  }

  let chute: DayFrame['chute'] = null;
  const u = span(t, D.dropAt, D.dropAt + D.chuteSec);
  if (t >= D.dropAt && u < 1) {
    const side = D.chuteSideShare;
    let x: number;
    let y: number;
    if (u < side) {
      const k = u / side;
      x = lerp(D.dropX, D.chuteSideX, smooth(k)) + Math.sin(k * Math.PI * 3) * 0.8 * (1 - k);
      y = lerp(D.planeY, D.chuteSideY, 1 - (1 - k) ** 1.5);
    } else {
      const k = (u - side) / (1 - side);
      x = lerp(D.chuteSideX, 0, smooth(k));
      y = lerp(D.chuteSideY, D.basketY, smooth(k));
    }
    chute = { x: Math.round(x), y: Math.round(y), canopy: u < side ? 1 : 1 - span(u, side, 1) };
  }
  const landedAt = D.dropAt + D.chuteSec;
  const bob = t >= landedAt && t < landedAt + 0.25 ? 1 : 0;

  let flame = 0;
  for (const [from, to] of D.flames) if (t >= from && t < to) flame = 1;
  const lift =
    D.liftMax * Math.max(...D.flames.map(([from, to]) => Math.sin(Math.PI * span(t, from, to))));
  const spin = D.spinTurns * 2 * Math.PI * smooth(span(t, D.spinAt, D.spinAt + D.spinSec));
  return { plane, chute, flame, lift: Math.round(lift), spin, bob };
}
