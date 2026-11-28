/**
 * The sky shows the board's issues: which board cards fly, which wait, which stay out.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { IssueBoardCardView } from '../src/office/engine/issueBoard.js';
import { skyTasksFromBoard } from '../src/office/engine/skyFromBoard.js';

const card = (
  number: number,
  status: IssueBoardCardView['status'],
  progress?: IssueBoardCardView['progress'],
): IssueBoardCardView => ({
  id: `o/r#${number}`,
  number,
  title: `issue ${number}`,
  status,
  url: `https://github.com/o/r/issues/${number}`,
  details: {
    labels: [],
    beforeAfter: '',
    doneWhen: '',
    blockedBy: '',
    scope: '',
    verify: '',
    decisions: [],
  },
  ...(progress ? { progress } : {}),
});

const stageOf = (c: IssueBoardCardView) => skyTasksFromBoard([c])[0]?.stage;

test('needs design flies while the agent writes the plan and parks once the plan is ready', () => {
  assert.equal(stageOf(card(1, 'needs_design', 'writing_plan')), 'designing');
  assert.equal(stageOf(card(1, 'needs_design')), 'designing');
  assert.equal(stageOf(card(1, 'needs_design', 'plan_ready')), 'plan_ready');
});

test('in progress flies as coding, or testing once the pull request is in tests or review', () => {
  assert.equal(stageOf(card(2, 'in_progress', 'coding')), 'coding');
  assert.equal(stageOf(card(2, 'in_progress')), 'coding');
  assert.equal(stageOf(card(2, 'in_progress', 'testing')), 'testing');
});

test('ready, in review, needs decision and done map to their own stage', () => {
  assert.equal(stageOf(card(3, 'ready')), 'ready');
  assert.equal(stageOf(card(3, 'in_review')), 'in_review');
  assert.equal(stageOf(card(3, 'needs_decision')), 'needs_decision');
  assert.equal(stageOf(card(3, 'done')), 'done');
});

test('new and blocked issues stay out of the sky', () => {
  assert.deepEqual(skyTasksFromBoard([card(4, 'new'), card(5, 'blocked')]), []);
});

test('a task carries its id, title and issue page', () => {
  assert.deepEqual(skyTasksFromBoard([card(6, 'ready')]), [
    { id: 'o/r#6', title: 'issue 6', stage: 'ready', url: 'https://github.com/o/r/issues/6' },
  ]);
});
