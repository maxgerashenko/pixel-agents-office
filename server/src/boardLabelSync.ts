import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { LAYOUT_FILE_DIR } from './constants.js';

/**
 * Board to label sync. The GitHub Action in prototypeRAG copies labels onto the project board;
 * a user project cannot trigger an Action when a card is dragged, so this runs the other way on
 * this Mac: when a card's Status column changed since the last tick, the issue's flow label is
 * swapped to match. Each tick also writes a heartbeat file the page reads to show the sync is live.
 */

/** Default tick; override locally with PIXEL_AGENTS_BOARD_SYNC_MINUTES (e.g. 2 or 4). */
export const BOARD_SYNC_TICK_MS = 2 * 60_000;
export const BOARD_SYNC_MINUTES_ENV = 'PIXEL_AGENTS_BOARD_SYNC_MINUTES';

export function boardSyncTickMsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const minutes = Number(env[BOARD_SYNC_MINUTES_ENV]);
  return Number.isFinite(minutes) && minutes >= 0.5 ? minutes * 60_000 : BOARD_SYNC_TICK_MS;
}
/** A heartbeat older than this many ticks counts as stale. */
export const BOARD_SYNC_STALE_AFTER_TICKS = 2;
export const BOARD_SYNC_ENV = 'PIXEL_AGENTS_BOARD_SYNC';
export const BOARD_SYNC_STATE_FILE = 'board-sync-state.json';
export const BOARD_SYNC_HEARTBEAT_FILE = 'board-sync-heartbeat.json';
const GH_TIMEOUT_MS = 30_000;

export type BoardSyncMode = 'off' | 'dry-run' | 'on';

/** Board Status column to the flow label it carries. New and Done carry none. */
const LABEL_OF_COLUMN: Readonly<Record<string, string | null>> = {
  new: null,
  ready: 'ready',
  design: 'design',
  coding: 'coding',
  review: 'review',
  decision: 'decision',
  blocked: 'blocked',
  stale: 'status:stale',
  done: null,
};
const FLOW_LABELS = [...new Set(Object.values(LABEL_OF_COLUMN).filter((l): l is string => !!l))];

/** The same priority as prototypeRAG's project_board_status_sync.py. */
const COLUMN_OF_LABEL_IN_PRIORITY_ORDER: ReadonlyArray<[string, string]> = [
  ['decision', 'decision'],
  ['status:stale', 'stale'],
  ['blocked', 'blocked'],
  ['review', 'review'],
  ['coding', 'coding'],
  ['ready', 'ready'],
  ['design', 'design'],
];

export interface BoardItem {
  /** `owner/repo`. */
  repo: string;
  number: number;
  /** Lowercased Status column name; empty when the card has none. */
  status: string;
  labels: string[];
}

export interface LabelChange {
  repo: string;
  number: number;
  from: string;
  to: string;
  add: string[];
  remove: string[];
}

export const itemKey = (item: Pick<BoardItem, 'repo' | 'number'>): string =>
  `${item.repo}#${item.number}`;

/** Pure: the column the labels alone put an open issue in. */
export function columnOfLabels(labels: string[]): string {
  const names = new Set(labels.map((l) => l.toLowerCase()));
  for (const [label, column] of COLUMN_OF_LABEL_IN_PRIORITY_ORDER) {
    if (names.has(label)) return column;
  }
  return 'new';
}

/**
 * Pure: the label changes for the cards a person moved since `lastSeen` (item key to column).
 * A card whose column did not change is left alone: its label moved first and the Action owns
 * that direction. Done never changes labels (it would also have to close the issue), and a
 * card with no earlier sighting is only recorded.
 */
/** Issues with one of these labels are skipped by the sync, so the cloud picker never sees them as ready. */
export const LOCAL_ONLY_LABELS = ['local-only', 'runs-on:mac'];

export function planLabelChanges(
  items: BoardItem[],
  lastSeen: Record<string, string>,
): LabelChange[] {
  const changes: LabelChange[] = [];
  for (const item of items) {
    const previous = lastSeen[itemKey(item)];
    if (previous === undefined || previous === item.status) continue;
    // Mac-only work stays out of the cloud picker's hands: never touch its labels.
    if (item.labels.some((l) => LOCAL_ONLY_LABELS.includes(l))) continue;
    if (item.status === 'done' || !(item.status in LABEL_OF_COLUMN)) continue;
    const labelColumn = columnOfLabels(item.labels);
    if (labelColumn === item.status) continue;
    const target = LABEL_OF_COLUMN[item.status];
    const present = new Set(item.labels);
    const remove = FLOW_LABELS.filter((l) => present.has(l) && l !== target);
    const add = target && !present.has(target) ? [target] : [];
    if (add.length === 0 && remove.length === 0) continue;
    changes.push({
      repo: item.repo,
      number: item.number,
      from: labelColumn,
      to: item.status,
      add,
      remove,
    });
  }
  return changes;
}

