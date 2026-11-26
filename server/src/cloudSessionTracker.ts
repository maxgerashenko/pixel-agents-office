import type { AgentStateStore } from './agentStateStore.js';
import {
  CLOUD_SESSION_URL_PREFIX,
  CLOUD_SESSIONS_IDLE_LINGER_MS,
  CLOUD_SESSIONS_MAX,
  CLOUD_SESSIONS_POLL_ENV,
  CLOUD_SESSIONS_POLL_INTERVAL_MS,
} from './constants.js';
import {
  type CloudSession,
  fetchCloudSessions,
} from './providers/hook/claude/claudeCloudSessions.js';

/** What the office draws for one cloud session (the `CloudSessionInfo` wire shape). */
export interface CloudSessionInfo {
  id: string;
  title: string;
  state: CloudSession['state'];
  repo?: string;
  url: string;
}

/**
 * Pure: the sessions to draw at `now`. Working and waiting-for-you sessions
 * always show; an idle one only while it changed recently. Most recently
 * changed first, capped.
 */
export function cloudSessionsForOffice(sessions: CloudSession[], now: number): CloudSessionInfo[] {
  return sessions
    .filter((s) => s.state !== 'idle' || now - s.updatedAt <= CLOUD_SESSIONS_IDLE_LINGER_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, CLOUD_SESSIONS_MAX)
    .map((s) => ({
      id: s.id,
      title: s.title,
      state: s.state,
      ...(s.repo ? { repo: s.repo } : {}),
      url: `${CLOUD_SESSION_URL_PREFIX}${encodeURIComponent(s.id)}`,
    }));
}

export interface CloudSessionTrackerOptions {
  now?: () => number;
  fetchSessions?: () => Promise<CloudSession[] | null>;
  intervalMs?: number;
}

/**
 * Keeps the list of the user's cloud sessions fresh while at least one page is
 * open, and broadcasts `cloudSessionsUpdate` when it changed. A failed poll
 * (signed out, offline, CLI too old) keeps the last list rather than emptying it.
 */
export class CloudSessionTracker {
  private latest: CloudSessionInfo[] = [];
  private timer: NodeJS.Timeout | null = null;
  private viewers = 0;
  private inFlight = false;
  private disposed = false;
  private readonly now: () => number;
  private readonly fetchSessions: () => Promise<CloudSession[] | null>;
  private readonly intervalMs: number;

  constructor(
    private readonly store: AgentStateStore,
    opts: CloudSessionTrackerOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.fetchSessions = opts.fetchSessions ?? (() => fetchCloudSessions());
    this.intervalMs = opts.intervalMs ?? CLOUD_SESSIONS_POLL_INTERVAL_MS;
  }

  currentMessage(): Record<string, unknown> {
    return { type: 'cloudSessionsUpdate', sessions: this.latest };
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
    if (process.env[CLOUD_SESSIONS_POLL_ENV] === '0') return;
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
      const sessions = await this.fetchSessions();
      if (sessions) {
        const next = cloudSessionsForOffice(sessions, this.now());
        if (JSON.stringify(next) !== JSON.stringify(this.latest)) {
          this.latest = next;
          this.store.broadcast(this.currentMessage());
        }
      }
    } finally {
      this.inFlight = false;
      if (!this.disposed && this.viewers > 0) this.schedule(this.intervalMs);
    }
  }
}
