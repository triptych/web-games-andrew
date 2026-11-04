# Hearthwick — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-115/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every recipe, building, journal entry, upgrade and quest points at real things; no building asks for a material that comes later or loops back on itself; every item can be had; no journal cycles. **rules**: harvesting and regrowth, placing (water, bounds, overlap, clearing trees, the dock), construction, the builder limit and cancel, moving and demolishing, workers and gathering (caps, night), crafting queues and stock targets, cooking, a hero eating, sleeping, shopping and equipping, quests (dispatch, results, delivery, recall, the odds, auto), raids, upgrades, the journal and special folk, newcomers, the market and auto-sell, offline progress (equals the same time simulated by hand, capped, scaled). **determinism**: same seed and inputs → same town; a save round trip mid-game plays on identically. **bot**: whole campaigns on `SEEDS` seeds, through `act()`, to the dragon, with per-day invariants; prints the pace table. `ONLY=purity,data,rules,determinism,bot`, `SEEDS=n`, `DAYS=n`, `VERBOSE=1`. |
| `node game-115/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the title with a town behind it, New Town, real clicks gather from a tree, drag pans, the wheel zooms, the journal is claimed, Build → a Woodshed placed by a real click → it finishes, a click selects it and a villager is assigned, hotkeys, Space pauses and the clock stops, ☰ → Space on Resume → Save & Quit → Continue, an old save shows "welcome back", heroes hired and sent on a quest through the UI, the ending. **phones** (touch only, real CDP touches) at 390×844 and 844×390: touch gathers, a drag pans, a pinch zooms, the build sheet, dragging the ghost and tapping ✔, controls ≥ 44 px, no sideways scroll, the sheet leaves the town in view, pause stays open after the finger lifts. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`, `Q='&q=2'` (graphics). Screenshots in `dev/shots/`. |
| `node game-115/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. E.g. `"__hw.start(5); __hw.ff(3000); __hw.view.focus(17,13,0.7)"`. `Q='&q=2'` for the full-quality picture. |
| `node game-115/dev/shot.mjs [page] [name] [w h]` | Screenshots a dev page; by default [gallery.html](gallery.html): every building at every level, every hero class at three gear tiers, villagers, trees in four seasons, rocks and plants. `gallery.html?only=tavern,hall` for a few. |
| `node game-115/dev/preview.mjs` | Sets up a town with the debug hooks and writes the 1200×630 Garden preview to `garden/img/games/game-115.jpg`. |

The browser scripts need `playwright` and a static server on port 8115:

```bash
python3 -m http.server 8115          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-115/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second, so the browser tests open the game with `&q=0` (no post-processing) and wait on state, never on the clock; the town is fast-forwarded with `__hw.ff(seconds)`. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__hw`: `G` (the game), `mode` (title, play), `paused`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title), `act(cmd)` (the same command door the UI uses), `autoplay(on, skill)` (the bot plays the real game), `ff(seconds, withBot)` (run the sim ahead), `offline(seconds)` (the away-time catch-up), `setSpeed(1|2|4)`, `save()`, `hasSave()`, `loadSaved()`, `toTitle()`. `&q=0|1|2` picks the graphics level, `&demo=0` skips the town built behind the title, `&fast=N` runs N× simulation per frame; neither does anything without `debug=1`.
