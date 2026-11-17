# Repo-level dev harness

Plain Node scripts, no build step, no test framework. Each newer game (037+) has its own `game-NNN/dev/` harness that plays the game properly. This folder holds checks that apply to **every** game.

| Command (from the repo root) | What it does |
|---|---|
| `node dev/smoketest.mjs` | Loads every game in real Chromium, at 1280×760 and on a touch-only 390×844 phone. It clicks or taps, presses Enter, Space, the arrows and WASD, and takes screenshots. A game fails on any console error, page error, failed request or HTTP error, if its `← Games` link is missing, off screen or covered, or if on the phone the page scrolls sideways or a canvas is clipped. |
| `NOSTORAGE=1 node dev/smoketest.mjs` | The same, with every `localStorage` access throwing a `SecurityError`, as it does when a browser blocks site data. A game must still boot and play; it just can't save. |
| `node dev/screenshots.mjs` | Takes a 1200×630 picture of every game (`ONLY=`, `FROM=`/`TO=`, `SHOT=title` work) into `garden/img/games/<game>.jpg`. The Garden's Library shows them, and share links use them. Serves the repo itself; needs `playwright`. |
| `node dev/add-meta.mjs` | Writes the description, canonical, Open Graph and Twitter card tags into each game's `index.html` (between `share-meta` comments, safe to re-run), pointing at those pictures. Titles and blurbs come from `js/gamedata.js`. Run it, and the screenshots, for each new game. |
| `python3 dev/make-icons.py` then `node dev/add-pwa.mjs` | Makes every game installable from the browser and gives it its favicon. Each game's icon is painted with fal (`fal-ai/nano-banana-2`, 1:1) from the style prompt and the game's subject in [`game-icons.json`](game-icons.json); add the new game's subject there, paint it, and save the painting as `game-NNN.png` in a folder. `python3 dev/make-icons.py --src that-folder` crops it full-bleed and writes `game-NNN/icons/icon-512.png`, `icon-192.png`, `icon-180.png`, `icon-96.png` (the launchers) and `favicon-32.png` (needs Pillow); without `--src` it re-derives the sizes from `icon-512.png`, or falls back to the Garden picture for a game with no painting. The second writes `game-NNN/manifest.webmanifest` and a block in each `index.html` (between `pwa` comments, safe to re-run) that links the favicon and the manifest and loads [`lib/pwa.js`](../lib/pwa.js), which registers the shared worker [`sw.js`](../sw.js) for the game's folder and offers an Install pill when the browser allows it. game-037 has its own manifest and worker and is skipped. Run both, after the screenshots, for each new game. |
| `node dev/make-updates.mjs` | Writes [`js/updates.json`](../js/updates.json): when each game was added and when its version in `js/gamedata.js` last changed, from the git history (first parent, so on `main` it is the day the change was merged). Pocket Garden's **Recently Updated** menu reads it. The Pages deploy runs it on every push to `main`, so there's no need to run it by hand; the committed copy is only for local servers. `--check` prints the 15 most recent. Needs the full history: in a shallow clone, `git fetch --unshallow --filter=blob:none origin` first. |
| `node dev/itch/export.mjs game-065` | Builds a standalone itch.io zip for a game. It copies the game, vendors the `/lib` files it uses and its three.js import-map dependencies, hides the repo launcher link, and writes `game-NNN/dev/itch/<name>-itch.zip`. See `dev/itch/README.md`. |

Options: `ONLY=game-001,game-016` runs only those games. `FROM=game-001 TO=game-036` runs a range. `VIEWS=desktop` or `VIEWS=phone` runs one size. `OUT` sets the screenshot folder (default `dev/shots/`). `BASE` sets the server (default `http://127.0.0.1:8000`).

It needs `playwright` and a static server:

```bash
python3 -m http.server 8000          # from the repo root, in another terminal
node dev/smoketest.mjs
```

Playwright installed globally? ESM ignores `NODE_PATH`, so link it in once with `mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright`.

No network to the CDNs? Several three.js games load r165 from unpkg or jsDelivr, and game-014 loads r128 from cdnjs. Fetch the packages once and the harness serves those requests from disk:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package
npm pack three@0.128.0 && tar xzf three-0.128.0.tgz && mv package dev/package-r128
```

Google Fonts requests are answered with an empty stylesheet, because every game falls back to a system font.

The smoke test is a floor, not a playtest. It catches a game that crashes on boot or on its first input, a 404 on an asset, a broken way back to the launcher, and a layout that does not fit a phone. It does not check that a game is fun or winnable.
