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
    [
      'New',
      'Needs design',
      'Ready',
      'In progress',
      'In review',
      'Needs decision',
      'Blocked',
      'Done',
    ],
  );
  assert.deepEqual(
    columns.map((c) => c.cards.map((x) => x.number)),
    [[1], [], [], [2, 3], [], [], [], []],
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
