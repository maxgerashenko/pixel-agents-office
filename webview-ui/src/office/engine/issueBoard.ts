/**
 * The whiteboard's big view: the GitHub board, one column per Status. The server sends every
 * issue with its column (`issueBoardUpdate`); this keeps the latest board and groups it.
 * Pure and DOM-free; WhiteboardModal draws it.
 */
import type { IssueBoardCard, IssueBoardStatus } from '../../../../core/src/messages.js';

export type IssueBoardCardView = IssueBoardCard;

/** The board's columns, left to right, with the names the GitHub board shows. */
export const ISSUE_BOARD_COLUMNS: ReadonlyArray<{ status: IssueBoardStatus; label: string }> = [
  { status: 'new', label: 'New' },
  { status: 'needs_design', label: 'Needs design' },
  { status: 'ready', label: 'Ready' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'in_review', label: 'In review' },
  { status: 'needs_decision', label: 'Needs decision' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'done', label: 'Done' },
];

const KNOWN_STATUSES = new Set<string>(ISSUE_BOARD_COLUMNS.map((c) => c.status));

let board: IssueBoardCardView[] = [];

export function setIssueBoard(next: IssueBoardCardView[]): void {
  board = next.filter((c) => KNOWN_STATUSES.has(c.status));
}

export function getIssueBoard(): IssueBoardCardView[] {
  return board;
}

export interface IssueBoardColumn {
  status: IssueBoardStatus;
  label: string;
  cards: IssueBoardCardView[];
}

/** Every column in board order, each with its issues by number; empty columns are kept. */
export function issueBoardColumns(cards: IssueBoardCardView[]): IssueBoardColumn[] {
  return ISSUE_BOARD_COLUMNS.map(({ status, label }) => ({
    status,
    label,
    cards: cards.filter((c) => c.status === status).sort((a, b) => a.number - b.number),
  }));
}

/** A card opens its issue only when the link is a github.com page. */
export function isOpenableIssueUrl(url: string): boolean {
  return url.startsWith('https://github.com/');
}
