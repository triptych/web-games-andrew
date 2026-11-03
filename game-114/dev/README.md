# LAST COLONIST — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-114/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **levels**: every chunk is rectangular, enters and leaves on the floor with headroom; every sector on `3 × SEEDS` seeds has exactly its pods, its exit or arena, pods, pickups and ground enemies standing on something, and builds deterministically. **rules**: running, the jump and the jump cut, a tap shorter than a step, crouching and aiming, platforms and dropping through, walls, acid, pits, all four weapons, the lance piercing, flares (and their burst wiping out shots), pods, pickups, checkpoints, dying and respawning, game over and continue, the exit, enemies waking and attacking, and each of the four bosses locking its arena and falling. **determinism**: same seed and inputs → same game; a save round trip mid-sector plays on identically. **reach**: an invulnerable bot crosses all eight sectors and beats every boss on `SEEDS` seeds, which proves every generated level can be crossed with the real body mover. **bot**: mortal bots at skill 1 and 0.6 play the whole campaign with continues; prints the balance table. `ONLY=purity,levels,rules,determinism,reach,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-114/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the title with the bot playing behind it, New Game → story → briefing by real keys (Space and Enter on focused buttons), real keys run, jump, fire and throw a flare, Escape pauses and the sim stops, Space resumes, ❚❚ → Save & Quit → Continue, the exit door → the tally → the next briefing, Game Over → Continue, the Queen falling → the ending → the title. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck, the stick runs, JUMP and FIRE, controls ≥ 44 px and on screen, the HUD clear of the ← Games link, pause stays open after the finger lifts. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-114/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. E.g. `"__lc.start(5, 3); __lc.ff(10); __lc.autoplay(true)"`. |
| `node game-114/dev/shot.mjs [page] [name] [w h]` | Screenshots a dev page; by default [gallery.html](gallery.html), every sprite at 3× plus the colour, emissive and normal atlases. |
| `node game-114/dev/preview.mjs` | Sets up a fight with the debug hooks and writes the 1200×630 Garden preview to `garden/img/games/game-114.jpg`. |

The browser scripts need `playwright` and a static server on port 8114:

```bash
python3 -m http.server 8114          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-114/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__lc`: `G` (the game), `mode` (title, story, brief, play, clear, over, won), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, level, opts)` (skips the title, story and briefing), `newCampaign(seed)`, `autoplay(on, skill)` (the bot plays the real game), `god(on)` (no damage), `ff(seconds, skill)` (run the sim ahead with the bot), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
