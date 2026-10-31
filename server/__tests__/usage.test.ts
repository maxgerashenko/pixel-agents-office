import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tmpBase: string;

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: () => tmpBase };
});

const { parseClaudeUsage } = await import('../src/providers/hook/claude/claudeUsage.js');
const { PixelAgentsServer } = await import('../src/server.js');
const { AgentStateStore } = await import('../src/agentStateStore.js');
const { UsageTracker, withoutExpiredWindows } = await import('../src/usageTracker.js');
const { handleClientMessage } = await import('../src/clientMessageHandler.js');

const FUTURE_S = Math.floor(Date.now() / 1000) + 3600;

function statusline(five?: unknown, seven?: unknown): Record<string, unknown> {
  return {
    session_id: 's',
    rate_limits: {
      ...(five !== undefined ? { five_hour: five } : {}),
      ...(seven !== undefined ? { seven_day: seven } : {}),
    },
  };
}

beforeEach(() => {
  tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-usage-test-'));
  fs.mkdirSync(path.join(tmpBase, '.pixel-agents'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

describe('parseClaudeUsage', () => {
  it('parses both windows and converts seconds to ms', () => {
    const r = parseClaudeUsage(
      statusline(
        { used_percentage: 23.5, resets_at: 1738425600 },
        { used_percentage: 41.2, resets_at: 1738857600 },
      ),
    );
    expect(r).toEqual({
      fiveHour: { usedPercentage: 23.5, resetsAt: 1738425600000 },
      sevenDay: { usedPercentage: 41.2, resetsAt: 1738857600000 },
    });
  });

  it('accepts a single window', () => {
    const r = parseClaudeUsage(statusline({ used_percentage: 10, resets_at: 5 }));
    expect(r).toEqual({ fiveHour: { usedPercentage: 10, resetsAt: 5000 } });
  });

  it('returns null for missing, empty or garbage input', () => {
    expect(parseClaudeUsage(undefined)).toBeNull();
    expect(parseClaudeUsage(null)).toBeNull();
    expect(parseClaudeUsage('x')).toBeNull();
    expect(parseClaudeUsage([])).toBeNull();
    expect(parseClaudeUsage({})).toBeNull();
    expect(parseClaudeUsage({ rate_limits: null })).toBeNull();
    expect(parseClaudeUsage({ rate_limits: 5 })).toBeNull();
    expect(parseClaudeUsage(statusline())).toBeNull();
  });

  it('drops a window with an invalid percentage or reset time', () => {
    expect(parseClaudeUsage(statusline({ used_percentage: 'a', resets_at: 5 }))).toBeNull();
    expect(parseClaudeUsage(statusline({ used_percentage: NaN, resets_at: 5 }))).toBeNull();
    expect(parseClaudeUsage(statusline({ used_percentage: 5, resets_at: 0 }))).toBeNull();
    expect(parseClaudeUsage(statusline({ used_percentage: 5, resets_at: -1 }))).toBeNull();
    expect(parseClaudeUsage(statusline({ used_percentage: 5 }))).toBeNull();
    const r = parseClaudeUsage(
      statusline({ used_percentage: 'a', resets_at: 5 }, { used_percentage: 5, resets_at: 5 }),
    );
    expect(r).toEqual({ sevenDay: { usedPercentage: 5, resetsAt: 5000 } });
  });

  it('clamps out-of-range percentages', () => {
    const r = parseClaudeUsage(
      statusline({ used_percentage: 140, resets_at: 5 }, { used_percentage: -4, resets_at: 5 }),
    );
    expect(r?.fiveHour?.usedPercentage).toBe(100);
    expect(r?.sevenDay?.usedPercentage).toBe(0);
  });
});

describe('withoutExpiredWindows', () => {
  const usage = {
    fiveHour: { usedPercentage: 50, resetsAt: 1000 },
    sevenDay: { usedPercentage: 20, resetsAt: 5000 },
    updatedAt: 1,
  };
  it('drops only the expired window', () => {
    expect(withoutExpiredWindows(usage, 999)).toEqual(usage);
    expect(withoutExpiredWindows(usage, 1000)).toEqual({
      sevenDay: usage.sevenDay,
      updatedAt: 1,
    });
    expect(withoutExpiredWindows(usage, 5000)).toBeNull();
  });
});

describe('UsageTracker', () => {
  it('broadcasts changes once, dedupes repeats, and ignores junk', () => {
    const store = new AgentStateStore();
    const seen: Record<string, unknown>[] = [];
    store.on('broadcast', (m) => seen.push(m));
    const tracker = new UsageTracker(store);
    const payload = statusline({ used_percentage: 54, resets_at: FUTURE_S });
    expect(tracker.ingest('claude', payload)).toBe(true);
    expect(tracker.ingest('claude', payload)).toBe(false);
    expect(tracker.ingest('claude', { nothing: 1 })).toBe(false);
    expect(tracker.ingest('unknown-provider', payload)).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      type: 'usageUpdate',
      providerId: 'claude',
      fiveHour: { usedPercentage: 54, resetsAt: FUTURE_S * 1000 },
    });
  });

  it('persists to usage.json and a new tracker replays it', () => {
    const store = new AgentStateStore();
    new UsageTracker(store).ingest(
      'claude',
      statusline({ used_percentage: 7, resets_at: FUTURE_S }),
    );
    const file = path.join(tmpBase, '.pixel-agents', 'usage.json');
    expect(fs.existsSync(file)).toBe(true);
    const replay = new UsageTracker(new AgentStateStore()).currentMessages();
    expect(replay).toHaveLength(1);
    expect(replay[0]).toMatchObject({ providerId: 'claude', fiveHour: { usedPercentage: 7 } });
  });

  it('sends nothing for an expired snapshot', () => {
    const store = new AgentStateStore();
    new UsageTracker(store).ingest(
      'claude',
      statusline({ used_percentage: 7, resets_at: FUTURE_S }),
    );
    const later = (FUTURE_S + 10) * 1000;
    expect(new UsageTracker(new AgentStateStore(), () => later).currentMessages()).toEqual([]);
  });

  it('survives a corrupt usage.json', () => {
    fs.writeFileSync(path.join(tmpBase, '.pixel-agents', 'usage.json'), '{not json');
    expect(new UsageTracker(new AgentStateStore()).currentMessages()).toEqual([]);
  });
});

describe('webviewReady handshake', () => {
  it('replays usage to a read-only client', () => {
    const store = new AgentStateStore();
    const tracker = new UsageTracker(store);
    tracker.ingest('claude', statusline({ used_percentage: 54, resets_at: FUTURE_S }));
    const sent: Record<string, unknown>[] = [];
    handleClientMessage({ type: 'webviewReady' }, (m) => sent.push(m), {
      store,
      cache: null,
      privileged: false,
      usage: tracker,
    });
    expect(sent.find((m) => m.type === 'usageUpdate')).toMatchObject({ providerId: 'claude' });
  });
});

describe('POST /api/usage/:providerId', () => {
  it('requires auth and broadcasts on a valid snapshot', async () => {
    const store = new AgentStateStore();
    const seen: Record<string, unknown>[] = [];
    store.on('broadcast', (m) => seen.push(m));
    const server = new PixelAgentsServer();
    try {
      const config = await server.start({ store, embedded: true });
      const url = `http://127.0.0.1:${config.port}/api/usage/claude`;
      const body = JSON.stringify(statusline({ used_percentage: 54, resets_at: FUTURE_S }));
      const noAuth = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(noAuth.status).toBe(401);
      expect(seen).toHaveLength(0);

      const ok = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
        body,
      });
      expect(ok.status).toBe(200);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ type: 'usageUpdate', fiveHour: { usedPercentage: 54 } });

      const tooBig = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
        body: JSON.stringify({ pad: 'x'.repeat(40_000) }),
      });
      expect(tooBig.status).toBe(413);
    } finally {
      server.stop();
    }
  });
});

