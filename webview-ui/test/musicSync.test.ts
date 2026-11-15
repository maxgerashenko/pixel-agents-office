import { describe, expect, it } from 'vitest';

import {
  needsResync,
  parseYouTubeId,
  secondsIntoHour,
  syncedPosition,
} from '../src/music/musicSync.js';

const at = (m: number, s: number, ms = 0) => new Date(2026, 10, 15, 9, m, s, ms);

describe('musicSync', () => {
  it('counts seconds from the top of the hour', () => {
    expect(secondsIntoHour(at(0, 0))).toBe(0);
    expect(secondsIntoHour(at(12, 30, 500))).toBe(750.5);
  });
  it('loops a 1:20 track in step with the clock', () => {
    expect(syncedPosition(at(0, 0), 80)).toBe(0);
    expect(syncedPosition(at(1, 20), 80)).toBe(0);
    expect(syncedPosition(at(2, 10), 80)).toBe(50);
  });
  it('restarts a track longer than an hour at every :00', () => {
    expect(syncedPosition(at(0, 0), 4800)).toBe(0);
    expect(syncedPosition(at(59, 59), 4800)).toBe(3599);
  });
  it('treats unknown length as no loop', () => {
    expect(syncedPosition(at(1, 0), 0)).toBe(60);
  });
  it('resyncs only past tolerance, and not across a loop seam', () => {
    expect(needsResync(10, 11, 80, 1.5)).toBe(false);
    expect(needsResync(10, 14, 80, 1.5)).toBe(true);
    expect(needsResync(79.5, 0.5, 80, 1.5)).toBe(false);
  });
  it('parses YouTube links', () => {
    const id = 'dQw4w9WgXcQ';
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${id}&t=3`)).toBe(id);
    expect(parseYouTubeId(`https://youtu.be/${id}?si=x`)).toBe(id);
    expect(parseYouTubeId(`youtube.com/shorts/${id}`)).toBe(id);
    expect(parseYouTubeId(id)).toBe(id);
    expect(parseYouTubeId('https://example.com/watch?v=' + id)).toBeNull();
    expect(parseYouTubeId('')).toBeNull();
  });
});
