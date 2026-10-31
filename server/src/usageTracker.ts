import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { UsageSnapshot, UsageWindow } from '../../core/src/provider.js';
import type { AgentStateStore } from './agentStateStore.js';
import {
  SERVER_JSON_DIR,
  USAGE_FILE_NAME,
  USAGE_POLL_ENV,
  USAGE_POLL_INTERVAL_MS,
  USAGE_POLL_MAX_BACKOFF_MS,
} from './constants.js';
import { hookProviderById, hookProviders } from './providers/index.js';

/** The latest snapshot of one provider, as stored and persisted. */
export interface StoredUsage extends UsageSnapshot {
  /** When the server received it, Unix epoch ms. */
  updatedAt: number;
}

function usageFilePath(): string {
  return path.join(os.homedir(), SERVER_JSON_DIR, USAGE_FILE_NAME);
}

function isWindow(value: unknown): value is UsageWindow {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w['usedPercentage'] === 'number' &&
    Number.isFinite(w['usedPercentage']) &&
    typeof w['resetsAt'] === 'number' &&
    Number.isFinite(w['resetsAt'])
  );
}

/** Read ~/.pixel-agents/usage.json, keeping only well-formed entries. */
export function readUsageFile(): Record<string, StoredUsage> {
  try {
    const parsed = JSON.parse(fs.readFileSync(usageFilePath(), 'utf-8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, StoredUsage> = {};
    for (const [providerId, entry] of Object.entries(parsed)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const fiveHour = isWindow(e['fiveHour']) ? e['fiveHour'] : undefined;
      const sevenDay = isWindow(e['sevenDay']) ? e['sevenDay'] : undefined;
      if (!fiveHour && !sevenDay) continue;
      out[providerId] = {
        ...(fiveHour ? { fiveHour } : {}),
        ...(sevenDay ? { sevenDay } : {}),
        updatedAt: typeof e['updatedAt'] === 'number' ? e['updatedAt'] : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Write usage.json atomically (tmp + rename), mode 0o600. Never throws. */
export function writeUsageFile(data: Record<string, StoredUsage>): void {
  const filePath = usageFilePath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error('[Pixel Agents] Failed to write usage file:', err);
  }
}

/** Drop every window whose reset time has passed, or null when none is left. A
 *  window that already reset reports a percentage that is no longer true. */
export function withoutExpiredWindows(usage: StoredUsage, now: number): StoredUsage | null {
  const fiveHour = usage.fiveHour && usage.fiveHour.resetsAt > now ? usage.fiveHour : undefined;
  const sevenDay = usage.sevenDay && usage.sevenDay.resetsAt > now ? usage.sevenDay : undefined;
  if (!fiveHour && !sevenDay) return null;
  return {
    ...(fiveHour ? { fiveHour } : {}),
    ...(sevenDay ? { sevenDay } : {}),
    updatedAt: usage.updatedAt,
  };
}

function sameWindow(a: UsageWindow | undefined, b: UsageWindow | undefined): boolean {
  if (!a || !b) return a === b;
  return a.usedPercentage === b.usedPercentage && a.resetsAt === b.resetsAt;
}

export interface UsageTrackerOptions {
  now?: () => number;
  /** Pull sources by provider id. Default: every registered provider with `fetchUsage`. */
  fetchers?: Record<string, () => Promise<UsageSnapshot | null>>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Base poll interval (default USAGE_POLL_INTERVAL_MS). */
  intervalMs?: number;
}

interface PollState {
  timer: unknown;
  inFlight: boolean;
  /** Failures in a row; 0 after a success. */
  failures: number;
  /** When the last poll was started, epoch ms (0 = never). */
  lastPollAt: number;
}

function defaultFetchers(): Record<string, () => Promise<UsageSnapshot | null>> {
  const out: Record<string, () => Promise<UsageSnapshot | null>> = {};
  for (const provider of hookProviders) {
    const fetchUsage = provider.fetchUsage;
    if (fetchUsage) out[provider.id] = () => fetchUsage.call(provider);
  }
  return out;
}

/**
 * Holds the latest usage snapshot per provider. Two sources feed it, last one
 * wins: the statusLine tap (`ingest`, push) and, while at least one page is
 * open (`addViewer`), a periodic pull through the provider's `fetchUsage`.
 * Both go through `apply`, which parses nothing itself: it persists and
 * broadcasts through the store (the one broadcast layer). The statusline fires
 * on every UI refresh, so an unchanged snapshot is dropped before it costs a
 * write or a frame to every client.
 */
export class UsageTracker {
  private readonly latest: Record<string, StoredUsage>;
  private readonly now: () => number;
  private readonly fetchers: Record<string, () => Promise<UsageSnapshot | null>>;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly intervalMs: number;
  private readonly polls = new Map<string, PollState>();
  private viewers = 0;
  private disposed = false;

  constructor(
    private readonly store: AgentStateStore,
    opts: UsageTrackerOptions | (() => number) = {},
  ) {
    const o: UsageTrackerOptions = typeof opts === 'function' ? { now: opts } : opts;
    this.now = o.now ?? Date.now;
    this.fetchers = o.fetchers ?? defaultFetchers();
    this.setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = o.clearTimer ?? ((h) => clearTimeout(h as NodeJS.Timeout));
    this.intervalMs = o.intervalMs ?? USAGE_POLL_INTERVAL_MS;
    this.latest = readUsageFile();
  }

  /** Ingest one raw payload. Returns true when it changed the snapshot. */
  ingest(providerId: string, raw: unknown): boolean {
    const parsed = hookProviderById(providerId)?.parseUsage?.(raw);
    return parsed ? this.apply(providerId, parsed) : false;
  }

  /** Store, persist and broadcast a snapshot unless it equals the current one. */
  private apply(providerId: string, parsed: UsageSnapshot): boolean {
    const previous = this.latest[providerId];
    if (
      previous &&
      sameWindow(previous.fiveHour, parsed.fiveHour) &&
      sameWindow(previous.sevenDay, parsed.sevenDay)
    ) {
      return false;
    }
    const stored: StoredUsage = {
      ...(parsed.fiveHour ? { fiveHour: parsed.fiveHour } : {}),
      ...(parsed.sevenDay ? { sevenDay: parsed.sevenDay } : {}),
      updatedAt: this.now(),
    };
    this.latest[providerId] = stored;
    writeUsageFile(this.latest);
    this.store.broadcast(toMessage(providerId, stored));
    return true;
  }

  /** A page is open: keep usage fresh until the returned release is called
   *  (idempotent). */
  addViewer(): () => void {
    if (this.disposed) return () => {};
    this.viewers++;
    if (this.viewers === 1) this.startPolling();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.viewers--;
      if (this.viewers === 0) this.stopPolling();
    };
  }

  dispose(): void {
    this.disposed = true;
    this.viewers = 0;
    this.stopPolling();
  }

  private pollingEnabled(): boolean {
    return process.env[USAGE_POLL_ENV] !== '0';
  }

  private startPolling(): void {
    if (!this.pollingEnabled()) return;
    for (const providerId of Object.keys(this.fetchers)) {
      const state = this.polls.get(providerId) ?? {
        timer: null,
        inFlight: false,
        failures: 0,
        lastPollAt: 0,
      };
      this.polls.set(providerId, state);
      if (state.inFlight) continue; // its completion reschedules
      const wait = state.lastPollAt
        ? Math.max(0, state.lastPollAt + this.delayFor(state) - this.now())
        : 0;
      this.schedule(providerId, state, wait);
    }
  }

  private stopPolling(): void {
    for (const state of this.polls.values()) {
      if (state.timer !== null) this.clearTimer(state.timer);
      state.timer = null;
    }
  }

  private delayFor(state: PollState): number {
    return Math.min(USAGE_POLL_MAX_BACKOFF_MS, this.intervalMs * 2 ** state.failures);
  }

  private schedule(providerId: string, state: PollState, ms: number): void {
    if (state.timer !== null) this.clearTimer(state.timer);
    state.timer = this.setTimer(() => {
      state.timer = null;
      void this.poll(providerId, state);
    }, ms);
  }

  private async poll(providerId: string, state: PollState): Promise<void> {
    if (state.inFlight || this.viewers === 0 || this.disposed) return;
    state.inFlight = true;
    state.lastPollAt = this.now();
    let result: UsageSnapshot | null = null;
    try {
      result = await this.fetchers[providerId]();
    } catch {
      result = null;
    }
    state.inFlight = false;
    if (this.disposed) return;
    if (result) {
      state.failures = 0;
      this.apply(providerId, result);
    } else {
      state.failures++;
    }
    if (this.viewers > 0) this.schedule(providerId, state, this.delayFor(state));
  }

  /** `usageUpdate` messages for every provider with a live (unexpired) window,
   *  for the webviewReady handshake. */
  currentMessages(): Record<string, unknown>[] {
    const now = this.now();
    const out: Record<string, unknown>[] = [];
    for (const [providerId, usage] of Object.entries(this.latest)) {
      const live = withoutExpiredWindows(usage, now);
      if (live) out.push(toMessage(providerId, live));
    }
    return out;
  }
}

function toMessage(providerId: string, usage: StoredUsage): Record<string, unknown> {
  return {
    type: 'usageUpdate',
    providerId,
    ...(usage.fiveHour ? { fiveHour: usage.fiveHour } : {}),
    ...(usage.sevenDay ? { sevenDay: usage.sevenDay } : {}),
    updatedAt: usage.updatedAt,
  };
}
