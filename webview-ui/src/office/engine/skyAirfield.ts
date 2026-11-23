/**
 * The airfield at the right of the sky: a left lot (plan and tests tasks wait here) beside the take-off
 * runway, and a landing runway beside the right lot (ready-to-merge tasks park here), seen from
 * above like a map. Pure geometry plus the static drawing; the tasks' planes live in skyTasks.
 */
import {
  SKY_AIRFIELD_GRASS_COLORS,
  SKY_AIRFIELD_HEIGHT_MAX,
  SKY_AIRFIELD_HEIGHT_MIN,
  SKY_AIRFIELD_HEIGHT_SHARE,
  SKY_AIRFIELD_LIGHT_COLOR,
  SKY_AIRFIELD_LIGHT_RATE,
  SKY_AIRFIELD_LOT_W,
  SKY_AIRFIELD_MARGIN,
  SKY_AIRFIELD_MARKING,
  SKY_AIRFIELD_PLANE_WING_COLOR,
  SKY_AIRFIELD_RUNWAY,
  SKY_AIRFIELD_RUNWAY_W,
  SKY_AIRFIELD_SLOT_PITCH,
  SKY_AIRFIELD_STRIP_GAP,
  SKY_AIRFIELD_STRIP_LOT_W,
  SKY_AIRFIELD_TARMAC,
  SKY_AIRFIELD_TAXI_BAND_H,
  SKY_AIRFIELD_TAXI_LINE,
  SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM,
  SKY_AIRFIELD_TAXI_W,
  SKY_AIRFIELD_TERMINAL,
  SKY_AIRFIELD_TERMINAL_EDGE,
  SKY_AIRFIELD_TERMINAL_W,
  SKY_AIRFIELD_WIDTH,
  SKY_AIRFIELD_WOODS_HEIGHT_MAX,
  SKY_AIRFIELD_WOODS_HEIGHT_SHARE,
  SKY_AIRFIELD_WOODS_TOP,
  SKY_BEACON_BASE_COLOR,
  SKY_BEACON_COLORS,
  SKY_BEACON_GLOW_ALPHA,
  SKY_BEACON_RIM_COLOR,
  SKY_BEACON_SWEEP_RATE,
  SKY_PR_NUMBER_COLOR,
  SKY_PR_NUMBER_MIN_FONT_PX,
  SKY_PR_NUMBER_OFFSET_UNITS,
  SKY_PR_NUMBER_SHADOW_COLOR,
  SKY_PR_NUMBER_SIZE_UNITS,
  SKY_ROCKET_BODY_COLOR,
  SKY_ROCKET_DARK_COLOR,
  SKY_ROCKET_DUST_COLOR,
  SKY_ROCKET_FLAME_COLORS,
  SKY_ROCKET_LEG_COLOR,
  SKY_TECH_HELMET_COLOR,
  SKY_TECH_LEGS_COLOR,
  SKY_TECH_SKIN_COLOR,
  SKY_TECH_TOOL_COLOR,
  SKY_TECH_VEST_COLOR,
  SKY_TECH_WORK_SEC,
} from '../../constants.js';
import { mix, parseHex, toCss } from './skyCycle.js';

export type AirfieldLot = 'plan' | 'ready';
export type Heading = 'up' | 'right' | 'down' | 'left';

/** Everything in canvas pixels, on the sprite-pixel grid. */
export interface Airfield {
  px: number;
  /** Top-left corner and size of the whole field. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Runway centres (x), shared top (y) and bottom (y). */
  runwayL: number;
  runwayR: number;
  runwayTop: number;
  runwayBottom: number;
  /** Taxiway row (y) and the two taxi columns beside the lots (x). */
  taxiY: number;
  gapL: number;
  gapR: number;
  lotL: number;
  lotR: number;
  /** Parking rows per lot (y of the first, pitch, count). */
  slotTop: number;
  slotRows: number;
  /** The narrow strip beside a full-size office: one runway, one taxi column and one lot, which
   *  plan tasks (upper bays) and ready tasks (lower bays) share. */
  strip: boolean;
}

