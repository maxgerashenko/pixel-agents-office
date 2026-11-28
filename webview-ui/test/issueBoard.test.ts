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
  issueDetailSections,
  issueDetailsLine,
  setIssueBoard,
} from '../src/office/engine/issueBoard.js';

const card = (number: number, status: IssueBoardCardView['status']): IssueBoardCardView => ({
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
});

test('columns follow the board left to right, each with its own issues, empty ones kept', () => {
  const columns = issueBoardColumns([
    card(3, 'in_progress'),
    card(1, 'new'),
    card(2, 'in_progress'),
  ]);
  assert.deepEqual(
    columns.map((c) => c.label),
    ['Ready', 'Design', 'Coding', 'Blocked', 'Decision', 'Review'],
  );
  assert.deepEqual(
    columns.map((c) => c.cards.map((x) => x.number)),
    [[], [], [2, 3], [], [], []],
  );
});

test('Blocked, Decision, Review end the board; New and Done are not shown on the board', () => {
  const columns = issueBoardColumns([card(1, 'new'), card(2, 'blocked'), card(3, 'done')]);
  assert.deepEqual(
    columns.map((c) => c.status),
    ['ready', 'needs_design', 'in_progress', 'blocked', 'needs_decision', 'in_review'],
  );
  assert.deepEqual(
    columns.map((c) => c.cards.length),
    [0, 0, 0, 1, 0, 0],
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

test('detail sections always list Before / After and Done when, flagged missing when empty', () => {
  const sections = issueDetailSections(card(1, 'new'));
  assert.deepEqual(
    sections.map((s) => [s.label, s.missing, s.collapsed]),
    [
      ['Before / After', true, false],
      ['Done when', true, false],
    ],
  );
});

test('detail sections add Blocked by (not when none), Scope and Verify (collapsed) when filled', () => {
  const full: IssueBoardCardView = {
    ...card(1, 'new'),
    details: {
      ...card(1, 'new').details,
      beforeAfter: '- Before: a\n- After: b',
      doneWhen: 'ships',
      blockedBy: '#12',
      scope: 'files',
      verify: 'run it',
    },
  };
  assert.deepEqual(
    issueDetailSections(full).map((s) => [s.label, s.missing, s.collapsed]),
    [
      ['Before / After', false, false],
      ['Done when', false, false],
      ['Blocked by', false, false],
      ['Scope', false, true],
      ['Verify', false, true],
    ],
  );
  const none = { ...full, details: { ...full.details, blockedBy: 'none' } };
  assert.ok(!issueDetailSections(none).some((s) => s.label === 'Blocked by'));
});
