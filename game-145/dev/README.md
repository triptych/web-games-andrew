# VACANCY — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-145/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/` (data included), `js/rng.js`, `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: walking and running, walls, doorways and their frames, a boarded building (no tool, then the crowbar), stairs up and down (and the top of a run is a wall from below), falling through a hole, reading a diary (the compass moves on), taking a tool once, vending machines, the breaker, dials, conduits out of order and in order, the master switch, the ending. **determinism**: same seed → same city; same inputs → same game; interiors are the same in any build order; a save round trip plays on identically; an unknown save version is refused. **city**: over `CITY_SEEDS` (6) cities, every floor tile of every building is reachable from a door, every door opens onto the street network, every needed building type exists. **story**: over `SEEDS` (30) seeds the whole chain is walked with the real A* and only the tools found so far, through the gate, Hall C, the breaker and the console; the clues carry all seven pieces; seeds differ. **bot**: the bot plays the whole game on `BOT_SEEDS` (6) seeds with per-step invariants and prints minutes and kilometres. `ONLY=purity,rules,determinism,city,story,bot`, `VERBOSE=1`. About two minutes. |
| `node game-145/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader), picture quality Low (`Q=medium` to change). **desktop**: title and back link, New Journey, all seven Meshy vehicles load and stand in the streets, the waking card, real keys walk and turn, F, J, M, Escape, pause stops the sim, E reads a diary, Save & Quit → Continue, the bot to the ending, A new journey, a typed seed. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the stick walks, the right half looks, USE reads a diary and the reader's button is on screen, controls ≥ 44 px, on screen and on top, no sideways scroll, the canvas matches the viewport. **nostorage**: plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-145/dev/tour.mjs [seed] [names]` | Photographs places in one city at 1280×720: `home`, `street`, `mall`, `mall2`, `backrooms`, `hospital`, `factory`, `hall`, `hotel`, `garage`. `Q=high` for shadows; `W`/`H` for size. → `dev/shots/tour-<name>.png`. |
| `node game-145/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-145/dev/gallery.mjs [top]` | Screenshots `dev/models.html`: every Meshy vehicle as the game fits it, from the side (or above), with a 1.8 m figure for scale. |
| `node game-145/dev/meshy/pipeline.mjs WORKDIR` | Regenerates the vehicles with Meshy. See [meshy/README.md](meshy/README.md). |
| `python3 -I game-145/dev/art/export.py RAW` | Rebuilds `art/` from the raw fal renders. See [art/README.md](art/README.md). |

The browser scripts need `playwright` and a static server on port 8145:

```bash
python3 -m http.server 8145          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-145/dev/node_modules
```

SwiftShader draws a few frames a second, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__va`: `G`, `mode`, `seen` (a count of every sim event), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title and the waking), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `vehicles` (the Meshy models: `loaded`, `failed`), `tp(id)` (stand by a thing, or by the compass's target), `look(pitch)`, `save()`, `hasSave()`, `objective()`. URL: `&fast=N` runs N× the simulation per frame; `&q=low|medium|high` forces the picture; `&seed=N` starts that city.
