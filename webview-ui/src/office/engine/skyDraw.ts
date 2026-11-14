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

/** Nudge a body's centre out of the layout rect into the nearest free margin that fits it. */
function clearOfLayout(
  x: number,
  y: number,
  r: number,
  w: number,
  h: number,
  rect?: { x: number; y: number; w: number; h: number },
): [number, number] {
  if (!rect) return [x, y];
  const inside =
    x > rect.x - r && x < rect.x + rect.w + r && y > rect.y - r && y < rect.y + rect.h + r;
  if (!inside) return [x, y];
  const opts: Array<{ d: number; pos: [number, number] }> = [];
  if (rect.y >= 2 * r) opts.push({ d: y - (rect.y - r), pos: [x, rect.y / 2] });
  if (h - (rect.y + rect.h) >= 2 * r)
    opts.push({ d: rect.y + rect.h + r - y, pos: [x, (h + rect.y + rect.h) / 2] });
  if (rect.x >= 2 * r) opts.push({ d: x - (rect.x - r), pos: [rect.x / 2, y] });
  if (w - (rect.x + rect.w) >= 2 * r)
    opts.push({ d: rect.x + rect.w + r - x, pos: [(w + rect.x + rect.w) / 2, y] });
  if (opts.length === 0) return [x, y];
  opts.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
  return opts[0].pos;
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
    const [sx, sy] = clearOfLayout(sky.sun.x * w, sky.sun.y * h, (r + 1) * px, w, h, avoid);
    disc(ctx, Math.round(sx / px) * px, Math.round(sy / px) * px, r, px);
  }
  if (sky.moon) {
    const [cx, cy] = clearOfLayout(sky.moon.x * w, sky.moon.y * h, (r + 1) * px, w, h, avoid);
    const mx = Math.round(cx / px) * px;
    const my = Math.round(cy / px) * px;
    ctx.fillStyle = SKY_MOON_COLOR;
    disc(ctx, mx, my, r, px);
    ctx.fillStyle = SKY_MOON_CRATER_COLOR;
    ctx.fillRect(mx - 2 * px, my - px, 2 * px, 2 * px);
    ctx.fillRect(mx + px, my + 2 * px, 2 * px, px);
  }
}
