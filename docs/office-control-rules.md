# Rules for controlling the Pixel Agents office

These rules apply to anyone who starts, stops, restarts or updates the
always-on web office on this Mac: you, Claude, or a local agent (Qwen, Gemma,
...). They exist so the office never loses its saved state.

## The setup

- The office is the **fork** at `~/Documents/GitHub/pixel-agents-office`, run by
  the launchd job `local.pixel-agents`
  (`~/Library/LaunchAgents/local.pixel-agents.plist`) as
  `node dist/cli.js --host 0.0.0.0 --port 3100 --no-terminal`, with `KeepAlive` on.
- Everything saved lives in `~/.pixel-agents/`: `layout.json` (office, Areas),
  `config.json` (settings, Area mappings, Directories), `standalone-state.json`
  (agents and seats), `standalone-token` (the bookmarked URL), `office/`.

## The rules

1. **Control it only with `scripts/office.sh`.**
   `status`, `on`, `off`, `restart`, `update`, `backup`. Nothing else starts,
   stops or rebuilds the office.
2. **Never `kill`, `pkill` or `kill -9` the server.** launchd restarts it at
   once (`KeepAlive`), and the unplanned restart drops saved agents.
3. **Never start a second server.** No `npx pixel-agents`, no
   `node dist/cli.js`, no `pixel-agents` by hand while the job exists. A second
   launch attaches to or fights the first over the same files.
4. **Back up before anything that stops the server.** `off`, `restart` and
   `update` do it for you; for anything else run `scripts/office.sh backup`
   first.
5. **Don't edit or delete files in `~/.pixel-agents/` while the server runs.**
   It rewrites them and will overwrite your change. To restore a file:
   `scripts/office.sh off`, copy it from a backup, `scripts/office.sh on`.
6. **Never delete `~/.pixel-agents/` or a backup, and never use
   `--rotate-token`,** unless the user asks for exactly that.
7. **Never print the server token** (`standalone-token`, `server.json`, the
   `?token=` URL). Redact it in logs you show.
8. **Agents ask before stopping the office.** Claude and local agents must ask
   the user before `off`, `restart` or `update`: it interrupts everyone watching.
   `status` and `backup` need no permission.
9. **Check after every change.** Run `scripts/office.sh status` and compare
   with the line from before: same layout size, furniture, Areas and mappings.
   If something is missing, stop and tell the user. Don't fix it by hand.
10. **Don't run the VS Code e2e suite** as part of any of this.

## Rolling back to the original

Ask the user first, then:

```bash
scripts/office.sh off
mv ~/Library/LaunchAgents/local.pixel-agents.plist.orig ~/Library/LaunchAgents/local.pixel-agents.plist
launchctl enable gui/$(id -u)/local.pixel-agents
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.pixel-agents.plist
```

## Known gap

Agents with no transcript (the `local-*` ones such as `Local_QWEN`,
`Local_GEMMA`) are dropped from `standalone-state.json` whenever the server
starts. Their Area mappings in `config.json` stay, so they land in the right
Area when they register again. Until that's fixed, a restart means they must
re-register.
