import { describe, expect, it } from 'vitest';

import {
  asUsageWindow,
  displayPercent,
  formatResetTime,
  liveWindow,
  pickSessionWindow,
  usageSeverity,
} from '../src/components/usageMeter.js';

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

describe('formatResetTime', () => {
  it('formats h:mm AM/PM', () => {
    expect(formatResetTime(Date.UTC(2026, 0, 1, 6, 50), 'UTC')).toBe('6:50 AM');
    expect(formatResetTime(Date.UTC(2026, 0, 1, 18, 5), 'UTC')).toBe('6:05 PM');
    expect(formatResetTime(Date.UTC(2026, 0, 1, 0, 0), 'UTC')).toBe('12:00 AM');
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
