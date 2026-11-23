import { execFile } from 'child_process';

import type { AgentStateStore } from './agentStateStore.js';
import { readConfig } from './configPersistence.js';
import {
  TASKS_MAX,
  TASKS_MERGED_LINGER_MS,
  TASKS_POLL_ENV,
  TASKS_POLL_INTERVAL_MS,
  TASKS_POLL_TIMEOUT_MS,
  TASKS_STALE_MS,
} from './constants.js';

/** The stages a task (one branch + PR) passes through, in order. */
export const TASK_STAGES = [
  'plan',
  'coding',
  'tests',
  'review',
  'ready_to_merge',
  'merged',
] as const;
export type TaskStage = (typeof TASK_STAGES)[number];

export interface TaskInfo {
  id: string;
  title: string;
  stage: TaskStage;
  /** The pull request's web page, when `gh` reported one. */
  url?: string;
}

/** The fields of `gh pr list --json ...` this reads. */
export interface GhPr {
  number: number;
  title: string;
  url?: string;
  headRefName: string;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  isDraft: boolean;
  changedFiles?: number;
  files?: { path: string }[];
  reviewDecision?: string | null;
  reviewRequests?: unknown[];
  statusCheckRollup?: { status?: string; conclusion?: string; state?: string }[] | null;
  updatedAt?: string;
  mergedAt?: string | null;
}

type ChecksState = 'none' | 'pending' | 'failing' | 'passing';

function checksState(pr: GhPr): ChecksState {
  const rollup = pr.statusCheckRollup ?? [];
  if (rollup.length === 0) return 'none';
  let pending = false;
  for (const c of rollup) {
    const verdict = (c.conclusion || c.state || '').toUpperCase();
    if (['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED'].includes(verdict)) {
      return 'failing';
    }
    if (c.status && c.status.toUpperCase() !== 'COMPLETED') pending = true;
    if (!verdict) pending = true;
    if (verdict === 'PENDING' || verdict === 'EXPECTED') pending = true;
  }
  return pending ? 'pending' : 'passing';
}

/** A plan is documents only: markdown, or anything under a docs/ or plans/ folder. */
const PLAN_DOC_PATTERN = /(\.md$)|(^|\/)(docs?|plans?)\//i;

/**
 * Pure: a plan that is not on main yet. An open pull request with nothing in it, or with
 * only documents in it, is still the plan; it ends when that pull request is merged (the
 * plan is published to main) or code joins the documents.
 */
function isUnpublishedPlan(pr: GhPr): boolean {
  if (pr.isDraft && pr.changedFiles === 0) return true;
  const files = pr.files ?? [];
  return files.length > 0 && files.every((f) => PLAN_DOC_PATTERN.test(f.path));
}

/** Pure: where a pull request is on the way from plan to merged. */
export function stageOfPr(pr: GhPr): TaskStage {
  if (pr.state === 'MERGED') return 'merged';
  if (isUnpublishedPlan(pr)) return 'plan';
  const checks = checksState(pr);
  if (pr.isDraft) {
    if (checks !== 'none') return 'tests';
    return 'coding';
  }
  if (checks === 'pending' || checks === 'failing') return 'tests';
  if (pr.reviewDecision === 'APPROVED') return 'ready_to_merge';
  // open and green, with or without a review requested: it is waiting for its review
  return 'review';
}

/** Pure: the board for one repo's pull requests at `now`. */
export function tasksFromPrs(prs: GhPr[], now: number): TaskInfo[] {
  const out: TaskInfo[] = [];
  for (const pr of prs) {
    if (pr.state === 'CLOSED') continue;
    const stamp = Date.parse((pr.state === 'MERGED' ? pr.mergedAt : pr.updatedAt) ?? '');
    const age = Number.isFinite(stamp) ? now - stamp : 0;
    if (pr.state === 'MERGED' ? age > TASKS_MERGED_LINGER_MS : age > TASKS_STALE_MS) continue;
    const stage = stageOfPr(pr);
    const task: TaskInfo = { id: `${pr.headRefName}#${pr.number}`, title: pr.title, stage };
    // a plan opens the pull request's files (its documents); the rest open the pull request
    if (typeof pr.url === 'string' && pr.url)
      task.url = stage === 'plan' ? `${pr.url}/files` : pr.url;
    out.push(task);
  }
  return out;
}

function run(cmd: string, args: string[], cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd, timeout: TASKS_POLL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => resolve(err ? null : stdout),
    );
  });
}

/** Asks `gh` for the PRs of the repo at `dir`; null when gh or the repo is unavailable. */
async function fetchPrs(dir: string): Promise<GhPr[] | null> {
  const out = await run(
    'gh',
    [
      'pr',
      'list',
      '--state',
      'all',
      '--limit',
      '30',
      '--json',
      'number,title,url,headRefName,state,isDraft,changedFiles,files,reviewDecision,reviewRequests,statusCheckRollup,updatedAt,mergedAt',
    ],
    dir,
  );
  if (out === null) return null;
  try {
    const parsed = JSON.parse(out) as unknown;
    return Array.isArray(parsed) ? (parsed as GhPr[]) : null;
  } catch {
    return null;
  }
}

export interface TaskTrackerOptions {
  now?: () => number;
  /** Repo directories to watch (default: the user's Directories). */
  dirs?: () => string[];
  fetchPrs?: (dir: string) => Promise<GhPr[] | null>;
  intervalMs?: number;
}

/**
 * Keeps the sky's board of tasks (one per branch + PR) fresh. While at least
 * one page is open it asks GitHub (through the user's own `gh`) every
 * `TASKS_POLL_INTERVAL_MS` and broadcasts `tasksUpdate` when the board changed.
 */
export class TaskTracker {
  private latest: TaskInfo[] = [];
  private timer: NodeJS.Timeout | null = null;
  private viewers = 0;
  private inFlight = false;
  private disposed = false;
  private readonly now: () => number;
  private readonly dirs: () => string[];
  private readonly fetchPrs: (dir: string) => Promise<GhPr[] | null>;
  private readonly intervalMs: number;

  constructor(
    private readonly store: AgentStateStore,
    opts: TaskTrackerOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.dirs = opts.dirs ?? (() => readConfig().directories.map((d) => d.path));
    this.fetchPrs = opts.fetchPrs ?? fetchPrs;
    this.intervalMs = opts.intervalMs ?? TASKS_POLL_INTERVAL_MS;
  }

  currentMessage(): Record<string, unknown> {
    return { type: 'tasksUpdate', tasks: this.latest };
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
    if (process.env[TASKS_POLL_ENV] === '0') return;
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
      const dirs = [...new Set(this.dirs())];
      const board: TaskInfo[] = [];
      for (const dir of dirs) {
        const prs = await this.fetchPrs(dir);
        if (prs) board.push(...tasksFromPrs(prs, this.now()));
      }
      const seen = new Set<string>();
      const tasks = board.filter((t) => !seen.has(t.id) && seen.add(t.id)).slice(0, TASKS_MAX);
      if (JSON.stringify(tasks) !== JSON.stringify(this.latest)) {
        this.latest = tasks;
        this.store.broadcast(this.currentMessage());
      }
    } finally {
      this.inFlight = false;
      if (!this.disposed && this.viewers > 0) this.schedule(this.intervalMs);
    }
  }
}
