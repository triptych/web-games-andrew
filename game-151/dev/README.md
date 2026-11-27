# One Shot — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-151/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **board**: 200 fresh boards with no runs and a move, runs, specials (4 → line, 5 → nova, L → cross), blasts, static, gravity, shuffles. **rules**: swaps, queued swaps, charge and its multipliers, shields, escorts, leaks, missiles, rounds cleared and timed out, routing, the final window, FIRE, the ratios and grades, rewards, replays, unlocks, retry, the desperate shot, shifting barriers, jammers, the hangar. **determinism**: seeds; a mid-round save round trip. **bot**: whole campaigns at skill 1 and 0.6 over `SEEDS` seeds with per-step invariants and asserted bands. `ONLY=purity,board,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-151/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game, the hangar tabs, a briefing and Escape out of it, Launch, a swap by a real mouse drag, a swap by arrows + Space, the Meshy models loaded, clips decoded and music playing, pause freezing the sim, Settings over Pause closing with Escape from a focused slider, rounds with routes picked by click, F fires, the readouts, Skip, the grade, the hangar showing it, Save & Quit, Continue. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, the board, gauges and pause button on screen and finger-sized (and nothing covering the pause button), a swap by a finger swipe, the pause sheet staying open, FIRE by tap. **nostorage**. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-151/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=4'` adds URL parameters; `AFTER="js"` runs a second snippet just before the shot. |
| `node game-151/dev/shot.mjs models` | Screenshots [models.html](models.html): every Meshy model in the game's toon shading, from the side and from where the player sees it, to check which way each one faces (`YAW` in `js/view/view.js`). |
| `meshy/`, `art/`, `audio/` | The media pipelines and what was generated: see [meshy/README.md](meshy/README.md), [art/README.md](art/README.md), [audio/README.md](audio/README.md). |

The browser scripts need `playwright` and a static server on port 8151:

```bash
python3 -m http.server 8151          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-151/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root);
the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with
`&fast=4`, fast-forward rounds with `__os.ff()` and wait on state, never on the clock. The view's beam follows the
sim's clock for the same reason. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__os`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`,
`board` (the board view: `cursor`, `sel`), `start(seed, level, launch)` (a fresh game straight into a briefing, or
launched), `act(cmd)` (any command the UI sends), `autoplay(on, skill)` (the bot plays the real game, hangar
included), `ff(seconds, skill)` (the sim runs ahead with the bot, stopping at a round's end), `save()`, `hasSave()`,
`syncScreens()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
