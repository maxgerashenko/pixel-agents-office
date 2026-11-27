import { SYNC_FLASH_MS, SYNC_LAMP_COLOR, SYNC_LAMP_FLASH_COLOR } from '../../constants.js';

export type SyncLiveness = 'live' | 'stale' | 'off';

export interface SyncState {
  liveness: SyncLiveness;
  /** ms epoch of the Mac's last tick, 0 when unknown. */
  lastTickAt: number;
}

let state: SyncState = { liveness: 'off', lastTickAt: 0 };

export function setSyncState(next: SyncState): void {
  state = next;
}

export function getSyncState(): SyncState {
  return state;
}

/** Pure: lamp colour now, or null when dark. One flash per tick, steady glow while live. */
export function syncLampColor(s: SyncState, nowMs: number): string | null {
  if (s.liveness !== 'live') return null;
  const sinceTick = nowMs - s.lastTickAt;
  return sinceTick >= 0 && sinceTick < SYNC_FLASH_MS ? SYNC_LAMP_FLASH_COLOR : SYNC_LAMP_COLOR;
}
