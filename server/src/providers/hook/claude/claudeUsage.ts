import type { UsageSnapshot, UsageWindow } from '../../../../../core/src/provider.js';

/**
 * Parse the JSON Claude Code pipes to a statusLine command on stdin.
 *
 * Only `rate_limits` is read. It is present for Claude.ai subscribers (Pro/Max)
 * after a session's first response, and absent for API-key accounts and for
 * some CLI versions, so every level may be missing or malformed:
 *
 *   "rate_limits": {
 *     "five_hour": { "used_percentage": 23.5, "resets_at": 1738425600 },
 *     "seven_day": { "used_percentage": 41.2, "resets_at": 1738857600 }
 *   }
 *
 * `resets_at` is Unix epoch SECONDS on the wire and MILLISECONDS in the
 * normalized snapshot. A window with a non-finite percentage or a non-positive
 * / non-finite reset time is dropped (the UI cannot say when it resets); an
 * out-of-range percentage is clamped to 0-100. Returns null when no window
 * survives, so the previous snapshot stands.
 */
export function parseClaudeUsage(raw: unknown): UsageSnapshot | null {
  if (!isRecord(raw) || !isRecord(raw['rate_limits'])) return null;
  const limits = raw['rate_limits'];
  const fiveHour = parseWindow(limits['five_hour']);
  const sevenDay = parseWindow(limits['seven_day']);
  if (!fiveHour && !sevenDay) return null;
  return {
    ...(fiveHour ? { fiveHour } : {}),
    ...(sevenDay ? { sevenDay } : {}),
  };
}

function parseWindow(value: unknown): UsageWindow | undefined {
  if (!isRecord(value)) return undefined;
  const pct = value['used_percentage'];
  const resetsAtSeconds = value['resets_at'];
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return undefined;
  if (typeof resetsAtSeconds !== 'number' || !Number.isFinite(resetsAtSeconds)) return undefined;
  if (resetsAtSeconds <= 0) return undefined;
  return {
    usedPercentage: Math.min(100, Math.max(0, pct)),
    resetsAt: Math.round(resetsAtSeconds * 1000),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
