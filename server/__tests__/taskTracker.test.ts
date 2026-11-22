import { describe, expect, it } from 'vitest';

import { type GhPr, stageOfPr, tasksFromPrs } from '../src/taskTracker.js';

const pr = (over: Partial<GhPr>): GhPr => ({
  number: 1,
  title: 't',
  headRefName: 'b',
  state: 'OPEN',
  isDraft: false,
  ...over,
});
const ok = [{ status: 'COMPLETED', conclusion: 'SUCCESS' }];

describe('stageOfPr', () => {
  it('maps PR state to a stage', () => {
    expect(stageOfPr(pr({ isDraft: true, changedFiles: 0 }))).toBe('plan');
    expect(stageOfPr(pr({ isDraft: true, changedFiles: 3 }))).toBe('coding');
    expect(stageOfPr(pr({ isDraft: true, statusCheckRollup: ok }))).toBe('tests');
    expect(stageOfPr(pr({ statusCheckRollup: [{ status: 'IN_PROGRESS' }] }))).toBe('tests');
    expect(stageOfPr(pr({ statusCheckRollup: ok, reviewRequests: [{}] }))).toBe('review');
    expect(stageOfPr(pr({ statusCheckRollup: ok }))).toBe('review');
    expect(stageOfPr(pr({ statusCheckRollup: ok, reviewDecision: 'APPROVED' }))).toBe(
      'ready_to_merge',
    );
    expect(stageOfPr(pr({ state: 'MERGED' }))).toBe('merged');
  });
});

describe('tasksFromPrs', () => {
  it('drops closed, stale and long-merged PRs', () => {
    const now = Date.parse('2026-11-22T12:00:00Z');
    const tasks = tasksFromPrs(
      [
        pr({ number: 1, updatedAt: '2026-11-22T11:00:00Z' }),
        pr({ number: 2, state: 'CLOSED' }),
        pr({ number: 3, updatedAt: '2026-10-01T00:00:00Z' }),
        pr({ number: 4, state: 'MERGED', mergedAt: '2026-11-22T11:50:00Z' }),
        pr({ number: 5, state: 'MERGED', mergedAt: '2026-11-20T00:00:00Z' }),
      ],
      now,
    );
    expect(tasks.map((t) => t.id)).toEqual(['b#1', 'b#4']);
  });
});
