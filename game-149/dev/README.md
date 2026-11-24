# Hurray LA's Fairy Lamp Adventure — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-149/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: moving, walls, pickups, the dash, the round ending. **determinism**: same seed and inputs → same game; a save round trip plays on identically. **bot**: the bot plays whole rounds on `SEEDS` seeds with per-step invariants and prints the balance table. `ONLY=purity,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-149/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game, real keys move and dash, pause freezes the sim, Save & Quit → Continue, the round ends, Play Again. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, the touch deck, the stick moves, A dashes, controls ≥ 44 px, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-149/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8149:

```bash
python3 -m http.server 8149          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-149/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__hla`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
