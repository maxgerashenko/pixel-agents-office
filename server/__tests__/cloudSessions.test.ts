import { describe, expect, it } from 'vitest';

import { cloudSessionsForOffice } from '../src/cloudSessionTracker.js';
import {
  type CloudSession,
  parseCloudSessionsResponse,
  stateOfStatus,
} from '../src/providers/hook/claude/claudeCloudSessions.js';

const reply = (body: unknown) =>
  JSON.stringify({
    type: 'control_response',
    response: { subtype: 'success', request_id: 'r1', response: body },
  });

describe('stateOfStatus', () => {
  it('maps the service words, hiding archived and failed', () => {
    expect(stateOfStatus('running')).toBe('working');
    expect(stateOfStatus('pending')).toBe('working');
    expect(stateOfStatus('requires_action')).toBe('permission');
    expect(stateOfStatus('idle')).toBe('idle');
    expect(stateOfStatus('archived')).toBeNull();
    expect(stateOfStatus('failed')).toBeNull();
    expect(stateOfStatus(undefined)).toBeNull();
  });
});

describe('parseCloudSessionsResponse', () => {
  it('reads an ok answer', () => {
    const out = parseCloudSessionsResponse(
      reply({
        status: 'ok',
        truncated: false,
        sessions: [
          {
            id: 'session_a',
            title: 'Fix it',
            updated_at: '2026-11-26T09:00:00Z',
            status: 'running',
            repository: { owner: 'o', name: 'n' },
          },
          { id: 'session_b', title: '', updated_at: 'junk', status: 'archived' },
          { title: 'no id', status: 'running' },
        ],
      }),
      'r1',
    );
    expect(out).toEqual([
      {
        id: 'session_a',
        title: 'Fix it',
        state: 'working',
        repo: 'o/n',
        updatedAt: Date.parse('2026-11-26T09:00:00Z'),
      },
    ]);
  });

  it('returns null for unavailable answers, other ids and junk', () => {
    expect(
      parseCloudSessionsResponse(reply({ status: 'unavailable', reason: 'not_signed_in' }), 'r1'),
    ).toBeNull();
    expect(parseCloudSessionsResponse(reply({ status: 'ok', sessions: [] }), 'other')).toBeNull();
    expect(parseCloudSessionsResponse('not json', 'r1')).toBeNull();
  });
});

describe('cloudSessionsForOffice', () => {
  const now = Date.parse('2026-11-26T10:00:00Z');
  const s = (id: string, state: CloudSession['state'], minutesAgo: number): CloudSession => ({
    id,
    title: id,
    state,
    updatedAt: now - minutesAgo * 60_000,
  });

  it('keeps working sessions, drops long-idle ones, newest first, with a page url', () => {
    const out = cloudSessionsForOffice(
      [s('old-idle', 'idle', 60), s('work', 'working', 120), s('new-idle', 'idle', 2)],
      now,
    );
    expect(out.map((x) => x.id)).toEqual(['new-idle', 'work']);
    expect(out[0].url).toBe('https://claude.ai/code/new-idle');
  });
});
