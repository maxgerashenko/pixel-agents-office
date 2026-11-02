import { describe, expect, it } from 'vitest';

import {
  asUsageWindow,
  displayPercent,
  formatTimeLeft,
  liveWindow,
  pickSessionWindow,
  ringHue,
  ringPixelPaths,
  sessionClock,
} from '../src/components/usageView.js';

describe('formatTimeLeft', () => {
  const MIN = 60_000;
  it('formats hours and minutes', () => {
    expect(formatTimeLeft(135 * MIN, 0)).toBe('2h 15m');
    expect(formatTimeLeft(120 * MIN, 0)).toBe('2h');
    expect(formatTimeLeft(45 * MIN, 0)).toBe('45m');
  });
  it('rounds up so a live window never reads 0m', () => {
    expect(formatTimeLeft(1, 0)).toBe('1m');
    expect(formatTimeLeft(61 * MIN + 1, 0)).toBe('1h 2m');
  });
  it('clamps a past reset to <1m', () => {
    expect(formatTimeLeft(0, 5 * MIN)).toBe('<1m');
  });
});

describe('liveWindow / pickSessionWindow', () => {
  const w = { usedPercentage: 54, resetsAt: 2000 };
  it('hides a window at or past its reset', () => {
    expect(liveWindow(w, 1999)).toBe(w);
    expect(liveWindow(w, 2000)).toBeUndefined();
    expect(liveWindow(undefined, 0)).toBeUndefined();
  });
  it('picks the first provider with a live five-hour window', () => {
    expect(pickSessionWindow({ claude: { fiveHour: w, updatedAt: 1 } }, 1000)).toBe(w);
    expect(pickSessionWindow({ claude: { fiveHour: w, updatedAt: 1 } }, 3000)).toBeUndefined();
    expect(pickSessionWindow({ claude: { updatedAt: 1 } }, 0)).toBeUndefined();
    expect(pickSessionWindow({}, 0)).toBeUndefined();
  });
});

describe('displayPercent / asUsageWindow', () => {
  it('rounds and clamps', () => {
    expect(displayPercent(53.6)).toBe(54);
    expect(displayPercent(150)).toBe(100);
    expect(displayPercent(-3)).toBe(0);
  });
  it('rejects malformed wire windows', () => {
    expect(asUsageWindow({ usedPercentage: 1, resetsAt: 2 })).toEqual({
      usedPercentage: 1,
      resetsAt: 2,
    });
    expect(asUsageWindow(null)).toBeUndefined();
    expect(asUsageWindow({ usedPercentage: 'x', resetsAt: 2 })).toBeUndefined();
    expect(asUsageWindow({ usedPercentage: 1, resetsAt: NaN })).toBeUndefined();
  });
});

describe('sessionClock', () => {
  const MIN = 60_000;
  const resetIn = (minutesLeft: number) => sessionClock(minutesLeft * MIN, 0);
  it('fills the ring over the hours before the last one', () => {
    expect(resetIn(300)).toEqual({ earlyPercent: 0, lastHourPercent: null });
    expect(resetIn(240)).toEqual({ earlyPercent: 25, lastHourPercent: null });
    expect(resetIn(180)).toEqual({ earlyPercent: 50, lastHourPercent: null });
  });
  it('reports the share of the last hour passed once it starts', () => {
    expect(resetIn(60)).toEqual({ earlyPercent: 100, lastHourPercent: 0 });
    expect(resetIn(45)).toEqual({ earlyPercent: 100, lastHourPercent: 25 });
    expect(resetIn(15)).toEqual({ earlyPercent: 100, lastHourPercent: 75 });
  });
  it('clamps a reset further out than the window, or already past', () => {
    expect(resetIn(400)).toEqual({ earlyPercent: 0, lastHourPercent: null });
    expect(resetIn(-5)).toEqual({ earlyPercent: 100, lastHourPercent: 100 });
  });
});

describe('ringPixelPaths', () => {
  const count = (d: string) => (d.match(/M/g) ?? []).length;
  it('splits the same ring pixels between filled and empty', () => {
    const none = ringPixelPaths(15, 4, 0);
    const half = ringPixelPaths(15, 4, 50);
    const full = ringPixelPaths(15, 4, 100);
    const total = count(none.empty);
    expect(total).toBeGreaterThan(0);
    expect(count(none.filled)).toBe(0);
    expect(count(full.filled)).toBe(total);
    expect(count(half.filled) + count(half.empty)).toBe(total);
    expect(Math.abs(count(half.filled) - total / 2)).toBeLessThanOrEqual(2);
  });
  it("fills clockwise from 12 o'clock (right half first)", () => {
    expect(ringPixelPaths(15, 4, 25).filled).toContain('M8 0h1v1h-1z');
    expect(ringPixelPaths(15, 4, 25).filled).not.toContain('M6 0h1v1h-1z');
  });
});

describe('ringHue', () => {
  it('slides from green (120) to red (0) as the ring fills', () => {
    expect(ringHue(0)).toBe(120);
    expect(ringHue(50)).toBe(60);
    expect(ringHue(100)).toBe(0);
    expect(ringHue(150)).toBe(0);
  });
});
