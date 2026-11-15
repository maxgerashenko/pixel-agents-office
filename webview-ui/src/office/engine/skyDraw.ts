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
  SKY_CLOUD_SUNSET_COLOR,
  SKY_CLOUD_SUNSET_LIT_COLOR,
  SKY_MOON_COLOR,
  SKY_MOON_CRATER_COLOR,
  SKY_MOON_DESIGN_RADIUS,
  SKY_MOON_GLOW_COLOR,
  SKY_MOON_MARE_COLOR,
  SKY_MOON_MAX_CANVAS_SHARE,
  SKY_MOON_RADIUS_SPRITE_PX,
  SKY_MOON_SHADE_COLOR,
  SKY_NIGHT_BAND_COLOR,
  SKY_NIGHT_BASE_COLOR,
  SKY_RING_COLORS,
  SKY_RING_DAY_ALPHA,
  SKY_RING_SHARE,
  SKY_RING_SUNSET_SHARE,
  SKY_STAR_COLOR,
  SKY_STROKE_AREA_SPRITE_PX,
  SKY_STROKE_MAX,
  SKY_SUN_CORE_COLOR,
  SKY_SWIRL_COLORS,
  SKY_TWINKLE_SEC,
  SKY_VORTICES,
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

/** A filled pixel disc drawn as one span per row: cheap enough for rings hundreds of pixels wide. */
function spanDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  px: number,
  w: number,
  h: number,
): void {
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy * px;
    if (y < -px || y > h) continue;
    const half = Math.floor(Math.sqrt(radius * radius - dy * dy));
    const x0 = Math.max(0, cx - half * px);
    const x1 = Math.min(w, cx + (half + 1) * px);
    if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, px);
  }
}

let nightCache: { key: string; canvas: HTMLCanvasElement } | null = null;

/**
 * The Starry Night sky: thousands of short brushstrokes following a flow field
 * that curls around two spirals and rolls in gentle waves elsewhere. Painted
 * once per canvas size into an offscreen canvas (it never changes), then
 * blitted each frame.
 */
