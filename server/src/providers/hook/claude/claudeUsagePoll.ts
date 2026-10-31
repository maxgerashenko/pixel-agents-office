import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { UsageSnapshot, UsageWindow } from '../../../../../core/src/provider.js';
import {
  SERVER_JSON_DIR,
  USAGE_POLL_SETTINGS_FILE_NAME,
  USAGE_POLL_TIMEOUT_MS,
} from '../../../constants.js';

/**
 * Pull-based usage refresh for Claude Code.
 *
 * Claude Code's SDK control request `get_usage` (print mode, experimental)
 * returns the account's plan rate limits WITHOUT a model call. Claude Code
 * fetches them itself with its own sign-in, which is why they include usage
 * spent on claude.ai web. Pixel Agents never reads credentials or talks to
 * Anthropic: it only runs the user's own `claude` binary.
 */

const SETTINGS_CONTENT = JSON.stringify({ disableAllHooks: true });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseWindow(raw: unknown): UsageWindow | undefined {
  if (!isRecord(raw)) return undefined;
  const utilization = raw['utilization'];
  const resetsAtIso = raw['resets_at'];
  if (typeof utilization !== 'number' || !Number.isFinite(utilization)) return undefined;
  if (typeof resetsAtIso !== 'string') return undefined;
  const resetsAt = Date.parse(resetsAtIso);
  if (!Number.isFinite(resetsAt) || resetsAt <= 0) return undefined;
  return { usedPercentage: Math.min(100, Math.max(0, utilization)), resetsAt };
}

/**
 * Parse one stdout line (or an already-parsed object) of the print-mode stream.
 * Returns the snapshot when it is the successful `control_response` for
 * `requestId` carrying at least one usable window; null otherwise (other
 * lines, errors, other request ids, no rate limits, garbage).
 */
export function parseClaudeUsageResponse(
  lineOrObj: unknown,
  requestId: string,
): UsageSnapshot | null {
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
  if (!isRecord(body) || !isRecord(body['rate_limits'])) return null;
  const fiveHour = parseWindow(body['rate_limits']['five_hour']);
  const sevenDay = parseWindow(body['rate_limits']['seven_day']);
  if (!fiveHour && !sevenDay) return null;
  return {
    ...(fiveHour ? { fiveHour } : {}),
    ...(sevenDay ? { sevenDay } : {}),
  };
}

/** True when the line is the (success or error) control_response for requestId. */
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

/** Write the hooks-off settings file the polling CLI is started with, when
 *  missing or different. Returns its path, or null when it cannot be written. */
function ensureSettingsFile(): string | null {
  const filePath = path.join(os.homedir(), SERVER_JSON_DIR, USAGE_POLL_SETTINGS_FILE_NAME);
  try {
    let current: string | null = null;
    try {
      current = fs.readFileSync(filePath, 'utf-8');
    } catch {
      /* missing */
    }
    if (current !== SETTINGS_CONTENT) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
      const tmpPath = `${filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmpPath, SETTINGS_CONTENT, { mode: 0o600 });
      fs.renameSync(tmpPath, filePath);
    }
    return filePath;
  } catch (err) {
    console.error('[Pixel Agents] Failed to write usage poll settings:', err);
    return null;
  }
}

export interface FetchClaudeUsageOptions {
  /** Executable to run (default `claude`). Injected by tests. */
  command?: string;
  /** Hard limit for the whole poll. */
  timeoutMs?: number;
}

/** Ask the user's `claude` CLI for the current rate limits. Never throws; null
 *  on any failure (not installed, signed out, API key, timeout, junk). */
export function fetchClaudeUsage(
  opts: FetchClaudeUsageOptions = {},
): Promise<UsageSnapshot | null> {
  return new Promise((resolve) => {
    let settled = false;
    let child: ReturnType<typeof spawn> | null = null;
    let timer: NodeJS.Timeout | null = null;

    const finish = (result: UsageSnapshot | null): void => {
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
      const requestId = `pixel-agents-usage-${crypto.randomUUID()}`;
      const args = [
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
      ];
      child = spawn(opts.command ?? 'claude', args, {
        cwd: os.homedir(),
        env: process.env,
        shell: win32,
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      });
      timer = setTimeout(() => finish(null), opts.timeoutMs ?? USAGE_POLL_TIMEOUT_MS);

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
            finish(parseClaudeUsageResponse(line, requestId));
            return;
          }
        }
      });

      child.stdin?.write(
        JSON.stringify({
          type: 'control_request',
          request_id: requestId,
          request: { subtype: 'get_usage', skip_behaviors: true },
        }) + '\n',
      );
    } catch {
      finish(null);
    }
  });
}
