# Itch.io exporter

Build a standalone zip for any static game folder in this repo:

```bash
node dev/itch/export.mjs game-065
node dev/itch/export.mjs game-064 --name krakens-gambit
```

The exporter writes to the game's ignored build folder:

- `game-NNN/dev/itch/<name>/` for local testing
- `game-NNN/dev/itch/<name>-itch.zip` for uploading to itch.io

What it does:

- copies the game folder, leaving out `dev/` and `game-plan.md`
- copies referenced `../lib/*.js` files into the build
- vendors three.js r165 import maps that point at unpkg, including only the add-ons the game imports
- removes the repo launcher link (`#games-link` or `#back-link` pointing at `../index.html`)
- creates a plain deflated zip with `index.html` at the top

If `game-NNN/dev/package/` exists, three.js is copied from there. Otherwise the exporter downloads files from the CDN named in the game's import map. To avoid network access, fetch three.js once:

```bash
cd game-065/dev
npm pack three@0.165.0
tar xzf three-0.165.0.tgz
```

For itch.io, create an HTML project, upload the zip, and tick "This file will be played in the browser". Most games here also want "Mobile friendly" and the fullscreen button.
