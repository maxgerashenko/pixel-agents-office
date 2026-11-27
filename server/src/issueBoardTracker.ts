import { execFile } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

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
import { type GhPr, stageOfPr, type TaskStage } from './taskTracker.js';

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

/** What the agent is doing on a card, for the sky: set only for needs design and in progress. */
export const ISSUE_PROGRESSES = ['writing_plan', 'plan_ready', 'coding', 'testing'] as const;
export type IssueProgress = (typeof ISSUE_PROGRESSES)[number];

export interface IssueBoardCard {
  /** `owner/repo#number`. */
  id: string;
  number: number;
  title: string;
  status: IssueBoardStatus;
  url: string;
  progress?: IssueProgress;
}

/** The fields of `gh issue list --json ...` this reads. */
export interface GhIssue {
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  labels: { name: string }[];
  closedAt?: string | null;
  /** Added by the tracker, not by `gh`: the stage of the open pull request that fixes this issue. */
  pullRequestStage?: TaskStage;
  /** Added by the tracker: a plan file `plan/feature-<number>-*.md` exists in the repo. */
  hasPlanFile?: boolean;
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

/** Pure: what the agent is doing on an open issue, or undefined when the status has no such split. */
function progressOfIssue(issue: GhIssue, status: IssueBoardStatus): IssueProgress | undefined {
  if (status === 'needs_design') return issue.hasPlanFile ? 'plan_ready' : 'writing_plan';
  if (status === 'in_progress') {
    const testing = ['tests', 'review', 'ready_to_merge'];
    return testing.includes(issue.pullRequestStage ?? '') ? 'testing' : 'coding';
  }
  return undefined;
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
    const status = boardStatusOfIssue(issue);
    const progress = progressOfIssue(issue, status);
    cards.push({
      id: `${repo}#${issue.number}`,
      number: issue.number,
      title: issue.title,
      status,
      url: issue.url,
      ...(progress ? { progress } : {}),
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

type GhOpenPr = GhPr & { closingIssuesReferences?: { number: number }[] };

function runGhOpenPrList(dir: string): Promise<GhOpenPr[]> {
  return new Promise((resolve) => {
    execFile(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'open',
        '--limit',
        '100',
        '--json',
        'number,title,url,headRefName,state,isDraft,changedFiles,files,reviewDecision,reviewRequests,statusCheckRollup,closingIssuesReferences',
      ],
      { cwd: dir, timeout: ISSUE_BOARD_POLL_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        try {
          const parsed = err ? null : (JSON.parse(stdout) as unknown);
          resolve(Array.isArray(parsed) ? (parsed as GhOpenPr[]) : []);
        } catch {
          resolve([]);
        }
      },
    );
  });
}

/** Issue numbers that have a plan file `plan/feature-<number>-*.md` in the repo at `dir`. */
function issueNumbersWithPlanFile(dir: string): Set<number> {
  try {
    const numbers = readdirSync(join(dir, 'plan')).flatMap((name) => {
      const match = /^feature-(\d+)-.*\.md$/.exec(name);
      return match ? [Number(match[1])] : [];
    });
    return new Set(numbers);
  } catch {
    return new Set();
  }
}

/**
 * Asks `gh` for the open and recently closed issues of the repo at `dir`, each marked with the
 * stage of the pull request that fixes it and whether its plan file exists; null when unavailable.
 */
async function fetchIssues(dir: string): Promise<GhIssue[] | null> {
  const [open, closed, openPrs] = await Promise.all([
    runGhIssueList(dir, 'open', ISSUE_BOARD_OPEN_LIMIT),
    runGhIssueList(dir, 'closed', ISSUE_BOARD_CLOSED_LIMIT),
    runGhOpenPrList(dir),
  ]);
  if (open === null) return null;
  const planned = issueNumbersWithPlanFile(dir);
  const stageByIssueNumber = new Map<number, TaskStage>();
  for (const pr of openPrs) {
    for (const ref of pr.closingIssuesReferences ?? [])
      stageByIssueNumber.set(ref.number, stageOfPr(pr));
  }
  const enriched = open.map((issue) => ({
    ...issue,
    pullRequestStage: stageByIssueNumber.get(issue.number),
    hasPlanFile: planned.has(issue.number),
  }));
  return [...enriched, ...(closed ?? [])];
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
