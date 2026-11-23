import { describe, expect, it } from 'vitest';

import { isActiveCardStatus } from '../src/components/cardBar.js';
import { agentsNeedingPermission, needsYouSkyIsNight } from '../src/components/needsYou.js';

describe('agentsNeedingPermission', () => {
  it('is empty when nothing waits', () => {
    expect(agentsNeedingPermission({})).toEqual([]);
    expect(agentsNeedingPermission({ 1: [{ done: false }], 2: undefined })).toEqual([]);
  });

  it('lists every agent with an open permission prompt', () => {
    expect(
      agentsNeedingPermission({
        1: [{ done: false, permissionWait: true }],
        2: [{ done: false }],
        3: [{ done: true }, { done: false, permissionWait: true }],
      }),
    ).toEqual([1, 3]);
  });

  it('stops as soon as the permission is answered', () => {
    expect(agentsNeedingPermission({ 1: [{ done: false, permissionWait: false }] })).toEqual([]);
    expect(agentsNeedingPermission({ 1: [{ done: true, permissionWait: true }] })).toEqual([]);
  });

  it('keeps a permission card in the active group', () => {
    expect(isActiveCardStatus('permission')).toBe(true);
  });
});

describe('needsYouSkyIsNight', () => {
  it('is day at midday and night late in the hour', () => {
    expect(needsYouSkyIsNight(0.15)).toBe(false);
    expect(needsYouSkyIsNight(0.8)).toBe(true);
  });
});
