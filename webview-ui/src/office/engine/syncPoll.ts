import { SYNC_POLL_MS } from '../../constants.js';
import type { SyncLiveness } from './skySync.js';
import { setSyncState } from './skySync.js';

interface Reply {
  liveness: SyncLiveness;
  heartbeat: { lastTickAt: number } | null;
}

/** Standalone only: ask the server how the Mac board sync is doing, every SYNC_POLL_MS. */
export function startSyncPoll(): void {
  const poll = async (): Promise<void> => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/board-sync`);
      const body = (await res.json()) as Reply;
      setSyncState({ liveness: body.liveness, lastTickAt: body.heartbeat?.lastTickAt ?? 0 });
    } catch {
      setSyncState({ liveness: 'off', lastTickAt: 0 });
    }
  };
  void poll();
  setInterval(() => void poll(), SYNC_POLL_MS);
}
