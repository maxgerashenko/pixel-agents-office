import { describe, expect, it } from 'vitest';

import {
  type BoardItem,
  BoardLabelSync,
  boardSyncLiveness,
  boardSyncTickMsFromEnv,
  columnOfLabels,
  planLabelChanges,
} from '../src/boardLabelSync.js';

const item = (number: number, status: string, labels: string[] = []): BoardItem => ({
  repo: 'o/r',
  number,
  status,
  labels,
});

describe('planLabelChanges', () => {
  it('records only on first sight', () => {
    expect(planLabelChanges([item(1, 'coding')], {})).toEqual([]);
  });
  it('swaps the flow label when the card moved', () => {
    const plan = planLabelChanges([item(1, 'review', ['in-progress', 'area:x'])], {
      'o/r#1': 'coding',
    });
    expect(plan).toEqual([
      {
        repo: 'o/r',
        number: 1,
        from: 'coding',
        to: 'review',
        add: ['in-review'],
        remove: ['in-progress'],
      },
    ]);
  });
  it('leaves a card alone when its column did not change', () => {
    expect(planLabelChanges([item(1, 'coding', [])], { 'o/r#1': 'coding' })).toEqual([]);
  });
  it('skips cards labelled local-only', () => {
    expect(planLabelChanges([item(1, 'ready', ['local-only'])], { 'o/r#1': 'new' })).toEqual([]);
  });
  it('skips when labels already agree', () => {
    expect(planLabelChanges([item(1, 'review', ['in-review'])], { 'o/r#1': 'coding' })).toEqual([]);
  });
  it('moving to New removes flow labels, Done changes nothing', () => {
    expect(
      planLabelChanges([item(1, 'new', ['blocked'])], { 'o/r#1': 'blocked' })[0]?.remove,
    ).toEqual(['blocked']);
    expect(planLabelChanges([item(2, 'done', ['in-progress'])], { 'o/r#2': 'coding' })).toEqual([]);
  });
});

describe('columnOfLabels', () => {
  it('uses the board sync priority', () => {
    expect(columnOfLabels(['in-progress', 'needs-decision'])).toBe('decision');
    expect(columnOfLabels([])).toBe('new');
  });
});

describe('boardSyncLiveness', () => {
  const hb = {
    lastTickAt: 1000,
    tickMs: 100,
    mode: 'on' as const,
    ok: true,
    itemsSeen: 0,
    changes: 0,
  };
  it('live, stale, off', () => {
    expect(boardSyncLiveness(hb, 1150)).toBe('live');
    expect(boardSyncLiveness(hb, 1300)).toBe('stale');
    expect(boardSyncLiveness(null, 0)).toBe('off');
    expect(boardSyncLiveness({ ...hb, mode: 'off' }, 1000)).toBe('off');
  });
});

describe('BoardLabelSync.tick', () => {
  const make = (mode: 'dry-run' | 'on', fail = false) => {
    const applied: unknown[] = [];
    let seen: Record<string, string> = { 'o/r#1': 'coding' };
    const beats: unknown[] = [];
    const sync = new BoardLabelSync({
      mode,
      now: () => 5,
      log: () => {},
      fetchItems: async () => [item(1, 'review', ['in-progress'])],
      applyChange: async (c) => {
        if (fail) throw new Error('boom');
        applied.push(c);
      },
      loadLastSeen: () => seen,
      saveLastSeen: (s) => {
        seen = s;
      },
      writeHeartbeat: (h) => beats.push(h),
    });
    return { sync, applied, beats, seen: () => seen };
  };
  it('dry-run applies nothing and keeps the snapshot', async () => {
    const t = make('dry-run');
    const hb = await t.sync.tick();
    expect(t.applied).toEqual([]);
    expect(t.seen()['o/r#1']).toBe('coding');
    expect(hb?.ok).toBe(true);
    expect(t.beats).toHaveLength(1);
  });
  it('on applies and records', async () => {
    const t = make('on');
    const hb = await t.sync.tick();
    expect(t.applied).toHaveLength(1);
    expect(hb?.changes).toBe(1);
    expect(t.seen()['o/r#1']).toBe('review');
  });
  it('a failed edit keeps the old column and flags the heartbeat', async () => {
    const t = make('on', true);
    const hb = await t.sync.tick();
    expect(hb?.ok).toBe(false);
    expect(t.seen()['o/r#1']).toBe('coding');
  });
});

describe('boardSyncTickMsFromEnv', () => {
  it('defaults to 2 minutes and reads the override', () => {
    expect(boardSyncTickMsFromEnv({})).toBe(120_000);
    expect(boardSyncTickMsFromEnv({ PIXEL_AGENTS_BOARD_SYNC_MINUTES: '4' })).toBe(240_000);
    expect(boardSyncTickMsFromEnv({ PIXEL_AGENTS_BOARD_SYNC_MINUTES: 'x' })).toBe(120_000);
  });
});
