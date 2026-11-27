import {
  SYNC_BEAT_MS,
  SYNC_BEAT_PULSE_MS,
  SYNC_FLASH_MS,
  SYNC_LAMP_COLOR,
  SYNC_LAMP_DIM_COLOR,
  SYNC_LAMP_FLASH_COLOR,
} from '../../constants.js';

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

/**
 * Pure: lamp colour now, or null when dark. Live: a dim rest glow with a shallow beat every
 * SYNC_BEAT_MS (so you can see the page is alive), and a bright white flash when a tick lands.
 */
export function syncLampColor(s: SyncState, nowMs: number): string | null {
  if (s.liveness !== 'live') return null;
  const sinceTick = nowMs - s.lastTickAt;
  if (sinceTick >= 0 && sinceTick < SYNC_FLASH_MS) return SYNC_LAMP_FLASH_COLOR;
  return sinceTick % SYNC_BEAT_MS < SYNC_BEAT_PULSE_MS ? SYNC_LAMP_COLOR : SYNC_LAMP_DIM_COLOR;
}
