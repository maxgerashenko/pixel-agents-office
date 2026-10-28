#!/usr/bin/env bash
# The one way to control the always-on Pixel Agents web office (the fork, run by
# launchd as local.pixel-agents). Rules: docs/office-control-rules.md.
#
#   scripts/office.sh status    Is it running, which build, is the state intact
#   scripts/office.sh on        Start it (and keep it starting at login)
#   scripts/office.sh off       Back up, then stop it (stays off after reboot)
#   scripts/office.sh restart   Back up, then restart it
#   scripts/office.sh update    Back up, pull + build the fork, then restart it
#   scripts/office.sh backup    Copy ~/.pixel-agents to ~/.pixel-agents.bak-<stamp>
#
# Never prints the server token.

set -euo pipefail

LABEL=local.pixel-agents
DOMAIN="gui/$(id -u)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
STATE="$HOME/.pixel-agents"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3100

loaded() { launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; }

server_pid() {
  node -e 'try{console.log(require(process.argv[1]).pid)}catch{}' "$STATE/server.json"
}

healthy() { curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null; }

backup() {
  local dest
  dest="$STATE.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a "$STATE" "$dest"
  echo "Backup: $dest"
}

wait_healthy() {
  for _ in $(seq 1 40); do
    healthy && return 0
    sleep 0.5
  done
  echo "Server did not answer /api/health on port $PORT" >&2
  return 1
}

# A server started by hand (npx, node dist/cli.js) would be reused or fought over.
refuse_stray() {
  local pid
  pid="$(server_pid)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && ! loaded; then
    echo "A Pixel Agents server not run by launchd is up (pid $pid): $(ps -o args= -p "$pid")" >&2
    echo "Stop it in its own terminal (Ctrl+C) first." >&2
    exit 1
  fi
}

status() {
  if loaded; then echo "launchd job: loaded"; else echo "launchd job: not loaded"; fi
  local pid
  pid="$(server_pid)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "server: pid $pid  $(ps -o args= -p "$pid")"
  else
    echo "server: not running"
  fi
  if healthy; then echo "health: ok (port $PORT)"; else echo "health: no answer (port $PORT)"; fi
  echo "fork: $(git -C "$REPO" branch --show-current) $(git -C "$REPO" log --oneline -1)"
  node "$REPO/scripts/fork-switch.mjs" snapshot | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);
    console.log(`state: layout ${j.layout?.size} (${j.layout?.furniture} furniture, ${j.layout?.areas.length} areas), ${j.webAgents} web agents, ${Object.keys(j.webAreaMappings).length} area mappings`)})'
}

on() {
  refuse_stray
  launchctl enable "$DOMAIN/$LABEL"
  loaded || launchctl bootstrap "$DOMAIN" "$PLIST"
  wait_healthy
  status
}

off() {
  backup
  launchctl disable "$DOMAIN/$LABEL"
  if loaded; then launchctl bootout "$DOMAIN/$LABEL"; fi
  echo "Stopped. Start again with: scripts/office.sh on"
}

restart() {
  backup
  if loaded; then
    launchctl kickstart -k "$DOMAIN/$LABEL"
    wait_healthy
    status
  else
    on
  fi
}

update() {
  if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
    echo "The fork checkout has local changes; commit or stash them first." >&2
    exit 1
  fi
  backup
  git -C "$REPO" pull --ff-only origin main
  (cd "$REPO" && SCARF_ANALYTICS=false npm install && node esbuild.js && npm run build:webview)
  restart
}

case "${1:-}" in
  status) status ;;
  on) on ;;
  off) off ;;
  restart) restart ;;
  update) update ;;
  backup) backup ;;
  *)
    echo "Usage: scripts/office.sh status | on | off | restart | update | backup" >&2
    exit 2
    ;;
esac