/** Where the office stands on the canvas, so the field can go in the woods beside it. */
interface AirfieldSite {
  h: number;
  office: { x: number; y: number; w: number; h: number };
}
let site: AirfieldSite | null = null;
export function setAirfieldSite(next: AirfieldSite | null): void {
  site = next;
}

/**
 * The field stands in the woods right of the office, long and thin, when the gap there is wide
 * enough; otherwise at the right of the sky, on the skyline.
 */
export function airfieldLayout(w: number, horizonY: number, px: number): Airfield {
  const wU = SKY_AIRFIELD_WIDTH;
  const gap = site ? w - (site.office.x + site.office.w) : 0;
  const inWoods = site !== null && gap >= (wU + 2 * SKY_AIRFIELD_MARGIN) * px;
  const stripW =
    SKY_AIRFIELD_RUNWAY_W +
    SKY_AIRFIELD_TAXI_W +
    SKY_AIRFIELD_STRIP_LOT_W +
    SKY_AIRFIELD_TERMINAL_W;
  const strip = !inWoods && site !== null && gap >= (stripW + SKY_AIRFIELD_STRIP_GAP + 1) * px;
  if (strip && site) return stripLayout(horizonY, px, stripW, site);
  let hU: number;
  let left: number;
  let top: number;
  if (inWoods && site) {
    hU = Math.max(
      SKY_AIRFIELD_HEIGHT_MIN,
      Math.min(
        SKY_AIRFIELD_WOODS_HEIGHT_MAX,
        Math.floor(((site.h - horizonY) * SKY_AIRFIELD_WOODS_HEIGHT_SHARE) / px),
      ),
    );
    left = Math.round((w - gap / 2 - (wU * px) / 2) / px) * px;
    top = Math.round((horizonY + SKY_AIRFIELD_WOODS_TOP * px) / px) * px;
  } else {
    hU = Math.max(
      SKY_AIRFIELD_HEIGHT_MIN,
      Math.min(SKY_AIRFIELD_HEIGHT_MAX, Math.floor((horizonY * SKY_AIRFIELD_HEIGHT_SHARE) / px)),
    );
    left = Math.round((w - (wU + SKY_AIRFIELD_MARGIN) * px) / px) * px;
    top = Math.round((horizonY - hU * px) / px) * px;
  }
  const T = SKY_AIRFIELD_TERMINAL_W;
  const L = SKY_AIRFIELD_LOT_W;
  const G = SKY_AIRFIELD_TAXI_W;
  const R = SKY_AIRFIELD_RUNWAY_W;
  const lotLx = T;
  const gapLx = lotLx + L;
  const rwLx = gapLx + G;
  const rwRx = wU - T - L - G - R;
  const gapRx = rwRx + R;
  const lotRx = gapRx + G;
  const half = (v: number): number => v + Math.floor(R / 2);
  const slotsH = hU - SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM - SKY_AIRFIELD_TAXI_BAND_H / 2 - 3;
  return {
    px,
    left,
    top,
    width: wU * px,
    height: hU * px,
    runwayL: left + half(rwLx) * px,
    runwayR: left + half(rwRx) * px,
    runwayTop: top + px,
    runwayBottom: top + (hU - 1) * px,
    taxiY: top + (hU - SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM) * px,
    gapL: left + (gapLx + Math.floor(G / 2)) * px,
    gapR: left + (gapRx + Math.floor(G / 2)) * px,
    lotL: left + (lotLx + Math.floor(L / 2)) * px,
    lotR: left + (lotRx + Math.floor(L / 2)) * px,
    slotTop: top + 6 * px,
    slotRows: Math.max(1, Math.floor(slotsH / SKY_AIRFIELD_SLOT_PITCH)),
    strip: false,
  };
}

