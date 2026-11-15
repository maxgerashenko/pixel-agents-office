/** Canvas painting for the day/night sky (state lives in skyCycle.ts, which stays DOM-free). */

import {
  SKY_BAND_SPRITE_PX,
  SKY_BIG_STAR_CORE_COLOR,
  SKY_BIG_STAR_GLOW_COLOR,
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
  SKY_HILL_DAY_COLOR,
  SKY_HILL_NIGHT_COLOR,
  SKY_HORIZON_LIFT_SPRITE_PX,
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
  SKY_SKYLINE_DAY_COLOR,
  SKY_SKYLINE_NIGHT_COLOR,
  SKY_STAR_COLOR,
  SKY_STROKE_AREA_SPRITE_PX,
  SKY_STROKE_MAX,
  SKY_SUN_CORE_COLOR,
  SKY_SWIRL_COLORS,
  SKY_TWINKLE_SEC,
  SKY_VORTICES,
  SKY_WINDOW_COLOR,
  SKY_WIPE_BAND_SPRITE_PX,
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

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
let ditherMask: { key: string; canvas: HTMLCanvasElement } | null = null;
let ditherTemp: HTMLCanvasElement | null = null;

/**
 * The band of `source` starting at x = `edge`, cut through an ordered-dither
 * mask that runs from empty on the left to solid on the right: the pixelated
 * edge night advances behind.
 */
function ditherStrip(
  source: HTMLCanvasElement,
  edge: number,
  bandW: number,
  h: number,
  px: number,
): HTMLCanvasElement | null {
  const key = `${bandW}x${h}x${px}`;
  if (ditherMask?.key !== key) {
    const mask = document.createElement('canvas');
    mask.width = bandW;
    mask.height = h;
    const m = mask.getContext('2d');
    if (!m) return null;
    const cols = bandW / px;
    for (let cx = 0; cx < cols; cx++) {
      const level = ((cx + 0.5) / cols) * 16;
      for (let cy = 0; cy * px < h; cy++) {
        if (BAYER4[cy % 4][cx % 4] < level) m.fillRect(cx * px, cy * px, px, px);
      }
    }
    ditherMask = { key, canvas: mask };
    ditherTemp = document.createElement('canvas');
    ditherTemp.width = bandW;
    ditherTemp.height = h;
  }
  const temp = ditherTemp;
  const tc = temp?.getContext('2d');
  if (!temp || !tc) return null;
  tc.globalCompositeOperation = 'source-over';
  tc.clearRect(0, 0, bandW, h);
  tc.drawImage(source, edge, 0, bandW, h, 0, 0, bandW, h);
  tc.globalCompositeOperation = 'destination-in';
  tc.drawImage(ditherMask.canvas, 0, 0);
  return temp;
}

/**
 * The skyline: pines, power lines and a bridge on the left; a cypress, rolling
 * hills and a village with a spire on the right; and the ground the office sits
 * on. `dusk` (0 day → 1 night) darkens it from deep green to near-black.
 */
function drawSkyline(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  px: number,
  horizon: number,
  dusk: number,
): void {
  const u = px;
  const base = Math.round(horizon / px) * px;
  const at = (f: number): number => Math.round((f * w) / px) * px;
  const dark = toCss(mix(parseHex(SKY_SKYLINE_DAY_COLOR), parseHex(SKY_SKYLINE_NIGHT_COLOR), dusk));
  const hill = toCss(mix(parseHex(SKY_HILL_DAY_COLOR), parseHex(SKY_HILL_NIGHT_COLOR), dusk));

  // rolling hills behind everything on the right
  ctx.fillStyle = hill;
  for (let x = at(0.62); x < w; x += 2 * u) {
    const f = (x / w - 0.62) / 0.38;
    const hgt = Math.round(6 + 5 * Math.sin(f * 9) + 3 * Math.sin(f * 23) + 12 * f);
    ctx.fillRect(x, base - hgt * u, 2 * u, hgt * u);
  }

  ctx.fillStyle = dark;
  ctx.fillRect(0, base, w, h - base);

  const pine = (cx: number, hgt: number): void => {
    for (let i = 0; i < hgt; i++) {
      const half = 1 + Math.floor((i % 7) * 0.8 + i * 0.1);
      ctx.fillRect(cx - half * u, base - (hgt - i) * u, (2 * half + 1) * u, u);
    }
  };
  for (const [f, hgt] of [
    [0.03, 22],
    [0.07, 30],
    [0.45, 24],
    [0.49, 34],
    [0.53, 28],
    [0.56, 40],
  ]) {
    pine(at(f), hgt);
  }

  // power poles and sagging wires
  const poleH = 30;
  const poles = [at(0.11), at(0.41)];
  for (const x of poles) {
    ctx.fillRect(x, base - poleH * u, u, poleH * u);
    ctx.fillRect(x - 3 * u, base - (poleH - 2) * u, 7 * u, u);
  }
  const wire = (x0: number, y0: number, x1: number, y1: number, sag: number): void => {
    for (let x = x0; x <= x1; x += u) {
      const k = (x - x0) / Math.max(u, x1 - x0);
      const y = y0 + (y1 - y0) * k + sag * 4 * k * (1 - k);
      ctx.fillRect(x, base - Math.round(y) * u, u, u);
    }
  };
  for (const drop of [2, 5]) {
    wire(0, poleH - drop + 3, poles[0], poleH - drop, -3);
    wire(poles[0], poleH - drop, poles[1], poleH - drop, -6);
    wire(poles[1], poleH - drop, at(0.6), poleH - drop - 10, -3);
  }

  // bridge: deck, dotted railing, three arches
  const bx0 = at(0.16);
  const bx1 = at(0.39);
  const deck = 10;
  for (let x = bx0; x < bx1; x += 2 * u) ctx.fillRect(x, base - (deck + 2) * u, u, u);
  ctx.fillRect(bx0, base - (deck + 1) * u, bx1 - bx0, 2 * u);
  const span = (bx1 - bx0) / 3;
  const rad = span / 2 - 2 * u;
  for (let x = bx0; x < bx1; x += u) {
    const local = ((x - bx0) % span) - span / 2;
    const arch = Math.abs(local) < rad ? Math.sqrt(rad * rad - local * local) : 0;
    const open = Math.min((deck - 2) * u, Math.round(arch / u) * u);
    ctx.fillRect(x, base - (deck - 1) * u, u, (deck - 1) * u - open);
  }

  // cypress: a tall flame, with a smaller one beside it
  const cypress = (cx: number, hgt: number, wide: number): void => {
    for (let i = 0; i < hgt; i++) {
      const k = i / hgt;
      const half = Math.round(
        wide * Math.sin(Math.PI * Math.pow(k, 0.55)) * (0.92 + 0.08 * Math.sin(i * 0.9)),
      );
      ctx.fillRect(cx - half * u, base - (hgt - i) * u, (2 * half + 1) * u, u);
    }
  };
  cypress(at(0.61), 62, 7);
  cypress(at(0.61) + 11 * u, 32, 5);

  // village: houses, a church with a spire, windows lit after dusk
  const vx = at(0.74);
  const houses: Array<[number, number, number]> = [
    [0, 8, 6],
    [9, 10, 7],
    [19, 7, 6],
    [28, 13, 5],
    [36, 8, 8],
    [47, 6, 6],
  ];
  for (const [dx, hw, hh] of houses) {
    ctx.fillRect(vx + dx * u, base - hh * u, hw * u, hh * u);
    for (let rI = 0; rI < Math.floor(hw / 2); rI++) {
      ctx.fillRect(vx + (dx + rI) * u, base - (hh + rI + 1) * u, (hw - 2 * rI) * u, u);
    }
  }
  for (let i = 0; i < 16; i++) {
    const half = Math.floor((16 - i) / 6);
    ctx.fillRect(vx + (33 - half) * u, base - (10 + 16 - i) * u, (2 * half + 1) * u, u);
  }
  if (dusk > 0.5) {
    ctx.fillStyle = SKY_WINDOW_COLOR;
    for (const [dx, hw, hh] of houses) {
      ctx.fillRect(vx + (dx + 2) * u, base - (hh - 2) * u, u, 2 * u);
      if (hw > 7) ctx.fillRect(vx + (dx + hw - 3) * u, base - (hh - 2) * u, u, 2 * u);
    }
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
    const len = 8 + Math.floor(rnd() * 8);
    for (let s = 0; s < len; s++) {
      c.fillRect(Math.round(x / px) * px, Math.round(y / px) * px, 3 * px, 2 * px);
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

  // the skyline stands a wall's height above the top row of tiles, where the office's roofline is
  const horizonY = avoid ? avoid.y - SKY_HORIZON_LIFT_SPRITE_PX * px : Math.round(h * 0.9);
  const r = SKY_BODY_RADIUS_SPRITE_PX;
  const sunPos = sky.sun ? arcPosition(sky.sun.p, sky.sun.lift, (r + 1) * px, w, h, avoid) : null;
  // Pixel-art glow: flat stepped rings of colour around the sun, small and pale at
  // midday, growing into a full orange-to-mauve sunset; then the cream sun itself
  if (sunPos && sky.sun) {
    const warmth = 1;
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

  // Night sweeps in from the right behind a dithered edge (and back out at dawn)
  const bandW = SKY_WIPE_BAND_SPRITE_PX * px;
  const edge = Math.round((w - sky.starAlpha * (w + bandW)) / px) * px;
  if (sky.starAlpha > 0) {
    const sec0 = now.getTime() / 1000;
    const backdrop = nightBackdrop(w, h, px);
    const solidFrom = Math.max(0, edge + bandW);
    if (solidFrom < w)
      ctx.drawImage(backdrop, solidFrom, 0, w - solidFrom, h, solidFrom, 0, w - solidFrom, h);
    if (edge + bandW > 0 && edge < w) {
      const strip = ditherStrip(backdrop, edge, bandW, h, px);
      if (strip) ctx.drawImage(strip, edge, 0);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(edge + bandW / 2, 0, w, h);
    ctx.clip();
    // Starry Night stars: a soft glow, a yellow body and a bright four-point sparkle
    for (const st of BIG_STARS) {
      const pulse = 0.8 + 0.2 * Math.sin(sec0 * 1.2 + st.phase);
      const sx = Math.round((st.x * w) / px) * px;
      const sy = Math.round((st.y * h) / px) * px;
      ctx.fillStyle = SKY_BIG_STAR_GLOW_COLOR;
      ctx.globalAlpha = 0.28 * pulse;
      spanDisc(ctx, sx, sy, st.size * 2 + 2, px, w, h);
      ctx.globalAlpha = 0.45 * pulse;
      spanDisc(ctx, sx, sy, st.size + 3, px, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = SKY_BIG_STAR_HALO_COLORS[0];
      spanDisc(ctx, sx, sy, st.size, px, w, h);
      ctx.fillStyle = SKY_BIG_STAR_CORE_COLOR;
      spanDisc(ctx, sx, sy, st.size - 2, px, w, h);
      ctx.fillStyle = SKY_BIG_STAR_HALO_COLORS[2];
      const arm = Math.max(1, st.size - 2);
      ctx.fillRect(sx - arm * px, sy, (2 * arm + 1) * px, px);
      ctx.fillRect(sx, sy - arm * px, px, (2 * arm + 1) * px);
    }
    ctx.fillStyle = SKY_STAR_COLOR;
    for (const star of STARS) {
      const tw = 0.6 + 0.4 * Math.sin((sec0 / SKY_TWINKLE_SEC + star.phase) * Math.PI * 2);
      ctx.globalAlpha = tw;
      ctx.fillRect(Math.round((star.x * w) / px) * px, Math.round((star.y * h) / px) * px, px, px);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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

  // Skyline: silhouettes standing on the office's top edge, and the ground around it
  const dusk = 1;
  drawSkyline(ctx, w, h, px, horizonY, dusk);

  if (sky.dayAlpha > 0) {
    const sec = now.getTime() / 1000;
    const warmth = 1;
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
      const y = Math.round((c.y * horizonY * 1.3) / px) * px;
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
        Math.round(
          (horizonY * 0.2 + b.y * horizonY * 0.7 + Math.sin(sec * 1.2 + b.bob + i) * 2 * px) / px,
        ) * px;
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
}
