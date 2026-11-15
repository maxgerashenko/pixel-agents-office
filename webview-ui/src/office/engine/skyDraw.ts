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
  SKY_MOON_COLOR,
  SKY_MOON_CRATER_COLOR,
  SKY_MOON_GLOW_COLOR,
  SKY_MOON_MARE_COLOR,
  SKY_MOON_RADIUS_SPRITE_PX,
  SKY_MOON_SHADE_COLOR,
  SKY_STAR_COLOR,
  SKY_SUN_HIGHLIGHT_COLOR,
  SKY_SUN_RAY_COLOR,
  SKY_SUN_RAY_COUNT,
  SKY_SUN_RAY_SPIN,
  SKY_SUN_RIM_COLOR,
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

/** The sun: soft glow, slowly turning rays, a shaded body with a highlight, and a friendly face. */
function drawSun(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  r: number,
  px: number,
  color: string,
  sec: number,
): void {
  const base = parseHex(color);
  // Glow: three soft stepped rings
  ctx.fillStyle = color;
  for (const [rad, a] of [
    [r + 7, 0.1],
    [r + 5, 0.16],
    [r + 3, 0.26],
  ]) {
    ctx.globalAlpha = a;
    disc(ctx, ox, oy, rad, px);
  }
  ctx.globalAlpha = 1;
  // Rays: alternating long and short, turning slowly
  ctx.fillStyle = SKY_SUN_RAY_COLOR;
  for (let i = 0; i < SKY_SUN_RAY_COUNT; i++) {
    const ang = (i / SKY_SUN_RAY_COUNT) * Math.PI * 2 + sec * SKY_SUN_RAY_SPIN;
    const len = i % 2 === 0 ? 6 : 3;
    for (let s = r + 2; s < r + 2 + len; s++) {
      const rx = Math.round((ox + Math.cos(ang) * s * px) / px) * px;
      const ry = Math.round((oy + Math.sin(ang) * s * px) / px) * px;
      ctx.fillRect(rx, ry, px, px);
      if (i % 2 === 0 && s < r + 2 + len - 2) ctx.fillRect(rx + px, ry, px, px);
    }
  }
  // Body: warm rim, body colour, bright highlight top-left
  ctx.fillStyle = SKY_SUN_RIM_COLOR;
  disc(ctx, ox, oy, r, px);
  ctx.fillStyle = toCss(mix(base, parseHex(SKY_SUN_RIM_COLOR), 0.25));
  disc(ctx, ox, oy, r - 1, px);
  ctx.fillStyle = color;
  disc(ctx, ox - px, oy - px, r - 2, px);
  ctx.fillStyle = SKY_SUN_HIGHLIGHT_COLOR;
  for (let dy = -r; dy <= 0; dy++) {
    for (let dx = -r; dx <= 0; dx++) {
      const d2 = (dx + 5) * (dx + 5) + (dy + 5) * (dy + 5);
      if (d2 <= 5) ctx.fillRect(ox + dx * px, oy + dy * px, px, px);
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
    // Rolling waves: taller bands sliding across, each with a light crest line
    for (const [i, sw] of SWIRLS.entries()) {
      const step = 2 * px;
      const dir = i % 2 === 0 ? 1 : -1;
      for (let x = 0; x < w; x += step) {
        const u = x / w;
        const y =
          (sw.y +
            Math.sin(u * sw.freq * Math.PI * 2 + sw.phase + dir * sec0 * 0.7) * sw.amp * 1.6) *
          h;
        const yy = Math.round(y / px) * px;
        ctx.fillStyle = SKY_SWIRL_COLORS[i % SKY_SWIRL_COLORS.length];
        ctx.globalAlpha = sky.starAlpha * 0.6;
        ctx.fillRect(x, yy, step, sw.thick * px);
        ctx.fillStyle = SKY_SWIRL_COLORS[(i + 2) % SKY_SWIRL_COLORS.length];
        ctx.globalAlpha = sky.starAlpha * 0.9;
        ctx.fillRect(x, yy - px, step, px);
      }
    }
    // Starry Night stars: a glowing core wrapped in concentric rings of turning
    // yellow / blue / orange dashes, pulsing softly
    for (const st of BIG_STARS) {
      const pulse = 0.8 + 0.2 * Math.sin(sec0 * 1.2 + st.phase);
      const sx = Math.round((st.x * w) / px) * px;
      const sy = Math.round((st.y * h) / px) * px;
      ctx.fillStyle = SKY_BIG_STAR_HALO_COLORS[0];
      ctx.globalAlpha = sky.starAlpha * pulse * 0.18;
      disc(ctx, sx, sy, st.size * 3, px);
      SKY_BIG_STAR_HALO_COLORS.forEach((col, k) => {
        const rad = st.size + 2 + k * 2;
        const dashes = 10 + k * 6;
        const spin = sec0 * (k % 2 === 0 ? 0.5 : -0.5) + st.phase;
        ctx.fillStyle = col;
        for (let j = 0; j < dashes; j++) {
          if (j % 2 === 1) continue;
          for (const sub of [0, 0.5]) {
            const ang = ((j + sub) / dashes) * Math.PI * 2 + spin;
            ctx.globalAlpha = sky.starAlpha * pulse * 0.9;
            ctx.fillRect(
              Math.round((sx + Math.cos(ang) * rad * px) / px) * px,
              Math.round((sy + Math.sin(ang) * rad * px) / px) * px,
              px,
              px,
            );
          }
        }
      });
      ctx.globalAlpha = sky.starAlpha;
      ctx.fillStyle = SKY_BIG_STAR_HALO_COLORS[0];
      disc(ctx, sx, sy, st.size, px);
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
    const [sx, sy] = arcPosition(sky.sun.p, sky.sun.lift, (r + 1) * px, w, h, avoid);
    drawSun(
      ctx,
      Math.round(sx / px) * px,
      Math.round(sy / px) * px,
      r,
      px,
      sky.sun.color,
      now.getTime() / 1000,
    );
  }
  if (sky.moon) {
    const mr = SKY_MOON_RADIUS_SPRITE_PX;
    const [cx, cy] = arcPosition(sky.moon.p, sky.moon.lift, (mr + 1) * px, w, h, avoid);
    const mx = Math.round(cx / px) * px;
    const my = Math.round(cy / px) * px;
    const dot = (dx: number, dy: number, sw = 1, sh = 1): void =>
      ctx.fillRect(mx + dx * px, my + dy * px, sw * px, sh * px);
    // soft glow
    ctx.fillStyle = SKY_MOON_GLOW_COLOR;
    for (const [gr, ga] of [
      [mr + 6, 0.07],
      [mr + 4, 0.1],
      [mr + 2, 0.16],
    ]) {
      ctx.globalAlpha = ga;
      disc(ctx, mx, my, gr, px);
    }
    ctx.globalAlpha = 1;
    // sphere: lit face, shadow creeping in from the lower right
    ctx.fillStyle = SKY_MOON_COLOR;
    disc(ctx, mx, my, mr, px);
    ctx.fillStyle = SKY_MOON_MARE_COLOR;
    for (const [mxo, myo, mrad] of [
      [-5, -5, 5],
      [3, -8, 3],
      [-8, 3, 4],
      [4, 2, 4],
    ]) {
      disc(ctx, mx + mxo * px, my + myo * px, mrad, px);
    }
    ctx.fillStyle = SKY_MOON_SHADE_COLOR;
    for (let dy = -mr; dy <= mr; dy++) {
      for (let dx = -mr; dx <= mr; dx++) {
        if (dx * dx + dy * dy > mr * mr + mr) continue;
        const lit = (dx - 7) * (dx - 7) + (dy - 7) * (dy - 7);
        if (lit > (mr + 7) * (mr + 7) - 40) dot(dx, dy);
      }
    }
    // craters: dark bowl with a bright rim on the lit side
    for (const [cdx, cdy, cr] of [
      [-9, -9, 2],
      [-2, -11, 1],
      [8, -4, 2],
      [-12, 0, 1],
      [-4, 4, 3],
      [3, 9, 2],
      [9, 7, 1],
      [-8, 9, 1],
      [1, -3, 1],
      [-1, 12, 1],
    ]) {
      ctx.fillStyle = SKY_MOON_CRATER_COLOR;
      disc(ctx, mx + cdx * px, my + cdy * px, cr, px);
      ctx.fillStyle = SKY_MOON_COLOR;
      ctx.fillRect(mx + (cdx - cr) * px, my + (cdy - cr) * px, px, px);
    }
  }
}
