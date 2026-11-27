import { describe, expect, it } from 'vitest';

import { syncAlpha, syncLampColor } from '../src/office/engine/skySync.js';

describe('syncLampColor', () => {
  const live = { liveness: 'live' as const, lastTickAt: 10_000 };
  it('flashes right after a tick, glows steady later', () => {
    const flash = syncLampColor(live, 10_500);
    const steady = syncLampColor(live, 60_000);
    expect(flash).not.toBeNull();
    expect(steady).not.toBeNull();
    expect(flash).not.toBe(steady);
  });
  it('is dark when stale or off', () => {
    expect(syncLampColor({ liveness: 'stale', lastTickAt: 0 }, 5)).toBeNull();
    expect(syncLampColor({ liveness: 'off', lastTickAt: 0 }, 5)).toBeNull();
  });
  it('dims craft unless live', () => {
    expect(syncAlpha(live)).toBe(1);
    expect(syncAlpha({ liveness: 'off', lastTickAt: 0 })).toBeLessThan(
      syncAlpha({ liveness: 'stale', lastTickAt: 0 }),
    );
  });
});
