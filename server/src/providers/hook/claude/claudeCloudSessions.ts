import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as os from 'os';

import { CLOUD_SESSIONS_POLL_TIMEOUT_MS } from '../../../constants.js';
import { ensureSettingsFile } from './claudeUsagePoll.js';

/**
 * The user's claude.ai cloud sessions, read through their own `claude` CLI.
 *
 * Same channel as the usage poll: a print-mode control request
 * (`list_cloud_sessions`) that the CLI answers with its own sign-in, so Pixel
 * Agents never reads credentials or talks to Anthropic. The CLI refuses to
 * answer a program started inside a Claude Code session, so the variables that
 * mark one are dropped from the child's environment.
 */

export type CloudSessionState = 'working' | 'permission' | 'idle';

export interface CloudSession {
  id: string;
  title: string;
  state: CloudSessionState;
  repo?: string;
  /** Last change, ms since epoch (0 when the service sent none). */
  updatedAt: number;
}

/** Environment variables that make the CLI think it was started inside a session. */
const SESSION_MARKER_ENV = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_REMOTE_SESSION_ID',
  'CLAUDE_CODE_REMOTE',
  'CLAUDE_CODE_CHILD_SESSION',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Pure: the CLI's `status` word for a row mapped to what the office shows; null = not shown. */
export function stateOfStatus(status: unknown): CloudSessionState | null {
  switch (status) {
    case 'running':
    case 'pending':
      return 'working';
    case 'requires_action':
      return 'permission';
    case 'idle':
      return 'idle';
    default:
      return null; // archived, failed, unknown
  }
}

/**
 * Parse the `control_response` line for `requestId`. Returns the sessions of an
 * `ok` answer, or null for anything else (other lines, errors, `unavailable`).
 */
export function parseCloudSessionsResponse(
  lineOrObj: unknown,
  requestId: string,
): CloudSession[] | null {
  let obj: unknown = lineOrObj;
  if (typeof lineOrObj === 'string') {
    try {
      obj = JSON.parse(lineOrObj);
    } catch {
      return null;
    }
  }
  if (!isRecord(obj) || obj['type'] !== 'control_response') return null;
  const response = obj['response'];
  if (!isRecord(response) || response['subtype'] !== 'success') return null;
  if (response['request_id'] !== requestId) return null;
  const body = response['response'];
  if (!isRecord(body) || body['status'] !== 'ok' || !Array.isArray(body['sessions'])) return null;
  const out: CloudSession[] = [];
  for (const row of body['sessions']) {
    if (!isRecord(row) || typeof row['id'] !== 'string' || !row['id']) continue;
    const state = stateOfStatus(row['status']);
    if (!state) continue;
    const repository = row['repository'];
    const repo =
      isRecord(repository) &&
      typeof repository['owner'] === 'string' &&
      typeof repository['name'] === 'string'
        ? `${repository['owner']}/${repository['name']}`
        : undefined;
    const stamp = typeof row['updated_at'] === 'string' ? Date.parse(row['updated_at']) : NaN;
    out.push({
      id: row['id'],
      title: typeof row['title'] === 'string' && row['title'] ? row['title'] : 'Cloud session',
      state,
      ...(repo ? { repo } : {}),
      updatedAt: Number.isFinite(stamp) ? stamp : 0,
    });
  }
  return out;
}

function isResponseFor(line: string, requestId: string): boolean {
  try {
    const obj = JSON.parse(line) as unknown;
    if (!isRecord(obj) || obj['type'] !== 'control_response') return false;
    const response = obj['response'];
    return isRecord(response) && response['request_id'] === requestId;
  } catch {
    return false;
  }
}

export interface FetchCloudSessionsOptions {
  /** Executable to run (default `claude`). Injected by tests. */
  command?: string;
  timeoutMs?: number;
}

/** Ask the user's `claude` CLI for their cloud sessions. Never throws; null on any
 *  failure (not installed, signed out, API key, timeout, junk). */
export function fetchCloudSessions(
  opts: FetchCloudSessionsOptions = {},
): Promise<CloudSession[] | null> {
  return new Promise((resolve) => {
    let settled = false;
    let child: ReturnType<typeof spawn> | null = null;
    let timer: NodeJS.Timeout | null = null;

    const finish = (result: CloudSession[] | null): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (child) {
        try {
          child.stdin?.end();
        } catch {
          /* already closed */
        }
        try {
          child.kill();
        } catch {
          /* already gone */
        }
      }
      resolve(result);
    };

    try {
      const settingsPath = ensureSettingsFile();
      if (!settingsPath) {
        resolve(null);
        return;
      }
      const win32 = process.platform === 'win32';
      const requestId = `pixel-agents-cloud-${crypto.randomUUID()}`;
      const env = { ...process.env };
      for (const name of SESSION_MARKER_ENV) delete env[name];
      child = spawn(
        opts.command ?? 'claude',
        [
          '-p',
          '--input-format',
          'stream-json',
          '--output-format',
          'stream-json',
          '--verbose',
          '--no-session-persistence',
          '--strict-mcp-config',
          '--settings',
          win32 ? `"${settingsPath}"` : settingsPath,
        ],
        {
          cwd: os.homedir(),
          env,
          shell: win32,
          stdio: ['pipe', 'pipe', 'ignore'],
          windowsHide: true,
        },
      );
      timer = setTimeout(() => finish(null), opts.timeoutMs ?? CLOUD_SESSIONS_POLL_TIMEOUT_MS);
      child.on('error', () => finish(null));
      child.on('close', () => finish(null));
      child.stdin?.on('error', () => {
        /* child exited before reading; 'close' settles */
      });

      let buffer = '';
      child.stdout?.setEncoding('utf-8');
      child.stdout?.on('data', (chunk: string) => {
        buffer += chunk;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line && isResponseFor(line, requestId)) {
            finish(parseCloudSessionsResponse(line, requestId));
            return;
          }
        }
      });

      child.stdin?.write(
        JSON.stringify({
          type: 'control_request',
          request_id: requestId,
          request: { subtype: 'list_cloud_sessions' },
        }) + '\n',
      );
    } catch {
      finish(null);
    }
  });
}
