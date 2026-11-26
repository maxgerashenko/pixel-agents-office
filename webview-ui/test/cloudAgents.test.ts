/**
 * Cloud sessions as characters (engine/cloudAgents): one character per session,
 * working / permission / idle states, removal when a session leaves the list,
 * and never part of the persisted seat payload.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import { CLOUD_AGENT_ID_BASE } from '../src/constants.js';
import { cloudUrlOf, syncCloudSessions } from '../src/office/engine/cloudAgents.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import type { OfficeLayout } from '../src/office/types.js';
import { TileType } from '../src/office/types.js';

function floorLayout(): OfficeLayout {
  return {
    version: 1,
    cols: 9,
    rows: 7,
    tiles: new Array<TileType>(63).fill(TileType.FLOOR_1),
    furniture: [],
  };
}

test('a cloud session becomes a character that follows its state', () => {
  const os = new OfficeState(floorLayout());
  const session = {
    id: 'session_a',
    title: 'Fix it',
    state: 'working' as const,
    url: 'https://claude.ai/code/session_a',
  };
  syncCloudSessions(os, [session]);

  const ch = [...os.characters.values()].find((c) => c.cloud);
  assert.ok(ch, 'character exists');
  assert.ok(ch.id >= CLOUD_AGENT_ID_BASE);
  assert.equal(ch.isActive, true);
  assert.equal(cloudUrlOf(os, ch.id), 'https://claude.ai/code/session_a');

  syncCloudSessions(os, [{ ...session, state: 'permission' }]);
  assert.equal(ch.bubbleType, 'permission');

  syncCloudSessions(os, [{ ...session, state: 'idle' }]);
  assert.equal(ch.isActive, false);
  assert.equal(ch.bubbleType, null);
});

test('is idempotent, is never persisted, and leaves with its session', () => {
  const os = new OfficeState(floorLayout());
  const session = { id: 'session_b', title: 'x', state: 'working' as const };
  syncCloudSessions(os, [session]);
  syncCloudSessions(os, [session]);
  assert.equal([...os.characters.values()].filter((c) => c.cloud).length, 1);
  assert.deepEqual(os.getPersistableSeats(), {});

  syncCloudSessions(os, []);
  const gone = [...os.characters.values()].find((c) => c.cloud);
  assert.ok(!gone || gone.matrixEffect === 'despawn', 'despawning or removed');
});
