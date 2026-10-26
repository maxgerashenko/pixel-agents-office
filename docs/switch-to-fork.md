# Switching from upstream Pixel Agents to this fork

This repository (`maxgerashenko/pixel-agents-office`) is a fork of
[`pixel-agents-hq/pixel-agents`](https://github.com/pixel-agents-hq/pixel-agents).
There is no published build of the fork: you build it from a local checkout and
run that instead of the original.

Claude Code can do all of this for you: open Claude in the fork checkout and say
**"switch me to my fork"** (the `switch-to-fork` project skill follows this
document).

## What the fork adds over upstream

| PR  | Change                                                                                             |
| --- | -------------------------------------------------------------------------------------------------- |
| #8  | Working agents sit only at computer seats (a PC/monitor desk; a bench or sofa facing a PC counts). |
| #5  | Idle agents rest on benches and sofas away from computers, and never wander into a marked Area.    |
| #4  | Agents assigned to an Area work only at that Area's computers.                                     |
| #7  | Folder-to-Area mappings survive renaming an Area.                                                  |
| #10 | Name labels show on active agents and hide when they go idle.                                      |

All five live in the office UI, which the web version and the VS Code extension
share, so both get them.

## What carries over, and what doesn't

Everything you saved lives in `~/.pixel-agents/`, not in the program, so the fork
reads the same files the original wrote:

| File                    | Holds                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `layout.json`           | Your office layout: floor, walls, furniture, Areas (shared by web and VS Code) |
| `config.json`           | Settings, Directories, Area→folder mappings (`standalone` = web, `vscode`)     |
| `standalone-state.json` | Web agents (characters, palettes) and their seats                              |
| `vscode-state.json`     | The same for VS Code                                                           |
| `standalone-token`      | The web server's token, so your bookmarked `?token=` URL keeps working         |

**Agents.** Claude sessions running in your own terminals keep running, and the
fork picks their characters up again when it starts. Agents you started from the web page's **+** button are different:
their Claude process runs inside the web server, so stopping the server ends them.
Let them finish first. Afterwards resume one with `claude --resume` in a normal
terminal, or start a new one from the page.

## Part A: the web version (`npx pixel-agents`)

`npx pixel-agents` always downloads the **original** from npm, so it never runs
the fork. These steps replace it with your checkout.

### A0. Prerequisites

Node.js 22 (see `.nvmrc`; `package.json` requires `>=20`), npm and Git.

### A1. Get the fork checkout

```bash
git clone https://github.com/maxgerashenko/pixel-agents-office.git
cd pixel-agents-office
```

Already have an upstream checkout? Point it at the fork and keep upstream as a
second remote (commit or stash local changes first):

```bash
git remote rename origin upstream
git remote add origin https://github.com/maxgerashenko/pixel-agents-office.git
git fetch origin
git checkout -B main origin/main
git branch --set-upstream-to=origin/main main
```

### A2. Build

```bash
npm ci
npm run package
```

If the build fails, stop here; the original keeps running untouched.

### A3. Back up and record what you have

With the original still running:

```bash
cp -Rp ~/.pixel-agents ~/pixel-agents-backup-$(date +%Y%m%d-%H%M%S)
node scripts/fork-switch.mjs snapshot > /tmp/pixel-agents-before.json
cat /tmp/pixel-agents-before.json
```

`snapshot` prints the layout size, furniture count, Areas, Area mappings,
Directories and saved agents. You compare against it in A6.

### A4. Stop the original web server

Press Ctrl+C in the terminal running `npx pixel-agents`, or:

```bash
node scripts/fork-switch.mjs servers    # lists running servers: "web" and "vscode"
node scripts/fork-switch.mjs stop-web   # stops only the web ones, gracefully
```

This matters: a new launch **reuses** a web server that is already running (it
prints `Reusing existing standalone server`), so you would keep seeing the
original. `stop-web` never touches VS Code's server.

### A5. Start the fork

```bash
node dist/cli.js            # same flags as before: --port, --host, --allowed-host, --no-terminal
```

Or once, `npm link`, after which `pixel-agents` on your `PATH` is the fork. Don't
use `npx pixel-agents` any more, and don't run it from inside the checkout (npx
resolves the checkout itself and fails with `pixel-agents: not found`).

It prints the same `http://…/?token=…` URL as before, since the token is reused.
Open it.

### A6. Check that everything loaded

```bash
node scripts/fork-switch.mjs snapshot | diff /tmp/pixel-agents-before.json - && echo "all carried over"
```

Then in the browser: your layout and Areas are there, your agents show up, and
a working agent shows its name label without hovering (fork change #10).

### A7. If something is missing: restore

```bash
node scripts/fork-switch.mjs stop-web
cp -p ~/pixel-agents-backup-<stamp>/layout.json ~/pixel-agents-backup-<stamp>/config.json \
      ~/pixel-agents-backup-<stamp>/standalone-state.json ~/.pixel-agents/
node dist/cli.js
```

`node scripts/fork-switch.mjs snapshot ~/pixel-agents-backup-<stamp>` shows what a
backup holds before you copy it back. To go back to the original entirely, stop
the fork the same way and run `npx pixel-agents` again; the files are shared, so it
picks up where you left off.

### Updating the web version later

```bash
git pull origin main
npm ci
npm run package
node scripts/fork-switch.mjs stop-web
node dist/cli.js
```

## Part B: the VS Code extension

The fork keeps the extension ID `pablodelucca.pixel-agents`, so it installs over
the Marketplace build and reads the same `~/.pixel-agents/` files.

Prerequisites: VS Code `^1.105.0` with `code` on `PATH` (Command Palette →
_Shell Command: Install 'code' command in PATH_; for Cursor / VSCodium / Insiders
use `cursor`, `codium` or `code-insiders`). Get the checkout as in A1 and back up
as in A3, then:

```bash
npm ci
npx @vscode/vsce package --out pixel-agents-fork.vsix
code --install-extension pixel-agents-fork.vsix --force
```

`vsce package` runs `npm run package` first. Then run **Developer: Reload Window**.

- **Install over the top, don't uninstall first.** Uninstalling runs the
  `vscode:uninstall` hook (`adapters/vscode/uninstall.ts`), which removes the
  Claude Code hooks from `~/.claude/settings.json` and resets hooks consent.
- **Turn off Auto Update** for Pixel Agents (right-click it in the Extensions view)
  so a Marketplace update can't replace the fork.
- Check: `code --list-extensions --show-versions | grep -i pixel-agents`.

To update: `git pull origin main`, then the three commands above, then reload.

To go back: `code --uninstall-extension pablodelucca.pixel-agents && code --install-extension pablodelucca.pixel-agents`
(the uninstall removes the hooks; the Marketplace build asks for consent again).

## Pulling upstream changes into the fork

`git fetch upstream && git merge upstream/main`, then push to `origin` or open a
PR as usual.
