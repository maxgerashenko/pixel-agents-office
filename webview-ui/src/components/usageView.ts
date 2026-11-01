import {
  USAGE_DANGER_PERCENT,
  USAGE_RING_RED_PERCENT,
  USAGE_RING_YELLOW_PERCENT,
  USAGE_SESSION_HOURS,
  USAGE_WARN_PERCENT,
} from '../constants.js';

/** One rate-limit window as the server broadcasts it (`usageUpdate`). */
export interface UsageWindowView {
  usedPercentage: number;
  /** Unix epoch milliseconds. */
  resetsAt: number;
}

/** Latest `usageUpdate` for one provider. */
export interface UsageView {
  fiveHour?: UsageWindowView;
  sevenDay?: UsageWindowView;
  updatedAt: number;
}

export type UsageSeverity = 'normal' | 'warning' | 'danger';

/** Bar colour band: warning from USAGE_WARN_PERCENT, danger from USAGE_DANGER_PERCENT. */
export function usageSeverity(percent: number): UsageSeverity {
  if (percent >= USAGE_DANGER_PERCENT) return 'danger';
  if (percent >= USAGE_WARN_PERCENT) return 'warning';
  return 'normal';
}

/** Time until the reset as "2h 15m", "45m" or "<1m". Minutes round up, so a
 *  window that is still live never reads "0m". */
export function formatTimeLeft(resetsAtMs: number, now: number): string {
  const minutes = Math.ceil(Math.max(0, resetsAtMs - now) / 60_000);
  if (minutes < 1) return '<1m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

const HOUR_MS = 3_600_000;

/** Where the five-hour window stands, derived from its reset time. */
export interface SessionClock {
  /** Share of the hours BEFORE the last one passed (0-100): the ring. */
  earlyPercent: number;
  /** Share of the LAST hour passed (0-100), or null before the last hour starts. */
  lastHourPercent: number | null;
}

/** The window started USAGE_SESSION_HOURS before its reset. Every hour but the
 *  last fills the ring; the last hour runs inside the token bar instead. */
export function sessionClock(resetsAtMs: number, now: number): SessionClock {
  const totalMs = USAGE_SESSION_HOURS * HOUR_MS;
  const elapsedMs = Math.min(totalMs, Math.max(0, totalMs - (resetsAtMs - now)));
  const lastHourStartMs = (USAGE_SESSION_HOURS - 1) * HOUR_MS;
  return {
    earlyPercent: (Math.min(elapsedMs, lastHourStartMs) / lastHourStartMs) * 100,
    lastHourPercent:
      elapsedMs >= lastHourStartMs ? ((elapsedMs - lastHourStartMs) / HOUR_MS) * 100 : null,
  };
}

export type RingStage = 'green' | 'yellow' | 'red';

/** Ring colour: green, yellow from USAGE_RING_YELLOW_PERCENT, red from USAGE_RING_RED_PERCENT. */
export function ringStage(percent: number): RingStage {
  if (percent >= USAGE_RING_RED_PERCENT) return 'red';
  if (percent >= USAGE_RING_YELLOW_PERCENT) return 'yellow';
  return 'green';
}

/** SVG path data for a pixel-art ring on a `size`×`size` grid, `thickness`
 *  pixels wide, split into the part filled clockwise from 12 o'clock up to
 *  `percent` and the rest. One `h1v1h-1z` square per pixel. */
export function ringPixelPaths(
  size: number,
  thickness: number,
  percent: number,
): { filled: string; empty: string } {
  const r = size / 2;
  const share = Math.min(100, Math.max(0, percent)) / 100;
  let filled = '';
  let empty = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - r;
      const dy = y + 0.5 - r;
      const d = Math.hypot(dx, dy);
      if (d > r - 0.2 || d < r - thickness) continue;
      let turn = Math.atan2(dx, -dy) / (2 * Math.PI);
      if (turn < 0) turn += 1;
      const px = `M${x} ${y}h1v1h-1z`;
      if (turn < share) filled += px;
      else empty += px;
    }
  }
  return { filled, empty };
}

/** The window if it has not reset yet, else undefined. A window past its reset
 *  time reports a percentage that is no longer true, so it is never shown. */
export function liveWindow(
  window: UsageWindowView | undefined,
  now: number,
): UsageWindowView | undefined {
  return window && window.resetsAt > now ? window : undefined;
}

/** Whole-number percent for display, clamped to 0-100. */
export function displayPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/** First provider's live five-hour window, or undefined (meter hidden). */
export function pickSessionWindow(
  usage: Record<string, UsageView>,
  now: number,
): UsageWindowView | undefined {
  for (const view of Object.values(usage)) {
    const w = liveWindow(view.fiveHour, now);
    if (w) return w;
  }
  return undefined;
}

/** Validate one wire window; anything malformed counts as absent. */
export function asUsageWindow(value: unknown): UsageWindowView | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const w = value as Record<string, unknown>;
  const pct = w['usedPercentage'];
  const resetsAt = w['resetsAt'];
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return undefined;
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt)) return undefined;
  return { usedPercentage: pct, resetsAt };
}