/** The strip: a long thin field in the woods, a tiny gap right of the office, its parking on the right. */
function stripLayout(horizonY: number, px: number, wU: number, s: AirfieldSite): Airfield {
  const hU = Math.max(
    SKY_AIRFIELD_HEIGHT_MIN,
    Math.min(
      SKY_AIRFIELD_WOODS_HEIGHT_MAX,
      Math.floor(((s.h - horizonY) * SKY_AIRFIELD_WOODS_HEIGHT_SHARE) / px),
    ),
  );
  const left = Math.round((s.office.x + s.office.w + SKY_AIRFIELD_STRIP_GAP * px) / px) * px;
  const top = Math.round((horizonY + SKY_AIRFIELD_WOODS_TOP * px) / px) * px;
  const R = SKY_AIRFIELD_RUNWAY_W;
  const G = SKY_AIRFIELD_TAXI_W;
  const L = SKY_AIRFIELD_STRIP_LOT_W;
  const slotsH = hU - SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM - SKY_AIRFIELD_TAXI_BAND_H / 2 - 3;
  const rows = Math.max(2, Math.floor(slotsH / SKY_AIRFIELD_SLOT_PITCH));
  const runway = left + Math.floor(R / 2) * px;
  const gapX = left + (R + Math.floor(G / 2)) * px;
  const lotX = left + (R + G + Math.floor(L / 2)) * px;
  return {
    px,
    left,
    top,
    width: wU * px,
    height: hU * px,
    runwayL: runway,
    runwayR: runway,
    runwayTop: top + px,
    runwayBottom: top + (hU - 1) * px,
    taxiY: top + (hU - SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM) * px,
    gapL: gapX,
    gapR: gapX,
    lotL: lotX,
    lotR: lotX,
    slotTop: top + 6 * px,
    slotRows: Math.max(1, Math.floor(rows / 2)),
    strip: true,
  };
}

/** Where a parked plane's middle sits. Extra planes beyond the rows tuck in beside the first column. */
export function slotPoint(f: Airfield, lot: AirfieldLot, slot: number): [number, number] {
  const row = slot % f.slotRows;
  const col = Math.floor(slot / f.slotRows);
  const x = (lot === 'plan' ? f.lotL : f.lotR) + (col % 2 === 0 ? 1 : -1) * col * 2 * f.px;
  // in the strip the ready bays sit below the plan bays, in the same lot
  const shift = f.strip && lot === 'ready' ? f.slotRows * SKY_AIRFIELD_SLOT_PITCH : 0;
  const y = f.slotTop + (shift + row * SKY_AIRFIELD_SLOT_PITCH + col * 4) * f.px;
  return [x, y];
}

/** A plane seen from above, nose up, short and thin (7 x 9): `b` body (the stage colour), `w` wing. */
const PLANE_TOP: string[] = [
  '...b...',
  '...b...',
  '..wbw..',
  'wwwbwww',
  'ww.b.ww',
  '...b...',
  '...b...',
  '.wwbww.',
  '...b...',
];
/** Nose to tail, in sprite pixels. */
export const PLANE_TOP_LENGTH = PLANE_TOP.length;
const PLANE_MID_X = 3;
const PLANE_MID_Y = 4;

/** Draws a top-down plane centred on (cx, cy), nose toward `heading`. */
export function drawGroundPlane(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  px: number,
  heading: Heading,
  bodyColor: string,
): void {
  PLANE_TOP.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = row[rx];
      if (c === '.') continue;
      const x = rx - PLANE_MID_X;
      const y = ry - PLANE_MID_Y;
      const [dx, dy] =
        heading === 'up'
          ? [x, y]
          : heading === 'right'
            ? [-y, x]
            : heading === 'down'
              ? [-x, -y]
              : [y, -x];
      ctx.fillStyle = c === 'b' ? bodyColor : SKY_AIRFIELD_PLANE_WING_COLOR;
      ctx.fillRect(cx + dx * px, cy + dy * px, px, px);
    }
  });
}

/**
 * The plane between its two views: the top-down sprite turned to `angle` (radians, 0 = nose
 * right, -PI/2 = nose up) with its wings folded to `wing` (1 = seen from above, 0 = seen side on), drawn at `scale`
 * (1 on the runway, smaller far away).
 */