// ── Spawned script ───────────────────────────────────────────

const STATUSLINE_SCRIPT = path.join(__dirname, '../../dist/hooks/claude-statusline.js');

function runScript(
  args: string[],
  stdin: string,
): Promise<{ code: number | null; stdout: string; ms: number }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('node', [STATUSLINE_SCRIPT, ...args], {
      env: { ...process.env, HOME: tmpBase, USERPROFILE: tmpBase },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 8000,
    });
    let stdout = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.on('close', (code) => resolve({ code, stdout, ms: Date.now() - started }));
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

describe.skipIf(!fs.existsSync(STATUSLINE_SCRIPT))('claude-statusline.js integration', () => {
  const blob = JSON.stringify(statusline({ used_percentage: 53.6, resets_at: FUTURE_S }));

  it('exits 0 quickly with no server and prints a summary line', async () => {
    const r = await runScript([], blob);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('5h 54%');
    expect(r.ms).toBeLessThan(3000);
  });

  it('prints nothing without data, and survives garbage stdin', async () => {
    expect((await runScript([], '{}')).stdout).toBe('');
    const r = await runScript([], 'not json');
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('passes a chained command output through, fed the same stdin', async () => {
    const r = await runScript(['--', 'node -e "process.stdin.pipe(process.stdout)"'], blob);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(blob);
  });

  it('posts the raw JSON to a live server with Bearer auth', async () => {
    const received: { auth?: string; url?: string; body: string }[] = [];
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        received.push({ auth: req.headers.authorization, url: req.url, body });
        res.writeHead(200);
        res.end('ok');
      });
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const port = (srv.address() as { port: number }).port;
    fs.writeFileSync(
      path.join(tmpBase, '.pixel-agents', 'server.json'),
      JSON.stringify({ port, pid: process.pid, token: 'tok' }),
    );
    try {
      const r = await runScript([], blob);
      expect(r.code).toBe(0);
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        auth: 'Bearer tok',
        url: '/api/usage/claude',
        body: blob,
      });
    } finally {
      srv.close();
    }
  });
});
