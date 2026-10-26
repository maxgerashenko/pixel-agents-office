/**
 * Helpers for docs/switch-to-fork.md (moving a machine from upstream Pixel
 * Agents to this fork without losing the saved office).
 *
 *   node scripts/fork-switch.mjs snapshot [dir]   What is saved in ~/.pixel-agents (or a backup dir)
 *   node scripts/fork-switch.mjs servers          Running Pixel Agents servers (web + VS Code)
 *   node scripts/fork-switch.mjs stop-web         Gracefully stop the running web (standalone) servers
 *
 * Read-only except stop-web, which sends SIGTERM to web servers only: VS Code's
 * embedded server lives inside the extension host and is never touched.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME_DIR = path.join(os.homedir(), '.pixel-agents');
const STOP_WAIT_MS = 5_000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function snapshot(dir) {
  const layout = readJson(path.join(dir, 'layout.json'));
  const config = readJson(path.join(dir, 'config.json'));
  const state = readJson(path.join(dir, 'standalone-state.json'));
  const vscodeState = readJson(path.join(dir, 'vscode-state.json'));
  return {
    dir,
    layout: layout
      ? {
          size: `${layout.cols}x${layout.rows}`,
          furniture: layout.furniture?.length ?? 0,
          areas: (layout.areas ?? []).map((a) => a.label),
        }
      : null,
    webAreaMappings: config?.standalone?.areaMappings ?? {},
    vscodeAreaMappings: config?.vscode?.areaMappings ?? {},
    directories: (config?.directories ?? []).map((d) => d.name),
    webAgents: (state?.agents ?? []).length,
    webSeats: Object.keys(state?.seats ?? {}).length,
    vscodeAgents: (vscodeState?.agents ?? []).length,
    webTokenSaved: fs.existsSync(path.join(dir, 'standalone-token')),
  };
}

function runningServers() {
  const dir = path.join(HOME_DIR, 'servers');
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  return entries
    .map((name) => readJson(path.join(dir, name)))
    .filter((c) => c && typeof c.pid === 'number' && isAlive(c.pid))
    .map((c) => ({ kind: c.servesSpa ? 'web' : 'vscode', pid: c.pid, port: c.port }));
}

async function stopWeb() {
  const web = runningServers().filter((s) => s.kind === 'web');
  if (web.length === 0) {
    console.log('No web server running.');
    return;
  }
  for (const s of web) {
    console.log(`Stopping web server pid ${s.pid} on port ${s.port}`);
    process.kill(s.pid, 'SIGTERM');
  }
  const deadline = Date.now() + STOP_WAIT_MS;
  while (Date.now() < deadline && web.some((s) => isAlive(s.pid))) {
    await new Promise((r) => setTimeout(r, 200));
  }
  const left = web.filter((s) => isAlive(s.pid));
  if (left.length > 0) {
    console.error(
      `Still running: ${left.map((s) => s.pid).join(', ')}. Stop it with Ctrl+C in its terminal.`,
    );
    process.exit(1);
  }
  console.log('Stopped.');
}

const [command, arg] = process.argv.slice(2);
if (command === 'snapshot') {
  console.log(JSON.stringify(snapshot(arg ? path.resolve(arg) : HOME_DIR), null, 2));
} else if (command === 'servers') {
  console.log(JSON.stringify(runningServers(), null, 2));
} else if (command === 'stop-web') {
  await stopWeb();
} else {
  console.error('Usage: node scripts/fork-switch.mjs snapshot [dir] | servers | stop-web');
  process.exit(2);
}
