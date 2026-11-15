/** Canvas painting for the day/night sky (state lives in skyCycle.ts, which stays DOM-free). */

import {
  SKY_BAND_SPRITE_PX,
  SKY_BIG_STAR_CORE_COLOR,
  SKY_BIG_STAR_HALO_COLORS,
  SKY_BIRD_COLOR,
  SKY_BIRD_CROSS_SEC,
  SKY_BIRD_FLAP_SEC,
  SKY_BODY_RADIUS_SPRITE_PX,
  SKY_CLOUD_COLOR,
  SKY_CLOUD_CROSS_SEC,
  SKY_CLOUD_SHADE_COLOR,
  SKY_MOON_CHEEK_COLOR,
  SKY_MOON_COLOR,
  SKY_MOON_CRATER_COLOR,
  SKY_MOON_FACE_COLOR,
  SKY_MOON_RADIUS_SPRITE_PX,
  SKY_STAR_COLOR,
  SKY_SWIRL_COLORS,
  SKY_TWINKLE_SEC,
} from '../../constants.js';
import {
  BIG_STARS,
  BIRDS,
  CLOUDS,
  hourFraction,
  mix,
  parseHex,
  skyAt,
  skyOverride,
  STARS,
  SWIRLS,
  toCss,
} from './skyCycle.js';

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
    const sec0 = now.getTime() / 1000;
    // Van Gogh swirls: slowly rolling wavy bands of lighter blue
    for (const [i, sw] of SWIRLS.entries()) {
      ctx.fillStyle = SKY_SWIRL_COLORS[i % SKY_SWIRL_COLORS.length];
      ctx.globalAlpha = sky.starAlpha * 0.55;
      const step = 2 * px;
      for (let x = 0; x < w; x += step) {
        const u = x / w;
        const y =
          (sw.y + Math.sin(u * sw.freq * Math.PI * 2 + sw.phase + sec0 * 0.15) * sw.amp) * h;
        ctx.fillRect(x, Math.round(y / px) * px, step, sw.thick * px);
      }
    }
    // Big glowing stars: bright core, stepped halo rings, a slow pulse
    for (const st of BIG_STARS) {
      const pulse = 0.75 + 0.25 * Math.sin(sec0 * 1.2 + st.phase);
      const sx = Math.round((st.x * w) / px) * px;
      const sy = Math.round((st.y * h) / px) * px;
      for (let ring = SKY_BIG_STAR_HALO_COLORS.length; ring >= 1; ring--) {
        ctx.fillStyle = SKY_BIG_STAR_HALO_COLORS[ring - 1];
        ctx.globalAlpha = sky.starAlpha * pulse * (0.7 - ring * 0.15);
        const rr = (st.size + ring * 2) * px;
        ctx.fillRect(sx - rr, sy - px, 2 * rr + px, 2 * px);
        ctx.fillRect(sx - px, sy - rr, 2 * px, 2 * rr + px);
        disc(ctx, sx, sy, st.size + ring, px);
      }
      ctx.globalAlpha = sky.starAlpha;
      ctx.fillStyle = SKY_BIG_STAR_CORE_COLOR;
      disc(ctx, sx, sy, st.size - 1, px);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = SKY_STAR_COLOR;
    const sec = now.getTime() / 1000;
    for (const star of STARS) {
      const tw = 0.6 + 0.4 * Math.sin((sec / SKY_TWINKLE_SEC + star.phase) * Math.PI * 2);
      ctx.globalAlpha = sky.starAlpha * tw;
      ctx.fillRect(Math.round((star.x * w) / px) * px, Math.round((star.y * h) / px) * px, px, px);
    }
    ctx.globalAlpha = 1;
  }

  if (sky.dayAlpha > 0) {
    const sec = now.getTime() / 1000;
    ctx.globalAlpha = sky.dayAlpha;
    // Clouds: a flat-bottomed puff of rects, drifting right and wrapping around
    for (const c of CLOUDS) {
      const u = px * c.scale;
      const cw = 14 * u;
      const x =
        Math.round((((c.phase + (sec / SKY_CLOUD_CROSS_SEC) * c.speed) % 1) * (w + cw) - cw) / px) *
        px;
      const y = Math.round((c.y * h) / px) * px;
      ctx.fillStyle = SKY_CLOUD_COLOR;
      ctx.fillRect(x + 2 * u, y, 5 * u, u);
      ctx.fillRect(x + 7 * u, y + u, 4 * u, u);
      ctx.fillRect(x + u, y + u, 10 * u, 2 * u);
      ctx.fillRect(x, y + 2 * u, 14 * u, 2 * u);
      ctx.fillStyle = SKY_CLOUD_SHADE_COLOR;
      ctx.fillRect(x + u, y + 4 * u, 12 * u, u);
    }
    // Birds: little flapping V shapes crossing the sky with a gentle bob
    ctx.fillStyle = SKY_BIRD_COLOR;
    const flapUp = Math.floor(sec / SKY_BIRD_FLAP_SEC) % 2 === 0;
    for (const b of BIRDS) {
      const x =
        Math.round((((b.phase + sec / SKY_BIRD_CROSS_SEC) % 1) * (w + 12 * px) - 6 * px) / px) * px;
      const y = Math.round((b.y * h + Math.sin(sec * 1.5 + b.bob) * 3 * px) / px) * px;
      if (flapUp) {
        ctx.fillRect(x, y, px, px);
        ctx.fillRect(x + px, y + px, px, px);
        ctx.fillRect(x + 2 * px, y + 2 * px, px, px);
        ctx.fillRect(x + 3 * px, y + px, px, px);
        ctx.fillRect(x + 4 * px, y, px, px);
      } else {
        ctx.fillRect(x, y + px, 2 * px, px);
        ctx.fillRect(x + 2 * px, y + 2 * px, px, px);
        ctx.fillRect(x + 3 * px, y + px, 2 * px, px);
      }
    }
    ctx.globalAlpha = 1;
  }

  const r = SKY_BODY_RADIUS_SPRITE_PX;
  if (sky.sun) {
    ctx.fillStyle = sky.sun.color;
    const [sx, sy] = arcPosition(sky.sun.p, sky.sun.lift, (r + 1) * px, w, h, avoid);
    const ox = Math.round(sx / px) * px;
    const oy = Math.round(sy / px) * px;
    disc(ctx, ox, oy, r, px);
    // cartoon face to match the moon
    ctx.fillStyle = SKY_MOON_FACE_COLOR;
    ctx.fillRect(ox - 3 * px, oy - 2 * px, px, 2 * px);
    ctx.fillRect(ox + 2 * px, oy - 2 * px, px, 2 * px);
    ctx.fillRect(ox - 2 * px, oy + 2 * px, px, px);
    ctx.fillRect(ox - px, oy + 3 * px, 3 * px, px);
    ctx.fillRect(ox + 2 * px, oy + 2 * px, px, px);
    ctx.fillStyle = SKY_MOON_CHEEK_COLOR;
    ctx.fillRect(ox - 6 * px, oy + px, 2 * px, px);
    ctx.fillRect(ox + 4 * px, oy + px, 2 * px, px);
  }
  if (sky.moon) {
    const mr = SKY_MOON_RADIUS_SPRITE_PX;
    const [cx, cy] = arcPosition(sky.moon.p, sky.moon.lift, (mr + 1) * px, w, h, avoid);
    const mx = Math.round(cx / px) * px;
    const my = Math.round(cy / px) * px;
    const dot = (dx: number, dy: number, sw = 1, sh = 1): void =>
      ctx.fillRect(mx + dx * px, my + dy * px, sw * px, sh * px);
    ctx.fillStyle = SKY_MOON_COLOR;
    disc(ctx, mx, my, mr, px);
    // craters
    ctx.fillStyle = SKY_MOON_CRATER_COLOR;
    dot(-8, -6, 3, 3);
    dot(5, 5, 3, 2);
    dot(6, -7, 2, 2);
    // face: eyes, smile, rosy cheeks
    ctx.fillStyle = SKY_MOON_FACE_COLOR;
    dot(-5, -3, 2, 3);
    dot(3, -3, 2, 3);
    dot(-3, 3);
    dot(-2, 4, 5, 1);
    dot(3, 3);
    ctx.fillStyle = SKY_MOON_CHEEK_COLOR;
    dot(-7, 1, 2, 2);
    dot(5, 1, 2, 2);
  }
}