export interface BoardSyncHeartbeat {
  lastTickAt: number;
  tickMs: number;
  mode: BoardSyncMode;
  ok: boolean;
  itemsSeen: number;
  changes: number;
  error?: string;
}

export type BoardSyncLiveness = 'live' | 'stale' | 'off';

/** Pure: whether the sync is live, stale (missed ticks) or off (no heartbeat or switched off). */
export function boardSyncLiveness(hb: BoardSyncHeartbeat | null, now: number): BoardSyncLiveness {
  if (!hb || hb.mode === 'off') return 'off';
  const age = now - hb.lastTickAt;
  return hb.ok && age <= hb.tickMs * BOARD_SYNC_STALE_AFTER_TICKS ? 'live' : 'stale';
}

export function boardSyncModeFromEnv(env: NodeJS.ProcessEnv = process.env): BoardSyncMode {
  const raw = env[BOARD_SYNC_ENV];
  return raw === 'on' || raw === 'dry-run' ? raw : 'off';
}

const stateDir = (): string => path.join(os.homedir(), LAYOUT_FILE_DIR);

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(stateDir(), file), 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  const target = path.join(stateDir(), file);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(tmp, target);
}

export const readBoardSyncHeartbeat = (): BoardSyncHeartbeat | null =>
  readJson<BoardSyncHeartbeat>(BOARD_SYNC_HEARTBEAT_FILE);

function gh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { timeout: GH_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
  });
}

const BOARD_QUERY = `query($owner:String!,$number:Int!,$endCursor:String){
  user(login:$owner){ projectV2(number:$number){ items(first:100, after:$endCursor){
    pageInfo{ hasNextPage endCursor }
    nodes{
      fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name } }
      content{ __typename ... on Issue{ number repository{ nameWithOwner } } }
    }
  } } }
}`;

interface BoardPage {
  data?: {
    user?: {
      projectV2?: {
        items?: {
          nodes?: {
            fieldValueByName?: { name?: string } | null;
            content?: {
              __typename?: string;
              number?: number;
              repository?: { nameWithOwner?: string };
            };
          }[];
        };
      };
    };
  };
}

/**
 * The issue cards of a user project with only their Status, through the user's own `gh` (needs the
 * project scope). Labels are left empty on purpose: reading them for every card made each tick
 * expensive, so the tick loads labels only for the cards that moved (see loadIssueLabels).
 */
export async function fetchBoardItems(owner: string, projectNumber: number): Promise<BoardItem[]> {
  const out = await gh([
    'api',
    'graphql',
    '--paginate',
    '--slurp',
    '-f',
    `query=${BOARD_QUERY}`,
    '-f',
    `owner=${owner}`,
    '-F',
    `number=${projectNumber}`,
  ]);
  const pages = JSON.parse(out) as BoardPage[];
  const items: BoardItem[] = [];
  for (const page of pages) {
    for (const node of page.data?.user?.projectV2?.items?.nodes ?? []) {
      const { __typename, number, repository } = node.content ?? {};
      if (__typename !== 'Issue' || !number || !repository?.nameWithOwner) continue;
      items.push({
        repo: repository.nameWithOwner,
        number,
        status: (node.fieldValueByName?.name ?? '').trim().toLowerCase(),
        labels: [],
      });
    }
  }
  return items;
}

/** Current labels of one issue (REST, so it does not spend GraphQL points). */
export async function loadIssueLabels(repo: string, number: number): Promise<string[]> {
  const out = await gh(['api', `repos/${repo}/issues/${number}`, '--jq', '[.labels[].name]']);
  return JSON.parse(out) as string[];
}

export async function applyLabelChange(change: LabelChange): Promise<void> {
  const args = ['issue', 'edit', String(change.number), '-R', change.repo];
  if (change.add.length) args.push('--add-label', change.add.join(','));
  if (change.remove.length) args.push('--remove-label', change.remove.join(','));
  await gh(args);
}

