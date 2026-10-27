# STARSLING — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-102/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **physics**: every sector's stack stands still even when forced awake and nothing breaks under its own weight; boxes fall, rest, stack, slide and roll; bodies sleep and wake. **rules**: aiming limits, firing, `predict()` against the real arc, black holes, all four specials, damage by material, chain explosions, the void, winning and losing. **determinism**: same seed and inputs → same game; a save round trip in mid-flight plays on identically (the contact cache is saved). **bot**: a perfect bot (plays each shot out on a copy of the game first) must clear every sector; a mortal bot plays `SEEDS` rounds of each, with per-step invariants, and the balance table prints. `ONLY=purity,physics,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-102/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, the sector list (only sector 1 open), New Game, real arrow keys turn the aim, a real mouse drag sets angle and power under the pointer and lets go to fire, Space fires and uses the special, Escape pauses, Space presses the focused Resume, Save & Quit → Continue, a lost sector → Retry, a won sector records stars and Next Sector starts the next. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, the touch deck is on before the first shot, a touch drag sets the aim exactly under the finger and lifting fires, a tap in flight uses the special, the deck button fires, controls ≥ 44 px, the HUD fits, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-102/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8102:

```bash
python3 -m http.server 8102          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-102/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ss`: `G` (the game), `mode`, `progress` (stars per sector), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, level)` (skips the title; level is 0-based), `autoplay(on)` (a mortal bot plays the real game), `ff(seconds)` (run the sim ahead with a mortal bot), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.

Handy: `view.worldToScreen(x, y)` and `view.screenToWorld(px, py)` map through the live camera, which is how the browser test puts a real finger exactly on the sling.
