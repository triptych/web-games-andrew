# HAYATE RIVER STRIKE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-152/dev/simtest.mjs` | Headless, in Node (~35 s). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: steering, banks, throttle, fuel and depots, the empty tank, the jump (mines, booms, bullets), charges, guns, combo, missiles, telegraphs, lasers, every pickup and boost, bridges, the landing shockwave and barrage, bosses and their phases, the dock and the last boss; no boss part hidden behind a shielded core. **skills**: prices, order, refunds, respec, every node changes a stat. **river**: 60 seeds × 3 sectors, channels ≥ 7.2 m, both arenas, spawns on the right ground. **determinism**: same seed → same game; save round trips mid-run and mid-boss. **bot**: whole runs at skill 1 / 0.6 / 0.3 with no skills, ~200 cores of skills and the full tree, per-step invariants, the balance table and asserted bands. `ONLY=purity,rules,skills,river,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-152/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, Space on the focused button, real keys steer, fire, jump and missile, pause freezes the sim, M mutes, audio decodes and sounds, Save & Quit → Continue, the dock, a skill bought by mouse, the skill sheet's foot, Launch, the run ending, Run Again; the frame isn't blank. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, the deck, auto-fire, stick, JUMP, MSL, controls ≥ 44 px, on screen and uncovered, gauges clear of the buttons, the skill sheet from pause. **nostorage**. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-152/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-152/dev/shot.mjs models [view=side]` | Screenshots [models.html](models.html): every model in the game's toon shading with an arrow pointing downriver, to set `yaw` in `js/view/models.js`. |
| `node game-152/dev/preview.mjs` | Writes `garden/img/games/game-152.jpg` (a SOUEN fight). |
| `python3 -I game-152/dev/art/export.py RAW art REF` | Cuts the ElevenLabs sheets into Meshy references, UI cut-outs, portraits and the title. See [art/README.md](art/README.md). |
| `node game-152/dev/meshy/pipeline.mjs WORK jobs.json` | Meshy image-to-3D for the references. See [meshy/README.md](meshy/README.md). |
| `python3 -I game-152/dev/audio/process.py RAW audio` | Encodes the ElevenLabs music, effects and voices. See [audio/README.md](audio/README.md). |

The browser scripts need `playwright` and a static server on port 8152:

```bash
python3 -m http.server 8152          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-152/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root);
the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with
`&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the
screenshots.

## Debug hooks (`?debug=1`)

`window.__hrs`: `G`, `mode` (`title | play | dock | over`), `meta` (cores, ranks, records), `seen` (a count of every
sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, sector, ranks)`, `autoplay(on)` (the bot plays the
real game), `ff(seconds)` (run the sim ahead with the bot; stops at the dock), `launch()` (leave the dock), `save()`,
`hasSave()`, `give(cores)`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
