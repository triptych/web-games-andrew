# The Kids Table — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-118/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: harvesting and recharge, moving, swapping, pair merges, the top tier, compost, serving, tables, refills, baskets, board lock. **content**: guests only ask for chains you have and tiers within reach, hints point at real cells, every goal is well formed and reachable, courses pay and the dinner wins. **determinism**: same seed and commands, same game; a save round trip plays on identically; time away recharges generators. **bot**: a skilled and a sloppy bot play whole games on `SEEDS` seeds with per-tick invariants and finish the Dinner Plan; the balance table is printed. `ONLY=purity,rules,content,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-118/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader), real input. **desktop**: title and back link, New Game, a click harvests, a mouse drag merges, click-then-click merges, the keyboard cursor, pause freezes the clock, Settings opens above Pause and Escape closes only it, serving by click and by drag, the compost bin, a new table brings a generator, the cookbook draws 24 icons, the shop, Save & Quit → Continue, the bot wins and the ending opens. **phones** (touch only, real CDP touches) at 390×844 and 844×390: the HUD fits and nothing covers the board's corners, tap harvests, a touch drag merges, tap-tap merges, tap serves, ❚❚ pauses and stays open, controls ≥ 44 px, no sideways scroll. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-118/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-118/dev/shot.mjs models.html models ["?only=turkey"]` | Screenshots the model gallery, [models.html](models.html): every dish and generator on a neutral background, a chain per row. Judge a model here before it goes under the game's lights. |
| `node game-118/dev/preview.mjs` | The 1200×630 Garden preview, to `garden/img/games/game-118.jpg`. |

The browser scripts need `playwright` and a static server on port 8118:

```bash
python3 -m http.server 8118          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-118/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second, so the tests wait on state, never on the clock, and click from the page or with raw mouse and touch events (Playwright's own `click()` waits for frames that never settle). A test that taps a sheet that pops in finishes the animation first. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__kt`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `board`, `start(seed)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot; opens the ending if it was won), `act(cmd)`, `place(cell, chain, tier|'gen')`, `set({coins, stars, ...})`, `cellClient(cell, y)` and `cardPoint(slot)` (screen positions for real input), `relayout()`, `save()`, `hasSave()`. `&fast=N` runs N× the sim clock; it does nothing without `debug=1`.