export interface BoardLabelSyncOptions {
  owner?: string;
  projectNumber?: number;
  tickMs?: number;
  mode?: BoardSyncMode;
  now?: () => number;
  fetchItems?: (owner: string, projectNumber: number) => Promise<BoardItem[]>;
  loadLabels?: (repo: string, number: number) => Promise<string[]>;
  applyChange?: (change: LabelChange) => Promise<void>;
  loadLastSeen?: () => Record<string, string>;
  saveLastSeen?: (seen: Record<string, string>) => void;
  writeHeartbeat?: (hb: BoardSyncHeartbeat) => void;
  log?: (message: string) => void;
}

/** Runs one tick every `tickMs`, whether or not a page is open. Does nothing in mode `off`. */
export class BoardLabelSync {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private disposed = false;
  private readonly opts: Required<BoardLabelSyncOptions>;

  constructor(opts: BoardLabelSyncOptions = {}) {
    this.opts = {
      owner: opts.owner ?? process.env.PIXEL_AGENTS_BOARD_OWNER ?? 'maxgerashenko',
      projectNumber: opts.projectNumber ?? Number(process.env.PIXEL_AGENTS_BOARD_NUMBER ?? 4),
      tickMs: opts.tickMs ?? boardSyncTickMsFromEnv(),
      mode: opts.mode ?? boardSyncModeFromEnv(),
      now: opts.now ?? Date.now,
      fetchItems: opts.fetchItems ?? fetchBoardItems,
      loadLabels: opts.loadLabels ?? loadIssueLabels,
      applyChange: opts.applyChange ?? applyLabelChange,
      loadLastSeen:
        opts.loadLastSeen ?? (() => readJson<Record<string, string>>(BOARD_SYNC_STATE_FILE) ?? {}),
      saveLastSeen: opts.saveLastSeen ?? ((seen) => writeJsonAtomic(BOARD_SYNC_STATE_FILE, seen)),
      writeHeartbeat:
        opts.writeHeartbeat ?? ((hb) => writeJsonAtomic(BOARD_SYNC_HEARTBEAT_FILE, hb)),
      log: opts.log ?? ((m) => console.log(`[Pixel Agents] ${m}`)),
    };
  }

  start(): void {
    if (this.opts.mode === 'off' || this.disposed) return;
    void this.tick().finally(() => this.schedule());
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    if (this.disposed) return;
    this.timer = setTimeout(
      () => void this.tick().finally(() => this.schedule()),
      this.opts.tickMs,
    );
  }

  async tick(): Promise<BoardSyncHeartbeat | null> {
    if (this.inFlight || this.disposed) return null;
    this.inFlight = true;
    const { mode, tickMs, now, log } = this.opts;
    const heartbeat: BoardSyncHeartbeat = {
      lastTickAt: now(),
      tickMs,
      mode,
      ok: true,
      itemsSeen: 0,
      changes: 0,
    };
    try {
      const items = await this.opts.fetchItems(this.opts.owner, this.opts.projectNumber);
      heartbeat.itemsSeen = items.length;
      const lastSeen = this.opts.loadLastSeen();
      // Only cards whose column moved need their labels; the rest cost nothing.
      for (const item of items) {
        const previous = lastSeen[itemKey(item)];
        if (previous === undefined || previous === item.status) continue;
        item.labels = await this.opts.loadLabels(item.repo, item.number);
      }
      const changes = planLabelChanges(items, lastSeen);
      const nextSeen: Record<string, string> = {};
      for (const item of items) nextSeen[itemKey(item)] = item.status;
      for (const change of changes) {
        const text = `${change.repo}#${change.number}: ${change.from} to ${change.to} (+${change.add.join(',') || '-'} -${change.remove.join(',') || '-'})`;
        if (mode === 'dry-run') {
          log(`board sync dry run: ${text}`);
          continue;
        }
        try {
          await this.opts.applyChange(change);
          heartbeat.changes++;
          log(`board sync: ${text}`);
        } catch (err) {
          // Keep the old column so the next tick retries this card.
          const key = itemKey(change);
          if (lastSeen[key] !== undefined) nextSeen[key] = lastSeen[key];
          heartbeat.ok = false;
          heartbeat.error = `label change failed for ${key}: ${(err as Error).message}`;
        }
      }
      if (mode === 'on') this.opts.saveLastSeen(nextSeen);
      else if (Object.keys(lastSeen).length === 0) this.opts.saveLastSeen(nextSeen);
    } catch (err) {
      heartbeat.ok = false;
      heartbeat.error = (err as Error).message;
      log(`board sync tick failed: ${heartbeat.error}`);
    } finally {
      this.inFlight = false;
    }
    try {
      this.opts.writeHeartbeat(heartbeat);
    } catch {
      // The heartbeat is best effort.
    }
    return heartbeat;
  }
}
