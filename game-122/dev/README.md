# Wrack & Wonder — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-122/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock; the bot's file never mentions the hidden laws. **laws**: 60 seeds each make a complete, consistent rule set, all different, and a glyph from one life looks different in the next. **gates**: on foot with no magic the islet, the fen, the moor plateau, the moat's far side and the castle can't be reached (a flood fill with the mover's own slope and water rules); each gate opens its way. **rules**: grammar (order, feeding, shapes, doubling, discord, unweaving, power and waxing), every puzzle's reactions, the instruments and the notebook, survival, saving. **determinism**: same seed and bot → same game; a save round trip plays on identically. **bot**: the researching bot frees Elowen on `SEEDS` seeds (default 6) and prints the table. `ONLY=purity,laws,gates,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-122/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title, the new-island sheet (name and seed), real keys walk, E gathers, Escape pauses and the sim stops, the desk gives the Focus and opens the journal, the lintel copies six marks, the alembic sheet distils, the book writes a spell with its own controls, F casts the first spell, the Marks grid takes a pencil mark, Save & Quit → Continue, the bot plays to the ending, Return to Title. Unique ids. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the deck shows, the stick walks, the look pad turns, Use gathers, Cast casts, the book opens and closes, ❚❚ pauses and stays open after the lift, controls ≥ 44 px and on screen. **nostorage**: plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/bt-*.png`. |
| `node game-122/dev/shots.mjs` | A tour of the island in 16 screenshots (beach, dusk, the hut inside and out, the circle, the wood, the mere, the fen, the gorge, the moor, the castle, night, the courtyard, the keep, the gallery): `dev/shots/tour-*.png`. `ONLY=hut-in,castle`, `Q='&seed=9'`. |
| `node game-122/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-122/dev/preview.mjs` | The 1200×630 preview for the Garden: `garden/img/games/game-122.jpg`. |
| `game-122/dev/gallery.html` | Nib, Elowen and a shade on a neutral background, turning, to judge the models without bloom or night. |

The browser scripts need `playwright` and a static server on port 8122:

```bash
python3 -m http.server 8122          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-122/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a frame or two a second here, the browser test opens the game with `&fast=4&q=low` and waits on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## URL parameters

`?debug=1` exposes `window.__ww`; `&fast=N` runs N× the simulation per frame (debug only); `&q=high|medium|low` overrides the graphics setting.

## Debug hooks (`?debug=1`)

`window.__ww`: `G` (the game), `mode`, `focus` (what "use" would act on), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `book`, `start(seed, name)` (skips the title), `act(cmd)` (any sim command, as the UI sends them), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `put(x, z, yaw, pitch)` (teleport), `save()`, `hasSave()`.
