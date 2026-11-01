import { useEffect, useState } from 'react';

import { USAGE_EXPIRY_CHECK_MS, USAGE_SESSION_HOURS } from '../constants.js';
import {
  displayPercent,
  formatTimeLeft,
  pickSessionWindow,
  ringPixelPaths,
  type RingStage,
  ringStage,
  sessionClock,
  type UsageSeverity,
  usageSeverity,
  type UsageView,
} from './usageView.js';

const FILL_CLASS: Record<UsageSeverity, string> = {
  normal: 'bg-accent-bright',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

const RING_FILL_CLASS: Record<RingStage, string> = {
  green: 'fill-status-success',
  yellow: 'fill-status-permission',
  red: 'fill-danger',
};
const RING_TEXT_CLASS: Record<RingStage, string> = {
  green: 'text-status-success',
  yellow: 'text-status-permission',
  red: 'text-danger',
};

/** Grid size and stroke of the session ring, in sprite pixels (drawn at 2×). */
const RING_GRID = 15;
const RING_THICKNESS = 4;

/** The hours before the last one: a pixel ring filling clockwise as they pass,
 *  green → yellow → red. */
function SessionRing({ percent }: { percent: number }) {
  const { filled, empty } = ringPixelPaths(RING_GRID, RING_THICKNESS, percent);
  return (
    <svg
      width={RING_GRID * 2}
      height={RING_GRID * 2}
      viewBox={`0 0 ${RING_GRID} ${RING_GRID}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path className="fill-border" d={empty} />
      <path className={RING_FILL_CLASS[ringStage(percent)]} d={filled} />
    </svg>
  );
}

interface UsageMeterProps {
  /** Latest `usageUpdate` per provider id. */
  usage: Record<string, UsageView>;
}

/**
 * Claude's "Current session" (five-hour) usage as a full-width strip at the top
 * of the app: a ring filling over the first four hours, the time left, and the token bar, which
 * also carries the last hour's progress in green. It is an ordinary flex child, so it pushes the office below it
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
  const { earlyPercent, lastHourPercent } = sessionClock(session.resetsAt, now);
  const timeLeft = formatTimeLeft(session.resetsAt, now);
  return (
    <div
      data-fit-obstacle="top"
      className="relative z-30 shrink-0 h-40 flex items-center gap-12 px-10 bg-bg border-b-2 border-border shadow-pixel select-none whitespace-nowrap"
      title="Claude usage, current session"
    >
      <span className="text-xs text-text">Current session</span>
      <div
        className="flex"
        title={`First ${USAGE_SESSION_HOURS - 1} hours: ${Math.round(earlyPercent)}% passed`}
      >
        <SessionRing percent={earlyPercent} />
      </div>
      <span
        className={`text-sm ${RING_TEXT_CLASS[ringStage(earlyPercent)]}`}
        title={`Resets in ${timeLeft}`}
      >
        {timeLeft}
      </span>
      <div
        className="relative flex-1 min-w-0 h-14 border-2 border-border bg-bg-dark"
        role="progressbar"
        aria-label="Current session usage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        title={
          lastHourPercent === null ? undefined : `Last hour: ${Math.round(lastHourPercent)}% passed`
        }
      >
        {/* Last hour of the window: green fill behind the token fill, so it
            only shows on the empty side once time passes the tokens; while
            behind, a thin line marks it inside the token fill. */}
        {lastHourPercent !== null && lastHourPercent > percent && (
          <div
            className="absolute inset-y-0 left-0 bg-status-success"
            style={{ width: `${lastHourPercent}%` }}
          />
        )}
        <div
          className={`relative h-full ${FILL_CLASS[usageSeverity(session.usedPercentage)]}`}
          style={{ width: `${percent}%` }}
        />
        {lastHourPercent !== null && lastHourPercent <= percent && (
          <div
            className="absolute -inset-y-2 w-3 bg-status-success"
            style={{ left: `calc(${lastHourPercent}% - 1px)` }}
          />
        )}
      </div>
      <span className="text-2xs text-text-muted">{percent}% used</span>
    </div>
  );
}
