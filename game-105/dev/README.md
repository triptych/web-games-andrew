# SOLDER & RAIN — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-105/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **generator**: every device kind at every tier it can appear in, over `SEEDS` seeds: valid, fits the bench, no overlapping footprints, every fault has its spare, deterministic, unique cable tags. **rules / parts / tools**: covering, lifting, screws and tool reach, smart and manual tools, rust and oil, snapping, wrong-spec parts, spares and refunds, the scrap bin, soldering heat and burns, the meter finding hidden faults, scrubbing needing movement. **solve**: the bot repairs every generated job through the real commands and passes the power test. **determinism**: same seed, same job; a save round trip mid-repair plays on identically. **story**: every scene, speaker, choice, clue and day references something real; the bot plays the whole campaign to all three endings and finds every clue. **hints**: the planner's next step is always physically possible. `ONLY=purity,generator,rules,rules2,tools,solve,determinism,story,hints`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-105/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, the story with real key presses, the shop and case board, the work order, a real mouse holding the driver on a screw until it is in the dish, sliding over the rest of the cover's screws with the button held, tap-to-carry and tap-to-put-down, orbit and zoom, the spares drawer, tool keys, pause freezing the sim, Save & Quit → Continue restoring the bench, Hint, the bot finishing the job, the result card and the customer's reply. **free**: Free Bench from the title. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the story, controls ≥ 44 px, on screen and not overlapping, a held touch turns a screw, pinch zooms, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,free,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-105/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. e.g. `play.mjs opened "__sr.free('cyberarm', 4, 3); __sr.goals(14)" 2500` shows a half-disassembled arm. |

The browser scripts need `playwright` and a static server on port 8105:

```bash
python3 -m http.server 8105          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-105/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` (and `&q=low`, no post-processing) and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__sr`: `G` (the game), `mode` (the phase), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `act(cmd)` (any sim command), `free(kind, tier, seed)` (straight to the bench), `campaign(seed)`, `solve(opt)` (the bot repairs the current job, instantly), `goals(n)` (run n bot goals and stop), `playAll(opt)` (the whole campaign), `autoplay(on)` (the bot plays the real game frame by frame), `nextGoal()` (what the hint would say), `project(ref)` (a ref's position on screen), `pick(x, y)`, `save()`, `hasSave()`, `toTitle()`. `&fast=N` runs N× the simulation per frame and `&q=low|med|high` picks the graphics tier; neither does anything without `debug=1` (`q` works always).

Refs name what is under the pointer: `part:p3`, `hole:s2.0`, `plug:w1.0`, `wire:w1`, `joint:p4.1`, `cut:w1`, `stash:t0`.
