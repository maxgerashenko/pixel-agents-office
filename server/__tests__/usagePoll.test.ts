import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tmpBase: string;

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: () => tmpBase };
});

const { parseClaudeUsageResponse, fetchClaudeUsage } =
  await import('../src/providers/hook/claude/claudeUsagePoll.js');
const { AgentStateStore } = await import('../src/agentStateStore.js');
const { UsageTracker } = await import('../src/usageTracker.js');

const REQ = 'req-1';
const RESET_ISO = '2030-10-31T14:00:00Z';
const RESET_MS = Date.parse(RESET_ISO);

function success(rateLimits: unknown, requestId = REQ): string {
  return JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: { session: {}, subscription_type: 'max', rate_limits: rateLimits },
    },
  });
}

beforeEach(() => {
  tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-usagepoll-'));
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env['PIXEL_AGENTS_USAGE_POLL'];
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

describe('parseClaudeUsageResponse', () => {
  it('parses both windows', () => {
    const line = success({
      five_hour: { utilization: 54.0, resets_at: RESET_ISO },
      seven_day: { utilization: 12, resets_at: RESET_ISO },
    });
    expect(parseClaudeUsageResponse(line, REQ)).toEqual({
      fiveHour: { usedPercentage: 54, resetsAt: RESET_MS },
      sevenDay: { usedPercentage: 12, resetsAt: RESET_MS },
    });
  });

  it('accepts a parsed object and clamps the percentage', () => {
    const obj = JSON.parse(success({ five_hour: { utilization: 250, resets_at: RESET_ISO } }));
    expect(parseClaudeUsageResponse(obj, REQ)).toEqual({
      fiveHour: { usedPercentage: 100, resetsAt: RESET_MS },
    });
  });

  it('returns null for null rate_limits', () => {
    expect(parseClaudeUsageResponse(success(null), REQ)).toBeNull();
  });

  it('returns null for an error response', () => {
    const line = JSON.stringify({
      type: 'control_response',
      response: { subtype: 'error', request_id: REQ, error: 'nope' },
    });
    expect(parseClaudeUsageResponse(line, REQ)).toBeNull();
  });

  it('returns null for another request id', () => {
    const line = success({ five_hour: { utilization: 1, resets_at: RESET_ISO } }, 'other');
    expect(parseClaudeUsageResponse(line, REQ)).toBeNull();
  });

  it('drops windows with null utilization or reset, keeps the other', () => {
    const line = success({
      five_hour: { utilization: null, resets_at: RESET_ISO },
      seven_day: { utilization: 5, resets_at: RESET_ISO },
    });
    expect(parseClaudeUsageResponse(line, REQ)).toEqual({
      sevenDay: { usedPercentage: 5, resetsAt: RESET_MS },
    });
    expect(
      parseClaudeUsageResponse(success({ five_hour: { utilization: 5, resets_at: null } }), REQ),
    ).toBeNull();
    expect(
      parseClaudeUsageResponse(success({ five_hour: { utilization: 5, resets_at: 'soon' } }), REQ),
    ).toBeNull();
  });

  it('returns null for garbage', () => {
    for (const g of [
      '',
      'not json',
      '[]',
      '{}',
      'null',
      '{"type":"system"}',
      42,
      null,
      undefined,
    ]) {
      expect(parseClaudeUsageResponse(g, REQ)).toBeNull();
    }
  });
});

function writeFake(script: string): string {
  const file = path.join(tmpBase, 'fake-claude.cjs');
  fs.writeFileSync(file, `#!/usr/bin/env node\n${script}`, { mode: 0o755 });
  return file;
}

describe.skipIf(process.platform === 'win32')('fetchClaudeUsage', () => {
  it('sends get_usage with hooks disabled and returns the snapshot', async () => {
    const cmd = writeFake(`
const fs = require('fs');
const args = process.argv.slice(2);
const settingsPath = args[args.indexOf('--settings') + 1];
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
let buf = '';
process.stdin.on('data', (d) => {
  buf += d;
  if (!buf.includes('\\n')) return;
  const req = JSON.parse(buf.split('\\n')[0]);
  console.log(JSON.stringify({ type: 'system', subtype: 'init' }));
  const ok = settings.disableAllHooks === true && args.includes('--no-session-persistence')
    && req.type === 'control_request' && req.request.subtype === 'get_usage';
  console.log(JSON.stringify({ type: 'control_response', response: { subtype: 'success',
    request_id: req.request_id, response: { rate_limits: { five_hour: {
      utilization: ok ? 33 : 99, resets_at: '${RESET_ISO}' } } } } }));
});
`);
    const result = await fetchClaudeUsage({ command: cmd, timeoutMs: 10_000 });
    expect(result).toEqual({ fiveHour: { usedPercentage: 33, resetsAt: RESET_MS } });
    const settingsFile = path.join(tmpBase, '.pixel-agents', 'usage-poll-settings.json');
    expect(JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))).toEqual({ disableAllHooks: true });
  });

  it('returns null when the CLI never answers (timeout)', async () => {
    const cmd = writeFake(`process.stdin.resume(); setInterval(() => {}, 1000);`);
    const started = Date.now();
    expect(await fetchClaudeUsage({ command: cmd, timeoutMs: 300 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('returns null when the command does not exist', async () => {
    expect(
      await fetchClaudeUsage({ command: path.join(tmpBase, 'missing'), timeoutMs: 5000 }),
    ).toBeNull();
  });

  it('returns null on an error response', async () => {
    const cmd = writeFake(`
process.stdin.on('data', (d) => {
  const req = JSON.parse(String(d).split('\\n')[0]);
  console.log(JSON.stringify({ type: 'control_response', response: { subtype: 'error', request_id: req.request_id, error: 'x' } }));
});`);
    expect(await fetchClaudeUsage({ command: cmd, timeoutMs: 5000 })).toBeNull();
  });
});

describe('UsageTracker polling', () => {
  const INTERVAL = 60_000;

  function setup(results: Array<ReturnType<typeof snap> | null>) {
    vi.useFakeTimers();
    const store = new AgentStateStore();
    const seen: Record<string, unknown>[] = [];
    store.on('broadcast', (m) => seen.push(m));
    let calls = 0;
    const fetcher = vi.fn(async () => {
      const r = results[Math.min(calls, results.length - 1)];
      calls++;
      return r;
    });
    const tracker = new UsageTracker(store, {
      fetchers: { claude: fetcher },
      intervalMs: INTERVAL,
    });
    return { tracker, fetcher, seen };
  }

  function snap(pct: number) {
    return { fiveHour: { usedPercentage: pct, resetsAt: Date.now() + 3_600_000 } };
  }

  it('does not poll without a viewer; polls at once with one, then every interval', async () => {
    const { tracker, fetcher, seen } = setup([snap(10), snap(20)]);
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(fetcher).not.toHaveBeenCalled();

    const release = tracker.addViewer();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(seen).toHaveLength(2);

    release();
    await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(fetcher).toHaveBeenCalledTimes(2);
    tracker.dispose();
  });

  it('an unchanged snapshot does not broadcast again', async () => {
    const s = snap(10);
    const { tracker, fetcher, seen } = setup([s]);
    tracker.addViewer();
    await vi.advanceTimersByTimeAsync(INTERVAL * 2);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(seen).toHaveLength(1);
    tracker.dispose();
  });

  it('keeps one viewer-count across several viewers; release is idempotent', async () => {
    const { tracker, fetcher } = setup([snap(10), snap(11), snap(12)]);
    const a = tracker.addViewer();
    const b = tracker.addViewer();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    a();
    a();
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(fetcher).toHaveBeenCalledTimes(2);
    b();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(fetcher).toHaveBeenCalledTimes(2);
    tracker.dispose();
  });

  it('does not poll immediately when the last poll is recent', async () => {
    const { tracker, fetcher } = setup([snap(10), snap(20)]);
    const r1 = tracker.addViewer();
    await vi.advanceTimersByTimeAsync(0);
    r1();
    await vi.advanceTimersByTimeAsync(10_000);
    tracker.addViewer();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVAL - 10_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    tracker.dispose();
  });

  it('backs off exponentially on null (capped) and resets on success', async () => {
    const { tracker, fetcher } = setup([null, null, null, snap(5), snap(6)]);
    tracker.addViewer();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1); // t=0, fail -> next in 2x
    await vi.advanceTimersByTimeAsync(INTERVAL * 2 - 1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2); // fail -> next in 4x
    await vi.advanceTimersByTimeAsync(INTERVAL * 4);
    expect(fetcher).toHaveBeenCalledTimes(3); // fail -> next in 8x
    await vi.advanceTimersByTimeAsync(INTERVAL * 8);
    expect(fetcher).toHaveBeenCalledTimes(4); // success -> base interval
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(fetcher).toHaveBeenCalledTimes(5);
    tracker.dispose();
  });

  it('caps the back-off at 30 minutes', async () => {
    const { tracker, fetcher } = setup([null]);
    tracker.addViewer();
    await vi.advanceTimersByTimeAsync(0);
    // failures: 1,2,... delay 2m,4m,8m,16m,30m,30m
    for (const mins of [2, 4, 8, 16, 30, 30]) {
      await vi.advanceTimersByTimeAsync(mins * 60_000);
    }
    expect(fetcher).toHaveBeenCalledTimes(7);
    tracker.dispose();
  });

  it('a throwing fetcher counts as a failure and never escapes', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => {
      throw new Error('boom');
    });
    const tracker = new UsageTracker(new AgentStateStore(), {
      fetchers: { claude: fetcher },
      intervalMs: INTERVAL,
    });
    tracker.addViewer();
    await vi.advanceTimersByTimeAsync(INTERVAL * 2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    tracker.dispose();
  });

  it('runs one poll in flight at most', async () => {
    vi.useFakeTimers();
    let resolveFetch: (v: null) => void = () => {};
    const fetcher = vi.fn(() => new Promise<null>((r) => (resolveFetch = r)));
    const tracker = new UsageTracker(new AgentStateStore(), {
      fetchers: { claude: fetcher },
      intervalMs: INTERVAL,
    });
    const a = tracker.addViewer();
    await vi.advanceTimersByTimeAsync(0);
    a();
    tracker.addViewer(); // re-open while the first poll is still running
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveFetch(null);
    await vi.advanceTimersByTimeAsync(0);
    tracker.dispose();
  });

  it('is disabled by PIXEL_AGENTS_USAGE_POLL=0', async () => {
    process.env['PIXEL_AGENTS_USAGE_POLL'] = '0';
    const { tracker, fetcher } = setup([snap(1)]);
    tracker.addViewer();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(fetcher).not.toHaveBeenCalled();
    tracker.dispose();
  });

  it('dispose stops polling and ignores later viewers', async () => {
    const { tracker, fetcher } = setup([snap(1), snap(2)]);
    tracker.addViewer();
    await vi.advanceTimersByTimeAsync(0);
    tracker.dispose();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
    tracker.addViewer();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
