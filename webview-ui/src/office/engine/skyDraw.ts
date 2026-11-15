/** Canvas painting for the day/night sky (state lives in skyCycle.ts, which stays DOM-free). */

import {
  SKY_BAND_SPRITE_PX,
  SKY_BODY_RADIUS_SPRITE_PX,
  SKY_MOON_COLOR,
  SKY_MOON_CRATER_COLOR,
  SKY_STAR_COLOR,
  SKY_TWINKLE_SEC,
} from '../../constants.js';
import { hourFraction, mix, parseHex, skyAt, skyOverride, STARS, toCss } from './skyCycle.js';

function disc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  px: number,
): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius + radius) {
        ctx.fillRect(cx + dx * px, cy + dy * px, px, px);
      }
    }
  }
}

/**
 * Where a body is on its rainbow arc: left to right across the canvas, rising
 * from the horizon (just inside the layout's top edge, so it ducks behind the
 * office) to a peak in the sky above it. Returns canvas pixels.
 */
function arcPosition(
  p: number,
  lift: number,
  r: number,
  w: number,
  h: number,
  rect?: { x: number; y: number; w: number; h: number },
): [number, number] {
  const horizon = rect ? rect.y + 2 * r : h * 0.9;
  const peak = Math.max(0, horizon - 3 * r);
  return [-r + p * (w + 2 * r), Math.max(r, horizon - lift * peak)];
}

/** Paint the sky over the whole canvas. `zoom` = device pixels per sprite pixel. */
export function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  zoom: number,
  avoid?: { x: number; y: number; w: number; h: number },
  now: Date = new Date(),
): void {
  const t = skyOverride() ?? hourFraction(now);
  const sky = skyAt(t);
  const px = Math.max(1, Math.round(zoom));
  const band = SKY_BAND_SPRITE_PX * px;
  const top = parseHex(sky.top);
  const bottom = parseHex(sky.bottom);
  const bands = Math.max(1, Math.ceil(h / band));
  for (let n = 0; n < bands; n++) {
    ctx.fillStyle = toCss(mix(top, bottom, bands === 1 ? 0 : n / (bands - 1)));
    ctx.fillRect(0, n * band, w, band);
  }

  if (sky.starAlpha > 0) {
    ctx.fillStyle = SKY_STAR_COLOR;
    const sec = now.getTime() / 1000;
    for (const star of STARS) {
      const tw = 0.6 + 0.4 * Math.sin((sec / SKY_TWINKLE_SEC + star.phase) * Math.PI * 2);
      ctx.globalAlpha = sky.starAlpha * tw;
      ctx.fillRect(Math.round((star.x * w) / px) * px, Math.round((star.y * h) / px) * px, px, px);
    }
    ctx.globalAlpha = 1;
  }

  const r = SKY_BODY_RADIUS_SPRITE_PX;
  if (sky.sun) {
    ctx.fillStyle = sky.sun.color;
    const [sx, sy] = arcPosition(sky.sun.p, sky.sun.lift, (r + 1) * px, w, h, avoid);
    disc(ctx, Math.round(sx / px) * px, Math.round(sy / px) * px, r, px);
  }
  if (sky.moon) {
    const [cx, cy] = arcPosition(sky.moon.p, sky.moon.lift, (r + 1) * px, w, h, avoid);
    const mx = Math.round(cx / px) * px;
    const my = Math.round(cy / px) * px;
    ctx.fillStyle = SKY_MOON_COLOR;
    disc(ctx, mx, my, r, px);
    ctx.fillStyle = SKY_MOON_CRATER_COLOR;
    ctx.fillRect(mx - 2 * px, my - px, 2 * px, 2 * px);
    ctx.fillRect(mx + px, my + 2 * px, 2 * px, px);
  }
}
