import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { UsageSnapshot, UsageWindow } from '../../core/src/provider.js';
import type { AgentStateStore } from './agentStateStore.js';
import { SERVER_JSON_DIR, USAGE_FILE_NAME } from './constants.js';
import { hookProviderById } from './providers/index.js';

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

/**
 * Holds the latest usage snapshot per provider. Ingest parses through the
 * provider, persists, and broadcasts through the store (the one broadcast
 * layer). The statusline fires on every UI refresh, so an unchanged snapshot is
 * dropped before it costs a write or a frame to every client.
 */
export class UsageTracker {
  private readonly latest: Record<string, StoredUsage>;

  constructor(
    private readonly store: AgentStateStore,
    private readonly now: () => number = Date.now,
  ) {
    this.latest = readUsageFile();
  }

  /** Ingest one raw payload. Returns true when it changed the snapshot. */
  ingest(providerId: string, raw: unknown): boolean {
    const parsed = hookProviderById(providerId)?.parseUsage?.(raw);
    if (!parsed) return false;
    const previous = this.latest[providerId];
    if (
      previous &&
      sameWindow(previous.fiveHour, parsed.fiveHour) &&
      sameWindow(previous.sevenDay, parsed.sevenDay)
    ) {
      return false;
    }
    const stored: StoredUsage = { ...parsed, updatedAt: this.now() };
    this.latest[providerId] = stored;
    writeUsageFile(this.latest);
    this.store.broadcast(toMessage(providerId, stored));
    return true;
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
