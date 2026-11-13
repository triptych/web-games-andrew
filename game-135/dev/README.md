# Hard Hat Harbor — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-135/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every job, step, giver and vehicle refers to something real; every job can be unlocked. **rules**: driving, walls, the river and the bridge, swapping, and each of the eight kinds of work. **determinism**: same seed and inputs → same game; a save in the middle of each kind of work plays on identically. **proofs**: debris placement over 60 seeds; every work point can be driven to, and the east bank cannot be without the bridge. **bot**: the bot finishes the whole game on `SEEDS` seeds at skills 1, 0.6 and 0.2 with per-step invariants, prints the balance table and asserts its bands. `ONLY=purity,data,rules,determinism,proofs,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-135/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the whole flow by real keys (see the file's header), all 14 models, the voice and effect clips, music playing, sound on the master bus. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through every screen, the stick drives, the red button honks, the toy box swaps, controls ≥ 44 px, nothing on the HUD overlaps, no sideways scroll, the crane meter fits. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-135/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=4&q=low'` adds URL parameters; `PAGE=dev/gallery.html` opens another page. |
| `dev/gallery.html` (`?set=veh` or `?set=bld`) | Every Meshy model on neutral grey with a red arrow for the way the game thinks it faces. A nose or front door off the arrow means `YAW` (`js/view/vehicles.js`) or `BYAW` (`js/view/town.js`) is wrong. |
| `node game-135/dev/preview.mjs` | The 1200×630 preview picture for the Garden (`garden/img/games/game-135.jpg`). |
| `dev/art/`, `dev/audio/`, `dev/assets/` | How the pictures, the sound and the models were made: prompts, scripts and a README each. |

The browser scripts need `playwright` and a static server on port 8135:

```bash
python3 -m http.server 8135          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-135/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second, so the tests open the game with `&fast=4&q=low` and wait on state, never on the clock. Passing tests don't mean the screen looks right: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__hh`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view` (`view.info.models` load counts, `view.screenOf(x, y, h)`), `ui`, `audio` (`level()`, `musicPlaying`, `voicePlaying`, `played`), `input`, `pend`, `prompt()` (the hint line), `start(seed)` (skips the title and the welcome), `autoplay(on, skill)` (the bot plays the real game; thank-you screens become toasts), `ff(seconds, until)` (run the sim ahead with the bot, stopping when `until(G)` is true), `cmd({veh, job})`, `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame (only with `debug=1`); `&q=low` turns off shadows and antialiasing; `&models=0` keeps the code-built stand-ins.
