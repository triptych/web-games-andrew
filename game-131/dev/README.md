# Fray & the Spiral Isle — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-131/dev/simtest.mjs` | Headless, in Node (about a minute). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every map and thing is well formed, every tunnel solvable, every line the sim can ask for exists, and the Tuning Verse and Weather Rhyme describe the chime order the sim wants. **rules**: walking, walls, the healing, a tunnel end to end, offerings, chimes, pedestals, portals, small things, the ending. **gates**: each gem is necessary and sufficient (the highlands cannot be walked to; doors hold until their flag; portals refuse without their gem). **scatter**: 50 seeds, every small thing reachable. **determinism**: same seed and inputs → same game; save round trips, one with Fray in a tunnel. **bot**: the story bot finishes on `SEEDS` seeds with per-step invariants; a completionist bot reads all 39 inscriptions and earns all 8 keepsakes. `ONLY=purity,data,rules,gates,scatter,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-131/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader), about four minutes. **desktop**: title and back link, cards closed with E and a click, W/→/mouse drag, a real E reads an inscription, journal tabs, pause freezes the sim, Settings on top of Pause and Escape with a slider focused, Space on a focused button, Fray guided through the root-way with real arrows and Space, Save & Quit → Continue, the bot plays to the ending in the page, the picture is not blank, models loaded, sound came out. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps, the touch deck, stick and look drag, ✋, the tunnel panel's buttons, controls ≥ 44 px, no sideways scroll, canvas = viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-131/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `python3 -I game-131/dev/art/export.py RAW` | Rebuilds `art/` from the fal originals. See [art/README.md](art/README.md). |
| `python3 -I game-131/dev/audio/process.py RAW` | Rebuilds `audio/` and `js/audio-files.js` from the ElevenLabs originals; `node game-131/dev/audio/check.mjs` checks each cut voice line's length against its text. See [audio/README.md](audio/README.md). |
| `node opt.mjs in.glb out.glb 1024` (in a scratch folder) | Shrinks a Meshy GLB. See [assets/README.md](assets/README.md). |

The browser scripts need `playwright` and a static server on port 8131:

```bash
python3 -m http.server 8131          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-131/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a few frames a second, so the tests open the game with `&fast=4&q=low` and wait on state, never on the clock. Passing tests don't mean the screen shows anything pleasant: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__si`: `G`, `mode`, `seen` (a count of every sim event drained), `view` (`view.info` has triangles and model load counts, `view.screenOf(x, y, z)`), `ui`, `audio` (`level()`, `musicPlaying`), `input`, `nextGoal()`, `start(seed)`, `autoplay(on, explore)`, `ff(seconds, explore)` (run the sim ahead with the bot), `skipCards()`, `goto(thingId, back)` (stand beside a thing, facing it), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; `&q=low` draws less; `&models=0` keeps the code-built shapes.
