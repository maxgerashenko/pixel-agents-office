import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import {
  SERVER_JSON_DIR,
  SERVER_JSON_NAME,
  SERVERS_DIR,
  USAGE_API_PREFIX,
} from '../../../../constants.js';
import type { ServerTarget } from '../../../../serverConfig.js';
import { isServerConfig, isServerTarget } from '../../../../serverConfig.js';

/**
 * Claude Code statusLine tap. Claude pipes a JSON blob to the configured
 * statusLine command on stdin and shows its stdout. For Pro/Max subscribers the
 * blob carries `rate_limits` (the only exact local source of usage). This
 * script forwards the blob to every live Pixel Agents server and then either
 * chains the user's own statusline command or prints a short line itself:
 *
 *   node claude-statusline.js                      -> prints "5h 54%"
 *   node claude-statusline.js -- "bash my.sh"      -> runs my.sh, passes its output through
 *
 * It must never slow or break Claude Code: the POST is best-effort with a short
 * timeout, every error is swallowed, and the exit code is always 0.
 */

/** Per-server POST timeout. The statusline refreshes constantly; never stall it. */
const POST_TIMEOUT_MS = 500;

const PIXEL_DIR = path.join(os.homedir(), SERVER_JSON_DIR);

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Live servers: every registry entry with a live PID, else the legacy server.json. */
function readServers(): ServerTarget[] {
  const live: ServerTarget[] = [];
  try {
    const dir = path.join(PIXEL_DIR, SERVERS_DIR);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as unknown;
        if (isServerConfig(entry) && isProcessAlive(entry.pid)) live.push(entry);
      } catch {
        /* malformed or mid-write entry */
      }
    }
  } catch {
    /* no registry directory */
  }
  if (live.length > 0) return live;
  try {
    const legacy = JSON.parse(
      fs.readFileSync(path.join(PIXEL_DIR, SERVER_JSON_NAME), 'utf-8'),
    ) as unknown;
    if (isServerTarget(legacy)) return [legacy];
  } catch {
    /* no server running */
  }
  return [];
}

function postToServer(server: ServerTarget, body: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: server.port,
          path: `${USAGE_API_PREFIX}/claude`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            Authorization: `Bearer ${server.token}`,
          },
          timeout: POST_TIMEOUT_MS,
        },
        (res) => {
          res.resume();
          resolve();
        },
      );
      req.on('error', () => resolve());
      req.on('timeout', () => {
        req.destroy();
        resolve();
      });
      req.end(body);
    } catch {
      resolve();
    }
  });
}

/** The chained command: everything after the first `--`. A single argument is
 *  the user's whole shell command line (the documented form). Several are an
 *  argv, so each is quoted: `-- bash "/My Scripts/s.sh"` must not split on the
 *  space in the path. */
function chainedCommand(argv: string[]): string | null {
  const i = argv.indexOf('--');
  if (i < 0) return null;
  const rest = argv.slice(i + 1);
  if (rest.length === 0) return null;
  const cmd = rest.length === 1 ? rest[0].trim() : rest.map(shellQuote).join(' ');
  return cmd || null;
}

function shellQuote(arg: string): string {
  if (process.platform === 'win32') return `"${arg.replace(/"/g, '\\"')}"`;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Run the user's own statusline with the same stdin; pass stdout through. */
function runChained(command: string, input: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
      child.on('error', () => resolve());
      child.on('close', () => resolve());
      child.stdin.on('error', () => {
        /* child exited before reading stdin */
      });
      child.stdin.end(input);
    } catch {
      resolve();
    }
  });
}

/** "5h 54%" from the stdin blob, or '' when it carries no five-hour data. */
function summaryLine(data: unknown): string {
  if (typeof data !== 'object' || data === null) return '';
  const limits = (data as Record<string, unknown>)['rate_limits'];
  if (typeof limits !== 'object' || limits === null) return '';
  const five = (limits as Record<string, unknown>)['five_hour'];
  if (typeof five !== 'object' || five === null) return '';
  const pct = (five as Record<string, unknown>)['used_percentage'];
  return typeof pct === 'number' && Number.isFinite(pct) ? `5h ${Math.round(pct)}%` : '';
}

async function main(): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    data = null;
  }

  const posts =
    data !== null
      ? Promise.all(readServers().map((s) => postToServer(s, JSON.stringify(data))))
      : Promise.resolve([]);

  const command = chainedCommand(process.argv.slice(2));
  if (command) {
    await Promise.all([runChained(command, input), posts]);
  } else {
    const line = summaryLine(data);
    if (line) process.stdout.write(`${line}\n`);
    await posts;
  }
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
