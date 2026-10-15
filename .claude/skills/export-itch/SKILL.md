---
name: export-itch
description: Package a game from the web-games-andrew repo as a standalone zip for itch.io (or any static host), then check that the zip runs on its own. Use whenever the user wants to export, package, zip, ship, release or upload a game to itch.io, says "make an itch build of game-065", "zip up Worldroot for itch", "export game-04x", or asks for a standalone/offline/self-contained copy of a game, even if they don't say "itch".
---

# export-itch

Turn one game folder into a zip that runs anywhere, with `index.html` at the top,
nothing reaching back into the repo, and the "← Games" launcher link hidden.

**Arguments:** `$ARGUMENTS` (one or more games, as `game-NNN` or a title, and an optional `--name <slug>`)

The work is done by `dev/itch/export.mjs` (plain Node 18+, no dependencies). Read
`dev/itch/README.md` for exactly what it rewrites. This skill is how to run it,
read what it says, check the result and hand it over.

If the checkout has no `dev/itch/export.mjs` (an older branch), use the copy that
ships with this skill, `scripts/export.mjs` next to this file. Run it from the repo
root the same way; it finds the repo from the game folder.

All paths are relative to the repo root (`git rev-parse --show-toplevel`).

---

## Step 1: Find the game

- `game-NNN` → use it. Check `game-NNN/index.html` exists.
- A title → match it against the `<title>` tags or the table in `README.md`:
  `grep -il "<title>.*worldroot" game-*/index.html`. Ask only if nothing or more than one matches.
- Several games → export each one in turn; the steps are the same.

The zip is named from the page `<title>` (`Emberleaf — The Lantern Library` →
`emberleaf-the-lantern-library-itch.zip`). Pass `--name` when the user gave a
name, or when the title is long and a short slug reads better on itch.io.

## Step 2: Make sure three.js can be vendored

Only for games with a three.js import map (`grep -q '"three"' game-NNN/index.html`).
Every one of them uses r165 from unpkg. The exporter takes three.js from the first of
`THREE_PKG`, `game-NNN/dev/package/` or `dev/package/`, and otherwise downloads it.

If none of those exist and there may be no network to unpkg (a cloud session
usually has none), fetch it once through npm, which goes through the proxy:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package && rm three-0.165.0.tgz
```

`dev/package/` is gitignored and the smoke test uses it too, so leave it there.

## Step 3: Run the exporter

```bash
node dev/itch/export.mjs game-NNN [--name slug]
```

It writes `game-NNN/dev/itch/<name>/` (the unzipped build) and
`game-NNN/dev/itch/<name>-itch.zip`. Both are gitignored: **never commit a build**.
(`dist/game-019*` is an old hand-made export; don't add to it.)

Read every line it prints:

| Output | Meaning | What to do |
|---|---|---|
| `shared: page-audio.js, kaplay/kaplay.mjs` | Files copied from `/lib` | Nothing |
| `three.js: ... + N add-on files` | Vendored three.js | Nothing |
| `warning: ... links to ../index.html` | A script builds a "Games list" link or button that is dead on itch.io (game-043, game-051) | Tell the user. Don't edit the game unless they ask |
| `warning: ... which does not exist (a comment?)` | A `../` path in a comment or a dead reference | Look at the line. A comment is fine; a real missing file is a bug in the game, so tell the user |
| `Error: ... points outside the game folder` | The game uses a repo file the exporter doesn't vendor yet | Extend `vendorRepoFiles` in `dev/itch/export.mjs` so it handles that kind of file for every game, then rerun. Don't hand-patch the build or the game |
| `Error: ... imports X: not handled` | A three.js add-on imports something other than `three` or a relative path | Extend `vendorThree` the same way |
| `Error: ... No network?` | unpkg unreachable and no local three.js | Step 2 |
| `Error: ... is three X, but the game imports three Y` | Wrong local package | `npm pack three@Y` into `THREE_PKG` instead |

If you changed the exporter, rerun it on two or three other games of different kinds
(a Kaplay game like game-004, a Phaser game like game-019, a three.js game like
game-065, a plain canvas game like game-001) and confirm they still build.

## Step 4: Check the zip runs on its own

A build can pass the exporter and still be broken. Serve the **unzipped zip in its
own folder**, never from the repo root, so any path that leaks out of the game
404s the way it would on itch.io. Linux paths are case-sensitive like itch.io's
servers, so a `Sprite.png` vs `sprite.png` mismatch that works on Windows also
shows up here.

1. Unzip to a fresh folder in your scratchpad (this also proves the zip is valid):
   `python3 -I -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; z.extractall(sys.argv[2])" <zip> <dir>`
2. Serve it: `python3 -m http.server 8765 -d <dir>` (in the background).
3. Load `http://127.0.0.1:8765/index.html` in Playwright Chromium (see
   `dev/README.md` for linking Playwright in), wait a couple of seconds, click the
   middle of the screen and press Enter, then collect:
   - console errors and page errors,
   - failed requests and 4xx/5xx responses **from the local server** (requests to
     Google Fonts or cdnjs failing because the sandbox has no network are not the
     build's fault, but report them),
   - `getComputedStyle` of every `[data-itch-hidden]` element, which must be `none`,
   - a screenshot. Look at it.
4. Stop the server.

Any local 404 or page error is a failed export: fix the cause (Step 3) and rerun.

Also check itch.io's HTML limits on the unzipped build: at most 1,000 files and
500 MB in total. The exporter prints the file count and size. If a build is close,
tell the user rather than deleting game files.

## Step 5: Hand it over

Tell the user:

- the zip path (`game-NNN/dev/itch/<name>-itch.zip`), its size and file count; in a
  cloud session, send the zip to them as a file, because the build folder is not
  committed and the container goes away;
- any warnings from Step 3 and anything odd from Step 4;
- which CDN files the game still loads at run time (Google Fonts; three.js r128 from
  cdnjs in game-014 and game-072), since those need the player to be online;
- the itch.io upload settings:
  - Kind of project: **HTML**; upload the zip and tick **This file will be played in the browser**
  - Embed: a size such as 1280 × 720 (the games fill whatever they are given), **Mobile friendly**, **Fullscreen button**
  - Saves use `localStorage`. itch.io serves the game from its own domain inside an iframe, so a browser that blocks third-party storage can stop saves; every game should still run (`NOSTORAGE=1 node dev/smoketest.mjs` checks that).

Only commit if you changed the exporter or its docs. Never commit the zip or the build folder.
