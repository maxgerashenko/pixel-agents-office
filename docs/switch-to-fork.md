# Switching from upstream Pixel Agents to this fork

This repository (`maxgerashenko/pixel-agents-office`) is a fork of
[`pixel-agents-hq/pixel-agents`](https://github.com/pixel-agents-hq/pixel-agents).
It keeps the same extension ID (`pablodelucca.pixel-agents`) and npm package name
(`pixel-agents`), so the fork **replaces** the original in place: your layout,
seats, settings and hook consent under `~/.pixel-agents/` carry over untouched.

There is no published build of the fork. You build it from a local checkout and
install the result. Claude Code can do all of this for you: open Claude in the
fork checkout and say **"switch me to my fork"** (the `switch-to-fork` project
skill follows this document).

## What the fork adds over upstream

| PR  | Change                                                                                             |
| --- | -------------------------------------------------------------------------------------------------- |
| #8  | Working agents sit only at computer seats (a PC/monitor desk; a bench or sofa facing a PC counts). |
| #5  | Idle agents rest on benches and sofas away from computers, and never wander into a marked Area.    |
| #4  | Agents assigned to an Area work only at that Area's computers.                                     |
| #7  | Folder-to-Area mappings survive renaming an Area.                                                  |
| #10 | Name labels show on active agents and hide when they go idle.                                      |

## 0. Prerequisites

- Node.js 22 (see `.nvmrc`; `package.json` requires `>=20`) and npm.
- VS Code `^1.105.0` with the `code` command on `PATH`
  (Command Palette → _Shell Command: Install 'code' command in PATH_).
  For Cursor / VSCodium / Insiders use `cursor`, `codium` or `code-insiders` instead of `code`.
- Git.

## 1. Get the fork checkout

**No checkout yet:**

```bash
git clone https://github.com/maxgerashenko/pixel-agents-office.git
cd pixel-agents-office
```

**Already have an upstream checkout** (remote points at `pixel-agents-hq/pixel-agents`):
keep upstream as a second remote so you can still pull its changes.

```bash
cd <your pixel-agents checkout>
git remote -v                      # check what origin points at
git remote rename origin upstream
git remote add origin https://github.com/maxgerashenko/pixel-agents-office.git
git fetch origin
git checkout -B main origin/main
git branch --set-upstream-to=origin/main main
```

Commit or stash local changes before `checkout -B`, which resets `main` to the fork.

## 2. Build and package the VS Code extension

```bash
npm ci
npx @vscode/vsce package --out pixel-agents-fork.vsix
```

`vsce package` runs the `vscode:prepublish` script (`npm run package`), which
regenerates the protocol bindings, type-checks, lints, bundles with esbuild and
builds the webview. `*.vsix` is git-ignored. If the build fails, stop and fix it;
don't install a stale `.vsix`.

## 3. Install it over the original

Close other VS Code windows that use Pixel Agents if you can, then:

```bash
code --install-extension pixel-agents-fork.vsix --force
```

Then in VS Code run **Developer: Reload Window**.

Install over the top, don't uninstall first. Uninstalling runs the
`vscode:uninstall` hook (`adapters/vscode/uninstall.ts`), which removes the
Claude Code hooks from `~/.claude/settings.json` and resets hooks consent, so the
fork would ask for consent again. That is harmless but unnecessary.

### Stop the Marketplace from switching you back

The fork has the same extension ID as the Marketplace build, so a Marketplace
update could replace it. In the Extensions view, right-click **Pixel Agents** and
make sure **Auto Update** is unchecked for it. (VS Code normally leaves
VSIX-installed extensions alone, but check.)

## 4. Verify

```bash
code --list-extensions --show-versions | grep -i pixel-agents
```

Then open the Pixel Agents panel and check a fork-only behaviour: start an
agent, and its name label should be visible while it works and disappear when
it goes idle (#10).

## 5. Standalone CLI (`npx pixel-agents`), only if you use it

`npx pixel-agents` downloads the **upstream** npm package, so it never runs the
fork. Use the checkout instead:

```bash
npm uninstall -g pixel-agents      # only if you installed upstream globally
npm run package                    # if you skipped step 2
npm link                           # puts the fork's `pixel-agents` on PATH
pixel-agents --port 3100
```

Without `npm link`, run `node dist/cli.js --port 3100` from the checkout.
If a standalone server is already running, stop it first so the new one isn't
reused.

## Updating later

```bash
git pull origin main
npm ci
npx @vscode/vsce package --out pixel-agents-fork.vsix
code --install-extension pixel-agents-fork.vsix --force
```

then **Developer: Reload Window**. `npm link` follows the checkout, so the
standalone CLI only needs `npm run package`.

To pull upstream changes into the fork: `git fetch upstream && git merge upstream/main`,
then push to `origin` (or open a PR) as usual.

## Going back to the original

```bash
code --uninstall-extension pablodelucca.pixel-agents
code --install-extension pablodelucca.pixel-agents
npm unlink -g pixel-agents         # if you linked the standalone CLI
```

The uninstall step removes the Claude Code hooks; the reinstalled Marketplace
build asks for consent again on first run.
