/**
 * The whiteboard's big view: issues grouped into the board's Status columns.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  getIssueBoard,
  isOpenableIssueUrl,
  type IssueBoardCardView,
  issueBoardColumns,
  issueDetailsLine,
  setIssueBoard,
} from '../src/office/engine/issueBoard.js';

const card = (number: number, status: IssueBoardCardView['status']): IssueBoardCardView => ({
  id: `o/r#${number}`,
  number,
  title: `issue ${number}`,
  status,
  url: `https://github.com/o/r/issues/${number}`,
});

test('columns follow the board left to right, each with its own issues, empty ones kept', () => {
  const columns = issueBoardColumns([
    card(3, 'in_progress'),
    card(1, 'new'),
    card(2, 'in_progress'),
  ]);
  assert.deepEqual(
    columns.map((c) => c.label),
    ['Ready', 'Needs design', 'Coding', 'In review', 'Needs decision'],
  );
  assert.deepEqual(
    columns.map((c) => c.cards.map((x) => x.number)),
    [[], [], [2, 3], [], []],
  );
});

test('New, Blocked and Done are not shown on the board', () => {
  const columns = issueBoardColumns([card(1, 'new'), card(2, 'blocked'), card(3, 'done')]);
  assert.deepEqual(
    columns.map((c) => c.status),
    ['ready', 'needs_design', 'in_progress', 'in_review', 'needs_decision'],
  );
  assert.equal(
    columns.some((c) => c.cards.length > 0),
    false,
  );
});

test('the store keeps the latest board and drops cards with an unknown status', () => {
  setIssueBoard([card(1, 'blocked'), { ...card(2, 'new'), status: 'later' as never }]);
  assert.deepEqual(
    getIssueBoard().map((c) => c.number),
    [1],
  );
});

test('only GitHub pages open from a card', () => {
  assert.equal(isOpenableIssueUrl('https://github.com/o/r/issues/1'), true);
  assert.equal(isOpenableIssueUrl('javascript:alert(1)'), false);
  assert.equal(isOpenableIssueUrl('https://github.com.evil.test/o/r/issues/1'), false);
});

test('details line names the column and the progress step', () => {
  assert.equal(issueDetailsLine(card(1, 'ready')), 'Ready');
  assert.equal(
    issueDetailsLine({ ...card(2, 'in_progress'), progress: 'plan_ready' }),
    'Coding \u00b7 plan ready',
  );
});
