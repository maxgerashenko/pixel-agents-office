import { USAGE_DANGER_PERCENT, USAGE_WARN_PERCENT } from '../constants.js';

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

/** "6:50 AM" in the viewer's local time (or `timeZone`, for tests). */
export function formatResetTime(resetsAtMs: number, timeZone?: string): string {
  return new Date(resetsAtMs)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
    .replace(/\s/g, ' ');
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