export function drawTurningPlane(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  px: number,
  angle: number,
  wing: number,
  bodyColor: string,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(cx + px / 2, cy + px / 2);
  ctx.rotate(angle + Math.PI / 2);
  ctx.scale(scale, scale);
  PLANE_TOP.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = row[rx];
      if (c === '.') continue;
      const x = (rx - PLANE_MID_X) * (c === 'b' ? 1 : wing);
      ctx.fillStyle = c === 'b' ? bodyColor : SKY_AIRFIELD_PLANE_WING_COLOR;
      ctx.fillRect((x - 0.5) * px, (ry - PLANE_MID_Y - 0.5) * px, px, px);
    }
  });
  ctx.restore();
}

/** A rocket standing on its pad, nose up (5 x 11): `k` dark, `w` white, `s` the stage band, `g` leg. */
const ROCKET: string[] = [
  '..k..',
  '.kkk.',
  '.www.',
  '.www.',
  '.sss.',
  '.www.',
  '.www.',
  '.kkk.',
  '.www.',
  'gwwwg',
  'g.k.g',
];
const ROCKET_MID_X = 2;
const ROCKET_MID_Y = 5;
/** Flame length below the nozzle at full burn, in sprite pixels. */
const ROCKET_FLAME_LEN = 5;

/**
 * A rocket centred on (cx, cy), turned to `angle` (radians, -PI/2 = nose up, 0 = nose right) and
 * drawn at `scale`. `flame` 0..1 is the burn; `dust` 0..1 the cloud kicked up round the pad
 * (only drawn when the rocket stands upright). `sec` makes the flame flicker.
 */
export function drawRocket(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  px: number,
  angle: number,
  scale: number,
  bandColor: string,
  flame: number,
  dust: number,
  sec: number,
): void {
  ctx.save();
  ctx.translate(cx + px / 2, cy + px / 2);
  ctx.scale(scale, scale);
  if (dust > 0) {
    // a puff either side of the nozzle, spreading and thinning
    const a = ctx.globalAlpha;
    ctx.fillStyle = SKY_ROCKET_DUST_COLOR;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const reach = 3 + Math.floor(i / 2) * 2;
      ctx.globalAlpha = a * dust * (1 - Math.floor(i / 2) * 0.25);
      ctx.fillRect(
        (side * reach * (0.6 + 0.4 * dust) - 0.5) * px,
        (ROCKET.length - ROCKET_MID_Y - 1.5 - (i % 3)) * px,
        px,
        px,
      );
    }
    ctx.globalAlpha = a;
  }
  ctx.rotate(angle + Math.PI / 2);
  ROCKET.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = row[rx];
      if (c === '.') continue;
      ctx.fillStyle =
        c === 'k'
          ? SKY_ROCKET_DARK_COLOR
          : c === 'w'
            ? SKY_ROCKET_BODY_COLOR
            : c === 's'
              ? bandColor
              : SKY_ROCKET_LEG_COLOR;
      ctx.fillRect((rx - ROCKET_MID_X - 0.5) * px, (ry - ROCKET_MID_Y - 0.5) * px, px, px);
    }
  });
  if (flame > 0) {
    const flick = Math.floor(sec * 14) % 2;
    const len = Math.max(1, Math.round(ROCKET_FLAME_LEN * flame) - flick);
    for (let i = 0; i < len; i++) {
      ctx.fillStyle = SKY_ROCKET_FLAME_COLORS[i < len / 2 ? 0 : 1];
      const wide = i < 2 && flame > 0.5 ? 3 : 1;
      ctx.fillRect(
        (-Math.floor(wide / 2) - 0.5) * px,
        (ROCKET.length - ROCKET_MID_Y + i - 0.5) * px,
        wide * px,
        px,
      );
    }
  }
  ctx.restore();
}

/** A technician (3 x 5): `h` helmet, `s` skin, `v` vest, `l` legs, `t` the tool he works with. */
const TECH_FRAMES: string[][] = [
  ['.h.', '.s.', 'vvv', '.v.', 'l.l'],
  ['.h.', '.s.', 'vvt', '.v.', 'l.l'],
];
const TECH_COLORS: Record<string, string> = {
  h: SKY_TECH_HELMET_COLOR,
  s: SKY_TECH_SKIN_COLOR,
  v: SKY_TECH_VEST_COLOR,
  l: SKY_TECH_LEGS_COLOR,
  t: SKY_TECH_TOOL_COLOR,
};

