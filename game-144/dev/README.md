# NEBULA REQUIEM — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-144/dev/simtest.mjs` | Headless, in Node (about a minute). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, three.js, storage, `Math.random` or the clock. **rules**: movement and focus, each pilot's gun, power levels, kills and chains, every power-up, every synergy (and that three of them change play), bombs, warp, shields and deaths, graze, each Burst, shield bearers, extends, enemy fire and the point-blank rule, capital-ship walls and engines, each boss through all its phases, phase time-outs, the Bellwether's armoured core, the Choirmaster's weakening. **story**: each pilot's plan names only real scenes and speakers, and the god-mode bot plays every pilot's whole story through six stages and six bosses to their own ending; continues. **media**: every portrait, cutscene, backdrop, boss card, music track and voice line is on disk. **generation**: 60 mothership corridors never narrower than `MIN_GAP` and passable past every pillar. **determinism**: same seed and inputs → same game; save round trips mid-stage and mid-boss play on identically. **endless**: waves escalate, bosses every 8 waves, the run ends in a final score. **bot**: every pilot at skills 1, 0.6 and 0.3 with per-step invariants, the balance table, asserted bands. `ONLY=…`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-144/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, Story → pilot and difficulty select → the opening cutscene (art, portrait, voiced text; Enter advances, Escape skips), radio chatter, real keys move/focus/bomb/burst/warp, the frame is not blank, pause freezes the sim, Space on Resume, a boss WARNING, the pilot's words and the boss bar, Save & Quit → Continue, sound out of the meter, music playing, effects decoded, game over → continue → give up → results → title. **survival**: reaches wave 2. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus and scenes, the deck, controls ≥ 44 px, the whole field on screen, the stick, BOMB, ❚❚ and Resume. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,survival,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-144/dev/tour.mjs` | Photographs every stage and boss in one browser session (`dev/shots/tour-*.png`). `ONLY=boss3,stage6`, `WAIT=ms`, `W=390 H=844 TOUCH=1`. |
| `node game-144/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-144/dev/art/prompts.mjs` | Every fal request, built from the data tables (see `dev/art/README.md`). |
| `node game-144/dev/audio/voices.mjs` | The ElevenLabs voice takes, built from the story script (see `dev/audio/README.md`). |

The browser scripts need `playwright` and a static server on port 8144:

```bash
python3 -m http.server 8144          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-144/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Overlays timed in real seconds (banners, WARNING) can stay on a screenshot after `ff()` jumps the sim ahead; that is the harness, not the game. Passing tests don't mean the screen looks right: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__nr`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, { pilot, mode, diff, stage })` (skips the title and the scenes), `autoplay(on, skill)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `god(on)`, `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame and `&q=low` forces low graphics; both need `debug=1` except `q`.
