/**
 * The airfield at the right of the sky: a left lot (plan tasks park here) beside the take-off
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
  SKY_AIRFIELD_TARMAC,
  SKY_AIRFIELD_TAXI_BAND_H,
  SKY_AIRFIELD_TAXI_LINE,
  SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM,
  SKY_AIRFIELD_TAXI_W,
  SKY_AIRFIELD_TERMINAL,
  SKY_AIRFIELD_TERMINAL_EDGE,
  SKY_AIRFIELD_TERMINAL_W,
  SKY_AIRFIELD_WIDTH,
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
}

export function airfieldLayout(w: number, horizonY: number, px: number): Airfield {
  const hU = Math.max(
    SKY_AIRFIELD_HEIGHT_MIN,
    Math.min(SKY_AIRFIELD_HEIGHT_MAX, Math.floor((horizonY * SKY_AIRFIELD_HEIGHT_SHARE) / px)),
  );
  const wU = SKY_AIRFIELD_WIDTH;
  const left = Math.round((w - (wU + SKY_AIRFIELD_MARGIN) * px) / px) * px;
  const top = Math.round((horizonY - hU * px) / px) * px;
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
    gapL: left + (gapLx + 1) * px,
    gapR: left + (gapRx + 1) * px,
    lotL: left + (lotLx + Math.floor(L / 2)) * px,
    lotR: left + (lotRx + Math.floor(L / 2)) * px,
    slotTop: top + 6 * px,
    slotRows: Math.max(1, Math.floor(slotsH / SKY_AIRFIELD_SLOT_PITCH)),
  };
}

/** Where a parked plane's middle sits. Extra planes beyond the rows tuck in beside the first column. */
export function slotPoint(f: Airfield, lot: AirfieldLot, slot: number): [number, number] {
  const row = slot % f.slotRows;
  const col = Math.floor(slot / f.slotRows);
  const x = (lot === 'plan' ? f.lotL : f.lotR) + (col % 2 === 0 ? 1 : -1) * col * 2 * f.px;
  const y = f.slotTop + (row * SKY_AIRFIELD_SLOT_PITCH + col * 4) * f.px;
  return [x, y];
}

/** A plane seen from above, nose up, 9 x 9: `b` body (the stage colour), `w` wing. */
const PLANE_TOP: string[] = [
  '....b....',
  '...bbb...',
  '..wbbbw..',
  'wwwbbbwww',
  '.wwbbbww.',
  '...bbb...',
  '..wbbbw..',
  '...bbb...',
  '....b....',
];

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
      const x = rx - 4;
      const y = ry - 4;
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
        tx + 1,
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
