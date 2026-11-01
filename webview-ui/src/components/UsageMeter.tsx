import { useEffect, useState } from 'react';

import { USAGE_EXPIRY_CHECK_MS, USAGE_SESSION_HOURS, usageRingColor } from '../constants.js';
import {
  displayPercent,
  formatTimeLeft,
  pickSessionWindow,
  ringHue,
  ringPixelPaths,
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

/** Pixels of a 7×7 pixel-art disc. */
const DOT_DISC = 'M2 0h3v1h1v1h1v3h-1v1h-1v1h-3v-1h-1v-1h-1v-3h1v-1h1z';
/** The last-hour dot is as tall as the token bar, borders included. */
const LAST_HOUR_DOT_PX = 14;

/** Grid size and stroke of the session ring, in sprite pixels (drawn at 2×). */
const RING_GRID = 15;
const RING_THICKNESS = 4;

/** The hours before the last one: a pixel ring filling clockwise as they pass,
 *  sliding green → red; once full (the last hour) it takes the token bar's purple. */
function SessionRing({ percent }: { percent: number }) {
  const full = percent >= 100;
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
      <path
        className={full ? 'fill-accent-bright' : undefined}
        style={full ? undefined : { fill: usageRingColor(ringHue(percent)) }}
        d={filled}
      />
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
 * also carries the last hour's progress in dark purple. It is an ordinary flex child, so it pushes the office below it
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
        className="text-sm"
        style={{ color: usageRingColor(ringHue(earlyPercent)) }}
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
        {/* Last hour of the window: dark purple fill behind the token fill, so it
            only shows on the empty side once time passes the tokens; while
            behind, a bar-high dot marks it inside the token fill. */}
        {lastHourPercent !== null && lastHourPercent > percent && (
          <div
            className="absolute inset-y-0 left-0 bg-usage-last-hour"
            style={{ width: `${lastHourPercent}%` }}
          />
        )}
        <div
          className={`relative h-full ${FILL_CLASS[usageSeverity(session.usedPercentage)]}`}
          style={{ width: `${percent}%` }}
        />
        {lastHourPercent !== null && lastHourPercent <= percent && (
          <svg
            width={LAST_HOUR_DOT_PX}
            height={LAST_HOUR_DOT_PX}
            viewBox="0 0 7 7"
            shapeRendering="crispEdges"
            className="absolute -top-2 fill-usage-last-hour"
            style={{ left: `calc(${lastHourPercent}% - ${LAST_HOUR_DOT_PX / 2}px)` }}
            aria-hidden
          >
            <path d={DOT_DISC} />
          </svg>
        )}
      </div>
      <span className="text-2xs text-text-muted">{percent}% used</span>
    </div>
  );
}
