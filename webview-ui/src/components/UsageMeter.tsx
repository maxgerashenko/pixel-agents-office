import { useEffect, useState } from 'react';

import { USAGE_EXPIRY_CHECK_MS } from '../constants.js';
import {
  displayPercent,
  formatTimeLeft,
  pickSessionWindow,
  type UsageSeverity,
  usageSeverity,
  type UsageView,
} from './usageView.js';

const FILL_CLASS: Record<UsageSeverity, string> = {
  normal: 'bg-accent-bright',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

interface UsageMeterProps {
  /** Latest `usageUpdate` per provider id. */
  usage: Record<string, UsageView>;
}

/**
 * Claude's "Current session" (five-hour) usage as a full-width strip at the top
 * of the app. It is an ordinary flex child, so it pushes the office below it
 * rather than covering it. Renders nothing (and takes no space) until a
 * status-line tap has reported a window that has not reset yet; re-checks on a
 * timer so it disappears at the reset.
 */
export function UsageMeter({ usage }: UsageMeterProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), USAGE_EXPIRY_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const session = pickSessionWindow(usage, now);
  if (!session) return null;

  const percent = displayPercent(session.usedPercentage);
  return (
    <div
      data-fit-obstacle="top"
      className="relative z-30 shrink-0 h-34 flex items-center gap-12 px-10 bg-bg border-b-2 border-border shadow-pixel select-none whitespace-nowrap"
      title="Claude usage, current session"
    >
      <span className="text-xs text-text">Current session</span>
      <span className="text-2xs text-text-muted">
        Resets in {formatTimeLeft(session.resetsAt, now)}
      </span>
      <div
        className="flex-1 min-w-0 h-10 border-2 border-border bg-bg-dark"
        role="progressbar"
        aria-label="Current session usage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={`h-full ${FILL_CLASS[usageSeverity(session.usedPercentage)]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-2xs text-text-muted">{percent}% used</span>
    </div>
  );
}
