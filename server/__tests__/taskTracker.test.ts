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
    // a plan stays the plan until it is merged: documents only, draft or not
    const docs = [{ path: 'docs/plans/x.md' }];
    expect(stageOfPr(pr({ isDraft: true, changedFiles: 1, files: docs }))).toBe('plan');
    expect(stageOfPr(pr({ files: docs, statusCheckRollup: ok }))).toBe('plan');
    expect(stageOfPr(pr({ state: 'MERGED', files: docs }))).toBe('merged');
    expect(stageOfPr(pr({ isDraft: true, files: [...docs, { path: 'src/a.ts' }] }))).toBe('coding');
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

describe('tasksFromPrs url', () => {
  it('carries the pull request link along', () => {
    const [t] = tasksFromPrs(
      [pr({ url: 'https://github.com/o/r/pull/1' } as Partial<GhPr>)],
      Date.now(),
    );
    expect(t.url).toBe('https://github.com/o/r/pull/1');
    const [u] = tasksFromPrs([pr({})], Date.now());
    expect('url' in u).toBe(false);
  });
});

describe('tasksFromPrs plan link', () => {
  it('a plan opens the PR files, other stages the PR', () => {
    const url = 'https://github.com/o/r/pull/1';
    const [plan] = tasksFromPrs(
      [pr({ url, files: [{ path: 'docs/a.md' }] } as Partial<GhPr>)],
      Date.now(),
    );
    expect(plan.stage).toBe('plan');
    expect(plan.url).toBe(`${url}/files`);
  });
});
