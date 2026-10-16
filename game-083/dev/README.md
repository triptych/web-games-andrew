# WYRMZONE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-083/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **world**: the plain's obstacles agree between queries, the start is clear, `pushOut` works. **ground**: walking, turning, obstacles, the two-fireball limit, kills and the quota, every enemy's attack, grace after a hit, dying and continuing, the Dragonbane's volleys and summons, the ascent into flight. **flight**: keys and stick on the cursor, the body following it, fire converging on it, griffons, firebolts hurting and shot down, tower crystals and shafts, crashing into a tower, the gorge's chains (and that every one can be passed), missing and breaking the ward stone, winning, a second cycle. **determinism**: same seed and inputs → same game; a save round trip plays on identically, on foot and on the wing. **bot**: the bot plays whole games on `SEEDS` seeds at skill 1 and 0.6 with per-step invariants and prints the balance table. `ONLY=purity,world,ground,flight,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-083/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title, back link and attract demo; New Game; real keys walk, turn and breathe fire; a click captures the mouse for mouse look, its motion turns the dragon and steers the cross in flight, and letting it go pauses; pause freezes the sim; Space on a focused Resume button resumes; Save & Quit → Continue; the Dragonbane falls and the ascent leads into flight; the mouse moves the cross and a held click streams fire; dying and Continue; the ward stone and the homecoming; a second cycle. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, the deck, the stick walks, FIRE fires, in flight the stick aims and springs back, controls ≥ 44 px, no sideways scroll, the canvas matches the visible viewport, the pause sheet survives the lifting finger. **nostorage**: boots, plays and ends with `localStorage` throwing; with the pointer lock refused, real mouse moves turn the dragon. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-083/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8083:

```bash
python3 -m http.server 8083          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-083/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Under SwiftShader the phosphor trails look longer than on a GPU, because frames are slower than the decay assumes. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__wz`: `G` (the game), `mode`, `seen` (a count of every sim event drained during play), `view`, `ui`, `audio`, `input`, `start(seed, stage)` (skips the title; `stage` is an index or an id: `march1`…`march4`, `boss`, `sky`, `ramparts`, `gorge`), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `idle(seconds)` (run it ahead with no input), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