/** A siren beacon (3 x 5): `d` dome, `c` the bright core, `r` rim, `b` base. */
const BEACON: string[] = ['.d.', 'dcd', 'dcd', 'rrr', 'bbb'];

type SignalStage = keyof typeof SKY_BEACON_COLORS;

/** Draws one rotating siren centred on (cx, cy): a bright pixel sweeps across the dome and the glow pulses. */
function drawBeacon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  px: number,
  stage: SignalStage,
  sec: number,
  phase: number,
): void {
  const colours = SKY_BEACON_COLORS[stage];
  const turn = (sec * SKY_BEACON_SWEEP_RATE + phase) % 1;
  // the beam passes the left, the front and the right of the dome in turn
  const step = Math.floor(turn * 4);
  const lit = [0, 1, 2, 1][step];
  const pulse = 0.5 + 0.5 * Math.sin(turn * Math.PI * 2);
  const a = ctx.globalAlpha;
  ctx.fillStyle = colours.glow;
  // the glow is a soft cross round the dome, pulsing with the sweep
  ctx.globalAlpha = a * SKY_BEACON_GLOW_ALPHA * (0.4 + 0.6 * pulse);
  ctx.fillRect(cx - 3 * px, cy - px, 7 * px, 2 * px);
  ctx.fillRect(cx - 2 * px, cy - 3 * px, 5 * px, 4 * px);
  ctx.globalAlpha = a;
  BEACON.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = row[rx];
      if (c === '.') continue;
      ctx.fillStyle =
        c === 'd'
          ? rx === lit && ry >= 1
            ? colours.core
            : colours.dome
          : c === 'c'
            ? colours.core
            : c === 'r'
              ? SKY_BEACON_RIM_COLOR
              : SKY_BEACON_BASE_COLOR;
      ctx.fillRect(cx + (rx - 1) * px, cy + (ry - 2) * px, px, px);
    }
  });
}

/**
 * What stands round a parked plane (or rocket) centred on (x, y): one siren beacon on the lot's outer edge (none for a plan), and for plan and tests a technician at the right wing working on it. Ready-to-merge
 * tasks get beacons only. `seed` offsets the flashing so neighbours don't pulse together.
 */
export function drawGroundCrew(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  stage: string,
  sec: number,
  seed: number,
): void {
  if (stage !== 'plan' && stage !== 'tests' && stage !== 'ready_to_merge') return;
  // one beacon per bay, on the lot's outer edge: the left edge of the left lot, the right edge of the right one.
  // A plan has no siren: its technician works on it quietly until the plan is published.
  if (stage !== 'plan') {
    const outer = stage === 'ready_to_merge' ? 6 : -6;
    drawBeacon(ctx, x + outer * px, y, px, stage, sec, seed);
  }
  if (stage === 'ready_to_merge') return;
  const frame = TECH_FRAMES[Math.floor(sec / SKY_TECH_WORK_SEC + seed * 7) % 2];
  frame.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = row[rx];
      if (c === '.') continue;
      ctx.fillStyle = TECH_COLORS[c];
      ctx.fillRect(x + (4 + rx) * px, y + (2 + ry - (c === 't' ? 1 : 0)) * px, px, px);
    }
  });
}

/** The pull request number a task id ends in (`branch#12` -> 12), or null. */
export function prNumberOfTaskId(id: string): number | null {
  const m = /#(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** "#N" centred under a parked plane or rocket at (x, y). */
export function drawPrNumber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  px: number,
  num: number,
): void {
  const size = Math.max(SKY_PR_NUMBER_MIN_FONT_PX, SKY_PR_NUMBER_SIZE_UNITS * px);
  ctx.font = `${size}px 'FS Pixel Sans'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const ty = y + SKY_PR_NUMBER_OFFSET_UNITS * px;
  ctx.fillStyle = SKY_PR_NUMBER_SHADOW_COLOR;
  ctx.fillText(`#${num}`, x + 1, ty + 1);
  ctx.fillStyle = SKY_PR_NUMBER_COLOR;
  ctx.fillText(`#${num}`, x, ty);
}

