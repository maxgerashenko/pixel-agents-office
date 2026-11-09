---
name: prototyperag-office-sync
description: Keep the prototypeRAG repo's snapshot of the Pixel Agents office in step with the live office. Use after office layout, Area or label-to-Area changes, or when the user says agents were added, renamed or removed in prototypeRAG ("agents changed in prototypeRAG"). Checks the office for unmapped or orphaned labels, saves the office into prototypeRAG, and gives the user the follow-up for that repo.
---

# Office ↔ prototypeRAG snapshot

Live source of truth: `~/.pixel-agents/` (`layout.json` for floor, furniture and Areas;
`config.json` for `directories` and `standalone.areaMappings`, label → Area). The snapshot
lives in `~/Documents/GitHub/prototypeRAG/.claude/pixel-agents/` (`layout.json`,
`office.json`) and is written by `prototypeRAG/.claude/tools/pixel_office.py`. The server
rewrites its files while running, so **never edit `~/.pixel-agents/` by hand**; follow
`docs/office-control-rules.md`.

## Entry A: agents changed in prototypeRAG (hand-off)

1. `scripts/office.sh status`. Office must be healthy.
2. Read-only check. Labels in the office have no Area mapping, or mappings point at labels
   that no longer exist:

   ```bash
   node -e '
   const h=process.env.HOME+"/.pixel-agents/";
   const live=new Set(require(h+"standalone-state.json").agents.map(a=>a.directoryName));
   const map=require(h+"config.json").standalone.areaMappings||{};
   console.log("unmapped:",[...live].filter(l=>!map[l]));
   console.log("orphaned:",Object.keys(map).filter(l=>!live.has(l)));'
   ```

3. Report both lists. Unmapped new labels (`Agent_<name>`) are placed by the user in the
   office page (drag into an Area); orphaned entries are old names from a rename. Removing
   orphans is a `config.json` edit, so it needs the server stopped: only with the user's
   OK, via `scripts/office.sh off`, edit, `scripts/office.sh on`. Otherwise leave them
   (harmless).
4. Once the user has mapped the labels, continue with Entry B.

## Entry B: layout, Areas or mappings changed

1. `scripts/office.sh status`; note the `state:` line.
2. Save into prototypeRAG (writes only inside that repo's `.claude/pixel-agents/`):

   ```bash
   cd ~/Documents/GitHub/prototypeRAG && python3 .claude/tools/pixel_office.py save
   git -C ~/Documents/GitHub/prototypeRAG diff --stat -- .claude/pixel-agents
   ```

3. Summarise what changed (Areas, furniture count, mapping keys added or removed from
   `office.json`). An empty diff means the snapshot was already current.
4. Do not commit in prototypeRAG unless asked. Give the user this block, filled in:

> **Next, in prototypeRAG** (`~/Documents/GitHub/prototypeRAG`):
>
> 1. `git status`: expect only `.claude/pixel-agents/layout.json` and `office.json`
>    (other uncommitted files there belong to other work; don't mix them in).
> 2. Commit those two files with a message saying what changed in the office and why
>    (file by file). **No** `Co-Authored-By` trailer in that repo.
> 3. Push or open the PR with its usual flow.

## Restoring (repo → office)

Only on a new machine or a lost `~/.pixel-agents/`. Ask first. `pixel_office.py restore`
copies the files back **and kickstarts launchd itself**, which skips the backup this
repo's rules require. So: `scripts/office.sh backup`, then `restore`, then
`scripts/office.sh restart` and compare the `state:` line. Say that the kickstart already
happened.

## Never

Print the token, `kill` the server, start a second one, or edit `~/.pixel-agents/` while
it runs.
