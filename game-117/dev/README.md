# PERIHELION — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-117/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **world**: on 40 seeds of all eight asteroids, every cube-sphere cell has four distinct symmetric neighbours and is found again by `cellOf()`, every cell is reachable, beacons and the gate sit in distinct cells at least 3 and 4 cells of maze from the start, and no cell centre is inside a wall. **rules**: walking keeps you on the sphere at `PLAYER.speed`, a straight lap comes home with the same heading (parallel transport), walls stop you, bolts stay on their great circle and spark on walls, beacons fall and open the gate, the gate warps to the next asteroid, hurt / dash / death / respawn / game over, Cadet lives, pickups, a drone hunting through the maze, the boss's pylon shield and the win. **determinism**: same seed and inputs → same game; a save round trip rebuilds the asteroid and plays on identically; an unknown save version is rejected. **bot**: whole campaigns on `SEEDS` seeds at skill 1 and 0.6 with per-step invariants, and the balance table. `ONLY=purity,world,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-117/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader), opened with `&q=0`. **desktop**: title, back link and logo, New Mission, W walks, Escape pauses and freezes the sim, Settings opens on top of the pause menu, Space on the focused Resume resumes without also dashing, an arrow tap fires, the mouse aims and its button fires, Space dashes, ❚❚ pauses, Save & Quit → Continue rebuilds the mission, losing the last life shows the end screen, New Mission again. **phones** (touch only, real CDP touches) at 390×844 and 844×390: the deck, the left stick walks, the right stick aims and fires, DASH, controls ≥ 44 px and on screen, the HUD clears the back link, the pause screen survives the finger lifting. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-117/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&q=1'` adds URL parameters. |
| `node game-117/dev/preview.mjs` | The 1200×630 Garden preview: a firefight by a beacon on asteroid IV, to `garden/img/games/game-117.jpg`. |

The browser scripts need `playwright` and a static server on port 8117:

```bash
python3 -m http.server 8117          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-117/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws about 2 frames a second here on low graphics and well under 1 on high, and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4&q=0` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ph`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, level)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `skipIntro()`, `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame and `&q=0|1|2` forces the graphics setting; both do nothing without `debug=1`.
