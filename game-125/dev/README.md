# SEEDFALL — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-125/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every research cost is earnable by the generation that can first research it, no research cycles, every blueprint exists, every creature and genome lives somewhere, every line of story is well-formed, every ending and black box is written. **station**: a flood fill over the walker's own `fits()` rule reaches every room and terminal; the real walker walks from the Wake Bay to the Holo-table. **rules**: the dialogue holds the world still, landing gates, gathering and samples, strikes, hazards, death and repair, lift-off, battery, splicing (sequencing, synergy, vats), release (every metric improves, repeats work less, fit), research, fabrication, upgrade caps, harvesters, stock caps, colonies, the clock, all four endings, the Rootmother and the Purge/Concord choice. **zones**: 60 seeds × 6 zones, every node and black box reachable from the beacon; a terraformed zone spawns fewer creatures and hazards and more plants. **determinism**: same seed, same year; save round trips mid-mission and mid-sentence play on identically. **fuzz**: 8 × 1500 random commands with invariants, then the bot must finish each year. **bot**: whole years by a perfect, a clumsy and a lazy bot; balance table. `ONLY=purity,data,station,rules,zones,determinism,fuzz,bot`, `SEEDS=n`, `VERBOSE=1`. About two minutes. |
| `node game-125/dev/year.mjs [seed] [skill]` | One bot year with a month-by-month log (generation, Eden, resources, drops, zones) and every milestone. `V=1` logs every drop. For balance work. |
| `node game-125/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, the wake-up scene with real keys (a press finishes the typing first), walking with W, the Holo-table by E after TILLY's scene, Escape closes it, pause stops the clock, the Hangar's drop button, driving, striking and gathering with real keys, lift-off on the beacon, the report closed by Space on its focused button, splicing and releasing by click, research by click, Escape closing Settings with a slider focused, Save & Quit → Continue, the bot playing out the year to an ending. Pixels are read back: the title and the Meadow must not be blank. **phones** (touch only, real CDP touches) at 390×844 and 844×390: tapping through the intro, the stick, the look pad, the Use button, a terminal that fits, dropping, ⚔, held ⛏, ☰ that stays open after the finger lifts, 44 px controls, no sideways scroll, the canvas matching the viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. |
| `node game-125/dev/shots.mjs` | One browser, many moments: every room, the dialogue, four terminals, all six zones (and a healed Meadow). `ONLY=meadow,hangar`, `W=390 H=844 TOUCH=1`. Writes `dev/shots/s-*.png`. |
| `node game-125/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-125/dev/preview.mjs` | The 1200×630 picture for the Garden's Library and share links: a healing Meadow with creatures, flowers and the bot's arms. Writes `dev/shots/preview-*.png`; copy the best to `garden/img/games/game-125.jpg`. |
| `dev/sprites.html` | Every sprite (TILLY's five moods, six bots, 23 genomes, the Rootmother, nodes, scenery, harvesters, colonies, sleepers) on a neutral ground. `?s=4` for a bigger scale. |

The browser scripts need `playwright` and a static server on port 8125:

```bash
python3 -m http.server 8125          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-125/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a frame or two a second, so the browser test opens the game with `&fast=4&q=low` (no post chain) and waits on state, never on the clock. The shots use the full post chain. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__sf`: `G` (the game; assignable), `mode` (title, play, over), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)`, `skipTalk()` (advances dialogue up to a choice), `act(cmd)` (a sim command, events flushed), `autoplay(on)` (the bot plays through the real loop), `ff(seconds, pred?)` (the bot plays ahead synchronously, until `pred(G)` if given), `step(inp, n)`, `save()`, `hasSave()`, `probe()` (draws a frame and returns the mean and spread of a grid of its pixels). `&fast=N` runs N× the simulation per frame and does nothing without `debug=1`; `&q=low|medium|high` picks the graphics quality.
