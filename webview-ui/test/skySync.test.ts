import { describe, expect, it } from 'vitest';

import { syncLampColor } from '../src/office/engine/skySync.js';

describe('syncLampColor', () => {
  const live = { liveness: 'live' as const, lastTickAt: 10_000 };
  it('flashes on a tick, beats every 5 s, rests dim between', () => {
    const flash = syncLampColor(live, 10_500);
    const beat = syncLampColor(live, 40_200);
    const rest = syncLampColor(live, 42_000);
    expect(new Set([flash, beat, rest]).size).toBe(3);
    expect(syncLampColor(live, 45_100)).toBe(beat);
  });
  it('is dark when stale or off', () => {
    expect(syncLampColor({ liveness: 'stale', lastTickAt: 0 }, 5)).toBeNull();
    expect(syncLampColor({ liveness: 'off', lastTickAt: 0 }, 5)).toBeNull();
  });
});
