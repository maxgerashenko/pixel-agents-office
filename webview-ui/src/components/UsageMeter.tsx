import { useEffect, useState } from 'react';

import { USAGE_EXPIRY_CHECK_MS, USAGE_SESSION_HOURS, usageRingColor } from '../constants.js';
import {
  displayPercent,
  formatTimeLeft,
  pickSessionWindow,
  pickWeekWindows,
  ringHue,
  ringPixelPaths,
  sessionClock,
  type UsageView,
  type UsageWindowView,
} from './usageView.js';

/** Grid size and stroke of the session ring, in sprite pixels (drawn at 2×). */
const RING_GRID = 15;
const RING_THICKNESS = 4;

/** The hours before the last one: a pixel ring filling clockwise as they pass,
 *  sliding green → red; once full (the last hour) it turns dark purple. */
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
        className={full ? 'fill-usage-ring-done' : undefined}
        style={full ? undefined : { fill: usageRingColor(ringHue(percent)) }}
        d={filled}
      />
    </svg>
  );
}

/** One thin line holding both weekly limits, in the main bar's colours and by
 *  its rule: Fable's week is the token fill (main colour); the all-models week
 *  is the second layer. The longer layer is drawn behind and the shorter in
 *  front, so neither hides the other: pink behind, yellow in front. */
function WeekLine({
  week,
  fable,
  now,
}: {
  week?: UsageWindowView;
  fable?: UsageWindowView;
  now: number;
}) {
  const weekPct = week ? displayPercent(week.usedPercentage) : null;
  const fablePct = fable ? displayPercent(fable.usedPercentage) : null;
  const weekAhead = weekPct !== null && (fablePct === null || weekPct > fablePct);
  const tips = [
    fable && fablePct !== null
      ? `Fable this week: ${fablePct}% used, resets in ${formatTimeLeft(fable.resetsAt, now)}`
      : null,
    week && weekPct !== null
      ? `This week: ${weekPct}% used, resets in ${formatTimeLeft(week.resetsAt, now)}`
      : null,
  ].filter(Boolean);
  return (
    <div
      className="relative h-8 border-2 border-border bg-bg-dark"
      role="progressbar"
      aria-label="Weekly limits"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={fablePct ?? weekPct ?? 0}
      title={tips.join('\n')}
    >
      {weekPct !== null && weekAhead && (
        <div
          className="absolute inset-y-0 left-0 bg-usage-last-hour"
          style={{ width: `${weekPct}%` }}
        />
      )}
      {fablePct !== null && (
        <div
          className="absolute inset-y-0 left-0 bg-accent-bright"
          style={{ width: `${fablePct}%` }}
        />
      )}
      {weekPct !== null && !weekAhead && (
        <div
          className="absolute inset-y-0 left-0 bg-usage-last-hour-behind"
          style={{ width: `${weekPct}%` }}
        />
      )}
    </div>
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

  const { week, fable } = pickWeekWindows(usage, now);
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
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div
          className="relative h-14 border-2 border-border bg-bg-dark"
          role="progressbar"
          aria-label="Current session usage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          title={
            lastHourPercent === null
              ? undefined
              : `Last hour: ${Math.round(lastHourPercent)}% passed`
          }
        >
          {/* Last hour of the window: a layer sharing the bar with the token
              fill. The shorter of the two is drawn in front, so both stay
              visible: yellow while the hour is behind the tokens, pink once
              it is ahead. */}
          {lastHourPercent !== null && lastHourPercent > percent && (
            <div
              className="absolute inset-y-0 left-0 bg-usage-last-hour"
              style={{ width: `${lastHourPercent}%` }}
            />
          )}
          <div className="relative h-full bg-accent-bright" style={{ width: `${percent}%` }} />
          {lastHourPercent !== null && lastHourPercent <= percent && (
            <div
              className="absolute inset-y-0 left-0 bg-usage-last-hour-behind"
              style={{ width: `${lastHourPercent}%` }}
            />
          )}
        </div>
        {/* Both weekly limits in one thin line under the main bar. */}
        {(fable || week) && <WeekLine week={week} fable={fable} now={now} />}
      </div>
      <span className="text-2xs text-text-muted">{percent}% used</span>
    </div>
  );
}
