/** Draws the merge celebration (see mergeCelebration.ts) on a canvas, in pixel art. */
import {
  SKY_BUTTON_BALLOON,
  SKY_BUTTON_ISS,
  SKY_MERGE_CANOPY,
  SKY_MERGE_FLAME,
  SKY_MERGE_MODULE,
  SKY_MERGE_PACKET,
  SKY_MERGE_PALETTE,
  SKY_MERGE_PLANE_COLOR,
  SKY_MERGE_ROCKET_BAND,
  SKY_MERGE_STRIPES,
} from '../../constants.js';
import { type CelebrationKind, dayFrame, nightFrame } from './mergeCelebration.js';
import { drawRocket, drawTurningPlane } from './skyAirfield.js';

interface View {
  ctx: CanvasRenderingContext2D;
  /** Device pixels per sprite pixel of the button, and the sprite's centre in device pixels. */
  u: number;
  cx: number;
  cy: number;
  /** Device pixels per sprite pixel of the plane and rocket. */
  fp: number;
}

/** A w x h block whose top-left corner is (x, y) sprite pixels from the centre. */
function cell(v: View, x: number, y: number, color: string, w = 1, h = 1): void {
  v.ctx.fillStyle = color;
  v.ctx.fillRect(Math.round(v.cx + x * v.u), Math.round(v.cy + y * v.u), w * v.u, h * v.u);
}

/** Draws `rows` centred on (x, y); `skip` leaves single pixels out. */
function sprite(
  v: View,
  rows: readonly string[],
  x: number,
  y: number,
  skip?: (rx: number, ry: number) => boolean,
): void {
  const ox = x - rows[0].length / 2;
  const oy = y - rows.length / 2;
  rows.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (ch === '.' || skip?.(rx, ry)) return;
      cell(v, ox + rx, oy + ry, SKY_MERGE_PALETTE[ch]);
    }),
  );
}

const ISS_MID = (SKY_BUTTON_ISS[0].length - 1) / 2;
/** Columns either side of the hub that stay put when the panels fold. */
const ISS_HUB = 3;
const issX = (d: number, fold: number): number =>
  Math.abs(d) > ISS_HUB ? Math.sign(d) * (ISS_HUB + Math.round((Math.abs(d) - ISS_HUB) * fold)) : d;

/** The ISS with its panels folded to `fold` of their width, lit up by `flash`. */
function drawIss(v: View, fold: number, flash: number): void {
  const rows = SKY_BUTTON_ISS;
  const top = -rows.length / 2;
  rows.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (ch === '.') return;
      const lit = flash > 0.5 && ch !== 'p';
      cell(v, issX(rx - ISS_MID, fold) - 0.5, top + ry, SKY_MERGE_PALETTE[lit ? 'h' : ch]);
    }),
  );
  if (flash < 0.3) return;
  // a sparkle on the hub and at the four panel corners
  const corners: Array<[number, number]> = [
    [0, 3],
    [-ISS_MID, 0],
    [ISS_MID, 0],
    [-ISS_MID, rows.length - 1],
    [ISS_MID, rows.length - 1],
  ];
  for (const [d, ry] of corners) {
    const x = issX(d, fold) - 0.5;
    const y = top + ry;
    cell(v, x - 1, y, SKY_MERGE_PALETTE.h);
    cell(v, x + 1, y, SKY_MERGE_PALETTE.h);
    cell(v, x, y - 1, SKY_MERGE_PALETTE.h);
    cell(v, x, y + 1, SKY_MERGE_PALETTE.h);
  }
}

function drawNight(v: View, t: number): void {
  const f = nightFrame(t);
  drawIss(v, f.fold, f.flash);
  if (f.module) {
    // it dissolves pixel by pixel once its work is done
    const gone = f.module.vanish;
    sprite(
      v,
      SKY_MERGE_MODULE,
      f.module.x,
      f.module.y,
      (rx, ry) => ((rx * 7 + ry * 3) % 10) / 10 < gone,
    );
  }
  if (f.rocket) {
    const { x, y } = f.rocket;
    drawRocket(
      v.ctx,
      Math.round(v.cx + x * v.u),
      Math.round(v.cy + y * v.u),
      v.fp,
      -Math.PI / 2,
      1,
      SKY_MERGE_ROCKET_BAND,
      1,
      0,
      t,
    );
  }
}

