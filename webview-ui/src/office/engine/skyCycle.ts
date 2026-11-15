/**
 * Day/night sky behind the office. The cycle is tied to the real clock hour:
 * day at :00, sunset around :30–:43, night until :56, then a short dawn.
 *
 * `skyAt` is pure (fraction of the hour → colours + sun/moon/star state);
 * `drawSky` paints it onto the canvas before the tiles, so it shows wherever
 * the layout doesn't cover (void tiles and the margin around the grid) at any
 * canvas size.
 */

import {
  SKY_KEYFRAMES,
  SKY_MOON_RISE_AT,
  SKY_STAR_COUNT,
  SKY_STAR_FADE,
  SKY_SUN_COLOR,
  SKY_SUN_SET_AT,
  SKY_SUN_SETTING_COLOR,
} from '../../constants.js';

export interface SkyState {
  top: string;
  bottom: string;
  /** Sun position as fractions of the canvas, or null when below the horizon. */
  /** `p` = 0..1 left to right across the sky; `lift` = 0 at the horizon, 1 at the top of the arc. */
  sun: { p: number; lift: number; color: string } | null;
  moon: { p: number; lift: number } | null;
  /** 0..1 */
  starAlpha: number;
}

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function toCss(c: Rgb): string {
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Fraction of the current real clock hour, 0 at :00 up to (not including) 1. */
export function hourFraction(now: Date): number {
  return (now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000) / 3600;
}

export function skyAt(t: number): SkyState {
  const f = clamp01(t);
  let i = 0;
  while (i < SKY_KEYFRAMES.length - 2 && f > SKY_KEYFRAMES[i + 1].at) i++;
  const a = SKY_KEYFRAMES[i];
  const b = SKY_KEYFRAMES[i + 1];
  const k = clamp01((f - a.at) / (b.at - a.at));
  const top = mix(parseHex(a.top), parseHex(b.top), k);
  const bottom = mix(parseHex(a.bottom), parseHex(b.bottom), k);

  let sun: SkyState['sun'] = null;
  if (f < SKY_SUN_SET_AT) {
    const p = f / SKY_SUN_SET_AT;
    const warm = clamp01((p - 0.8) / 0.2);
    sun = {
      p,
      lift: Math.sin(Math.PI * p),
      color: toCss(mix(parseHex(SKY_SUN_COLOR), parseHex(SKY_SUN_SETTING_COLOR), warm)),
    };
  }
  let moon: SkyState['moon'] = null;
  if (f > SKY_MOON_RISE_AT) {
    const q = (f - SKY_MOON_RISE_AT) / (1 - SKY_MOON_RISE_AT);
    moon = { p: q, lift: Math.sin(Math.PI * q) };
  }
  const { in0, in1, out0, out1 } = SKY_STAR_FADE;
  const starAlpha = clamp01((f - in0) / (in1 - in0)) * clamp01((out1 - f) / (out1 - out0));
  return { top: toCss(top), bottom: toCss(bottom), sun, moon, starAlpha };
}

/** Stable pseudo-random star field (fractions of the canvas + twinkle phase). */
const STARS = (() => {
  let s = 12345;
  const rnd = (): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: SKY_STAR_COUNT }, () => ({
    x: rnd(),
    y: rnd() * 0.85,
    phase: rnd(),
  }));
})();

let override: number | null = null;

/** The fraction of the hour the sky is pinned to, or null for the real clock. */
export function skyOverride(): number | null {
  return override;
}

/** Pin the sky to a fraction of the hour (null = follow the real clock). For tests/screenshots. */
export function setSkyHourFraction(t: number | null): void {
  override = t;
}

export { mix, parseHex, STARS, toCss };
