/**
 * Cloud sessions as characters. The server sends the user's claude.ai cloud
 * sessions (`cloudSessionsUpdate`); each one sits at a desk like an agent: typing
 * while it works, a permission bubble while it waits for you, idle at its prompt.
 * They are not agents of this server — no terminal, never persisted — so a click
 * opens the session's page instead.
 */
import { CLOUD_AGENT_ID_BASE, CLOUD_TITLE_MAX_CHARS } from '../../constants.js';
import type { OfficeState } from './officeState.js';

export type CloudSessionState = 'working' | 'permission' | 'idle';

export interface CloudSessionView {
  id: string;
  title: string;
  state: CloudSessionState;
  repo?: string;
  url?: string;
}

/** Session id → character id, kept for the page's lifetime so a session keeps its character. */
const characterIds = new Map<string, number>();
/** Character id → the state last applied, so a poll that changed nothing touches nothing. */
const applied = new Map<number, CloudSessionState>();

function characterIdFor(sessionId: string): number {
  let id = characterIds.get(sessionId);
  if (id === undefined) {
    id = CLOUD_AGENT_ID_BASE + characterIds.size;
    characterIds.set(sessionId, id);
  }
  return id;
}

function clip(title: string): string {
  return title.length > CLOUD_TITLE_MAX_CHARS
    ? `${title.slice(0, CLOUD_TITLE_MAX_CHARS - 1)}…`
    : title;
}

function applyState(os: OfficeState, id: number, state: CloudSessionState): void {
  if (applied.get(id) === state) return;
  applied.set(id, state);
  os.setAgentActive(id, state !== 'idle');
  if (state === 'permission') os.showPermissionBubble(id);
  else os.dismissBubble(id);
}

/** The character id of a cloud session's page url, or null when `id` is not a cloud character. */
export function cloudUrlOf(os: OfficeState, id: number): string | null {
  return os.characters.get(id)?.cloud?.url ?? null;
}

/** Bring the office's cloud characters in line with `sessions`. Idempotent. */
export function syncCloudSessions(os: OfficeState, sessions: CloudSessionView[]): void {
  const live = new Set<number>();
  for (const s of sessions) {
    const id = characterIdFor(s.id);
    live.add(id);
    if (!os.characters.has(id)) {
      applied.delete(id);
      os.addAgent(id);
    }
    const ch = os.characters.get(id);
    if (!ch) continue;
    ch.cloud = { title: clip(s.title), url: s.url ?? '' };
    ch.directoryName = s.repo;
    applyState(os, id, s.state);
  }
  for (const ch of [...os.characters.values()]) {
    if (ch.cloud && !live.has(ch.id)) {
      applied.delete(ch.id);
      os.removeAgent(ch.id);
    }
  }
}