/** The balloon; its envelope is drawn column by column, each coloured by where on the turn it faces. */
function drawBalloon(
  v: View,
  t: number,
  lift: number,
  spin: number,
  bob: number,
  flame: number,
): void {
  const rows = SKY_BUTTON_BALLOON;
  const mid = (rows[0].length - 1) / 2;
  const top = -rows.length / 2 - lift;
  const envelopeRows = 10;
  const basketFrom = 13;
  rows.forEach((row, ry) => {
    const first = row.search(/[^.]/);
    const last = row.replace(/\.+$/, '').length - 1;
    if (first < 0) return;
    const y = top + ry + (ry >= basketFrom ? bob : 0);
    if (ry >= envelopeRows) {
      for (let rx = first; rx <= last; rx++) {
        if (row[rx] !== '.') cell(v, rx - mid - 0.5, y, SKY_MERGE_PALETTE[row[rx]]);
      }
      return;
    }
    const half = (last - first + 1) / 2;
    for (let rx = first; rx <= last; rx++) {
      const face = (rx - first + 0.5 - half) / half;
      const phi = Math.asin(Math.max(-1, Math.min(1, face))) + spin;
      const sector = Math.floor((phi + Math.PI / 2) / (Math.PI / 5));
      const letter = SKY_MERGE_STRIPES[((sector % 10) + 10) % 10];
      cell(v, rx - mid - 0.5, y, SKY_MERGE_PALETTE[letter]);
    }
  });
  if (flame) {
    const frame = SKY_MERGE_FLAME[Math.floor(t * 12) % 2];
    // under the skirt, in front of the ropes
    sprite(v, frame, 0, top + envelopeRows + 2);
  }
}

function drawDay(v: View, t: number, reach: { left: number; right: number }): void {
  const f = dayFrame(t, reach);
  drawBalloon(v, t, f.lift, f.spin, f.bob, f.flame);
  if (f.chute) {
    const { x, y, canopy } = f.chute;
    if (canopy > 0.05) {
      const sink = (1 - canopy) * 2;
      // a collapsing canopy loses its top row
      sprite(v, SKY_MERGE_CANOPY, x, y - 4 + sink, (_rx, ry) => canopy <= 0.5 && ry === 0);
      cell(v, x - 1.5, y - 3 + sink, SKY_MERGE_PALETTE.k);
      cell(v, x + 0.5, y - 3 + sink, SKY_MERGE_PALETTE.k);
      cell(v, x - 1, y - 2 + sink, SKY_MERGE_PALETTE.k, 2, 1);
    }
    sprite(v, SKY_MERGE_PACKET, x, y);
  }
  if (f.plane) {
    drawTurningPlane(
      v.ctx,
      Math.round(v.cx + f.plane.x * v.u),
      Math.round(v.cy + f.plane.y * v.u),
      v.fp,
      0,
      1,
      SKY_MERGE_PLANE_COLOR,
    );
  }
}

/**
 * Draws one frame of a celebration `t` seconds in. `centre` is the button sprite's centre and `unit`
 * its device pixels per sprite pixel; `flyerPx` sizes the plane and rocket; `reach` is the room left
 * and right of the sprite to the screen's edges, in sprite pixels.
 */
export function drawCelebration(
  ctx: CanvasRenderingContext2D,
  kind: CelebrationKind,
  t: number,
  centre: { x: number; y: number },
  unit: number,
  flyerPx: number,
  reach: { left: number; right: number },
): void {
  ctx.imageSmoothingEnabled = false;
  const v: View = { ctx, u: unit, cx: centre.x, cy: centre.y, fp: flyerPx };
  if (kind === 'night') drawNight(v, t);
  else drawDay(v, t, reach);
}
