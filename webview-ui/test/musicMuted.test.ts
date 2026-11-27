import { afterEach, describe, expect, it, vi } from 'vitest';

import { MUSIC_ON_STORAGE_KEY } from '../src/constants.js';
import { readMusicMuted, writeMusicMuted } from '../src/music/useHourlyMusic.js';

function stubStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  });
  return data;
}

describe('music autostart opt-out', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('plays on load until the user turns the music off', () => {
    stubStorage();
    expect(readMusicMuted()).toBe(false);
    writeMusicMuted(true);
    expect(readMusicMuted()).toBe(true);
    writeMusicMuted(false);
    expect(readMusicMuted()).toBe(false);
  });
  it('stores the choice under the music key', () => {
    const data = stubStorage();
    writeMusicMuted(true);
    expect(data.get(MUSIC_ON_STORAGE_KEY)).toBe('off');
  });
  it('defaults to playing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readMusicMuted()).toBe(false);
    expect(() => writeMusicMuted(true)).not.toThrow();
  });
});
