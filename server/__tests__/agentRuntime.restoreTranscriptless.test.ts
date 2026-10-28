import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StateAdapter } from '../../core/src/adapter.js';
import { AgentRuntime } from '../src/agentRuntime.js';
import { AgentStateStore } from '../src/agentStateStore.js';
import { EXTERNAL_STALE_CHECK_INTERVAL_MS } from '../src/constants.js';
import { setAgentRemovalCallback, startStaleExternalAgentCheck } from '../src/fileWatcher.js';
import { claudeProvider } from '../src/providers/hook/claude/claude.js';
import type { PersistedAgent } from '../src/types.js';

function createMockAdapter(initial: PersistedAgent[]): StateAdapter & {
  saved: PersistedAgent[][];
} {
  let current = initial;
  const saved: PersistedAgent[][] = [];
  return {
    saved,
    loadAgents: () => current,
    saveAgents: (agents) => {
      current = agents;
      saved.push(agents);
    },
    loadSeats: () => ({}),
    saveSeats: () => {},
    getSetting: <T>(_key: string, defaultValue: T): T => defaultValue,
    setSetting: vi.fn<(key: string, value: unknown) => void>(),
  };
}

/**
 * An agent registered with no transcript (empty jsonlFile, sessionId like
 * `local-<name>`) has no file to check. Restore used to run existsSync('') on it,
 * skip it, and the persist() at the end of restore then rewrote the state file
 * without it, so every server start lost it for good.
 */
describe('AgentRuntime -- transcript-less agents survive a restart', () => {
  let tmpDir: string;
  let runtime: AgentRuntime | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-restore-nojsonl-'));
  });

  afterEach(() => {
    runtime?.dispose();
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const transcriptless = (id: number, name: string): PersistedAgent => ({
    id,
    sessionId: `local-${name}`,
    terminalName: '',
    isExternal: true,
    jsonlFile: '',
    projectDir: path.join(tmpDir, name),
    directoryName: name,
    palette: 2,
    hueShift: 0,
  });

  it('restores the agent and keeps it in the state file', () => {
    const adapter = createMockAdapter([transcriptless(5, 'Local_QWEN')]);
    const store = new AgentStateStore();
    store.setAdapter(adapter);
    runtime = new AgentRuntime(store, claudeProvider);

    runtime.restoreExternalAgents();

    expect(store.get(5)?.directoryName).toBe('Local_QWEN');
    expect(adapter.saved.at(-1)?.map((p) => p.id)).toEqual([5]);
  });

  it('still drops a transcript agent whose file is gone', () => {
    const adapter = createMockAdapter([
      transcriptless(5, 'Local_QWEN'),
      {
        ...transcriptless(6, 'Gone'),
        sessionId: 'sess-gone',
        jsonlFile: path.join(tmpDir, 'missing.jsonl'),
      },
    ]);
    const store = new AgentStateStore();
    store.setAdapter(adapter);
    runtime = new AgentRuntime(store, claudeProvider);

    runtime.restoreExternalAgents();

    expect(store.has(5)).toBe(true);
    expect(store.has(6)).toBe(false);
    expect(adapter.saved.at(-1)?.map((p) => p.id)).toEqual([5]);
  });

  it('the stale check leaves a transcript-less agent alone', () => {
    vi.useFakeTimers();
    const adapter = createMockAdapter([transcriptless(5, 'Local_QWEN')]);
    const store = new AgentStateStore();
    store.setAdapter(adapter);
    runtime = new AgentRuntime(store, claudeProvider);
    runtime.restoreExternalAgents();

    // The check removes through this module-level callback; without it a removal
    // would be a silent no-op and the assertion below could never fail.
    setAgentRemovalCallback((id) => store.delete(id));
    const timer = startStaleExternalAgentCheck(store, new Set());
    vi.advanceTimersByTime(EXTERNAL_STALE_CHECK_INTERVAL_MS * 2);
    clearInterval(timer);
    setAgentRemovalCallback(null);

    expect(store.has(5)).toBe(true);
  });
});
