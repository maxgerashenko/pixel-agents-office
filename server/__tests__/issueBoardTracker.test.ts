import { describe, expect, it } from 'vitest';

import {
  boardStatusOfIssue,
  type GhIssue,
  issueBoardFromIssues,
  IssueBoardTracker,
} from '../src/issueBoardTracker.js';

const issue = (over: Partial<GhIssue>): GhIssue => ({
  number: 1,
  title: 't',
  url: 'https://github.com/o/r/issues/1',
  state: 'OPEN',
  labels: [],
  ...over,
});
const labels = (...names: string[]) => names.map((name) => ({ name }));

describe('boardStatusOfIssue', () => {
  it('follows the board sync: a closed issue is done, else the first flow label wins', () => {
    expect(boardStatusOfIssue(issue({}))).toBe('new');
    expect(boardStatusOfIssue(issue({ labels: labels('bug') }))).toBe('new');
    expect(boardStatusOfIssue(issue({ labels: labels('design') }))).toBe('needs_design');
    expect(boardStatusOfIssue(issue({ labels: labels('ready') }))).toBe('ready');
    expect(boardStatusOfIssue(issue({ labels: labels('Coding') }))).toBe('in_progress');
    expect(boardStatusOfIssue(issue({ labels: labels('coding', 'review') }))).toBe('in_review');
    expect(boardStatusOfIssue(issue({ labels: labels('review', 'blocked') }))).toBe('blocked');
    expect(boardStatusOfIssue(issue({ labels: labels('blocked', 'decision') }))).toBe(
      'needs_decision',
    );
    expect(boardStatusOfIssue(issue({ state: 'CLOSED', labels: labels('blocked') }))).toBe('done');
  });
});

describe('progress of a card', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const progressOf = (over: Partial<GhIssue>) =>
    issueBoardFromIssues([issue(over)], now)[0].progress;

  it('needs design: writing the plan until a plan file exists, then ready for review', () => {
    const labelsNeedsDesign = labels('design');
    expect(progressOf({ labels: labelsNeedsDesign })).toBe('writing_plan');
    expect(progressOf({ labels: labelsNeedsDesign, hasPlanFile: true })).toBe('plan_ready');
  });

  it('in progress: coding until its pull request has checks running or is in review', () => {
    const labelsInProgress = labels('coding');
    expect(progressOf({ labels: labelsInProgress })).toBe('coding');
    expect(progressOf({ labels: labelsInProgress, pullRequestStage: 'plan' })).toBe('coding');
    expect(progressOf({ labels: labelsInProgress, pullRequestStage: 'coding' })).toBe('coding');
    expect(progressOf({ labels: labelsInProgress, pullRequestStage: 'tests' })).toBe('testing');
    expect(progressOf({ labels: labelsInProgress, pullRequestStage: 'review' })).toBe('testing');
  });

  it('other statuses carry no progress', () => {
    expect(progressOf({ labels: labels('ready') })).toBeUndefined();
    expect(progressOf({ labels: labels('review') })).toBeUndefined();
    expect(progressOf({ labels: labels('decision') })).toBeUndefined();
  });
});

describe('issueBoardFromIssues', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');

  it('keeps every open issue and only recently closed ones', () => {
    const cards = issueBoardFromIssues(
      [
        issue({ number: 5, labels: labels('coding') }),
        issue({ number: 6, state: 'CLOSED', closedAt: '2026-11-25T12:00:00Z' }),
        issue({ number: 7, state: 'CLOSED', closedAt: '2026-11-01T12:00:00Z' }),
      ],
      now,
    );
    expect(cards.map((c) => [c.number, c.status])).toEqual([
      [5, 'in_progress'],
      [6, 'done'],
    ]);
  });

  it('names each card by its repo and number, read from the issue url', () => {
    const [card] = issueBoardFromIssues(
      [issue({ number: 42, url: 'https://github.com/max/proto/issues/42' })],
      now,
    );
    expect(card).toEqual({
      id: 'max/proto#42',
      number: 42,
      title: 't',
      status: 'new',
      url: 'https://github.com/max/proto/issues/42',
      details: expect.any(Object),
    });
  });
});

describe('IssueBoardTracker', () => {
  it('reads each directory once, drops duplicates and broadcasts only on change', async () => {
    const sent: unknown[] = [];
    const store = { broadcast: (m: unknown) => sent.push(m) };
    const tracker = new IssueBoardTracker(store as never, {
      now: () => Date.parse('2026-11-26T12:00:00Z'),
      dirs: () => ['/a', '/a', '/b'],
      fetchIssues: async (dir) => (dir === '/b' ? null : [issue({ number: 3 })]),
    });
    await tracker.poll();
    await tracker.poll();
    expect(sent).toEqual([
      {
        type: 'issueBoardUpdate',
        issues: [
          {
            id: 'o/r#3',
            number: 3,
            title: 't',
            status: 'new',
            url: 'https://github.com/o/r/issues/1',
            details: expect.any(Object),
          },
        ],
      },
    ]);
    tracker.dispose();
  });
});

describe('issueBoardFromIssues details', () => {
  it('puts the sections of the body on the card, with the decision options', () => {
    const [card] = issueBoardFromIssues(
      [
        issue({
          body: '## Done when\nit ships\n\n## Decision needed\n**Q?**\n- [ ] A (recommended)\n- [ ] B\n',
        }),
      ],
      0,
    );
    expect(card.details?.doneWhen).toBe('it ships');
    expect(card.details?.decisions?.[0].options).toHaveLength(2);
  });

  it('gives a card with no body empty details, never undefined sections', () => {
    const [card] = issueBoardFromIssues([issue({})], 0);
    expect(card.details?.beforeAfter).toBe('');
    expect(card.details?.decisions).toEqual([]);
  });
});
