---
name: switch-to-fork
description: Replace the original Pixel Agents (Marketplace or upstream git) with this fork on the user's machine, or update an installed fork build. Use for "switch me to my fork", "install my fork", "update my Pixel Agents fork".
---

# Switch to the Pixel Agents fork

Follow `docs/switch-to-fork.md` in this repository; it is the source of truth.
Read it first, then do the steps on this machine:

1. **Checkout.** Run `git remote -v`. If `origin` is `pixel-agents-hq/pixel-agents`,
   rename it to `upstream` and add `https://github.com/maxgerashenko/pixel-agents-office.git`
   as `origin` (doc step 1). If `git status` shows uncommitted changes, ask the
   user before resetting `main`. If already on the fork, `git pull origin main`.
2. **Editor CLI.** Find which of `code`, `code-insiders`, `cursor`, `codium` is
   on PATH and has `pablodelucca.pixel-agents` installed
   (`<cli> --list-extensions --show-versions`). If none is on PATH, ask the user
   which editor they use.
3. **Build.** `npm ci`, then `npx @vscode/vsce package --out pixel-agents-fork.vsix`.
   If it fails, report the error and stop; never install an old `.vsix`.
4. **Install.** `<cli> --install-extension pixel-agents-fork.vsix --force`.
   Do not uninstall first (the uninstall hook strips the user's Claude Code hooks).
5. **Standalone.** Only if `which pixel-agents` or the user says they use
   `npx pixel-agents`: do doc step 5 (`npm link`). Ask before
   `npm uninstall -g pixel-agents`.
6. **Report.** Show the installed version line, and tell the user to run
   *Developer: Reload Window* and to uncheck **Auto Update** for Pixel Agents in
   the Extensions view so the Marketplace build can't replace the fork.
