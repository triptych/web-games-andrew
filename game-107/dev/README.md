# Kaiju Roll — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-107/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **city**: 40 generated cities (`SEEDS` seeds × 5 cities) fit their plate, have no overlapping buildings, sit inside blocks, start the monster on open ground, and a flood fill proves a ball of the starting radius reaches every building. **rules**: steering and the minimum speed, the sea wall, bouncing and crushing, floors and rubble, swallowing, the pounce and slam, shells and shields, tanks, helicopters, bombers, power-ups, dying and respawning, clearing a city, gifts, winning. **determinism**: same seed and inputs → same game; a save made in the middle of a fight (tank, helicopter, shells, bombs) plays on identically; unknown saves are refused. **bot**: whole five-city games at three skills with per-step invariants and a balance table (seconds and health lost per city). **chaos**: random steering and pounces in every city with the army forced on, checking invariants and that saves round trip. `ONLY=purity,city,rules,determinism,bot,chaos`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-107/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title with a bot rolling behind it, New Game → city card, Space on the focused Roll! button, real keys steer and pounce, the HUD, pause freezes the sim, Settings opens above Pause and its outline switch toggles the cel pass, Save & Quit → Continue, a flattened city shows the star sheet and three gifts, a gift unlocks Next city, the next city card, losing the last life shows Game over → Play Again. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck is on before the first city, the stick steers, POUNCE pounces, controls ≥ 44 px, the HUD fits, no sideways scroll, the canvas matches the visible viewport, the star sheet is usable. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-107/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-107/dev/shot.mjs [row] [theme]` | Screenshots [gallery.html](gallery.html), every procedural model on a neutral background (`row`: `kaiju`, `props`, `army`, `roofs`, `land`; `theme` 0-4). Judge a model here before judging it under fog and dusk lighting. |
| `node game-107/dev/preview.mjs [seed] [city] [seconds]` | The 1200×630 picture for the Garden's Library and share links: fast-forwards with the bot to a busy moment, hides the HUD, writes `dev/shots/preview.jpg`. Copy it to `garden/img/games/game-107.jpg`, then `ONLY=game-107 node dev/add-meta.mjs`. |

The browser scripts need `playwright` and a static server on port 8107:

```bash
python3 -m http.server 8107          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-107/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots, and look at them from more than one script (a z-fighting bug showed only in one).

## Debug hooks (`?debug=1`)

`window.__kr`: `G` (the game), `mode` (`title`, `play`, `over`), `seen` (a count of every sim event drained during play, not the title's attract mode), `view`, `ui`, `audio`, `input`, `start(seed, city)` (skips the title and the city card; `city` is 0-4), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot until the city is flattened), `next()` (leave the star sheet for the next city), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`. `view.debugCam = { x, y, z, lx, lz }` frees the camera for a top-down look.