/** The field itself: grass, lots, terminals, taxiways and the two runways. `night` is 0..1. */
export function drawAirfield(
  ctx: CanvasRenderingContext2D,
  f: Airfield,
  sec: number,
  night: number,
): void {
  const px = f.px;
  const pick = (c: { day: string; night: string }): string =>
    toCss(mix(parseHex(c.day), parseHex(c.night), night));
  const rect = (colour: string, xU: number, yU: number, wU: number, hU: number): void => {
    ctx.fillStyle = colour;
    ctx.fillRect(f.left + xU * px, f.top + yU * px, wU * px, hU * px);
  };
  const hU = f.height / px;
  const T = SKY_AIRFIELD_TERMINAL_W;
  const L = SKY_AIRFIELD_LOT_W;
  const G = SKY_AIRFIELD_TAXI_W;
  const R = SKY_AIRFIELD_RUNWAY_W;
  const wU = f.width / px;
  const rwLx = T + L + G;
  const rwRx = wU - T - L - G - R;
  const lotRx = rwRx + R + G;
  const tarmac = pick(SKY_AIRFIELD_TARMAC);
  const runway = pick(SKY_AIRFIELD_RUNWAY);
  const mark = pick(SKY_AIRFIELD_MARKING);
  const taxiLine = pick(SKY_AIRFIELD_TAXI_LINE);

  // grass, mown in vertical stripes
  for (let x = 0, n = 0; x < wU; x += 8, n++) {
    const g = SKY_AIRFIELD_GRASS_COLORS[n % 2];
    rect(pick(g), x, 0, Math.min(8, wU - x), hU);
  }
  if (f.strip) {
    drawStrip(ctx, f, sec, night, pick, rect);
    return;
  }
  // lots, taxi gaps and the taxiway along the bottom
  rect(tarmac, T, 1, L, hU - 2);
  rect(tarmac, lotRx, 1, L, hU - 2);
  rect(tarmac, T + L, 0, G, hU - 2);
  rect(tarmac, rwRx + R, 0, G, hU - 2);
  const bandY = hU - SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM - SKY_AIRFIELD_TAXI_BAND_H / 2;
  rect(tarmac, T, bandY, wU - 2 * T, SKY_AIRFIELD_TAXI_BAND_H);
  // taxi centre lines: along the band and up the middle
  for (let x = T + 1; x < wU - T - 1; x += 4) {
    rect(taxiLine, x, hU - SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM, 2, 1);
  }
  const midX = Math.floor((rwLx + R + rwRx) / 2);
  rect(taxiLine, midX, 1, 1, bandY - 1);
  // terminals on the outer edges
  for (const tx of [0, wU - T]) {
    rect(pick(SKY_AIRFIELD_TERMINAL_EDGE), tx, 3, T, hU - 12);
    rect(pick(SKY_AIRFIELD_TERMINAL), tx + (tx === 0 ? 0 : 1), 4, T - 1, hU - 14);
    for (let y = 6; y < hU - 10; y += 4) {
      rect(
        night > 0.5 ? SKY_AIRFIELD_LIGHT_COLOR : pick(SKY_AIRFIELD_TERMINAL_EDGE),
        tx + Math.min(1, T - 1),
        y,
        1,
        1,
      );
    }
  }
  // parking-bay lines
  for (const lx of [T, lotRx]) {
    for (let k = 1; k <= f.slotRows; k++) {
      const y = 6 - 5 + k * SKY_AIRFIELD_SLOT_PITCH - 1;
      if (y < bandY - 1) rect(mark, lx + 2, y, L - 4, 1);
    }
  }
  // runways: edge lines, dashed centre, thresholds at both ends
  const lightOn = Math.floor(sec * SKY_AIRFIELD_LIGHT_RATE);
  for (const rx of [rwLx, rwRx]) {
    rect(runway, rx, 0, R, hU);
    rect(mark, rx, 0, 1, hU);
    rect(mark, rx + R - 1, 0, 1, hU);
    for (let y = 8; y < hU - 8; y += 6) rect(mark, rx + Math.floor(R / 2), y, 1, 3);
    for (const y of [1, hU - 3]) {
      for (let k = 1; k < R - 1; k += 2) rect(mark, rx + k, y, 1, 2);
    }
    if (night > 0) {
      ctx.globalAlpha = night;
      for (let y = 2, n = 0; y < hU - 1; y += 4, n++) {
        if ((n + lightOn) % 3 !== 0) continue;
        rect(SKY_AIRFIELD_LIGHT_COLOR, rx, y, 1, 1);
        rect(SKY_AIRFIELD_LIGHT_COLOR, rx + R - 1, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }
}

/** The strip's ground: runway, taxi column, the shared lot and a terminal on the right edge. */
function drawStrip(
  ctx: CanvasRenderingContext2D,
  f: Airfield,
  sec: number,
  night: number,
  pick: (c: { day: string; night: string }) => string,
  rect: (colour: string, xU: number, yU: number, wU: number, hU: number) => void,
): void {
  const hU = f.height / f.px;
  const wU = f.width / f.px;
  const R = SKY_AIRFIELD_RUNWAY_W;
  const G = SKY_AIRFIELD_TAXI_W;
  const L = SKY_AIRFIELD_STRIP_LOT_W;
  const T = SKY_AIRFIELD_TERMINAL_W;
  const tarmac = pick(SKY_AIRFIELD_TARMAC);
  const mark = pick(SKY_AIRFIELD_MARKING);
  const bandY = hU - SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM - SKY_AIRFIELD_TAXI_BAND_H / 2;
  rect(tarmac, R + G, 1, L, hU - 2);
  rect(tarmac, R, 0, G, hU - 2);
  rect(tarmac, 0, bandY, wU - T, SKY_AIRFIELD_TAXI_BAND_H);
  for (let x = 1; x < wU - T - 1; x += 4) {
    rect(pick(SKY_AIRFIELD_TAXI_LINE), x, hU - SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM, 2, 1);
  }
  rect(pick(SKY_AIRFIELD_TERMINAL_EDGE), wU - T, 3, T, hU - 12);
  rect(pick(SKY_AIRFIELD_TERMINAL), wU - T + 1, 4, T - 1, hU - 14);
  for (let y = 6; y < hU - 10; y += 4) {
    rect(
      night > 0.5 ? SKY_AIRFIELD_LIGHT_COLOR : pick(SKY_AIRFIELD_TERMINAL_EDGE),
      wU - T,
      y,
      1,
      1,
    );
  }
  for (let k = 1; k <= f.slotRows * 2; k++) {
    const y = 6 - 5 + k * SKY_AIRFIELD_SLOT_PITCH - 1;
    if (y < bandY - 1) rect(mark, R + G + 2, y, L - 4, 1);
  }
  const runway = pick(SKY_AIRFIELD_RUNWAY);
  rect(runway, 0, 0, R, hU);
  rect(mark, 0, 0, 1, hU);
  rect(mark, R - 1, 0, 1, hU);
  for (let y = 8; y < hU - 8; y += 6) rect(mark, Math.floor(R / 2), y, 1, 3);
  for (const y of [1, hU - 3]) {
    for (let k = 1; k < R - 1; k += 2) rect(mark, k, y, 1, 2);
  }
  if (night > 0) {
    const lightOn = Math.floor(sec * SKY_AIRFIELD_LIGHT_RATE);
    ctx.globalAlpha = night;
    for (let y = 2, n = 0; y < hU - 1; y += 4, n++) {
      if ((n + lightOn) % 3 !== 0) continue;
      rect(SKY_AIRFIELD_LIGHT_COLOR, 0, y, 1, 1);
      rect(SKY_AIRFIELD_LIGHT_COLOR, R - 1, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
