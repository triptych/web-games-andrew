# Itch.io exporter

Build a standalone zip for any static game folder in this repo:

```bash
node dev/itch/export.mjs game-065
node dev/itch/export.mjs game-064 --name krakens-gambit
```

In Claude Code, `/export-itch game-065` runs this, checks the zip in a browser on its own, and lists the itch.io upload settings (`.claude/skills/export-itch/SKILL.md`).

The exporter writes to the game's ignored build folder:

- `game-NNN/dev/itch/<name>/` for local testing
- `game-NNN/dev/itch/<name>-itch.zip` for uploading to itch.io

What it does:

- copies the game folder, leaving out `dev/` and `game-plan.md`
- copies every file the game uses from the repo's `/lib` into `lib/` in the build and rewrites the paths: `<script src="../lib/page-audio.js">` in the page and ES module imports such as `'../../lib/kaplay/kaplay.mjs'` or Phaser's `phaser.esm.js`
- vendors three.js r165 import maps that point at unpkg, including only the add-ons the game imports
- hides the repo launcher link (`← Games` pointing at `../index.html`) with `display: none !important` instead of removing it, because some games' scripts look it up; a launcher link in running text is unwrapped to plain text
- creates a plain deflated zip with `index.html` at the top

It stops with an error if any path in the game's HTML, JS or CSS still leaves the game folder and is not under `/lib`, because that file would 404 on itch.io. It warns, and carries on, for script-built links to `../index.html` (game-043, game-051: a dead "Games list" button on itch.io) and for `../` paths to files that do not exist, which are usually comments.

Plain `<script src="https://...">` tags and Google Fonts are left alone: they still load from their CDN on itch.io. game-014 and game-072 load three.js r128 from cdnjs that way.

three.js is copied from the first of these that exists: `THREE_PKG`, `game-NNN/dev/package/`, or the repo's `dev/package/` (the one the smoke test uses). Otherwise the exporter downloads files from the CDN named in the game's import map. The local package must be the version the import map names. To avoid network access, fetch three.js once:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package && rm three-0.165.0.tgz
```

For itch.io, create an HTML project, upload the zip, and tick "This file will be played in the browser". Most games here also want "Mobile friendly" and the fullscreen button.
