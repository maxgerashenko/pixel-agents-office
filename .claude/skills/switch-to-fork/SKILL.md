---
name: switch-to-fork
description: Replace the original Pixel Agents (web `npx pixel-agents` or the Marketplace VS Code extension) with this fork on the user's machine, keeping their layout, Areas and agents; or update an installed fork. Use for "switch me to my fork", "run my fork", "update my fork".
---

# Switch to the Pixel Agents fork

`docs/switch-to-fork.md` is the source of truth; read it first, then do it on this
machine. Default to **Part A (web version)** unless the user says they use VS Code
or `code --list-extensions` shows `pablodelucca.pixel-agents` and no web server is
running (`node scripts/fork-switch.mjs servers`). Do both if they use both.

Web version, end to end:

1. **Checkout.** `git remote -v`. If `origin` is `pixel-agents-hq/pixel-agents`,
   re-point it (doc A1). Uncommitted changes → ask before `checkout -B`. Already
   on the fork → `git pull origin main`.
2. **Build.** `npm ci && npm run package`. On failure, report and stop; the
   original is still running, nothing is lost.
3. **Back up.** `cp -Rp ~/.pixel-agents ~/pixel-agents-backup-<stamp>` and
   `node scripts/fork-switch.mjs snapshot > /tmp/pixel-agents-before.json`.
   Show the user the snapshot.
4. **Agents started from the web page's + button die with the server.** If
   `snapshot` shows web agents, tell the user this and ask before stopping.
5. **Stop.** `node scripts/fork-switch.mjs stop-web`. If it can't, ask the user to
   Ctrl+C the `npx pixel-agents` terminal. Never kill a `vscode` server.
6. **Start.** Run `node dist/cli.js` with the flags the user used before, in the
   background or a terminal they keep open. The log must say
   `server running at`, not `Reusing existing standalone server`.
   Offer `npm link` so `pixel-agents` means the fork from now on.
7. **Verify.** `node scripts/fork-switch.mjs snapshot | diff /tmp/pixel-agents-before.json -`
   must be empty. Give the user the printed URL (it holds their token; it's the
   same URL as before) and ask them to check their layout and agents.
8. **If anything is missing**, restore from the backup (doc A7) and tell the user
   what differed.

VS Code: doc Part B. Build with `npx @vscode/vsce package --out pixel-agents-fork.vsix`,
install with `<cli> --install-extension pixel-agents-fork.vsix --force`, never
uninstall the Marketplace build first (it strips the Claude Code hooks), then tell
the user to reload the window and uncheck Auto Update for Pixel Agents.
