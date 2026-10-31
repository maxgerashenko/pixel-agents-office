import { describe, expect, it } from 'vitest';

import {
  asUsageWindow,
  displayPercent,
  formatTimeLeft,
  liveWindow,
  pickSessionWindow,
  usageSeverity,
} from '../src/components/usageView.js';

describe('usageSeverity', () => {
  it('bands at 80 and 95', () => {
    expect(usageSeverity(0)).toBe('normal');
    expect(usageSeverity(79.9)).toBe('normal');
    expect(usageSeverity(80)).toBe('warning');
    expect(usageSeverity(94.9)).toBe('warning');
    expect(usageSeverity(95)).toBe('danger');
    expect(usageSeverity(100)).toBe('danger');
  });
});

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
