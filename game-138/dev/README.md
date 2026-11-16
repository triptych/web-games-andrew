# Lanternhollow — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-138/dev/simtest.mjs` | Headless, in Node. **purity** (`js/sim/`, `js/rng.js`, `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock), **tiles** (rotations, edges, a symmetric compatibility table), **wfc** (every adjacency of every collapse matches; pins; a 0 slider grows none), **gen** (`SEEDS` seeds × 3 sizes × 1–5 levels: stairs line up, everything reachable, sized, never the fallback; sliders; painted pins), **features** (never block the way, every friend and hoard reachable, 0 places nothing, stamps and erasures, a blocking stamp refused), **share** (round trips, hostile links), **walker** (walls, water, stairs, friends, treasure), **determinism** (same params → same dungeon; a mid-walk save round trip), **bot** (the explorer walks whole dungeons with the real collision and finds everything; prints a table). `ONLY=…`, `SEEDS=n` (default 30), `VERBOSE=1`. |
| `node game-138/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: welcome, the hash is the dungeon, all 17 models load, a real click on the dice, keys 2/PgUp, a slider and a theme chip rebuild, a real click on the canvas paints a well and places a cauldron, Tidy, Ctrl+Z, the share link opened in a second tab is the same dungeon, Escape with a slider focused, Space on a focused button, W walks, the tour finds everything, Esc returns. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps, controls ≥ 44 px and on screen, the depth rail, the stick walks, the look pad turns. **nostorage**. **shared**: a link greets you and is honoured. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage,shared`. Screenshots in `dev/shots/`. |
| `node game-138/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the builder with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&models=0'` adds URL parameters, `H='#s=…'` opens a share link, `DPR=2` for a sharp picture. |
| `node game-138/dev/preview.mjs` | The 1200×630 picture for the Garden's library (`garden/img/games/game-138.jpg`). |
| `dev/assets/` | The Meshy pipeline: `prompts.mjs`, `meshy-batch.mjs`, `opt.mjs` (see [assets/README.md](assets/README.md)). |

The browser scripts need `playwright` and a static server on port 8138:

```bash
python3 -m http.server 8138          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-138/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. SwiftShader draws a frame every second or so with parallax on everything: the tests wait on state, never on the clock, and two browsers at once starve each other (run one at a time). Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__lh`: `G`, `mode` (`build`/`walk`), `cur` (the level shown), `bot`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `apply(fn)` (change the params as the workbench does, with undo), `setLevel(k)`, `startWalk(tour)`, `leaveWalk()`, `doUndo()`, `undoDepth()`, `shareUrl()`, `ff(seconds)` (the explorer bot walks ahead synchronously), `screenOf(mx, my, y)` (the screen point of a micro cell, for real clicks). `&fast=N` runs N× the walk per frame. `?models=0` keeps the code-built stand-ins.