function nightBackdrop(w: number, h: number, px: number): HTMLCanvasElement {
  const key = `${w}x${h}x${px}`;
  if (nightCache?.key === key) return nightCache.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  nightCache = { key, canvas };
  if (!c) return canvas;
  c.fillStyle = SKY_NIGHT_BASE_COLOR;
  c.fillRect(0, 0, w, h);
  let seed = 2024;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const side = Math.min(w, h);
  const count = Math.min(
    SKY_STROKE_MAX,
    Math.floor((w * h) / (SKY_STROKE_AREA_SPRITE_PX * px * px)),
  );
  const step = 2 * px;
  const last = SKY_SWIRL_COLORS.length - 1;
  for (let n = 0; n < count; n++) {
    let x = rnd() * w;
    let y = rnd() * h;
    // how close this stroke starts to a spiral core (paler there)
    let near = 0;
    for (const v of SKY_VORTICES) {
      const d = Math.hypot(x - v.x * w, y - v.y * h) / (v.r * side);
      near = Math.max(near, Math.exp(-d * d));
    }
    const band = 0.66 + 0.07 * Math.sin((x / w) * 5 + 0.6);
    const inBand = Math.abs(y / h - band) < 0.05 && rnd() < 0.55;
    c.fillStyle = inBand
      ? SKY_NIGHT_BAND_COLOR
      : SKY_SWIRL_COLORS[Math.min(last, Math.floor(rnd() * 3.4 + near * 2.4))];
    const len = 4 + Math.floor(rnd() * 5);
    for (let s = 0; s < len; s++) {
      c.fillRect(Math.round(x / px) * px, Math.round(y / px) * px, 2 * px, px);
      // flow: gentle rolling waves, bent into a spiral near each vortex
      const wave = Math.sin((x / w) * 7 + (y / h) * 4) * 0.5;
      let fx = Math.cos(wave) * 0.5;
      let fy = Math.sin(wave) * 0.5;
      for (const v of SKY_VORTICES) {
        const dx = x - v.x * w;
        const dy = y - v.y * h;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = dist / (v.r * side * 1.7);
        const pull = Math.exp(-reach * reach) * 2.2;
        fx += pull * (-dy / dist - (0.3 * dx) / dist);
        fy += pull * (dx / dist - (0.3 * dy) / dist);
      }
      const mag = Math.hypot(fx, fy) || 1;
      x += (fx / mag) * step;
      y += (fy / mag) * step;
    }
  }
  return canvas;
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

  const r = SKY_BODY_RADIUS_SPRITE_PX;
  const sunPos = sky.sun ? arcPosition(sky.sun.p, sky.sun.lift, (r + 1) * px, w, h, avoid) : null;
  // Pixel-art glow: flat stepped rings of colour around the sun, small and pale at
  // midday, growing into a full orange-to-mauve sunset; then the cream sun itself
  if (sunPos && sky.sun) {
    const warmth = Math.max(0, Math.min(1, (sky.sun.p - 0.55) / 0.3));
    const fade = Math.min(1, (1 - sky.sun.p) / 0.06);
    const reach = (Math.min(w, h) / px) * (SKY_RING_SHARE + SKY_RING_SUNSET_SHARE * warmth);
    const ox = Math.round(sunPos[0] / px) * px;
    const oy = Math.round(sunPos[1] / px) * px;
    SKY_RING_COLORS.forEach((color, i) => {
      // midday shows only the inner, yellow rings, faintly; sunset brings them all in, solid
      const inner = i >= SKY_RING_COLORS.length / 2 ? SKY_RING_DAY_ALPHA : 0;
      ctx.globalAlpha = (warmth + (1 - warmth) * inner) * fade;
      ctx.fillStyle = color;
      spanDisc(ctx, ox, oy, Math.round(reach * (1 - i / SKY_RING_COLORS.length)), px, w, h);
    });
    ctx.globalAlpha = fade;
    ctx.fillStyle = SKY_SUN_CORE_COLOR;
    spanDisc(ctx, ox, oy, r, px, w, h);
    ctx.globalAlpha = 1;
  }

  if (sky.starAlpha > 0) {
    const sec0 = now.getTime() / 1000;
    // The painted sky: swirling brushstrokes, cached per canvas size
    ctx.globalAlpha = sky.starAlpha;
    ctx.drawImage(nightBackdrop(w, h, px), 0, 0);
    // Starry Night stars: a glowing core wrapped in concentric rings of turning
    // yellow / blue / orange dashes, pulsing softly
    for (const st of BIG_STARS) {
      const pulse = 0.8 + 0.2 * Math.sin(sec0 * 1.2 + st.phase);
      const sx = Math.round((st.x * w) / px) * px;
      const sy = Math.round((st.y * h) / px) * px;
      ctx.fillStyle = SKY_BIG_STAR_HALO_COLORS[4];
      ctx.globalAlpha = sky.starAlpha * pulse * 0.2;
      disc(ctx, sx, sy, st.size * 4, px);
      ctx.globalAlpha = sky.starAlpha * pulse * 0.2;
      disc(ctx, sx, sy, st.size * 3, px);
      SKY_BIG_STAR_HALO_COLORS.forEach((col, k) => {
        const rad = st.size + 3 + k * 3;
        const dashes = 16 + k * 8;
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
              2 * px,
              2 * px,
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
    const warmth = sky.sun ? Math.max(0, Math.min(1, (sky.sun.p - 0.55) / 0.3)) : 1;
    const cloud = toCss(mix(parseHex(SKY_CLOUD_COLOR), parseHex(SKY_CLOUD_SUNSET_COLOR), warmth));
    const lit = toCss(
      mix(parseHex(SKY_CLOUD_SHADE_COLOR), parseHex(SKY_CLOUD_SUNSET_LIT_COLOR), warmth),
    );
    ctx.globalAlpha = sky.dayAlpha;
    // Clouds: long flat streaks with stepped ends, drifting right and wrapping around
    for (const c of CLOUDS) {
      const u = px * c.scale;
      const cw = 44 * u;
      const x =
        Math.round((((c.phase + (sec / SKY_CLOUD_CROSS_SEC) * c.speed) % 1) * (w + cw) - cw) / px) *
        px;
      const y = Math.round((c.y * h) / px) * px;
      ctx.fillStyle = cloud;
      ctx.fillRect(x + 10 * u, y, 22 * u, u);
      ctx.fillRect(x + 4 * u, y + u, 36 * u, u);
      ctx.fillRect(x, y + 2 * u, 44 * u, u);
      ctx.fillRect(x + 8 * u, y + 3 * u, 30 * u, u);
      ctx.fillStyle = lit;
      ctx.fillRect(x + 14 * u, y + 4 * u, 20 * u, u);
    }
    // Birds: a loose flock of small v shapes, wings beating
    ctx.fillStyle = SKY_BIRD_COLOR;
    for (const [i, b] of BIRDS.entries()) {
      const flapUp = Math.floor(sec / SKY_BIRD_FLAP_SEC + b.phase * 7) % 2 === 0;
      const bu = px;
      const x =
        Math.round(
          (((sec / SKY_BIRD_CROSS_SEC) % 1) * (w + 80 * px) - 70 * px + b.phase * 60 * px) / px,
        ) * px;
      const y =
        Math.round((h * 0.12 + b.y * h * 0.3 + Math.sin(sec * 1.2 + b.bob + i) * 2 * px) / px) * px;
      if (flapUp) {
        ctx.fillRect(x, y, 2 * bu, bu);
        ctx.fillRect(x + bu, y + bu, 2 * bu, bu);
        ctx.fillRect(x + 3 * bu, y + 2 * bu, bu, bu);
        ctx.fillRect(x + 4 * bu, y + bu, 2 * bu, bu);
        ctx.fillRect(x + 5 * bu, y, 2 * bu, bu);
      } else {
        ctx.fillRect(x, y + bu, 3 * bu, bu);
        ctx.fillRect(x + 3 * bu, y + 2 * bu, bu, bu);
        ctx.fillRect(x + 4 * bu, y + bu, 3 * bu, bu);
      }
    }
    ctx.globalAlpha = 1;
  }

  if (sky.moon) {
    const mr = Math.max(
      6,
      Math.min(
        SKY_MOON_RADIUS_SPRITE_PX,
        Math.floor((SKY_MOON_MAX_CANVAS_SHARE * Math.min(w, h)) / px),
      ),
    );
    const k = mr / SKY_MOON_DESIGN_RADIUS;
    const sc = (n: number): number => Math.round(n * k);
    const [cx, cy] = arcPosition(sky.moon.p, sky.moon.lift, (mr + 1) * px, w, h, avoid);
    const mx = Math.round(cx / px) * px;
    const my = Math.round(cy / px) * px;
    const dot = (dx: number, dy: number, sw = 1, sh = 1): void =>
      ctx.fillRect(mx + dx * px, my + dy * px, sw * px, sh * px);
    // soft glow
    ctx.fillStyle = SKY_MOON_GLOW_COLOR;
    for (const [gr, ga] of [
      [mr + sc(6), 0.07],
      [mr + sc(4), 0.1],
      [mr + sc(2), 0.16],
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
      disc(ctx, mx + sc(mxo) * px, my + sc(myo) * px, sc(mrad), px);
    }
    ctx.fillStyle = SKY_MOON_SHADE_COLOR;
    for (let dy = -mr; dy <= mr; dy++) {
      for (let dx = -mr; dx <= mr; dx++) {
        if (dx * dx + dy * dy > mr * mr + mr) continue;
        const lit = (dx - sc(7)) * (dx - sc(7)) + (dy - sc(7)) * (dy - sc(7));
        if (lit > (mr + sc(7)) * (mr + sc(7)) - 40 * k * k) dot(dx, dy);
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
      disc(ctx, mx + sc(cdx) * px, my + sc(cdy) * px, sc(cr), px);
      ctx.fillStyle = SKY_MOON_COLOR;
      ctx.fillRect(mx + (sc(cdx) - sc(cr)) * px, my + (sc(cdy) - sc(cr)) * px, sc(cr) * px, px);
    }
  }
}
