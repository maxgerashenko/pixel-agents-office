# Usage meter

Pixel Agents can show Claude's "Current session" usage as a strip across the top of the office:

```
Current session   Resets at 6:50 AM   [██████░░░░░░░░░░]   54% used
```

The strip appears only once data arrives, and disappears when the window resets.

## Where the numbers come from

The only exact local source is the JSON Claude Code pipes to a **statusLine command** on stdin. For Claude.ai subscribers (Pro/Max) it carries `rate_limits.five_hour` and `rate_limits.seven_day` (`used_percentage`, `resets_at`). It is absent for API-key accounts and before a session's first response, and the strip then stays hidden. Hooks do not carry it. Pixel Agents never reads your OAuth credentials and never calls an Anthropic API.

`claude-statusline.js` is a small tap: it forwards that JSON to the local Pixel Agents server (`POST /api/usage/claude`, Bearer token from `~/.pixel-agents/server.json`, 500 ms timeout, errors swallowed, always exits 0), then prints a status line.

## Setup (opt-in)

Pixel Agents does **not** edit the `statusLine` entry of `~/.claude/settings.json` for you: that would widen what you consented to for hooks. Add it yourself.

The script is copied to `~/.pixel-agents/hooks/claude-statusline.js` every time the standalone server starts, and whenever hooks are installed (VS Code). It does not need hooks to be enabled.

No statusline yet (prints `5h 54%`):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.pixel-agents/hooks/claude-statusline.js"
  }
}
```

Keep your existing statusline: put its command after `--`; it receives the same stdin and its output is passed through unchanged.

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.pixel-agents/hooks/claude-statusline.js -- \"bash ~/my-statusline.sh\""
  }
}
```

## Notes

- The latest snapshot is kept in `~/.pixel-agents/usage.json` so a restart still shows it. A window whose reset time has passed is never shown.
- The bar turns amber at 80% and red at 95%.
- On a phone the strip sits above the office and terminal pages.
- `resetsAt` is Unix epoch milliseconds on the wire (`usageUpdate` in `core/asyncapi.yaml`); Claude reports seconds and the server converts.
