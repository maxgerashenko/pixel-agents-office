import { execFile } from 'child_process';

import type { AgentStateStore } from './agentStateStore.js';
import { readConfig } from './configPersistence.js';
import {
  ISSUE_BOARD_CLOSED_LIMIT,
  ISSUE_BOARD_DONE_LINGER_MS,
  ISSUE_BOARD_OPEN_LIMIT,
  ISSUE_BOARD_POLL_ENV,
  ISSUE_BOARD_POLL_INTERVAL_MS,
  ISSUE_BOARD_POLL_TIMEOUT_MS,
} from './constants.js';

/** The board's Status columns, left to right. */
export const ISSUE_BOARD_STATUSES = [
  'new',
  'needs_design',
  'ready',
  'in_progress',
  'in_review',
  'needs_decision',
  'blocked',
  'done',
] as const;
export type IssueBoardStatus = (typeof ISSUE_BOARD_STATUSES)[number];

/**
 * Flow labels in priority order: the first one an open issue carries is its column. The same
 * order as prototypeRAG's scripts/project_board_status_sync.py, which sets the GitHub board from
 * these labels, so the office and the board agree.
 */
const FLOW_LABEL_TO_STATUS_IN_PRIORITY_ORDER: ReadonlyArray<[string, IssueBoardStatus]> = [
  ['needs-decision', 'needs_decision'],
  ['blocked', 'blocked'],
  ['in-review', 'in_review'],
  ['in-progress', 'in_progress'],
  ['status:ready', 'ready'],
  ['needs-design', 'needs_design'],
];

export interface IssueBoardCard {
  /** `owner/repo#number`. */
  id: string;
  number: number;
  title: string;
  status: IssueBoardStatus;
  url: string;
}

/** The fields of `gh issue list --json ...` this reads. */
export interface GhIssue {
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  labels: { name: string }[];
  closedAt?: string | null;
}

/** Pure: the board column an issue belongs in. */
export function boardStatusOfIssue(issue: GhIssue): IssueBoardStatus {
  if (issue.state === 'CLOSED') return 'done';
  const labelNames = new Set(issue.labels.map((label) => label.name.toLowerCase()));
  for (const [flowLabel, status] of FLOW_LABEL_TO_STATUS_IN_PRIORITY_ORDER) {
    if (labelNames.has(flowLabel)) return status;
  }
  return 'new';
}

/** `owner/repo` from an issue's web page, or null when the url is not a GitHub issue. */
function repoOfIssueUrl(url: string): string | null {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/\d+$/.exec(url);
  return match ? match[1] : null;
}

/** Pure: the cards for one repo's issues at `now`; closed issues only while recently closed. */
export function issueBoardFromIssues(issues: GhIssue[], now: number): IssueBoardCard[] {
  const cards: IssueBoardCard[] = [];
  for (const issue of issues) {
    if (issue.state === 'CLOSED') {
      const closedAt = Date.parse(issue.closedAt ?? '');
      if (!Number.isFinite(closedAt) || now - closedAt > ISSUE_BOARD_DONE_LINGER_MS) continue;
    }
    const repo = repoOfIssueUrl(issue.url);
    if (repo === null) continue;
    cards.push({
      id: `${repo}#${issue.number}`,
      number: issue.number,
      title: issue.title,
      status: boardStatusOfIssue(issue),
      url: issue.url,
    });
  }
  return cards;
}

function runGhIssueList(
  dir: string,
  state: 'open' | 'closed',
  limit: number,
): Promise<GhIssue[] | null> {
  return new Promise((resolve) => {
    execFile(
      'gh',
      [
        'issue',
        'list',
        '--state',
        state,
        '--limit',
        String(limit),
        '--json',
        'number,title,url,state,labels,closedAt',
      ],
      { cwd: dir, timeout: ISSUE_BOARD_POLL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          console.warn(`[Pixel Agents] gh issue list failed in ${dir}: ${err.message}`);
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as unknown;
          resolve(Array.isArray(parsed) ? (parsed as GhIssue[]) : null);
        } catch {
          resolve(null);
        }
      },
    );
  });
}

/** Asks `gh` for the open and recently closed issues of the repo at `dir`; null when unavailable. */
async function fetchIssues(dir: string): Promise<GhIssue[] | null> {
  const [open, closed] = await Promise.all([
    runGhIssueList(dir, 'open', ISSUE_BOARD_OPEN_LIMIT),
    runGhIssueList(dir, 'closed', ISSUE_BOARD_CLOSED_LIMIT),
  ]);
  if (open === null) return null;
  return [...open, ...(closed ?? [])];
}

export interface IssueBoardTrackerOptions {
  now?: () => number;
  /** Repo directories to read (default: the user's Directories). */
  dirs?: () => string[];
  fetchIssues?: (dir: string) => Promise<GhIssue[] | null>;
  intervalMs?: number;
}

/**
 * Keeps the whiteboard's issue board fresh. While at least one page is open it asks GitHub
 * (through the user's own `gh`) every `ISSUE_BOARD_POLL_INTERVAL_MS` and broadcasts
 * `issueBoardUpdate` when the board changed.
 */
export class IssueBoardTracker {
  private latest: IssueBoardCard[] = [];
  private timer: NodeJS.Timeout | null = null;
  private viewers = 0;
  private inFlight = false;
  private disposed = false;
  private readonly now: () => number;
  private readonly dirs: () => string[];
  private readonly fetchIssues: (dir: string) => Promise<GhIssue[] | null>;
  private readonly intervalMs: number;

  constructor(
    private readonly store: Pick<AgentStateStore, 'broadcast'>,
    opts: IssueBoardTrackerOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.dirs = opts.dirs ?? (() => readConfig().directories.map((d) => d.path));
    this.fetchIssues = opts.fetchIssues ?? fetchIssues;
    this.intervalMs = opts.intervalMs ?? ISSUE_BOARD_POLL_INTERVAL_MS;
  }

  currentMessage(): Record<string, unknown> {
    return { type: 'issueBoardUpdate', issues: this.latest };
  }

  addViewer(): () => void {
    if (this.disposed) return () => {};
    this.viewers++;
    if (this.viewers === 1) this.schedule(0);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.viewers--;
      if (this.viewers === 0 && this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    };
  }

  dispose(): void {
    this.disposed = true;
    this.viewers = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(ms: number): void {
    if (process.env[ISSUE_BOARD_POLL_ENV] === '0') return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, ms);
  }

  async poll(): Promise<void> {
    if (this.inFlight || this.disposed) return;
    this.inFlight = true;
    try {
      const cards: IssueBoardCard[] = [];
      for (const dir of new Set(this.dirs())) {
        const issues = await this.fetchIssues(dir);
        if (issues) cards.push(...issueBoardFromIssues(issues, this.now()));
      }
      const seen = new Set<string>();
      const issues = cards.filter((card) => !seen.has(card.id) && seen.add(card.id));
      if (JSON.stringify(issues) !== JSON.stringify(this.latest)) {
        this.latest = issues;
        this.store.broadcast(this.currentMessage());
      }
    } finally {
      this.inFlight = false;
      if (!this.disposed && this.viewers > 0) this.schedule(this.intervalMs);
    }
  }
}
